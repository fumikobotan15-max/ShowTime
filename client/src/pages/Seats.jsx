import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, inr, fmtTime, fmtDate } from '../api';
import { Navbar, Steps } from '../components/Common';

const getCategorySegments = cells => {
  const segments = [];
  cells.forEach((cell, index) => {
    if (cell.type !== 'seat') return;
    const previous = segments[segments.length - 1];
    if (previous && previous.end === index && previous.categoryName === cell.categoryName && previous.price === cell.price) {
      previous.end++;
    } else {
      segments.push({ start: index, end: index + 1, categoryName: cell.categoryName, price: cell.price });
    }
  });
  return segments;
};

const getSingleCategory = cells => {
  const categories = new Map(cells
    .filter(cell => cell.type === 'seat')
    .map(cell => [`${cell.categoryName}|${cell.price}`, { categoryName: cell.categoryName, price: cell.price }]));
  return categories.size === 1 ? categories.values().next().value : null;
};

const groupSeatRows = rows => rows.reduce((groups, row) => {
  const cells = Array.isArray(row.cells) ? row.cells : [];
  const category = getSingleCategory(cells);
  const previous = groups[groups.length - 1];
  if (category && previous?.category
    && category.categoryName === previous.category.categoryName
    && category.price === previous.category.price) {
    previous.rows.push(row);
  } else {
    groups.push({ category, rows: [row] });
  }
  return groups;
}, []);

export default function Seats() {
  const { id } = useParams();
  const nav = useNavigate();
  const [show, setShow] = useState(null), [cfg, setCfg] = useState(null), [selectedSeats, setSelectedSeats] = useState([]), [err, setErr] = useState('');
  const dragSelecting = useRef(false);
  const dragStartSeat = useRef(null);
  const dragMoved = useRef(false);
  useEffect(() => {
    api('/shows/' + id).then(setShow).catch(e => setErr(e.message));
    api('/payments/config').then(setCfg).catch(e => setErr(e.message));
  }, [id]);
  useEffect(() => {
    const stopDrag = () => {
      dragSelecting.current = false;
      dragStartSeat.current = null;
    };
    const cancelDrag = () => {
      stopDrag();
      dragMoved.current = false;
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('blur', cancelDrag);
    return () => {
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('blur', cancelDrag);
    };
  }, []);
  if (err && (!show || !cfg)) return <><Navbar /><p className="error page" role="alert">{err}</p></>;
  if (!show || !cfg) return <div className="center muted loading-state">Loading seats...</div>;

  const seatLayout = Array.isArray(show.seatLayout) ? show.seatLayout : [];
  const seatGroups = groupSeatRows(seatLayout);
  const tickets = selectedSeats.reduce((total, seat) => total + seat.price, 0);
  const fee = selectedSeats.length * cfg.fee;
  const bookedSeats = show.bookedSeats || [];
  const toggle = seat => {
    if (bookedSeats.includes(seat.id)) return;
    setErr('');
    setSelectedSeats(current => current.some(selected => selected.id === seat.id)
      ? current.filter(selected => selected.id !== seat.id)
      : [...current, seat]);
  };
  const selectSeat = seat => {
    if (bookedSeats.includes(seat.id)) return;
    setErr('');
    setSelectedSeats(current => current.some(selected => selected.id === seat.id) ? current : [...current, seat]);
  };
  const beginDragSelection = (event, seat) => {
    if (event.button !== 0) return;
    dragMoved.current = false;
    dragSelecting.current = true;
    dragStartSeat.current = seat;
  };
  const continueDragSelection = seat => {
    if (!dragSelecting.current || !dragStartSeat.current || dragStartSeat.current.id === seat.id) return;
    dragMoved.current = true;
    selectSeat(dragStartSeat.current);
    selectSeat(seat);
  };
  const handleSeatClick = (event, seat) => {
    if (event.detail === 0) {
      dragMoved.current = false;
      return toggle(seat);
    }
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    toggle(seat);
  };
  const go = () => {
    sessionStorage.setItem('st_checkout', JSON.stringify({ showId: id, seats: selectedSeats.map(seat => seat.id) }));
    nav('/checkout');
  };

  return (
    <>
      <Navbar />
      <main className="page seatpage" data-reveal>
        <section data-reveal>
          <Steps current={2} />
          <h2>{show.movie.title}</h2>
          <p className="muted">{show.theatre.name} &middot; {show.screen} &middot; {fmtDate(show.date)}, {fmtTime(show.time)}</p>
          <div className="screen"><span>All eyes this way</span></div>
          <div className="legend">
            <span><i className="seat" /> Available</span><span><i className="seat sel" /> Selected</span><span><i className="seat taken" /> Taken</span>
          </div>
          {!seatLayout.length
            ? <p className="error" role="alert">Seat layout is unavailable for this screen.</p>
            : <div className="seat-layout">
                <p className="seat-drag-hint muted">Click and drag across seats to select multiple.</p>
                {seatGroups.map(group => (
                  <div className="seat-tier-group" key={group.category
                    ? `${group.category.categoryName}-${group.category.price}-${group.rows[0].label}`
                    : group.rows[0].label}>
                    {group.category && <h3 className="seat-tier-title">{group.category.categoryName} &middot; {inr(group.category.price)}</h3>}
                    {group.rows.map(row => {
                      const cells = Array.isArray(row.cells) ? row.cells : [];
                      const seatRow = group.category ? 1 : 2;
                      const gridClass = `seatrow-grid${group.category ? ' compact' : ''}`;
                  return (
                    <div className="seatrow" key={row.label}>
                      <div className={gridClass} style={{ gridTemplateColumns: `18px repeat(${cells.length}, 30px)` }}>
                        <b className="seatrow-label" style={{ gridColumn: 1, gridRow: seatRow }}>{row.label}</b>
                        {!group.category && getCategorySegments(cells).map(segment => (
                          <span
                            className="seat-category-label"
                            key={`${segment.start}-${segment.end}-${segment.categoryName}`}
                            style={{ gridColumn: `${segment.start + 2} / span ${segment.end - segment.start}`, gridRow: 1 }}
                          >
                            {segment.categoryName} &middot; {inr(segment.price)}
                          </span>
                        ))}
                        {cells.map((cell, index) => {
                          const gridPosition = { gridColumn: index + 2, gridRow: seatRow };
                          if (cell.type !== 'seat') {
                            return <div key={`${cell.type}-${index}`} className="seat seat-placeholder" style={gridPosition} aria-hidden="true" />;
                          }
                          const seatId = `${row.label}${cell.number}`;
                          const seat = { ...cell, id: seatId, row: row.label };
                          const taken = bookedSeats.includes(seatId), selected = selectedSeats.some(item => item.id === seatId);
                          return (
                            <button
                              key={seatId}
                              type="button"
                              aria-label={`Seat ${seatId}, ${cell.categoryName}, ${inr(cell.price)}`}
                              aria-pressed={selected}
                              disabled={taken}
                              className={`seat${taken ? ' taken' : ''}${selected ? ' sel' : ''}`}
                              style={gridPosition}
                              onPointerDown={event => beginDragSelection(event, seat)}
                              onPointerEnter={() => continueDragSelection(seat)}
                              onClick={event => handleSeatClick(event, seat)}
                            >
                              {cell.number}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                    })}
                  </div>
                ))}
              </div>}
        </section>
        <aside className="summary" data-reveal>
          <h3>Booking summary</h3>
          {err && <p className="error" role="alert">{err}</p>}
          {!selectedSeats.length ? <p className="muted">Pick your seats to see the price.</p> : (
            <>
              <ul className="lines">{selectedSeats.map(seat => <li key={seat.id}><span>Seat {seat.id} · {seat.categoryName}</span><span>{inr(seat.price)}</span></li>)}</ul>
              <div className="line"><span>Tickets ({selectedSeats.length})</span><span>{inr(tickets)}</span></div>
              <div className="line"><span>Convenience fee</span><span>{inr(fee)}</span></div>
              <div className="line total"><span>Total</span><span>{inr(tickets + fee)}</span></div>
            </>
          )}
          <button className="btn accent block" disabled={!selectedSeats.length || !seatLayout.length} onClick={go}>Proceed to checkout</button>
        </aside>
      </main>
    </>
  );
}
