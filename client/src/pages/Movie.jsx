import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, dateKey } from '../api';
import { Navbar, Poster } from '../components/Common';
import BookingDialog from '../components/BookingDialog';

const releaseDateLabel = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'long', year: 'numeric'
});

export default function Movie() {
  const { id } = useParams();
  const [m, setM] = useState(null), [err, setErr] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { api('/movies/' + id).then(setM).catch(e => setErr(e.message)); }, [id]);
  if (err) return <><Navbar /><p className="error page">{err}</p></>;
  if (!m) return <div className="center muted loading-state">Loading...</div>;
  const comingSoon = m.releaseDate && m.releaseDate > dateKey(new Date());
  const languages = m.languages?.length ? m.languages : [m.language].filter(Boolean);
  const facts = [m.rating, m.votes, m.duration].filter(value => value && value !== 'Not specified');
  const certificate = m.certification && m.certification !== 'Not specified' ? m.certification : '';
  const formats = m.formats.filter(value => value && value !== 'Not specified');
  const castImages = new Map((m.castImages || []).map(({ name, imageUrl }) => [name, imageUrl]));
  return (
    <>
      <Navbar />
      <main className="page movie-page" data-reveal>
        <Link to="/home" className="movie-back"><span aria-hidden="true">←</span> Browse movies</Link>
        <div className="movie-detail">
          <aside className="movie-poster-shell">
            <Poster movie={m} className="big" />
          </aside>
          <div className="movie-copy">
            <span className="movie-eyebrow">{comingSoon ? 'Coming soon' : 'Now showing'}</span>
          <h1>{m.title}</h1>
            <div className="movie-genres">
              {m.genre.map(genre => <span key={genre}>{genre}</span>)}
              {m.director && <span>Directed by {m.director}</span>}
            </div>
            <div className="movie-facts">
              {facts.map((fact, index) => (
                <span key={`${fact}-${index}`} className={fact === m.rating ? 'movie-fact movie-fact-rating' : 'movie-fact'}>
                  {fact === m.rating && <span aria-hidden="true">★</span>}{fact}
                </span>
              ))}
            </div>
            {m.releaseDate && (
              <p className="movie-release"><span>Release date</span><strong>{releaseDateLabel(m.releaseDate)}</strong></p>
            )}
            {(languages.length > 0 || formats.length > 0 || certificate) && (
              <div className="movie-specs" aria-label="Movie details">
                {languages.length > 0 && <div><span>Languages</span><strong>{languages.join(' · ')}</strong></div>}
                {formats.length > 0 && <div><span>Formats</span><strong>{formats.join(' · ')}</strong></div>}
                {certificate && <div><span>Certificate</span><strong>{certificate}</strong></div>}
              </div>
            )}
            {m.synopsis && (
              <section className="movie-overview">
                <span className="movie-section-label">The story</span>
                <h2>Synopsis</h2>
                <p className="syn">{m.synopsis}</p>
              </section>
            )}
            {m.cast.length > 0 && (
              <section className="movie-cast">
                <span className="movie-section-label">Meet the cast</span>
                <h2>Starring</h2>
                <div className="cast">{m.cast.map(c => (
                  <div key={c} className="castitem">
                    <span className="cast-portrait">
                      <span aria-hidden="true">{c[0]}</span>
                      {castImages.has(c) && <img src={castImages.get(c)} alt={c} onError={event => event.currentTarget.remove()} />}
                    </span>
                    <span>{c}</span>
                  </div>
                ))}</div>
              </section>
            )}
            <div className="movie-booking">
              {comingSoon
                ? <p className="muted">Coming soon. Booking will be available when showtimes are listed.</p>
                : <button type="button" className="btn accent big" onClick={() => setBookingOpen(true)}>Book Tickets</button>}
            </div>
          </div>
        </div>
      </main>
      {bookingOpen && (
        <BookingDialog
          movie={m}
          onClose={() => setBookingOpen(false)}
          onContinue={({ language, formats }) => {
            const query = new URLSearchParams({ language, format: formats.join(',') });
            navigate(`/movie/${m._id}/shows?${query}`);
          }}
        />
      )}
    </>
  );
}
