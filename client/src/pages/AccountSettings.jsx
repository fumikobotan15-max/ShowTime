import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useAuth } from '../auth';
import { api } from '../api';
import { Navbar } from '../components/Common';
import { PhoneNumberField } from './AuthPages';

const initials = name => name?.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U';

async function prepareProfileImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('The profile image could not be processed in this browser.');
  }
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close();

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const encodedSize = dataUrl.slice(dataUrl.indexOf(',') + 1).length;
    if (encodedSize * 0.75 <= 65536) return dataUrl;
  }
  throw new Error('This image could not be reduced enough. Choose a smaller image.');
}

function PasswordInput({ label, value, onChange, visible, onToggle, autoComplete, required = true }) {
  return (
    <label>{label}
      <span className="pw">
        <input
          type={visible ? 'text' : 'password'}
          required={required}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="pw-toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={onToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {visible
              ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.3 3.1" /><path d="M6.2 6.2C3.9 7.7 2.8 9.5 2.5 12c.7 1.8 3.9 7 9.5 7 1 0 2-.2 2.9-.5" /></>
              : <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></>}
          </svg>
        </button>
      </span>
    </label>
  );
}

export default function AccountSettings() {
  const { updateUser, logout } = useAuth();
  const nav = useNavigate();
  const imageInput = useRef(null);
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [phoneCountry, setPhoneCountry] = useState('IN');
  const [profileImage, setProfileImage] = useState('');
  const [editing, setEditing] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [passwordVisible, setPasswordVisible] = useState({});
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadProfile = data => {
    const [firstName = '', ...lastParts] = (data.name || '').split(/\s+/);
    const parsedPhone = parsePhoneNumberFromString(data.phone || '');
    setAccount(data);
    setProfile({
      firstName,
      lastName: lastParts.join(' '),
      email: data.email || '',
      phone: parsedPhone?.nationalNumber || ''
    });
    setPhoneCountry(parsedPhone?.country || 'IN');
    setProfileImage(data.profileImage || '');
  };

  useEffect(() => {
    api('/auth/account').then(loadProfile).catch(error => setLoadError(error.message));
  }, []);

  const changeProfile = key => event => setProfile(current => ({ ...current, [key]: event.target.value }));
  const onImageSelected = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileMessage(null);
    try {
      setProfileImage(await prepareProfileImage(file));
    } catch (error) {
      setProfileMessage({ type: 'error', text: error.message });
    }
  };

  const saveProfile = async event => {
    event.preventDefault();
    setProfileMessage(null);
    const firstName = profile.firstName.trim();
    const lastName = profile.lastName.trim();
    if (!firstName || !lastName) return setProfileMessage({ type: 'error', text: 'Enter your first and last name.' });

    setProfileBusy(true);
    try {
      const saved = await api('/auth/account/profile', {
        method: 'PUT',
        body: { firstName, lastName, profileImage }
      });
      loadProfile(saved);
      updateUser(saved);
      setEditing(false);
      setProfileMessage({ type: 'success', text: 'Profile information saved.' });
    } catch (error) {
      setProfileMessage({ type: 'error', text: error.message });
    } finally {
      setProfileBusy(false);
    }
  };

  const cancelEditing = () => {
    if (account) loadProfile(account);
    setEditing(false);
    setProfileMessage(null);
  };

  const savePassword = async event => {
    event.preventDefault();
    setPasswordMessage(null);
    if (passwords.newPassword.length < 8) {
      return setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
    }
    if (passwords.newPassword !== passwords.confirmNewPassword) {
      return setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
    }
    setPasswordBusy(true);
    try {
      const result = await api('/auth/account/password', { method: 'PUT', body: passwords });
      setPasswords({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setPasswordVisible({});
      setAccount(current => ({ ...current, hasPassword: true }));
      updateUser({ hasPassword: true });
      setPasswordMessage({ type: 'success', text: result.message });
    } catch (error) {
      setPasswordMessage({ type: 'error', text: error.message });
    } finally {
      setPasswordBusy(false);
    }
  };

  const deleteAccount = async event => {
    event.preventDefault();
    setDeleteMessage('');
    setDeleteBusy(true);
    try {
      await api('/auth/account', { method: 'DELETE', body: { password: deletePassword } });
      logout();
      nav('/login', { replace: true });
    } catch (error) {
      setDeleteMessage(error.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const togglePassword = key => setPasswordVisible(current => ({ ...current, [key]: !current[key] }));
  const accountInitials = initials(account?.name);

  return (
    <>
      <Navbar />
      <main className="page account-settings">
        <h1>Account settings</h1>
        <p className="muted account-settings-intro">Manage your profile, security and account.</p>
        {loadError && <p className="error" role="alert">{loadError}</p>}
        {!account && !loadError && <p className="muted">Loading account information...</p>}
        {account && (
          <>
            <section className="account-panel" aria-labelledby="profile-heading">
              <div className="account-panel-heading">
                <div><h2 id="profile-heading">Profile Information</h2><p className="muted">Your personal details used for your ShowTime account.</p></div>
                {!editing && <button type="button" className="btn ghost" onClick={() => { setProfileMessage(null); setEditing(true); }}>Edit profile</button>}
              </div>
              <form onSubmit={saveProfile} noValidate>
                <div className="account-photo-row">
                  <div className="account-photo" aria-label="Profile picture">
                    {profileImage ? <img src={profileImage} alt="Profile" /> : <span>{accountInitials}</span>}
                  </div>
                  <div>
                    <input ref={imageInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageSelected} />
                    <button type="button" className="btn ghost" disabled={!editing} onClick={() => imageInput.current?.click()}>{profileImage ? 'Change picture' : 'Upload picture'}</button>
                    {profileImage && editing && <button type="button" className="account-remove-photo" onClick={() => setProfileImage('')}>Remove</button>}
                    <p className="small muted">JPEG, PNG or WebP, up to 10 MB.</p>
                  </div>
                </div>
                <div className="row2">
                  <label>First name<input required disabled={!editing} autoComplete="given-name" value={profile.firstName} onChange={changeProfile('firstName')} /></label>
                  <label>Last name<input required disabled={!editing} autoComplete="family-name" value={profile.lastName} onChange={changeProfile('lastName')} /></label>
                </div>
                <label>Email address<input type="email" disabled autoComplete="email" value={profile.email} /></label>
                <label>Phone number
                  <PhoneNumberField country={phoneCountry} onCountryChange={setPhoneCountry} value={profile.phone} onChange={changeProfile('phone')} disabled />
                </label>
                {profileMessage && <p className={profileMessage.type === 'error' ? 'error account-message' : 'notice account-message'} role={profileMessage.type === 'error' ? 'alert' : 'status'}>{profileMessage.text}</p>}
                {editing && <div className="account-form-actions">
                  <button type="button" className="btn ghost" onClick={cancelEditing} disabled={profileBusy}>Cancel</button>
                  <button type="submit" className="btn primary" disabled={profileBusy}>{profileBusy ? 'Saving...' : 'Save changes'}</button>
                </div>}
              </form>
            </section>

            <section className="account-panel" aria-labelledby="security-heading">
              <div className="account-panel-heading"><div><h2 id="security-heading">Account Security</h2><p className="muted">{account.hasPassword ? 'Change your password to keep your account secure.' : 'Add a password so you can also sign in with your email address.'}</p></div></div>
              <form onSubmit={savePassword} noValidate>
                {account.hasPassword && <PasswordInput label="Current password" value={passwords.currentPassword} autoComplete="current-password" visible={!!passwordVisible.currentPassword} onToggle={() => togglePassword('currentPassword')} onChange={event => setPasswords(current => ({ ...current, currentPassword: event.target.value }))} />}
                <div className="row2">
                  <PasswordInput label="New password" value={passwords.newPassword} autoComplete="new-password" visible={!!passwordVisible.newPassword} onToggle={() => togglePassword('newPassword')} onChange={event => setPasswords(current => ({ ...current, newPassword: event.target.value }))} />
                  <PasswordInput label="Confirm new password" value={passwords.confirmNewPassword} autoComplete="new-password" visible={!!passwordVisible.confirmNewPassword} onToggle={() => togglePassword('confirmNewPassword')} onChange={event => setPasswords(current => ({ ...current, confirmNewPassword: event.target.value }))} />
                </div>
                {passwordMessage && <p className={passwordMessage.type === 'error' ? 'error account-message' : 'notice account-message'} role={passwordMessage.type === 'error' ? 'alert' : 'status'}>{passwordMessage.text}</p>}
                <div className="account-form-actions"><button type="submit" className="btn primary" disabled={passwordBusy}>{passwordBusy ? 'Saving...' : 'Save password'}</button></div>
              </form>
            </section>

            <section className="account-panel account-management" aria-labelledby="management-heading">
              <div className="account-panel-heading"><div><h2 id="management-heading">Account Management</h2><p className="muted">Account details and deletion options.</p></div></div>
              <dl className="account-meta">
                <div><dt>Account created</dt><dd>{account.createdAt ? new Date(account.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unavailable'}</dd></div>
                <div><dt>Account status</dt><dd>{account.isActive ? 'Active' : 'Inactive'}</dd></div>
              </dl>
              {!deleting
                ? <button type="button" className="account-delete-link" onClick={() => { setDeleting(true); setDeleteMessage(''); }}>Delete account</button>
                : (
                  <form className="account-delete-confirm" onSubmit={deleteAccount} noValidate>
                    <p><strong>Delete your account permanently?</strong> This permanently removes your account, preferences, reviews, bookings and payment records.</p>
                    <label>Confirm with your current password<input type="password" required autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></label>
                    {deleteMessage && <p className="error account-message" role="alert">{deleteMessage}</p>}
                    <div className="account-form-actions">
                      <button type="button" className="btn ghost" disabled={deleteBusy} onClick={() => { setDeleting(false); setDeletePassword(''); setDeleteMessage(''); }}>Cancel</button>
                      <button type="submit" className="btn danger" disabled={deleteBusy}>{deleteBusy ? 'Deleting...' : 'Delete account permanently'}</button>
                    </div>
                  </form>
                )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
