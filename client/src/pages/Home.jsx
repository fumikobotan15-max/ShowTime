import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, dateKey } from '../api';
import { Navbar, Poster } from '../components/Common';
import BookingDialog from '../components/BookingDialog';

const Card = ({ m, rank, showRating = false }) => {
  const hasNumericRating = /^\d+(?:\.\d+)?\/10$/.test(m.rating || '');
  return (
    <Link
      to={`/movie/${m._id}`}
      className="card"
      data-reveal
      aria-label={rank ? `${m.title}, rank ${rank} in Top 5 movies` : undefined}
    >
      <div className="card-poster-wrap">
      <Poster movie={m} />
      {rank && <span className="card-rank" aria-hidden="true">{rank}</span>}
        {showRating && hasNumericRating && (
          <span className="card-rating" aria-label={`${m.rating} rating`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z" /></svg>
            {m.rating}
          </span>
        )}
      </div>
      <h4>{m.title}</h4>
    </Link>
  );
};

const SectionHeading = ({ eyebrow, title }) => (
  <div className="section-heading" data-reveal>
    <span className="section-eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
  </div>
);

const MovieShelf = ({ eyebrow, title, movies, ranked = false, showRating = false, description }) => {
  const trackRef = useRef(null);
  const scroll = direction => {
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: direction * trackRef.current.clientWidth * 0.8, behavior: 'smooth' });
    }
  };
  return (
    <section className={`movie-section${ranked ? ' movie-section-ranked' : ''}`}>
      <div className="movie-section-heading">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="shelf-controls">
          <button type="button" aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)}>‹</button>
          <button type="button" aria-label={`Scroll ${title} right`} onClick={() => scroll(1)}>›</button>
        </div>
      </div>
      {description && <p className="movie-section-description">{description}</p>}
      <div className="movie-shelf" ref={trackRef} aria-label={title}>
        {movies.map((movie, index) => (
          <Card key={movie._id} m={movie} rank={ranked ? index + 1 : undefined} showRating={showRating} />
        ))}
      </div>
    </section>
  );
};

const footerSections = [
  {
    title: 'CINEMA EXPERIENCES',
    items: ['IMAX 70mm & Laser', 'Dolby Cinema Experience', '4DX Motion Auditoriums', 'ScreenX 270-Degree Panorama', 'VIP Dine-In Lounges']
  },
  {
    title: 'GUEST SERVICES',
    items: ['My CineTickets & QR Wallet', 'Refund & Seat Exchange Policy', 'Gift Cards & Corporate Vouchers', 'Assistive Audio & Sensory Screenings', 'Lost and Found']
  },
  {
    title: 'LEGAL & CORPORATE',
    items: ['Terms of Booking', 'Privacy Statement', 'Cookie Preferences', 'Press Room & Box Office Data', 'Cinema Theatre Franchise Enquiries']
  }
];

const normalizeValues = value => {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  return list.map(v => String(v).trim()).filter(Boolean);
};

export default function Home() {
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('st_prefs') || '{}'); } catch { return {}; }
  });
  const [prefsReady, setPrefsReady] = useState(false);
  const [all, setAll] = useState([]), [picks, setPicks] = useState([]), [theatres, setTheatres] = useState([]);
  const [q, setQ] = useState(''), [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false), [searchError, setSearchError] = useState('');
  const [err, setErr] = useState('');
  const [bookingMovie, setBookingMovie] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    api('/preferences').then(p => { setPrefs(p || {}); localStorage.setItem('st_prefs', JSON.stringify(p || {})); }).catch(() => {}).finally(() => setPrefsReady(true));
  }, []);
  useEffect(() => {
    if (!prefsReady) return;
    api('/movies').then(setAll).catch(e => setErr(e.message));
    api('/theatres').then(setTheatres).catch(() => {});
    const p = new URLSearchParams();
    for (const language of normalizeValues(prefs.language)) {
      if (language !== 'Other') p.append('language', language);
    }
    for (const actor of normalizeValues(prefs.actor)) {
      p.append('actor', actor);
    }
    if ([...p].length) api('/movies?' + p).then(setPicks).catch(() => {});
  }, [prefsReady, prefs.language, prefs.actor]);
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      return;
    }

    let active = true;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      api('/movies?' + new URLSearchParams({ q: query }))
        .then(results => { if (active) setSearchResults(results); })
        .catch(error => { if (active) setSearchError(error.message); })
        .finally(() => { if (active) setSearchLoading(false); });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);
  const handleSearch = value => {
    setQ(value);
    setSearchResults([]);
    setSearchError('');
  };
  const today = dateKey(new Date());
  const comingSoon = all.filter(movie => movie.releaseDate && movie.releaseDate > today);
  const nowShowing = all.filter(movie => !movie.releaseDate || movie.releaseDate <= today);
  const shown = q ? searchResults : nowShowing;
  const hero = nowShowing[0];
  const topMovies = all.slice(0, 5)
    .map(movie => movie.title === 'Brindavihari' ? all.find(candidate => candidate.title === 'Ghost Soldier') : movie)
    .filter(Boolean);
  return (
    <>
      <Navbar onSearch={handleSearch} />
      <main className="page home-page">
        {err && <p className="error">{err}</p>}
        {searchError && <p className="error" role="alert">{searchError}</p>}
        {hero && !q && (
          <section className="hero" data-reveal style={{
            backgroundColor: '#111827',
            backgroundImage: hero.backdropUrl
              ? `linear-gradient(110deg, rgba(17,24,39,.88), rgba(17,24,39,.3)), url("${hero.backdropUrl}")`
              : `linear-gradient(110deg, ${hero.color}, #111827)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>
            <div className="hero-content">
              <span className="hero-eyebrow"><span aria-hidden="true" /> Featured movie</span>
              <h1>{hero.title}</h1>
              <div className="hero-meta">
                {hero.rating && hero.rating !== 'Not specified' && <span className="hero-rating"><span aria-hidden="true">★</span>{hero.rating}</span>}
                {hero.duration && hero.duration !== 'Not specified' && <span>{hero.duration}</span>}
                {hero.genre.length > 0 && <span>{hero.genre.join(' · ')}</span>}
              </div>
              <p className="hero-syn">{hero.synopsis}</p>
              <div className="hero-actions">
                <button type="button" className="btn accent" onClick={() => setBookingMovie(hero)}>Book tickets</button>
                <Link to={`/movie/${hero._id}`} className="btn glass">Explore movie</Link>
              </div>
            </div>
          </section>
        )}
        {!q && picks.length > 0 && <MovieShelf eyebrow="Curated for you" title="Picked for you" movies={picks} />}
        {q
          ? <><SectionHeading eyebrow="Search the collection" title={`Results for "${q}"`} /><div className="grid">{shown.map(m => <Card key={m._id} m={m} />)}</div></>
          : <MovieShelf eyebrow="On the big screen" title="Now showing" movies={nowShowing} showRating />}
        {q && searchLoading && <p className="muted">Searching TMDb...</p>}
        {!shown.length && !searchLoading && !searchError && <p className="muted">No movies match your search.</p>}
        {!q && <>
          <MovieShelf eyebrow="Audience favorites" title="Top 5 movies" movies={topMovies} ranked showRating />
        </>}
        {!q && comingSoon.length > 0 && <>
          <MovieShelf eyebrow="Plan ahead" title="Coming soon" movies={comingSoon} description="Pre-booking information will appear when showtimes are available." />
        </>}
        {!q && <>
          <SectionHeading eyebrow="Your neighborhood" title="Theatres near you" />
          <div className="theatres">{theatres.map(t => {
            const details = [...(t.amenities || [])];
            if (t.screenCount) details.push(`${t.screenCount}${t.screenCountIsMinimum ? '+' : ''} screens`);
            return (
              <div key={t._id} className="tcard" data-reveal>
                <h4>{t.name}</h4>
                <p className="muted">{t.area}</p>
                {details.length > 0 && <p className="small">{details.join(' | ')}</p>}
                {Number.isFinite(t.rating) && <p className="small muted">Rating: {t.rating}/5</p>}
              </div>
            );
          })}</div>
        </>}
        <p className="small muted">This product uses the <a href="https://www.themoviedb.org/">TMDB API</a> but is not endorsed or certified by TMDB.</p>
      </main>
      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-top">
            <div className="home-footer-socials" aria-label="Social media">
              <span role="img" aria-label="Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 8H16V4.5h-3c-3.3 0-5.5 2-5.5 5.2V12H5v3.5h2.5V22h4v-6.5H15l.5-3.5h-4V9.8c0-1.1.4-1.8 2-1.8Z" /></svg>
              </span>
              <span role="img" aria-label="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.8" r="1" fill="currentColor" /></svg>
              </span>
              <span role="img" aria-label="X">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.8 5.7 22H2.5l7.3-8.5L1.8 2h6.5l4.5 6.7L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" /></svg>
              </span>
              <span role="img" aria-label="YouTube">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.9a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9ZM9.7 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
              </span>
            </div>
            <div className="home-footer-support">
              <span>Questions or Booking Support?</span>
              <a href="tel:+180053412200">1-800-5341-2200</a>
            </div>
          </div>
          <div className="home-footer-columns">
            {footerSections.map(section => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>
              </section>
            ))}
          </div>
          <div className="home-footer-bottom">
            <div className="home-footer-locale">
              <svg className="home-footer-globe" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span>English (US)</span>
              <span>Selected Location: Bangalore</span>
            </div>
            <p className="home-footer-copyright">© 2024 CINEFLIX Theatres International LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
      {bookingMovie && (
        <BookingDialog
          movie={bookingMovie}
          onClose={() => setBookingMovie(null)}
          onContinue={({ language, formats }) => {
            const query = new URLSearchParams({ language, format: formats.join(',') });
            navigate(`/movie/${bookingMovie._id}/shows?${query}`);
          }}
        />
      )}
    </>
  );
}
