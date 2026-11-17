import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';

export const Logo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <path d="M18 7H59V45H32L18 62L39 30C25 28 13 23 7 16C3 11 8 7 18 7Z" fill="#000" />
    <path d="M17 10h4.5v4.5H17zM25 10h4.5v4.5H25zM33 10h4.5v4.5H33zM41 10h4.5v4.5H41zM49 10h4.5v4.5H49z" fill="#fff" />
    <path d="M34 40h4.5v4.5H34zM42 40h4.5v4.5H42zM50 40h4.5v4.5H50z" fill="#fff" />
    <path d="M5 17l2.5 3-1.5 4L4 20zM9 21l4 2.2-1.7 4.2-4-2.2zM15 24.3l4.5 2-2.1 4.2-4.5-2zM22 27.1l4.5 1.4-2.1 4.1-4.5-1.4z" fill="#000" />
  </svg>
);

export function Navbar({ onSearch }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountTriggerRef = useRef(null);
  const accountDropdownRef = useRef(null);
  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!accountOpen) return undefined;

    const closeWhenOutside = event => {
      if (
        !accountTriggerRef.current?.contains(event.target) &&
        !accountDropdownRef.current?.contains(event.target)
      ) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setAccountOpen(false);
    };

    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountOpen]);
  const firstName = user?.name?.split(' ')[0] || 'Account';
  return (
    <header className="nav">
      <Link to="/home" className="brand"><Logo /><span>ShowTime</span></Link>
      {onSearch && (
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input className="search" type="search" aria-label="Search movies" placeholder="Search movies" value={q}
            onChange={e => { setQ(e.target.value); onSearch(e.target.value); }} />
        </div>
      )}
      <button className="navtoggle iconbtn" type="button" aria-label="Toggle navigation menu" aria-expanded={menuOpen} data-tooltip="Menu" onClick={() => setMenuOpen(!menuOpen)}>
        <span /><span /><span />
      </button>
      <nav className={'navlinks' + (menuOpen ? ' open' : '')} aria-label="Primary navigation">
        <NavLink to="/home" className={({ isActive }) => isActive ? 'active' : ''}>Movies</NavLink>
        <NavLink to="/bookings" className={({ isActive }) => isActive ? 'active' : ''}>My bookings</NavLink>
        <NavLink to="/preferences" className={({ isActive }) => isActive ? 'active' : ''}>Preferences</NavLink>
        <div className="account-menu">
          <button ref={accountTriggerRef} className="account-trigger" type="button" aria-expanded={accountOpen} aria-haspopup="menu" data-tooltip="Account menu" onClick={() => setAccountOpen(open => !open)}>
            <span className="avatar mini">
              <span>{firstName[0]}</span>
              {user?.profileImage && <img src={user.profileImage} alt="" onError={event => event.currentTarget.remove()} />}
            </span><span>{firstName}</span><span className="chevron">⌄</span>
          </button>
          {accountOpen && <div ref={accountDropdownRef} className="dropdown open" role="menu">
            <Link to="/bookings" role="menuitem" onClick={() => setAccountOpen(false)}>My bookings</Link>
            <Link to="/preferences" role="menuitem" onClick={() => setAccountOpen(false)}>Update preferences</Link>
            <Link to="/account-settings" role="menuitem" onClick={() => setAccountOpen(false)}>Account settings</Link>
            <button className="dropdown-action" role="menuitem" onClick={() => { setAccountOpen(false); logout(); nav('/login'); }}>Log out</button>
          </div>}
        </div>
      </nav>
    </header>
  );
}

export const Poster = ({ movie, className = '' }) => (
  <div className={'poster ' + className}
    style={movie.posterUrl ? { backgroundImage: `url("${movie.posterUrl}")` } : { background: `linear-gradient(160deg, ${movie.color || '#374151'}, #111827)` }}>
    {!movie.posterUrl && <span>{movie.title}</span>}
  </div>
);

export const Steps = ({ current }) => (
  <ol className="steps">
    {['Showtime', 'Seats', 'Payment'].map((s, i) => (
      <li key={s} className={i + 1 === current ? 'on' : i + 1 < current ? 'done' : ''}>{s}</li>
    ))}
  </ol>
);
