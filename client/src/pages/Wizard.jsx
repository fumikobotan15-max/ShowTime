import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const base = [
  { key: 'language', title: 'Your Language, Your Movies', subtitle: 'Discover cinema in the languages you enjoy.', options: ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Other'] },
  { key: 'theatre', title: 'Your Perfect Movie Destination', subtitle: 'Choose the theatres where you love the big-screen experience.', options: ['PVR Cinemas', 'INOX', 'Cinepolis', 'Miraj Cinemas', 'MGM Cinemas', 'Asian Cinemas', 'Other'] },
  { key: 'actor', title: 'Pick Your Screen Icons', subtitle: 'Tell us which stars make you excited for a movie.', options: ['Shah Rukh Khan', 'Prabhas', 'Yash', 'Allu Arjun', 'Vijay', 'Deepika Padukone', 'Mahesh Babu', 'Ram Charan', 'N. T. Rama Rao Jr.', 'Salman Khan', 'Other'] }
];
const preferenceKeys = base.map(({ key }) => key);
const actorPortraits = {
  'Shah Rukh Khan': '/actors/shah-rukh-khan.jpg',
  Prabhas: '/actors/prabhas.jpg',
  Yash: '/actors/yash.jpg',
  'Allu Arjun': '/actors/allu-arjun.jpg',
  Vijay: '/actors/vijay.jpg',
  'Deepika Padukone': '/actors/deepika-padukone.jpg',
  'Mahesh Babu': '/actors/mahesh-babu.jpg',
  'Ram Charan': '/actors/ram-charan.jpg',
  'N. T. Rama Rao Jr.': '/actors/ntr.jpg',
  'Salman Khan': '/actors/salman-khan.jpg'
};
const actorPortraitPositions = {
  'Shah Rukh Khan': '50% 8%',
  Prabhas: '50% 0%',
  Yash: '50% 0%',
  'Allu Arjun': '50% 0%',
  Vijay: '50% 7%',
  'Deepika Padukone': '50% 0%',
  'Mahesh Babu': '50% 0%',
  'Ram Charan': '50% 5%',
  'N. T. Rama Rao Jr.': '50% 8%',
  'Salman Khan': '50% 0%'
};
const normalizeValues = value => {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  return list.map(v => String(v).trim()).filter(Boolean);
};
const allowedPreferences = preferences => Object.fromEntries(
  preferenceKeys
    .filter(key => normalizeValues(preferences?.[key]).length)
    .map(key => [key, normalizeValues(preferences[key])])
);

function ActorPortrait({ name, src }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

  return failed
    ? <span className="actor-avatar-fallback" aria-hidden="true">{initials}</span>
    : (
      <span className="actor-avatar-frame" aria-hidden="true">
        <img
          className="actor-avatar"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ objectPosition: actorPortraitPositions[name] }}
        />
      </span>
    );
}

export default function Wizard() {
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [prefs, setPrefs] = useState({});
  const [theatres, setTheatres] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/preferences')
      .then(p => setPrefs(allowedPreferences(p || {})))
      .catch(() => {
        try { setPrefs(allowedPreferences(JSON.parse(localStorage.getItem('st_prefs') || '{}'))); } catch { setPrefs({}); }
      });
    api('/theatres').then(t => setTheatres([...new Set(t.map(x => x.chain))])).catch(() => {});
  }, []);
  const step = base[i];
  const options = step.key === 'theatre'
    ? [...new Map(
      [...step.options.filter(option => option !== 'Other'), ...(theatres || [])]
        .map(option => [option.toLocaleLowerCase(), option])
    ).values(), 'Other']
    : step.options;
  const selected = normalizeValues(prefs[step.key]);
  const pick = option => setPrefs(prev => {
    const current = normalizeValues(prev[step.key]);
    const next = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    const nextPrefs = { ...prev };
    if (next.length) nextPrefs[step.key] = next; else delete nextPrefs[step.key];
    return nextPrefs;
  });
  const finish = async () => {
    setError('');
    try {
      await api('/preferences', { method: 'PUT', body: prefs });
      localStorage.setItem('st_prefs', JSON.stringify(prefs));
      nav('/home');
    } catch (e) { setError(e.message); }
  };
  const next = () => (i === base.length - 1 ? finish() : setI(i + 1));
  const pct = Math.round(((i + 1) / base.length) * 100);
  return (
    <div className="wizard">
      <div className="bar"><div style={{ width: pct + '%' }} /></div>
      <p className="stepno">Step {i + 1} of {base.length} ({pct}%)</p>
      <div className="wizbody" data-reveal>
        <h1>{step.title}</h1>
        <p className="muted">{step.subtitle}</p>
        <div className="chips">
          {options.map(o => {
            const portrait = step.key === 'actor' ? actorPortraits[o] : null;
            return (
              <button
                key={o}
                className={'chip' + (portrait ? ' actor-chip' : '') + (selected.includes(o) ? ' on' : '')}
                onClick={() => pick(o)}
              >
                {portrait && <ActorPortrait name={o} src={portrait} />}
                <span>{o}</span>
              </button>
            );
          })}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="wizactions">
          {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn primary" disabled={!selected.length} onClick={next}>{i === base.length - 1 ? 'Finish' : 'Next'}</button>
          <button className="linkbtn" onClick={next}>Skip</button>
        </div>
      </div>
    </div>
  );
}
