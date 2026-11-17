import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import 'flag-icons/css/flag-icons.min.css';
import flagCountryData from 'flag-icons/country.json';
import { Logo } from '../components/Common';
import { useAuth } from '../auth';
import { api } from '../api';
import { API_URL } from '../config/keys';

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const flagCountryCodes = new Set(flagCountryData.map(({ code }) => code.toUpperCase()));
const emailPattern = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)*\.[A-Z]{2,}$/i;
const isValidEmail = value => {
  const email = value.trim();
  const separator = email.lastIndexOf('@');
  return separator > 0 && separator <= 64 && email.length - separator - 1 <= 253 && email.length <= 254 && emailPattern.test(email);
};
const phoneCountries = getCountries().filter(code => flagCountryCodes.has(code)).map(code => {
  const name = countryNames.of(code);
  if (!name || name === code) throw new Error(`No display name available for country code ${code}`);
  return {
    code,
    name,
    dialCode: `+${getCountryCallingCode(code)}`
  };
}).sort((a, b) => a.name.localeCompare(b.name));

function Shell({ title, children, logoSize = 36, showCardLogo = true }) {
  const [supportPanel, setSupportPanel] = useState('');

  useEffect(() => {
    if (!supportPanel) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setSupportPanel('');
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [supportPanel]);

  return (
    <div className="authbg">
      <div className="auth-utility-row">
        <Link to="/" className="auth-brand" aria-label="ShowTime home">
          <Logo size={28} />
          <span>ShowTime</span>
        </Link>
        <div className="auth-support-actions">
          <button type="button" className="auth-support-button" onClick={() => setSupportPanel('help')}>Help</button>
          <button type="button" className="auth-support-button" onClick={() => setSupportPanel('contact')}>Contact</button>
        </div>
      </div>
      <div className="authcard" data-reveal>
        {showCardLogo && <Logo size={logoSize} />}
        <h2>{title}</h2>
        {children}
      </div>
      {supportPanel && (
        <div className="auth-support-backdrop" onClick={event => { if (event.target === event.currentTarget) setSupportPanel(''); }}>
          <section className="auth-support-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-support-title">
            <button type="button" className="auth-support-close" aria-label="Close dialog" onClick={() => setSupportPanel('')}>×</button>
            {supportPanel === 'help' ? (
              <>
                <h2 id="auth-support-title">How can we help?</h2>
                <h3>Signing in</h3>
                <p>Check that you’re using the email address and password linked to your ShowTime account. Use <Link to="/forgot-password" onClick={() => setSupportPanel('')}>Password Reset</Link> if you need to reset your password.</p>
                <h3>Creating an account</h3>
                <p>Enter your details, a valid phone number, and matching passwords, then accept the Terms of Service and Privacy Policy.</p>
                <h3>Verification code</h3>
                <p>For password recovery, check the phone linked to your account. You can request another code when the countdown finishes.</p>
              </>
            ) : (
              <>
                <h2 id="auth-support-title">Contact ShowTime</h2>
                <p>For help with your account, sign-in, or password recovery, email our support contact:</p>
                <a className="auth-contact-email" href="mailto:chiranth.bs54@gmail.com">chiranth.bs54@gmail.com</a>
                <p className="small">Please don’t include your password or verification code in your message.</p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export function PhoneNumberField({ country, onCountryChange, value, onChange, disabled = false }) {
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const selectorRef = useRef(null);
  const selectedCountry = phoneCountries.find(item => item.code === country);
  const filteredCountries = phoneCountries.filter(item =>
    `${item.name} ${item.dialCode}`.toLowerCase().includes(countryQuery.toLowerCase())
  );

  useEffect(() => {
    const closeMenu = event => {
      if (!selectorRef.current?.contains(event.target)) setCountryMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, []);

  return (
    <div className="phone-field">
      <div className="country-selector" ref={selectorRef}>
        <button
          type="button"
          className="country-trigger"
          aria-label={`Select country, ${selectedCountry.name} ${selectedCountry.dialCode}`}
          aria-haspopup="listbox"
          aria-expanded={countryMenuOpen}
          disabled={disabled}
          onClick={() => { setCountryMenuOpen(!countryMenuOpen); setCountryQuery(''); }}
        >
          <span className={`fi fi-${selectedCountry.code.toLowerCase()}`} aria-hidden="true" />
          <span>{selectedCountry.dialCode}</span>
          <span className="country-chevron" aria-hidden="true">⌄</span>
        </button>
        {countryMenuOpen && (
          <div className="country-menu">
            <input
              className="country-search"
              type="search"
              placeholder="Search country"
              aria-label="Search countries"
              value={countryQuery}
              onChange={event => setCountryQuery(event.target.value)}
            />
            <div className="country-list" role="listbox" aria-label="Countries">
              {filteredCountries.length ? filteredCountries.map(item => (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={item.code === country}
                  className="country-option"
                  onClick={() => { onCountryChange(item.code); setCountryMenuOpen(false); setCountryQuery(''); }}
                >
                  <span className={`country-option-flag fi fi-${item.code.toLowerCase()}`} aria-hidden="true" />
                  <span className="country-option-name">{item.name}</span>
                  <span className="country-option-dial">{item.dialCode}</span>
                </button>
              )) : <p className="country-empty">No countries found</p>}
            </div>
          </div>
        )}
      </div>
      <input
        className="phone-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required
        disabled={disabled}
        aria-label="Phone number"
        placeholder="Phone number"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

const socialProviders = [
  {
    name: 'Google',
    icon: <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.8 27.9a12 12 0 0 1 0-7.8v-5.3H5.9a20 20 0 0 0 0 18.4l6.9-5.3Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 14.8l6.9 5.3C14.4 15.5 18.8 12 24 12Z" />
    </svg>
  },
  {
    name: 'Apple',
    icon: <svg className="apple-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M17.05 12.54c.02 2.17 1.9 2.9 1.92 2.91-.02.05-.3 1.04-.98 2.06-.59.88-1.2 1.75-2.16 1.77-.94.02-1.24-.57-2.32-.57-1.08 0-1.42.55-2.31.59-.93.04-1.64-.95-2.24-1.82-1.22-1.77-2.15-5-.9-7.18a3.47 3.47 0 0 1 2.93-1.78c.92-.02 1.79.62 2.35.62.56 0 1.61-.77 2.71-.66.46.02 1.76.19 2.59 1.43-.07.04-1.55.9-1.59 2.63ZM15.27 7.2a3.2 3.2 0 0 0 .75-2.3 3.27 3.27 0 0 0-2.12 1.08 3.05 3.05 0 0 0-.77 2.22 2.7 2.7 0 0 0 2.14-1Z" />
    </svg>
  },
  {
    name: 'Facebook',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M13.5 20v-7.3H16l.4-2.9h-2.9V8c0-.8.2-1.4 1.5-1.4h1.5V4a19 19 0 0 0-2.2-.1c-2.2 0-3.7 1.3-3.7 3.8v2.1H8.1v2.9h2.5V20h2.9Z" />
    </svg>
  }
];

const Social = () => (
  <>
    <div className="or"><span>Or log in with</span></div>
    <div className="social">
      {socialProviders.map(({ name, icon }) => (
        <button key={name} type="button" className="social-button" aria-label={`${name} sign in`} data-tooltip={name}
          onClick={() => window.location.assign(`${API_URL}/auth/oauth/${name.toLowerCase()}`)}>{icon}</button>
      ))}
    </div>
  </>
);

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const oauthError = new URLSearchParams(location.search).get('oauth_error');
  const oauthErrorMessage = {
    not_configured: 'This sign-in provider is not configured yet. Please use email and password or contact support.',
    cancelled: 'Sign-in was cancelled.',
    failed: 'Sign-in could not be completed. Please try again.'
  }[oauthError] || '';
  const [show, setShow] = useState(false), [err, setErr] = useState(oauthErrorMessage), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await login(f.email, f.password);
      nav('/home', { replace: true });
    }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="User Login" logoSize={48}>
      <form onSubmit={submit}>
        <label>Email address<input type="email" required placeholder="Email address" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
        <label>Password
          <span className="pw">
            <input type={show ? 'text' : 'password'} required placeholder="Password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
            <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {show ? (
                  <>
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a11.8 11.8 0 0 1-3.1 4.2M6.2 6.2A12.5 12.5 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a10 10 0 0 0 3-.5" />
                  </>
                ) : (
                  <>
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </span>
        </label>
        <div className="login-options">
          <label className="remember-option">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Logging in...' : 'Login'}</button>
      </form>
      <Social />
      <p className="small">Don't have an account? <Link className="signup-link" to="/signup">Sign up</Link></p>
    </Shell>
  );
}

export function OAuthCallback() {
  const { completeOAuth } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const pendingRequest = useRef(null);
  const code = new URLSearchParams(location.search).get('code');

  useEffect(() => {
    if (!code) {
      setError('This sign-in link is missing or has expired. Please try again.');
      return undefined;
    }

    window.history.replaceState({}, '', location.pathname);
    let active = true;
    if (!pendingRequest.current) pendingRequest.current = completeOAuth(code);
    pendingRequest.current.then(result => {
      if (active) nav(result.isNewUser ? '/location' : '/home', { replace: true });
    }).catch(reason => {
      if (active) setError(reason.message);
    });
    return () => { active = false; };
  }, [code, completeOAuth, location.pathname, nav]);

  return (
    <Shell title="Completing sign in">
      {error
        ? <><p className="error" role="alert">{error}</p><p className="small"><Link to="/login">Back to login</Link></p></>
        : <p className="muted" role="status">Please wait while we finish signing you in...</p>}
    </Shell>
  );
}

export function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step !== 'success') return undefined;
    const timer = setTimeout(() => nav('/login', { replace: true }), 2000);
    return () => clearTimeout(timer);
  }, [step, nav]);

  const requestCode = async (resend = false) => {
    setErr('');
    setBusy(true);
    try {
      const result = await api(`/auth/password-reset/${resend ? 'resend' : 'request'}`, {
        method: 'POST',
        body: { email }
      });
      if (result.maskedPhone) setMaskedPhone(result.maskedPhone);
      setResendIn(result.resendAfterSeconds || 60);
      setStep('otp');
    } catch (error) {
      setErr(error.providerErrorCode ? `${error.message} (Twilio error ${error.providerErrorCode})` : error.message);
      const seconds = error.message.match(/wait (\d+) seconds/i);
      if (seconds) setResendIn(Number(seconds[1]));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async event => {
    event.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/auth/password-reset/verify', { method: 'POST', body: { email, otp } });
      setStep('new-password');
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async event => {
    event.preventDefault();
    setErr('');
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(newPassword)) {
      setErr('Use 8–72 characters, including at least one letter and one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password-reset', { method: 'POST', body: { password: newPassword } });
      setStep('success');
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const eyeIcon = visible => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {visible ? (
        <>
          <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a11.8 11.8 0 0 1-3.1 4.2M6.2 6.2A12.5 12.5 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a10 10 0 0 0 3-.5" />
        </>
      ) : (
        <>
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );

  return (
    <Shell title="Password Reset">
      {step === 'email' && (
        <form onSubmit={event => { event.preventDefault(); requestCode(); }}>
          <label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" /></label>
          <p className="small recovery-message">If your account has a registered phone number, we’ll send a verification code there. If you signed up with a social provider, use that provider to sign in.</p>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn primary block" disabled={busy} aria-busy={busy}>{busy && <span className="auth-spinner" aria-hidden="true" />}{busy ? 'Sending code...' : 'Send OTP'}</button>
        </form>
      )}
      {step === 'otp' && (
        <form onSubmit={verifyCode}>
          <p className="small recovery-message" aria-live="polite">
            {maskedPhone ? `A verification code was sent to ${maskedPhone}.` : 'If an account exists, a verification code was sent to its registered phone.'}
          </p>
          <label>Verification code
            <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit OTP" />
          </label>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn primary block" disabled={busy} aria-busy={busy}>{busy && <span className="auth-spinner" aria-hidden="true" />}{busy ? 'Verifying...' : 'Verify OTP'}</button>
          <p className="small recovery-message">
            {resendIn > 0 ? `Resend OTP in ${resendIn}s` : <button className="reset-resend" type="button" disabled={busy} onClick={() => requestCode(true)}>{busy ? 'Sending...' : 'Resend OTP'}</button>}
          </p>
        </form>
      )}
      {step === 'new-password' && (
        <form onSubmit={savePassword}>
          <label>New Password
            <span className="pw">
              <input type={showNewPassword ? 'text' : 'password'} required minLength={8} maxLength={72} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="New password" />
              <button type="button" className="pw-toggle" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showNewPassword}>{eyeIcon(showNewPassword)}</button>
            </span>
          </label>
          <label>Confirm New Password
            <span className="pw">
              <input type={showConfirmPassword ? 'text' : 'password'} required minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirm new password" aria-invalid={Boolean(confirmPassword && newPassword !== confirmPassword)} />
              <button type="button" className="pw-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword}>{eyeIcon(showConfirmPassword)}</button>
            </span>
            {confirmPassword && newPassword !== confirmPassword && <span className="error confirm-password-error" role="alert">Passwords do not match.</span>}
          </label>
          <p className="small recovery-message">Use 8–72 characters, including at least one letter and one number.</p>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn primary block" disabled={busy} aria-busy={busy}>{busy && <span className="auth-spinner" aria-hidden="true" />}{busy ? 'Saving password...' : 'Save Password'}</button>
        </form>
      )}
      {step === 'success' && <p className="notice recovery-message" role="status">Your password has been updated. Redirecting to login...</p>}
      {step !== 'success' && <p className="small"><Link to="/login">Back to login</Link></p>}
    </Shell>
  );
}

export function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [country, setCountry] = useState('IN');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [agree, setAgree] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const passwordsDoNotMatch = confirmPasswordTouched && f.password !== f.confirmPassword;
  const emailInvalid = emailTouched && !isValidEmail(f.email);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    setEmailTouched(true);
    const email = f.email.trim();
    if (!isValidEmail(email)) return;
    setConfirmPasswordTouched(true);
    if (f.password !== f.confirmPassword) return;
    if (!agree) return setErr('Please agree to the Terms of Service and Privacy Policy');
    const phoneNumber = f.phone.trim();
    if (!isValidPhoneNumber(phoneNumber, country)) return setErr('Please enter a valid phone number for the selected country');
    const parsedPhone = parsePhoneNumberFromString(phoneNumber, country);
    if (!parsedPhone) return setErr('Please enter a valid phone number for the selected country');
    setBusy(true);
    try { await register({ name: `${f.first} ${f.last}`.trim(), email, phone: parsedPhone.number, password: f.password }); nav('/location', { replace: true }); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your account" logoSize={48}>
      <form onSubmit={submit} noValidate>
        <div className="row2">
          <label>First name<input required value={f.first} onChange={set('first')} placeholder="Alex" /></label>
          <label>Last name<input required value={f.last} onChange={set('last')} placeholder="Rivera" /></label>
        </div>
        <label>Email address<input type="email" required value={f.email} onChange={set('email')} onBlur={() => setEmailTouched(true)} placeholder="alex@gmail.com" aria-invalid={emailInvalid} aria-describedby={emailInvalid ? 'signup-email-error' : undefined} className={emailInvalid ? 'input-invalid' : undefined} /></label>
        {emailInvalid && <p className="email-validation-error" id="signup-email-error" role="alert">Please enter a valid email address.</p>}
        <label>Phone number<PhoneNumberField country={country} onCountryChange={setCountry} value={f.phone} onChange={set('phone')} /></label>
        <label>Password<input type="password" required minLength={6} value={f.password} onChange={set('password')} placeholder="At least 6 characters" /></label>
        <label>Confirm Password
          <span className="pw">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={f.confirmPassword}
              onChange={event => { setF({ ...f, confirmPassword: event.target.value }); setConfirmPasswordTouched(true); }}
              placeholder="Confirm your password"
              aria-invalid={passwordsDoNotMatch}
              aria-describedby={passwordsDoNotMatch ? 'password-mismatch' : undefined}
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              aria-pressed={showConfirmPassword}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {showConfirmPassword ? (
                  <>
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a11.8 11.8 0 0 1-3.1 4.2M6.2 6.2A12.5 12.5 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a10 10 0 0 0 3-.5" />
                  </>
                ) : (
                  <>
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </span>
          {passwordsDoNotMatch && <span id="password-mismatch" className="error confirm-password-error" role="alert">Passwords do not match.</span>}
        </label>
        <label className="check">
          <input type="checkbox" required checked={agree} onChange={e => setAgree(e.target.checked)} aria-describedby={err ? 'signup-error' : undefined} />
          <span>I agree to the <a className="signup-link" href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a className="signup-link" href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
        </label>
        {err && <p id="signup-error" className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Creating account...' : 'Create free account'}</button>
      </form>
      <p className="small">Already have an account? <Link className="signup-link" to="/login">Log in</Link></p>
    </Shell>
  );
}

export function LocationPermission() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState(user?.location || null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const searchLocations = async event => {
    event.preventDefault();
    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
      setError('Enter at least two characters to search for a location.');
      return;
    }
    setSearching(true);
    setError('');
    setResults([]);
    setHasSearched(true);
    try {
      const result = await api(`/location/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(result.locations || []);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Location detection is unavailable in this browser. Search for your city or area instead.');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await api(`/location/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
          setSelectedLocation(result.location);
          setQuery('');
          setResults([]);
        } catch (problem) {
          setError(problem.message || 'We could not identify your location. Search for your city or area instead.');
        } finally {
          setDetecting(false);
        }
      },
      geoError => {
        const message = geoError.code === 1
          ? 'Location permission was denied. You can search for your city or area instead.'
          : geoError.code === 2
            ? 'Your location is unavailable right now. Search for your city or area instead.'
            : 'Location detection timed out. Search for your city or area instead.';
        setError(message);
        setDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  };

  const continueToPreferences = async () => {
    if (!selectedLocation) return;
    setError('');
    setSaving(true);
    try {
      await api('/auth/location', { method: 'PUT', body: { location: selectedLocation } });
      nav('/preferences', { replace: true });
    } catch (problem) {
      setError(problem.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="Where are you watching from?" logoSize={48} showCardLogo={false}>
      <div className="location-content">
        <p className="location-subtitle">Allow ShowTime to identify your location and help personalise your movie experience.</p>
        <button className="location-detect" type="button" onClick={useCurrentLocation} disabled={detecting}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>{detecting ? 'Finding your location...' : 'Use My Current Location'}</span>
          {detecting && <span className="auth-spinner" aria-hidden="true" />}
        </button>

        <div className="location-divider"><span>or search for a location</span></div>

        {selectedLocation ? (
          <div className="location-selected" role="status">
            <span className="location-selected-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            </span>
            <span className="location-selected-text">
              <strong>{selectedLocation.displayName}</strong>
              <small>{[selectedLocation.city, selectedLocation.locality, selectedLocation.postalCode].filter(Boolean).join(' · ')}</small>
            </span>
            <button type="button" className="location-change" onClick={() => { setSelectedLocation(null); setQuery(''); setError(''); }}>Change</button>
          </div>
        ) : (
          <div className="location-search-wrap">
            <label htmlFor="location-search">City, area or PIN code</label>
            <form className="location-search-box" onSubmit={searchLocations}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
              <input
                id="location-search"
                type="search"
                autoComplete="off"
                placeholder="Search city, area or PIN code"
                value={query}
                onChange={event => { setQuery(event.target.value); setSelectedLocation(null); setResults([]); setHasSearched(false); }}
                aria-controls="location-results"
                aria-expanded={results.length > 0 || searching}
              />
              <button type="submit" aria-label="Search locations" disabled={searching || query.trim().length < 2}>
                {searching ? <span className="auth-spinner" aria-hidden="true" /> : <span aria-hidden="true">Search</span>}
              </button>
            </form>
            {(searching || results.length > 0 || hasSearched) && (
              <div className="location-results" id="location-results" role="listbox" aria-label="Matching locations">
                {searching && <p className="location-search-status">Searching locations...</p>}
                {!searching && results.map((location, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="location-result"
                    key={`${location.displayName}-${index}`}
                    onClick={() => { setSelectedLocation(location); setQuery(''); setResults([]); setError(''); }}
                  >
                    <span className="location-result-pin" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                    </span>
                    <span>{location.displayName}</span>
                  </button>
                ))}
                {!searching && !results.length && hasSearched && <p className="location-search-status">No matching locations found.</p>}
              </div>
            )}
          </div>
        )}

        {error && <p className="error location-error" role="alert">{error}</p>}
        <button className="btn primary block location-continue" type="button" disabled={!selectedLocation || saving || detecting} onClick={continueToPreferences}>
          {saving && <span className="auth-spinner" aria-hidden="true" />}
          {saving ? 'Saving location...' : 'Continue'}
        </button>
      </div>
    </Shell>
  );
}
