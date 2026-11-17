import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Common';
import { useAuth } from '../auth';

const tagline = 'BOOK YOUR MOVIE TICKETS';

export default function Splash() {
  const nav = useNavigate();
  const { user, ready } = useAuth();
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = event => setReduceMotion(event.matches);
    media.addEventListener('change', updateMotionPreference);
    return () => media.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => nav(user ? '/home' : '/login', { replace: true }), reduceMotion ? 500 : 4300);
    return () => clearTimeout(t);
  }, [ready, user, nav, reduceMotion]);

  return (
    <div className={`center splash${reduceMotion ? ' splash-reduced-motion' : ''}`}>
      <div className="logo-tile"><Logo size={132} /></div>
      <h1>ShowTime</h1>
      <p className="tag" aria-label={tagline}>
        {Array.from(tagline, (character, index) => (
          <span key={`${character}-${index}`} aria-hidden="true" style={{ animationDelay: `${1.25 + index * 0.045}s` }}>{character === ' ' ? '\u00a0' : character}</span>
        ))}
      </p>
    </div>
  );
}
