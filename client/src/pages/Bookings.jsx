import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr, fmtTime, fmtDate } from '../api';
import { Navbar } from '../components/Common';

export default function Bookings() {
  const [list, setList] = useState(null), [err, setErr] = useState('');
  const load = () => api('/bookings/mine').then(setList).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const cancel = async b => {
    if (!confirm('Cancel this booking?')) return;
    try { await api(`/bookings/${b._id}/cancel`, { method: 'POST' }); load(); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <Navbar />
      <main className="page narrow" data-reveal>
        <h1>My bookings</h1>
        {err && <p className="error">{err}</p>}
        {list && !list.length && <p className="muted">No bookings yet. <Link to="/home">Find a movie</Link></p>}
        {list?.map(b => (
          <div key={b._id} className="bk" data-reveal>
            <div>
              <h3>{b.show.movie.title} {b.status === 'cancelled' && <span className="tagpill">Cancelled</span>}</h3>
              <p className="muted small">{b.show.theatre.name} &middot; {fmtDate(b.show.date)}, {fmtTime(b.show.time)}</p>
              <p className="small">Seats {b.seats.join(', ')} &middot; {inr(b.amount.total)} &middot; {b.ref}</p>
            </div>
            <div className="bkactions">
              <Link to={`/ticket/${b._id}`} className="btn ghost">View ticket</Link>
              {b.status === 'confirmed' && new Date(b.show.startsAt) - new Date() > 2 * 3600e3 && <button className="linkbtn" onClick={() => cancel(b)}>Cancel</button>}
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
