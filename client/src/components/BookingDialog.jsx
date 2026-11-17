import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function BookingDialog({ movie, onClose, onContinue }) {
  const languages = Array.from(new Set([...(movie.languages || []), movie.language]
    .filter(language => typeof language === 'string' && language.trim() && !/^\+\d+$/.test(language))));
  const formatsForLanguage = language => {
    const languageFormats = movie.languageFormats?.find(entry => entry.language === language)?.formats;
    return (languageFormats?.length ? languageFormats : movie.formats || [])
      .filter(format => format && format !== 'Not specified');
  };
  const [selectedLanguage, setSelectedLanguage] = useState(languages.includes(movie.language) ? movie.language : languages[0] || '');
  const [selectedFormats, setSelectedFormats] = useState([]);
  const closeButton = useRef(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const toggleFormat = (language, format) => {
    if (language !== selectedLanguage) {
      setSelectedLanguage(language);
      setSelectedFormats([format]);
      return;
    }
    setSelectedFormats(current => current.includes(format)
      ? current.filter(value => value !== format)
      : [...current, format]);
  };

  const toggleAll = language => {
    const formats = formatsForLanguage(language);
    if (language === selectedLanguage && selectedFormats.length === formats.length) {
      setSelectedFormats([]);
      return;
    }
    setSelectedLanguage(language);
    setSelectedFormats(formats);
  };

  return createPortal(
    <div className="booking-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title">
        <header className="booking-dialog-header">
          <div>
            <span>{movie.title}</span>
            <h2 id="booking-dialog-title">Select language and format</h2>
          </div>
          <button ref={closeButton} className="booking-dialog-close" type="button" onClick={onClose} aria-label="Close language and format selection">×</button>
        </header>
        <div className="booking-dialog-options">
          {languages.map(language => {
            const formats = formatsForLanguage(language);
            const allSelected = selectedLanguage === language && selectedFormats.length === formats.length;
            return (
              <section className="booking-language" key={language} aria-label={`${language} formats`}>
                <h3>{language}</h3>
                <div className="booking-format-list">
                  {formats.map(format => (
                    <button
                      key={`${language}-${format}`}
                      type="button"
                      className={`booking-format${selectedLanguage === language && selectedFormats.includes(format) ? ' selected' : ''}`}
                      aria-pressed={selectedLanguage === language && selectedFormats.includes(format)}
                      onClick={() => toggleFormat(language, format)}
                    >
                      {format}
                    </button>
                  ))}
                  {formats.length > 1 && (
                    <button
                      type="button"
                      className={`booking-format booking-select-all${allSelected ? ' selected' : ''}`}
                      aria-pressed={allSelected}
                      onClick={() => toggleAll(language)}
                    >
                      Select all
                    </button>
                  )}
                </div>
              </section>
            );
          })}
          {!languages.length && <p className="muted booking-empty">No languages are listed for this movie.</p>}
          {!movie.formats?.length && <p className="muted booking-empty">No formats are listed for this movie.</p>}
        </div>
        <footer className="booking-dialog-footer">
          <button
            type="button"
            className="btn accent booking-continue"
            disabled={!selectedLanguage || !selectedFormats.length}
            onClick={() => onContinue({ language: selectedLanguage, formats: selectedFormats })}
          >
            View showtimes
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
