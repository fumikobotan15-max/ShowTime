import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, dateKey, fmtTime } from '../api';
import { Navbar } from '../components/Common';

const movieLanguages = movie => Array.from(new Set([...(movie?.languages || []), movie?.language]
  .filter(language => typeof language === 'string' && language.trim() && !/^\+\d+$/.test(language))));
const specialFormatOptions = ['Dolby', 'Dolby Atmos', 'Laser', '4K', 'Insignia', 'P [XL]', 'Luxe'];
const timePeriods = [
  { value: 'morning', label: 'Morning', hours: '12:00 AM - 11:59 AM', start: 0, end: 12, icon: '☼' },
  { value: 'afternoon', label: 'Afternoon', hours: '12:00 PM - 3:59 PM', start: 12, end: 16, icon: '☀' },
  { value: 'evening', label: 'Evening', hours: '4:00 PM - 6:59 PM', start: 16, end: 19, icon: '☁' },
  { value: 'night', label: 'Night', hours: '7:00 PM - 11:59 PM', start: 19, end: 24, icon: '☾' }
];
const facilityOptions = [
  {
    label: 'Ticket Cancellation',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M16 5v14M7 8l6 8M13 8l-6 8" />
    </svg>
  },
  {
    label: 'F&B',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8h12l-1 12H6L5 8ZM8 8V6a3 3 0 0 1 6 0v2M18 11h3v6h-3M18 19h3" />
    </svg>
  },
  {
    label: 'MTicket',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M8 15V9l2 2 2-2v6M15 10h2M15 13h2" />
    </svg>
  },
  {
    label: 'Parking Facility',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="8" r="5" />
      <path d="M7 11V5h2a2 2 0 0 1 0 4H7M3 19h18l-1-5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2l-3 5ZM3 19v2M21 19v2M7 16h.01M17 16h.01" />
    </svg>
  },
  {
    label: 'Food Court',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3v6M8 3v6M5 6h3M6.5 9v12M14 3v18M14 3c3 2 4 5 4 9h-4" />
    </svg>
  }
];

export default function Shows() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const requestedLanguage = searchParams.get('language') || '';
  const requestedFormats = (searchParams.get('format') || '').split(',').filter(Boolean);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() + index);
    return day;
  }), []);
  const [date, setDate] = useState(dateKey(days[0]));
  const [movie, setMovie] = useState(null);
  const [movieError, setMovieError] = useState('');
  const [shows, setShows] = useState([]);
  const [showsError, setShowsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(null);
  const [pref, setPref] = useState(() => {
    try { return JSON.parse(localStorage.getItem('st_prefs') || '{}').theatre; } catch { return undefined; }
  });
  const [selectedLanguage, setSelectedLanguage] = useState(requestedLanguage);
  const [selectedFormats, setSelectedFormats] = useState(requestedFormats);
  const [priceRange, setPriceRange] = useState('all');
  const [selectedSpecialFormats, setSelectedSpecialFormats] = useState([]);
  const [cancellableOnly, setCancellableOnly] = useState(false);
  const [selectedTimePeriods, setSelectedTimePeriods] = useState([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [openFilter, setOpenFilter] = useState('');
  const [theatreSearch, setTheatreSearch] = useState('');
  const [selectedTheatre, setSelectedTheatre] = useState(null);
  const [favoriteTheatres, setFavoriteTheatres] = useState([]);
  const filtersRef = useRef(null);

  useEffect(() => {
    setSelectedLanguage(requestedLanguage);
    setSelectedFormats(requestedFormats);
  }, [id, requestedLanguage, searchParams.get('format')]);

  useEffect(() => {
    if (!openFilter) return undefined;
    const closeOnOutsideClick = event => {
      if (!filtersRef.current?.contains(event.target)) setOpenFilter('');
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [openFilter]);

  useEffect(() => {
    if (!selectedTheatre) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = event => {
      if (event.key === 'Escape') setSelectedTheatre(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedTheatre]);

  useEffect(() => {
    api('/preferences').then(preferences => setPref(preferences?.theatre)).catch(() => {});
    api('/payments/config').then(setPricing).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setMovieError('');
    api('/movies/' + id)
      .then(result => { if (active) setMovie(result); })
      .catch(error => { if (active) setMovieError(error.message); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setShowsError('');
    const query = new URLSearchParams({ movie: id, date });
    api(`/shows?${query}`)
      .then(result => { if (active) setShows(result); })
      .catch(error => { if (active) { setShows([]); setShowsError(error.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, date]);

  const languages = movieLanguages(movie);
  const formatsForLanguage = language => {
    const localFormats = movie?.languageFormats?.find(entry => entry.language === language)?.formats;
    return localFormats?.length ? localFormats : movie?.formats || [];
  };
  const selectedFilterValue = !selectedLanguage
    ? 'all'
    : selectedFormats.length === 0 || selectedFormats.length === formatsForLanguage(selectedLanguage).length
      ? `${selectedLanguage}::all`
      : selectedFormats.length === 1
        ? `${selectedLanguage}::${selectedFormats[0]}`
        : `${selectedLanguage}::selected`;
  const pricePoints = [...new Set((pricing?.tiers || []).map(tier => tier.price).filter(Number.isFinite))].sort((a, b) => a - b);
  const middlePrice = pricePoints[1] ?? pricePoints[0] ?? 0;
  const highPrice = pricePoints[2] ?? pricePoints[pricePoints.length - 1] ?? middlePrice;
  const now = new Date();
  const showMatchesFilters = show => {
    if (selectedLanguage && show.language !== selectedLanguage) return false;
    if (selectedFormats.length && !selectedFormats.includes(show.format)) return false;
    if (selectedSpecialFormats.length) {
      const amenities = (show.theatre?.amenities || []).map(amenity => amenity.toLowerCase().replace(/[\s()[\]]/g, ''));
      const matchesAll = selectedSpecialFormats.every(format => {
        const searchTerm = format.toLowerCase().replace(/[\s()[\]]/g, '');
        return amenities.some(amenity => amenity.includes(searchTerm));
      });
      if (!matchesAll) return false;
    }
    if (cancellableOnly && new Date(show.startsAt).getTime() - now.getTime() < 2 * 60 * 60 * 1000) return false;
    if (theatreSearch && !`${show.theatre.name} ${show.theatre.address}`.toLowerCase().includes(theatreSearch.toLowerCase())) return false;
    if (priceRange !== 'all' && pricePoints.length) {
      const fitsPrice = pricePoints.some(price => {
        if (priceRange === 'budget') return price < middlePrice;
        if (priceRange === 'mid') return price >= middlePrice && price < highPrice;
        return price >= highPrice;
      });
      if (!fitsPrice) return false;
    }
    return true;
  };
  const matchingShows = shows.filter(showMatchesFilters);
  const getTimePeriod = show => {
    const hour = Number(show.time.split(':')[0]);
    return timePeriods.find(period => hour >= period.start && hour < period.end)?.value;
  };
  const availableTimePeriods = new Set(matchingShows
    .filter(show => new Date(show.startsAt) >= now)
    .map(getTimePeriod));
  const filteredShows = matchingShows
    .filter(show => !selectedTimePeriods.length || selectedTimePeriods.includes(getTimePeriod(show)))
    .sort((a, b) => {
      if (sortBy === 'popularity') {
        const popularityDifference = (b.theatre.rating || 0) - (a.theatre.rating || 0);
        if (popularityDifference) return popularityDifference;
      }
      const preferredDifference = Number(b.theatre.chain === pref) - Number(a.theatre.chain === pref);
      return preferredDifference || new Date(a.startsAt) - new Date(b.startsAt);
    });

  const theatresById = new Map();
  filteredShows.forEach(show => {
    if (!show.theatre) return;
    const theatreId = show.theatre._id;
    if (!theatresById.has(theatreId)) theatresById.set(theatreId, { theatre: show.theatre, groups: new Map() });
    const theatre = theatresById.get(theatreId);
    const language = show.language || movie?.language || '';
    if (!theatre.groups.has(language)) theatre.groups.set(language, { language, shows: [] });
    theatre.groups.get(language).shows.push(show);
  });
  const theatreGroups = [...theatresById.values()].sort((a, b) => {
    if (sortBy === 'popularity') return (b.theatre.rating || 0) - (a.theatre.rating || 0) || a.theatre.name.localeCompare(b.theatre.name);
    return Number(b.theatre.chain === pref) - Number(a.theatre.chain === pref) || a.theatre.name.localeCompare(b.theatre.name);
  });

  const handleLanguageFormatChange = event => {
    const [language, format] = event.target.value.split('::');
    if (event.target.value === 'all') {
      setSelectedLanguage('');
      setSelectedFormats([]);
      return;
    }
    setSelectedLanguage(language);
    if (format === 'all') setSelectedFormats([]);
    else if (format !== 'selected') setSelectedFormats([format]);
  };
  const theatreAddress = selectedTheatre?.address || selectedTheatre?.area || '';
  const theatreMapQuery = selectedTheatre ? `${selectedTheatre.name}, ${theatreAddress || 'Bengaluru'}` : '';
  const selectedIsFavorite = selectedTheatre && favoriteTheatres.includes(String(selectedTheatre._id));

  return (
    <>
      <Navbar />
      <main className="shows-page">
        <header className="shows-movie-header">
          <div className="shows-inner">
            <div className="shows-movie-details">
              {movieError
                ? <p className="error" role="alert">{movieError}</p>
                : <h1>{movie?.title || 'Loading movie…'}{selectedLanguage && ` - (${selectedLanguage})`}</h1>}
              {movie && (
                <>
                  <div className="shows-movie-meta">
                    {movie.duration && movie.duration !== 'Not specified' && <span>Movie runtime: {movie.duration}</span>}
                    {movie.certification && movie.certification !== 'Not specified' && <span>{movie.certification}</span>}
                    {movie.genre.map(genre => <span key={genre}>{genre}</span>)}
                  </div>
                  {movieError && <p className="muted small">Movie details could not be loaded.</p>}
                </>
              )}
            </div>
            <label className="shows-search-controls">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
              <input
                className="shows-theatre-search"
                type="search"
                aria-label="Search theatres by name or area"
                placeholder="Search theatre by name"
                value={theatreSearch}
                onChange={event => setTheatreSearch(event.target.value)}
              />
            </label>
          </div>
        </header>

        <section className="shows-toolbar" aria-label="Showtime date and filters">
          <div className="shows-inner shows-toolbar-inner">
            <div className="shows-dates" aria-label="Choose a date">
              {days.map(day => {
                const key = dateKey(day);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`shows-date${key === date ? ' active' : ''}`}
                    aria-pressed={key === date}
                    onClick={() => setDate(key)}
                  >
                    <span>{day.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                    <strong>{day.getDate()}</strong>
                    <span>{day.toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </button>
                );
              })}
            </div>

            <div className="shows-filters" ref={filtersRef}>
              <label className="shows-filter">
                <span className="visually-hidden">Language and format</span>
                <select aria-label="Language and format" value={selectedFilterValue} onChange={handleLanguageFormatChange}>
                  <option value="all">All Languages - All</option>
                  {languages.map(language => {
                    const formats = formatsForLanguage(language);
                    return (
                      <optgroup label={language} key={language}>
                        <option value={`${language}::all`}>{language} - All</option>
                        {formats.map(format => <option value={`${language}::${format}`} key={format}>{language} - {format}</option>)}
                      </optgroup>
                    );
                  })}
                  {selectedFilterValue.endsWith('::selected') && (
                    <option value={selectedFilterValue}>{selectedLanguage} - {selectedFormats.join(', ')}</option>
                  )}
                </select>
              </label>
              <label className="shows-filter">
                <span className="visually-hidden">Price range</span>
                <select aria-label="Price range" value={priceRange} onChange={event => setPriceRange(event.target.value)}>
                  <option value="all">Price Range: All</option>
                  {pricePoints.length > 1 && <option value="budget">Under ₹{middlePrice}</option>}
                  {pricePoints.length > 2 && <option value="mid">₹{middlePrice}–₹{highPrice - 1}</option>}
                  {pricePoints.length > 1 && <option value="premium">₹{highPrice}+</option>}
                </select>
              </label>
              <div className="shows-dropdown">
                <button
                  type="button"
                  className="shows-dropdown-toggle"
                  aria-expanded={openFilter === 'special'}
                  aria-haspopup="true"
                  onClick={() => setOpenFilter(current => current === 'special' ? '' : 'special')}
                >
                  <span>Special Formats{selectedSpecialFormats.length ? ` (${selectedSpecialFormats.length})` : ''}</span>
                  <span className={`shows-chevron${openFilter === 'special' ? ' open' : ''}`} aria-hidden="true">⌄</span>
                </button>
                {openFilter === 'special' && (
                  <div className="shows-dropdown-menu shows-checkbox-menu" role="group" aria-label="Special formats">
                    {specialFormatOptions.map(format => (
                      <label className="shows-check-row" key={format}>
                        <span>{format}</span>
                        <input
                          type="checkbox"
                          checked={selectedSpecialFormats.includes(format)}
                          onChange={() => setSelectedSpecialFormats(current => current.includes(format)
                            ? current.filter(value => value !== format)
                            : [...current, format])}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="shows-dropdown">
                <button
                  type="button"
                  className="shows-dropdown-toggle"
                  aria-expanded={openFilter === 'other'}
                  aria-haspopup="true"
                  onClick={() => setOpenFilter(current => current === 'other' ? '' : 'other')}
                >
                  <span>Other Filters{cancellableOnly ? ' (1)' : ''}</span>
                  <span className={`shows-chevron${openFilter === 'other' ? ' open' : ''}`} aria-hidden="true">⌄</span>
                </button>
                {openFilter === 'other' && (
                  <div className="shows-dropdown-menu shows-checkbox-menu" role="group" aria-label="Other filters">
                    <label className="shows-check-row">
                      <span>Cancelable</span>
                      <input type="checkbox" checked={cancellableOnly} onChange={event => setCancellableOnly(event.target.checked)} />
                    </label>
                  </div>
                )}
              </div>
              <div className="shows-dropdown shows-time-dropdown">
                <button
                  type="button"
                  className="shows-dropdown-toggle"
                  aria-expanded={openFilter === 'time'}
                  aria-haspopup="true"
                  onClick={() => setOpenFilter(current => current === 'time' ? '' : 'time')}
                >
                  <span>{selectedTimePeriods.length ? selectedTimePeriods.map(value => timePeriods.find(period => period.value === value)?.label).join(', ') : 'Preferred Time'}</span>
                  <span className={`shows-chevron${openFilter === 'time' ? ' open' : ''}`} aria-hidden="true">⌄</span>
                </button>
                {openFilter === 'time' && (
                  <div className="shows-dropdown-menu shows-time-menu" role="group" aria-label="Preferred time">
                    {timePeriods.map(period => {
                      const enabled = availableTimePeriods.has(period.value);
                      return (
                        <label className={`shows-time-row${enabled ? '' : ' disabled'}`} key={period.value}>
                          <span className="shows-time-icon" aria-hidden="true">{period.icon}</span>
                          <span className="shows-time-label"><strong>{period.label}</strong><small>{period.hours}</small></span>
                          <input
                            type="checkbox"
                            checked={selectedTimePeriods.includes(period.value)}
                            disabled={!enabled}
                            onChange={() => setSelectedTimePeriods(current => current.includes(period.value)
                              ? current.filter(value => value !== period.value)
                              : [...current, period.value])}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="shows-dropdown shows-sort-dropdown">
                <button
                  type="button"
                  className="shows-dropdown-toggle"
                  aria-expanded={openFilter === 'sort'}
                  aria-haspopup="true"
                  onClick={() => setOpenFilter(current => current === 'sort' ? '' : 'sort')}
                >
                  <span>Sort By{sortBy !== 'relevance' ? `: ${sortBy === 'popularity' ? 'Popularity' : 'Distance'}` : ''}</span>
                  <span className={`shows-chevron${openFilter === 'sort' ? ' open' : ''}`} aria-hidden="true">⌄</span>
                </button>
                {openFilter === 'sort' && (
                  <div className="shows-dropdown-menu shows-sort-menu" role="radiogroup" aria-label="Sort showtimes">
                    <label className="shows-radio-row">
                      <span><strong>Relevance</strong><small>Best options for you first</small></span>
                      <input type="radio" name="show-sort" checked={sortBy === 'relevance'} onChange={() => setSortBy('relevance')} />
                    </label>
                    <label className="shows-radio-row">
                      <span><strong>Popularity</strong><small>Show most popular first</small></span>
                      <input type="radio" name="show-sort" checked={sortBy === 'popularity'} onChange={() => setSortBy('popularity')} />
                    </label>
                    <label className="shows-radio-row disabled" title="Theatres don't have location coordinates yet">
                      <span><strong>Distance</strong><small>Location data unavailable</small></span>
                      <input type="radio" name="show-sort" checked={sortBy === 'distance'} disabled />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="shows-results">
          <div className="shows-inner">
            <div className="shows-legend">
              <span><i className="show-legend-dot available" /> Available</span>
              <span><i className="show-legend-dot started" /> Started</span>
            </div>
            {loading && <p className="muted loading-state">Loading showtimes...</p>}
            {!loading && showsError && <p className="error" role="alert">{showsError}</p>}
            {!loading && !showsError && !theatreGroups.length && (
              <p className="shows-empty">No showtimes match these filters for this date. Try another date or clear a filter.</p>
            )}
            {!loading && theatreGroups.map(({ theatre, groups }) => {
              const details = [...(theatre.amenities || [])];
              if (theatre.screenCount) details.push(`${theatre.screenCount}${theatre.screenCountIsMinimum ? '+' : ''} screens`);
              return (
                <article className="shows-theatre-card" key={theatre._id}>
                <header className="shows-theatre-header">
                  <span className="shows-theatre-brand" aria-hidden="true">{(theatre.chain || theatre.name).slice(0, 3).toUpperCase()}</span>
                  <div className="shows-theatre-info">
                    <h2>
                      <button type="button" className="shows-theatre-name" aria-haspopup="dialog" onClick={() => setSelectedTheatre(theatre)}>
                        {theatre.name}
                      </button>
                    </h2>
                    <p>{theatre.address}</p>
                    {details.length > 0 && <span className="shows-amenities">{details.join(' · ')}</span>}
                    {theatre.chain === pref && <span className="shows-preferred-badge">Preferred theatre</span>}
                  </div>
                </header>
                <div className="shows-theatre-slots">
                  {[...groups.values()].map(group => (
                    <section className="shows-format-group" key={`${theatre._id}-${group.language}`}>
                      <h3>{group.language}</h3>
                      <div className="shows-time-list">
                        {group.shows.map(show => {
                          const past = new Date(show.startsAt) < now;
                          return past
                            ? <span key={show._id} className="shows-time-slot started" aria-label={`${fmtTime(show.time)}, ${group.language} ${show.format}, show has started`}>
                                <strong>{fmtTime(show.time)}</strong><small>{show.format}</small>
                              </span>
                            : <Link key={show._id} to={`/shows/${show._id}/seats`} className="shows-time-slot" aria-label={`${fmtTime(show.time)}, ${group.language} ${show.format}, ${theatre.name}`}>
                                <strong>{fmtTime(show.time)}</strong><small>{show.format}</small>
                              </Link>;
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                </article>
              );
            })}
          </div>
        </section>
        {selectedTheatre && createPortal(
          <div
            className="theatre-detail-backdrop"
            onMouseDown={event => {
              if (event.target === event.currentTarget) setSelectedTheatre(null);
            }}
          >
            <section className="theatre-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="theatre-detail-title">
              <header className="theatre-detail-header">
                <h2 id="theatre-detail-title">{selectedTheatre.name}</h2>
                <button type="button" className="theatre-detail-close" aria-label="Close theatre details" onClick={() => setSelectedTheatre(null)}>
                  &times;
                </button>
              </header>
              <div className="theatre-detail-map">
                <iframe
                  title={`Map showing ${selectedTheatre.name}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(theatreMapQuery)}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="theatre-detail-address">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <p>{theatreAddress || 'Address unavailable'}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(theatreMapQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${selectedTheatre.name} in Google Maps`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </a>
              </div>
              <button
                type="button"
                className={`theatre-detail-favorite${selectedIsFavorite ? ' active' : ''}`}
                aria-pressed={Boolean(selectedIsFavorite)}
                onClick={() => setFavoriteTheatres(current => selectedIsFavorite
                  ? current.filter(id => id !== String(selectedTheatre._id))
                  : [...current, String(selectedTheatre._id)])}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.8 8.6c0 4.2-8.8 10-8.8 10s-8.8-5.8-8.8-10a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8Z" />
                </svg>
                <span>{selectedIsFavorite ? 'Added to your favorite cinemas' : 'Tap to add to your favorite cinemas'}</span>
              </button>
              <section className="theatre-detail-facilities">
                <h3>Available Facilities</h3>
                <div className="theatre-facility-grid">
                  {facilityOptions.map(({ label, icon }) => (
                    <div className="theatre-facility" key={label}>
                      {icon}
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </div>,
          document.body
        )}
      </main>
    </>
  );
}
