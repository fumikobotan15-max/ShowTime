const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Booking, Screen, Seat } = require('../models');
const { DEFAULT_LAYOUT_CONFIG, generateSeatLayout, getSeatRecords, priceSelection } = require('../services/seatLayout');

test('numbers seats continuously across placeholder cells and keeps mixed row pricing', () => {
  const cells = [
    ...Array.from({ length: 4 }, () => ({ categoryName: 'Classic', price: 250 })),
    'empty_space',
    'aisle',
    'indent',
    ...Array.from({ length: 12 }, () => ({ categoryName: 'Lounger', price: 400 }))
  ];
  const layout = generateSeatLayout([{ label: 'M', cells }]);
  const row = layout[0];
  const seats = row.cells.filter(cell => cell.type === 'seat');
  const records = getSeatRecords('screen-1', layout);

  assert.deepEqual(seats.map(seat => seat.number), Array.from({ length: 16 }, (_, index) => index + 1));
  assert.deepEqual(row.cells.slice(4, 7).map(cell => cell.type), ['empty_space', 'aisle', 'indent']);
  assert.deepEqual(seats.slice(0, 4).map(seat => [seat.categoryName, seat.price]), Array(4).fill(['Classic', 250]));
  assert.deepEqual(seats.slice(4).map(seat => [seat.categoryName, seat.price]), Array(12).fill(['Lounger', 400]));
  assert.equal(records.length, 16);
  assert.equal(records[15].row, 'M');
  assert.equal(records[15].number, 16);
});

test('default configuration includes asymmetrical, indented, and aisle-separated rows', () => {
  const layout = generateSeatLayout(DEFAULT_LAYOUT_CONFIG);
  const mixedRow = layout.find(row => row.label === 'M');
  const seats = mixedRow.cells.filter(cell => cell.type === 'seat');

  assert.equal(seats.length, 16);
  assert.deepEqual(mixedRow.cells.slice(4, 10).map(cell => cell.type), Array(6).fill('empty_space'));
  assert.deepEqual(new Set(seats.map(seat => seat.categoryName)), new Set(['Classic', 'Lounger']));
  assert.ok(layout.some(row => row.cells.some(cell => cell.type === 'aisle')));
  assert.ok(layout.some(row => row.cells.some(cell => cell.type === 'indent')));
});

test('prices a mixed-tier selection from the selected seat records', () => {
  const seatRecords = getSeatRecords('screen-1', generateSeatLayout(DEFAULT_LAYOUT_CONFIG));
  const selection = priceSelection(['M1', 'M5'], seatRecords);

  assert.deepEqual(selection.selectedSeats.map(seat => seat.categoryName), ['Classic', 'Lounger']);
  assert.equal(selection.total, 650);
  assert.equal(priceSelection(['M17'], seatRecords), null);
});

test('rejects seat configuration without a category name and integer price', () => {
  assert.throws(
    () => generateSeatLayout([{ label: 'A', cells: [{ categoryName: 'Classic', price: 150.5 }] }]),
    /category name and non-negative integer price/
  );
});

test('screen and seat schemas accept placeholders and custom priced categories', () => {
  const layout = generateSeatLayout(DEFAULT_LAYOUT_CONFIG);
  const screenId = new mongoose.Types.ObjectId();
  const screen = new Screen({
    theatre: new mongoose.Types.ObjectId(),
    name: 'Screen 1',
    format: 'Multi-format',
    rows: layout.map(row => row.label),
    layout,
    columns: Math.max(...layout.map(row => row.cells.length)),
    totalSeats: getSeatRecords(screenId, layout).length
  });
  const seat = new Seat({ screen: screenId, row: 'M', number: 16, categoryName: 'Lounger', price: 400 });

  assert.equal(screen.validateSync(), undefined);
  assert.equal(seat.validateSync(), undefined);
});

test('booking schema accepts a selection of more than eight seats', () => {
  const booking = new Booking({
    ref: 'ST-TEST1234',
    user: new mongoose.Types.ObjectId(),
    show: new mongoose.Types.ObjectId(),
    seats: Array.from({ length: 10 }, (_, index) => `A${index + 1}`),
    amount: { tickets: 1500, fee: 100, total: 1600 },
    payment: { mode: 'demo', paymentId: 'DEMO-TEST1234' }
  });

  assert.equal(booking.validateSync(), undefined);
});
