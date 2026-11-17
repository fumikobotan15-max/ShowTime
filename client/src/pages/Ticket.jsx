import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, inr, fmtTime, fmtDate } from '../api';
import { Logo, Navbar } from '../components/Common';

export default function Ticket() {
  const { id } = useParams();
  const [b, setB] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/bookings/' + id).then(setB).catch(e => setErr(e.message)); }, [id]);
  if (err) return <><Navbar /><p className="error page">{err}</p></>;
  if (!b) return <div className="center muted loading-state">Loading ticket...</div>;
  const s = b.show;
  return (
    <>
      <Navbar />
      <main className="page narrow" data-reveal>
        <div className="okbanner">{b.status === 'cancelled' ? 'This booking was cancelled' : 'Booking confirmed'}</div>
        <div className="ticket">
          <div className="tmain">
            <div className="ticket-brand"><Logo size={32} /><span>ShowTime</span></div>
            <h2>{s.movie.title}</h2>
            <p className="muted">{s.format} &middot; {s.language || s.movie.language}</p>
            <dl>
              <div><dt>Date</dt><dd>{fmtDate(s.date)}</dd></div>
              <div><dt>Time</dt><dd>{fmtTime(s.time)}</dd></div>
              <div><dt>Screen</dt><dd>{s.screen}</dd></div>
              <div><dt>Seats</dt><dd>{b.seats.join(', ')}</dd></div>
            </dl>
            <p>{s.theatre.name}<br /><span className="muted small">{s.theatre.address}</span></p>
            <p className="small muted">Booking ref {b.ref} &middot; Paid {inr(b.amount.total)}</p>
          </div>
          <div className="tqr"><QRCodeSVG value={`${b.ref}|${b._id}`} size={140} /><small>{b.ref}</small></div>
        </div>
        <div className="actions ticket-actions"><button className="btn ghost" onClick={() => window.print()}>Print ticket</button><Link to="/bookings" className="btn primary">My bookings</Link></div>
      </main>
    </>
  );
}
