const PLACEHOLDERS = new Set(['aisle', 'empty_space', 'indent']);

const seatBlock = (categoryName, price, count) => Array.from(
  { length: count },
  () => ({ categoryName, price })
);

const standardRow = (label, categoryName, price) => ({
  label,
  cells: [...seatBlock(categoryName, price, 8), 'aisle', ...seatBlock(categoryName, price, 8)]
});

const DEFAULT_LAYOUT_CONFIG = [
  ...['A', 'B', 'C', 'D'].map(label => standardRow(label, 'Classic', 150)),
  ...['E', 'F', 'G', 'H'].map(label => standardRow(label, 'Prime', 250)),
  {
    label: 'I',
    cells: ['indent', 'indent', ...seatBlock('Recliner', 400, 8), 'aisle', ...seatBlock('Recliner', 400, 8)]
  },
  standardRow('J', 'Recliner', 400),
  {
    label: 'M',
    cells: [...seatBlock('Classic', 250, 4), ...Array(6).fill('empty_space'), ...seatBlock('Lounger', 400, 12)]
  }
];

function generateSeatLayout(config) {
  if (!Array.isArray(config) || !config.length) {
    throw new TypeError('Seat layout configuration must contain at least one row');
  }

  const rowLabels = new Set();
  return config.map(row => {
    if (!row || typeof row.label !== 'string' || !/^[A-Z]{1,5}$/.test(row.label) || rowLabels.has(row.label)) {
      throw new TypeError('Seat layout rows must have unique labels of 1 to 5 uppercase letters');
    }
    if (!Array.isArray(row.cells) || !row.cells.length) {
      throw new TypeError(`Seat layout row ${row.label} must contain cells`);
    }
    rowLabels.add(row.label);

    let number = 0;
    const cells = row.cells.map(cell => {
      const type = typeof cell === 'string' ? cell : cell?.type;
      if (PLACEHOLDERS.has(type)) return { type };

      const categoryName = cell?.categoryName;
      const price = cell?.price;
      if (typeof categoryName !== 'string' || !categoryName.trim() || !Number.isSafeInteger(price) || price < 0) {
        throw new TypeError(`Seat layout row ${row.label} has a seat without a category name and non-negative integer price`);
      }

      number++;
      if (number > 100) throw new RangeError(`Seat layout row ${row.label} cannot contain more than 100 seats`);
      return { type: 'seat', number, categoryName: categoryName.trim(), price };
    });

    if (!number) throw new TypeError(`Seat layout row ${row.label} must contain at least one seat`);
    return { label: row.label, cells };
  });
}

function getSeatRecords(screen, layout) {
  return layout.flatMap(row => row.cells
    .filter(cell => cell.type === 'seat')
    .map(cell => ({
      screen,
      row: row.label,
      number: cell.number,
      categoryName: cell.categoryName,
      price: cell.price
    })));
}

function priceSelection(seatIds, seatRecords) {
  const seatById = new Map(seatRecords.map(seat => [`${seat.row}${seat.number}`, seat]));
  const selectedSeats = seatIds.map(seatId => seatById.get(seatId));
  if (selectedSeats.some(seat => !seat)) return null;
  return {
    selectedSeats,
    total: selectedSeats.reduce((total, seat) => total + seat.price, 0)
  };
}

module.exports = { DEFAULT_LAYOUT_CONFIG, generateSeatLayout, getSeatRecords, priceSelection };
