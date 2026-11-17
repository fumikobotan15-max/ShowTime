import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, inr, fmtTime, fmtDate } from '../api';
import { Navbar, Steps } from '../components/Common';

const loadRazorpay = () => new Promise((res, rej) => {
  if (window.Razorpay) return res();
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = res; s.onerror = () => rej(new Error('Could not load Razorpay'));
  document.body.appendChild(s);
});

export default function Checkout() {
  const nav = useNavigate();
  const co = JSON.parse(sessionStorage.getItem('st_checkout') || 'null');
  const [show, setShow] = useState(null), [cfg, setCfg] = useState(null);
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvv: '' });
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [paymentError, setPaymentError] = useState('');
  const pinInputs = useRef([]);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!co) return;
    api('/shows/' + co.showId).then(setShow).catch(e => setErr(e.message));
    api('/payments/config').then(setCfg).catch(() => {});
  }, []);
  useEffect(() => {
    if (!paymentDialogOpen) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !busy) setPaymentDialogOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paymentDialogOpen, busy]);
  if (!co) return <Navigate to="/home" replace />;
  if (!show || !cfg) return <div className="center muted loading-state">Loading...</div>;

  const seatById = new Map((show.seatLayout || []).flatMap(row => row.cells
    .filter(cell => cell.type === 'seat')
    .map(cell => [`${row.label}${cell.number}`, { ...cell, id: `${row.label}${cell.number}`, row: row.label }])));
  const selectedSeats = co.seats.map(seatId => seatById.get(seatId)).filter(Boolean);
  const invalidSelection = selectedSeats.length !== co.seats.length;
  const tickets = selectedSeats.reduce((total, seat) => total + seat.price, 0);
  const fee = co.seats.length * cfg.fee, total = tickets + fee;

  const confirm = async payment => {
    const b = await api('/bookings', { method: 'POST', body: { showId: co.showId, seats: co.seats, payment } });
    sessionStorage.removeItem('st_checkout');
    nav('/ticket/' + b.id, { replace: true });
  };

  const startRazorpay = async o => {
    await loadRazorpay();
    const rz = new window.Razorpay({
      key: o.keyId, amount: o.amount.total * 100, currency: 'INR', order_id: o.orderId, name: 'ShowTime',
      description: `${show.movie.title} - ${co.seats.join(', ')}`,
      handler: async r => { try { await confirm(r); } catch (x) { setErr(x.message); setBusy(false); } },
      modal: { ondismiss: () => setBusy(false) },
      theme: { color: '#e11d48' }
    });
    rz.on('payment.failed', r => { setErr(r.error?.description || 'Payment failed'); setBusy(false); });
    rz.open();
  };

  const openPayment = async e => {
    e.preventDefault(); setErr('');
    if (invalidSelection) return setErr('One or more selected seats are no longer available. Please choose seats again.');
    try {
      if (cfg.mode === 'mock' && selectedMethod === 'card') {
        if (card.number.replace(/\s/g, '').length < 12 || !card.name || !/^\d{2}\s*\/\s*\d{2}$/.test(card.exp) || card.cvv.length < 3) {
          setErr('Enter a card number, name, expiry (MM / YY) and CVV. Any test values work in demo mode.');
          return;
        }
      }
      setBusy(true);
      if (cfg.mode === 'mock') {
        setPin(['', '', '', '']);
        setPaymentError('');
        setPaymentDialogOpen(true);
        setBusy(false);
        return;
      }
      const o = await api('/payments/order', { method: 'POST', body: { showId: co.showId, seats: co.seats } });
      await startRazorpay(o);
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  const submitDemoPayment = async e => {
    e.preventDefault();
    if (pin.join('') !== '1234') {
      setPaymentError(`Incorrect ${selectedMethod === 'card' ? 'OTP' : 'PIN'}. Use 1234 in demo mode.`);
      return;
    }
    setPaymentError('');
    setBusy(true);
    try {
      const o = await api('/payments/order', { method: 'POST', body: { showId: co.showId, seats: co.seats } });
      if (o.mode === 'mock') {
        await confirm({ mode: 'mock', method: selectedMethod });
        return;
      }
      setPaymentDialogOpen(false);
      await startRazorpay(o);
    } catch (x) {
      setPaymentError(x.message);
      setBusy(false);
    }
  };

  const updatePinDigit = (index, value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4 - index).split('');
    setPin(current => current.map((item, i) => i >= index && i < index + digits.length ? digits[i - index] : i === index ? '' : item));
    setPaymentError('');
    const nextIndex = index + digits.length;
    if (digits.length && nextIndex < pinInputs.current.length) pinInputs.current[nextIndex]?.focus();
  };

  const handlePinKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !pin[index] && index > 0) pinInputs.current[index - 1]?.focus();
  };

  const choosePaymentMethod = method => {
    setSelectedMethod(method);
    setErr('');
  };

  return (
    <>
      <Navbar />
      <main className="page seatpage" data-reveal>
        <section data-reveal>
          <Steps current={3} />
          <h2>Checkout</h2>
          <form onSubmit={openPayment} className="paybox">
            <h3>Payment method</h3>
            <p className="payment-methods-title">Choose a payment method</p>
            <ul className="payment-methods" aria-label="Payment methods">
              <li><button type="button" className={`payment-method${selectedMethod === 'google-pay' ? ' selected' : ''}`} aria-pressed={selectedMethod === 'google-pay'} onClick={() => choosePaymentMethod('google-pay')}><img src="/payments/googlepay-mark.jpg" alt="" /><span>Google Pay</span></button></li>
              <li><button type="button" className={`payment-method${selectedMethod === 'phonepe' ? ' selected' : ''}`} aria-pressed={selectedMethod === 'phonepe'} onClick={() => choosePaymentMethod('phonepe')}><img src="/payments/phonepe.svg" alt="" /><span>PhonePe</span></button></li>
              <li><button type="button" className={`payment-method${selectedMethod === 'paytm' ? ' selected' : ''}`} aria-pressed={selectedMethod === 'paytm'} onClick={() => choosePaymentMethod('paytm')}><img src="/payments/paytm.svg" alt="" /><span>Paytm</span></button></li>
              <li><button type="button" className={`payment-method${selectedMethod === 'card' ? ' selected' : ''}`} aria-pressed={selectedMethod === 'card'} onClick={() => choosePaymentMethod('card')}><span className="payment-card-mark" aria-hidden="true">CARD</span><span>Credit / Debit</span></button></li>
            </ul>
            {cfg.mode === 'mock' ? (
              <>
                <p className="notice">Demo mode: no real money is charged. Add Razorpay keys in <code>server/config/keys.js</code> to take real payments.</p>
                {selectedMethod === 'card' && (
                  <>
                    <p className="payment-card-title">Pay with credit or debit card</p>
                    <label>Card number<input inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.number} onChange={e => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '') })} /></label>
                    <label>Cardholder name<input value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} /></label>
                    <div className="row2">
                      <label>Expires<input placeholder="MM / YY" value={card.exp} onChange={e => setCard({ ...card, exp: e.target.value })} /></label>
                      <label>CVV<input inputMode="numeric" maxLength={4} value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} /></label>
                    </div>
                  </>
                )}
              </>
            ) : <p className="notice">You will pay securely with Razorpay (UPI, cards, netbanking, wallets).</p>}
            {err && <p className="error" role="alert">{err}</p>}
            <button className="btn accent block" disabled={busy || invalidSelection}>{busy ? 'Processing...' : `Pay ${inr(total)}`}</button>
          </form>
        </section>
        <aside className="summary" data-reveal>
          <h3>{show.movie.title}</h3>
          <p className="muted small">{show.theatre.name}<br />{show.screen} &middot; {show.format} &middot; {show.language || show.movie.language}<br />{fmtDate(show.date)}, {fmtTime(show.time)}</p>
          <div className="line"><span>Seats</span><span>{co.seats.join(', ')}</span></div>
          <ul className="lines">{selectedSeats.map(seat => <li key={seat.id}><span>{seat.categoryName}</span><span>{inr(seat.price)}</span></li>)}</ul>
          <div className="line"><span>Tickets ({co.seats.length})</span><span>{inr(tickets)}</span></div>
          <div className="line"><span>Convenience fee</span><span>{inr(fee)}</span></div>
          <div className="line total"><span>Total due</span><span>{inr(total)}</span></div>
          {invalidSelection && (
            <button type="button" className="btn ghost block" onClick={() => nav(`/shows/${co.showId}/seats`)}>
              Choose seats again
            </button>
          )}
        </aside>
      </main>
      {paymentDialogOpen && (
        <div className="payment-dialog-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !busy) setPaymentDialogOpen(false);
        }}>
          <form className="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-amount" onSubmit={submitDemoPayment}>
            <button type="button" className="payment-dialog-close" aria-label="Close payment dialog" onClick={() => setPaymentDialogOpen(false)} disabled={busy}>×</button>
            <h2 id="payment-dialog-amount">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(total)}</h2>
            <p className="payment-dialog-prompt">Enter your {selectedMethod === 'card' ? 'OTP' : 'PIN'}</p>
            <div className="payment-pin-inputs">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={element => { pinInputs.current[index] = element; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={event => updatePinDigit(index, event.target.value)}
                  onKeyDown={event => handlePinKeyDown(index, event)}
                  aria-label={`${selectedMethod === 'card' ? 'OTP' : 'PIN'} digit ${index + 1}`}
                  autoComplete="one-time-code"
                  autoFocus={index === 0}
                  required
                />
              ))}
            </div>
            <p className="payment-dialog-hint">Demo {selectedMethod === 'card' ? 'OTP' : 'PIN'}: 1234</p>
            {paymentError && <p className="error payment-dialog-error" role="alert">{paymentError}</p>}
            <button className="btn accent block payment-dialog-pay" disabled={busy || pin.join('').length !== 4}>
              {busy ? 'Processing...' : 'Pay'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
