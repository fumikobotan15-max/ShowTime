const router = require('express').Router();
const crypto = require('crypto');
const { Show, Seat, Booking } = require('../models');
const auth = require('../middleware/auth');
const K = require('../config/keys');
const { DEFAULT_LAYOUT_CONFIG, generateSeatLayout, getSeatRecords, priceSelection } = require('../services/seatLayout');

const razorOn = () => !!(K.RAZORPAY_KEY_ID && K.RAZORPAY_KEY_SECRET);
const rzClient = () => { const R = require('razorpay'); return new R({ key_id: K.RAZORPAY_KEY_ID, key_secret: K.RAZORPAY_KEY_SECRET }); };

async function validate(showId, seats) {
  if (!Array.isArray(seats) || !seats.length) throw { code: 400, message: 'Select at least one seat' };
  const uniq = [...new Set(seats)];
  const parsedSeats = uniq.map(seat => typeof seat === 'string' && seat.match(/^([A-Z]{1,5})([1-9]\d{0,2})$/));
  if (uniq.length !== seats.length || parsedSeats.some(seat => !seat || Number(seat[2]) > 100)) {
    throw { code: 400, message: 'Invalid seat selection' };
  }
  const show = await Show.findById(showId).populate('screenRef').catch(() => null);
  if (!show) throw { code: 404, message: 'Show not found' };
  if (show.startsAt < new Date()) throw { code: 400, message: 'This show has already started' };
  if (seats.some(s => show.bookedSeats.includes(s))) throw { code: 409, message: 'Some seats were just taken. Please choose others.' };

  const requestedCoordinates = parsedSeats.map(seat => ({ row: seat[1], number: Number(seat[2]) }));
  let seatRecords;
  if (show.screenRef?._id) {
    const layoutSeats = getSeatRecords(show.screenRef._id, show.screenRef.layout || []);
    const layoutSeatById = new Map(layoutSeats.map(seat => [`${seat.row}${seat.number}`, seat]));
    seatRecords = await Seat.find({
      screen: show.screenRef._id,
      isActive: true,
      $or: requestedCoordinates
    }).select('row number categoryName price').lean();
    seatRecords = seatRecords.filter(seat => {
      const configuredSeat = layoutSeatById.get(`${seat.row}${seat.number}`);
      return configuredSeat
        && configuredSeat.categoryName === seat.categoryName
        && configuredSeat.price === seat.price;
    });
  } else {
    seatRecords = getSeatRecords(null, generateSeatLayout(DEFAULT_LAYOUT_CONFIG));
  }
  const selection = priceSelection(seats, seatRecords);
  if (!selection) throw { code: 400, message: 'One or more selected seats are not available in this layout' };

  const tickets = selection.total;
  const fee = seats.length * K.CONVENIENCE_FEE_PER_TICKET;
  return { show, seats, amount: { tickets, fee, total: tickets + fee } };
}
const fail = (res, e) => res.status(e.code || 500).json({ message: e.message || 'Something went wrong' });

router.get('/payments/config', (_, res) => res.json({ mode: razorOn() ? 'razorpay' : 'mock', fee: K.CONVENIENCE_FEE_PER_TICKET }));

router.post('/payments/order', auth, async (req, res) => {
  try {
    const v = await validate(req.body.showId, req.body.seats);
    if (!razorOn()) return res.json({ mode: 'mock', amount: v.amount });
    const order = await rzClient().orders.create({ amount: v.amount.total * 100, currency: 'INR', receipt: 'st_' + Date.now() });
    res.json({ mode: 'razorpay', orderId: order.id, keyId: K.RAZORPAY_KEY_ID, amount: v.amount });
  } catch (e) { fail(res, e); }
});

router.post('/bookings', auth, async (req, res) => {
  try {
    const { showId, seats, payment = {} } = req.body;
    const v = await validate(showId, seats);
    let paymentId;
    if (razorOn()) {
      const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: s } = payment;
      const expected = crypto.createHmac('sha256', K.RAZORPAY_KEY_SECRET).update(o + '|' + p).digest('hex');
      if (!o || !p || expected !== s) throw { code: 400, message: 'Payment verification failed' };
      const order = await rzClient().orders.fetch(o);
      if (order.amount !== v.amount.total * 100) throw { code: 400, message: 'Payment amount mismatch' };
      paymentId = p;
    } else {
      paymentId = 'DEMO-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    // Atomic: only succeeds if none of the seats are booked yet
    const r = await Show.updateOne({ _id: showId, bookedSeats: { $nin: v.seats } }, { $push: { bookedSeats: { $each: v.seats } } });
    if (!r.modifiedCount) throw { code: 409, message: 'Some seats were just taken. Please choose others.' };
    const b = await Booking.create({
      ref: 'ST-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      user: req.userId, show: showId, seats: v.seats, amount: v.amount,
      payment: { mode: razorOn() ? 'razorpay' : 'demo', paymentId }
    });
    res.status(201).json({ id: b._id, ref: b.ref });
  } catch (e) { fail(res, e); }
});

const populate = q => q.populate({ path: 'show', populate: [{ path: 'movie' }, { path: 'theatre' }] });
router.get('/bookings/mine', auth, async (req, res) =>
  res.json(await populate(Booking.find({ user: req.userId }).sort({ createdAt: -1 }))));

router.get('/bookings/:id', auth, async (req, res) => {
  const b = await populate(Booking.findOne({ _id: req.params.id, user: req.userId })).catch(() => null);
  b ? res.json(b) : res.status(404).json({ message: 'Booking not found' });
});

router.post('/bookings/:id/cancel', auth, async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.id, user: req.userId }).populate('show').catch(() => null);
  if (!b || b.status !== 'confirmed') return res.status(404).json({ message: 'Booking not found' });
  if (b.show.startsAt - new Date() < 2 * 3600 * 1000) return res.status(400).json({ message: 'Cancellation closes 2 hours before showtime' });
  await Show.updateOne({ _id: b.show._id }, { $pullAll: { bookedSeats: b.seats } });
  b.status = 'cancelled'; await b.save();
  res.json({ ok: true });
});

module.exports = router;
