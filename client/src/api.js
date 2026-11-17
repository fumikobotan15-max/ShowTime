import { API_URL } from './config/keys';
export async function api(path, { method = 'GET', body } = {}) {
  const t = localStorage.getItem('st_token');
  let r;
  try {
    r = await fetch(API_URL + path, {
      method,
      credentials: path.startsWith('/auth/password-reset') ? 'include' : 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch { throw new Error('Cannot reach the server. Is it running?'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(d.message || 'Request failed');
    if (Number.isInteger(d.providerErrorCode)) error.providerErrorCode = d.providerErrorCode;
    throw error;
  }
  return d;
}
export const inr = n => '\u20B9' + Number(n).toLocaleString('en-IN');
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
