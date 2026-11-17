const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } = require('crypto');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const { isValidPhoneNumber } = require('libphonenumber-js');
const { User, PasswordReset, OAuthLoginTicket, UserPreferences, Review, Booking, Payment, Show } = require('../models');
const auth = require('../middleware/auth');
const K = require('../config/keys');
const oauth = require('../services/oauth');

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const RESEND_DELAY_MS = 60 * 1000;
const RESET_SESSION_MS = 10 * 60 * 1000;
const MAX_OTP_SENDS = 3;
const MAX_OTP_ATTEMPTS = 5;
const RESET_COOKIE = 'st_password_reset';
const RESET_COOKIE_PATH = '/api/auth/password-reset';
const OAUTH_COOKIE_PATH = `${new URL(K.PUBLIC_API_URL).pathname.replace(/\/+$/, '')}/auth/oauth`;
const genericResetMessage = 'If an account exists for that email, a verification code was sent to its registered phone.';
const trustedOrigins = new Set(K.CLIENT_URL.split(',').map(origin => origin.trim()).filter(Boolean));
const clientUrl = K.CLIENT_URL.split(',').map(origin => origin.trim()).find(Boolean);
const oauthProviders = new Set(['google', 'apple', 'facebook']);
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const emailPattern = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)*\.[A-Z]{2,}$/i;
const isValidEmail = value => {
  const separator = value.lastIndexOf('@');
  return separator > 0 && separator <= 64 && value.length - separator - 1 <= 253 && value.length <= 254 && emailPattern.test(value);
};

const resetRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please try again later.' }
});
const resetVerifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Please try again later.' }
});
const resetSaveLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Please try again later.' }
});
const oauthExchangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again later.' }
});

const hashResetValue = value => createHmac('sha256', K.PASSWORD_RESET_OTP_SECRET).update(value).digest('hex');
const findProviderErrorCode = value => {
  if (!value || typeof value !== 'object') return null;
  for (const [key, entry] of Object.entries(value)) {
    if (/^(?:code|error_?code)$/i.test(key)) {
      const code = typeof entry === 'number'
        ? entry
        : typeof entry === 'string' && /^\d+$/.test(entry)
          ? Number(entry)
          : null;
      if (Number.isSafeInteger(code) && code > 0) return code;
    }
    const nestedCode = findProviderErrorCode(entry);
    if (nestedCode) return nestedCode;
  }
  return null;
};
const equalHashes = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || !/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left || '', 'hex');
  const rightBuffer = Buffer.from(right || '', 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
const requireTrustedOrigin = (req, res, next) => {
  if (!trustedOrigins.has(req.get('origin'))) return res.status(403).json({ message: 'This request origin is not allowed.' });
  next();
};
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const maskPhone = phone => {
  const digits = phone.replace(/\D/g, '');
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};
const resetConfigReady = () => K.PASSWORD_RESET_OTP_SECRET.length >= 32 && K.TWILIO_ACCOUNT_SID && K.TWILIO_AUTH_TOKEN && K.TWILIO_FROM_NUMBER;

async function sendResetOtp(phone, otp) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(K.TWILIO_ACCOUNT_SID)}/Messages.json`;
  const credentials = Buffer.from(`${K.TWILIO_ACCOUNT_SID}:${K.TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({
    To: phone,
    From: K.TWILIO_FROM_NUMBER,
    Body: `Your ShowTime password reset code is ${otp}. It expires in 5 minutes. Do not share this code.`
  });
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    const deliveryError = new Error('Twilio request could not be completed');
    deliveryError.networkCode = error.cause?.code || error.name;
    throw deliveryError;
  }
  if (response.ok) return;

  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text();
  let responseBody = {};
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = {};
  }
  const providerCode = findProviderErrorCode(responseBody);
  const deliveryError = new Error('Twilio rejected the SMS request');
  deliveryError.httpStatus = response.status;
  deliveryError.providerCode = providerCode;
  deliveryError.responseContentType = contentType.split(';')[0].slice(0, 80);
  deliveryError.responseFormat = Object.keys(responseBody).length ? 'json' : 'non-json';
  deliveryError.responseKeys = Object.keys(responseBody).slice(0, 12);
  throw deliveryError;
}

function setResetCookie(res, token) {
  res.cookie(RESET_COOKIE, token, {
    httpOnly: true,
    secure: K.NODE_ENV === 'production',
    sameSite: K.NODE_ENV === 'production' ? 'none' : 'strict',
    path: RESET_COOKIE_PATH,
    maxAge: RESET_SESSION_MS
  });
}

function clearResetCookie(res) {
  res.clearCookie(RESET_COOKIE, {
    httpOnly: true,
    secure: K.NODE_ENV === 'production',
    sameSite: K.NODE_ENV === 'production' ? 'none' : 'strict',
    path: RESET_COOKIE_PATH
  });
}

function readResetCookie(req) {
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${RESET_COOKIE}=`));
  return cookie ? cookie.slice(RESET_COOKIE.length + 1) : '';
}

async function issueOtp(user, res) {
  const now = new Date();
  let reset = await PasswordReset.findOne({ user: user._id });
  const withinWindow = reset?.sendWindowStartedAt && now - reset.sendWindowStartedAt < SEND_WINDOW_MS;

  if (withinWindow && reset.sendCount >= MAX_OTP_SENDS) {
    return res.status(429).json({ message: 'The code request limit has been reached. Please try again later.' });
  }
  if (withinWindow && reset.lastSentAt && now - reset.lastSentAt < RESEND_DELAY_MS) {
    const waitSeconds = Math.ceil((RESEND_DELAY_MS - (now - reset.lastSentAt)) / 1000);
    return res.status(429).json({ message: `Please wait ${waitSeconds} seconds before requesting another code.`, resendAfterSeconds: waitSeconds });
  }

  if (!reset) reset = new PasswordReset({ user: user._id, sendCount: 0, attempts: 0 });
  if (!withinWindow) {
    reset.sendWindowStartedAt = now;
    reset.sendCount = 0;
    reset.attempts = 0;
  }

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  reset.otpHash = hashResetValue(otp);
  reset.otpExpiresAt = new Date(now.getTime() + OTP_LIFETIME_MS);
  reset.attempts = 0;
  reset.sendCount += 1;
  reset.lastSentAt = now;
  reset.verifiedAt = null;
  reset.resetTokenHash = null;
  reset.resetTokenExpiresAt = null;
  reset.expiresAt = new Date(reset.sendWindowStartedAt.getTime() + SEND_WINDOW_MS);
  await reset.save();

  try {
    await sendResetOtp(user.phone, otp);
  } catch (error) {
    await PasswordReset.updateOne({ _id: reset._id, otpHash: reset.otpHash }, {
      $inc: { sendCount: -1 },
      $unset: { otpHash: 1, otpExpiresAt: 1, lastSentAt: 1 }
    });
    console.error('Password reset SMS delivery failed:', {
      httpStatus: error.httpStatus || null,
      providerCode: error.providerCode || null,
      networkCode: error.networkCode || null,
      responseContentType: error.responseContentType || null,
      responseFormat: error.responseFormat || null,
      responseKeys: error.responseKeys || []
    });
    return res.status(502).json({
      message: 'Unable to send a verification code right now. Please try again later.',
      ...(error.providerCode ? { providerErrorCode: error.providerCode } : {})
    });
  }

  return res.json({
    message: genericResetMessage,
    maskedPhone: maskPhone(user.phone),
    resendAfterSeconds: RESEND_DELAY_MS / 1000
  });
}

const sign = u => ({
  token: jwt.sign({ id: u._id }, K.JWT_SECRET, { expiresIn: '7d' }),
  user: {
    id: u._id,
    name: u.name,
    email: u.email,
    location: u.location || null,
    hasPhone: Boolean(u.phone),
    hasPassword: Boolean(u.password)
  }
});
const publicAccount = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  hasPassword: Boolean(user.password),
  profileImage: user.profileImage || '',
  location: user.location || null,
  isActive: user.isActive,
  createdAt: user.createdAt
});
const accountImagePattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const oauthTicketHash = value => createHash('sha256').update(value).digest('hex');
const oauthStateCookie = provider => `st_oauth_state_${provider}`;

function redirectOAuthError(res, error) {
  const url = new URL('/login', clientUrl);
  url.searchParams.set('oauth_error', error);
  return res.redirect(url.toString());
}

function clearOAuthState(res, provider) {
  res.clearCookie(oauthStateCookie(provider), {
    httpOnly: true,
    secure: K.NODE_ENV === 'production',
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH
  });
}

async function findOrCreateOAuthUser(provider, profile) {
  const email = normalizeEmail(profile.email);
  const providerId = typeof profile.providerId === 'string' ? profile.providerId : '';
  if (!profile.emailVerified || !isValidEmail(email) || !providerId || providerId.length > 255) {
    throw new Error('The identity provider did not return a verified email address.');
  }

  let user = await User.findOne({ authProviders: { $elemMatch: { provider, providerId } } });
  let isNewUser = false;
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      if (!user.authProviders.some(identity => identity.provider === provider && identity.providerId === providerId)) {
        user.authProviders.push({ provider, providerId });
        await user.save();
      }
    } else {
      const suggestedName = typeof profile.name === 'string' ? profile.name.trim().slice(0, 80) : '';
      const name = suggestedName.length >= 2 ? suggestedName : (email.split('@')[0].slice(0, 78) || 'ShowTime user');
      try {
        user = await User.create({ name, email, authProviders: [{ provider, providerId }] });
        isNewUser = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOne({ email });
        if (!user) user = await User.findOne({ authProviders: { $elemMatch: { provider, providerId } } });
        if (!user) throw error;
        if (!user.authProviders.some(identity => identity.provider === provider && identity.providerId === providerId)) {
          user.authProviders.push({ provider, providerId });
          await user.save();
        }
      }
    }
  }
  if (!user.isActive) throw new Error('This ShowTime account is inactive. Contact support for help.');
  return { user, isNewUser };
}

router.get('/account', auth, asyncRoute(async (req, res) => {
  const user = await User.findById(req.userId).select('+password name email phone profileImage isActive createdAt');
  if (!user) return res.status(404).json({ message: 'Account not found' });
  res.json(publicAccount(user));
}));

router.put('/account/profile', auth, asyncRoute(async (req, res) => {
  const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
  if (!firstName || !lastName || firstName.length > 40 || lastName.length > 40 || `${firstName} ${lastName}`.length > 80) {
    return res.status(400).json({ message: 'Enter a first and last name within the allowed length.' });
  }
  const profileImage = req.body?.profileImage;
  if (profileImage !== undefined && profileImage !== null && (
    typeof profileImage !== 'string' ||
    profileImage.length > 90000 ||
    !accountImagePattern.test(profileImage) ||
    Buffer.from(profileImage.slice(profileImage.indexOf(',') + 1), 'base64').length > 65536
  )) {
    return res.status(400).json({ message: 'Choose a supported profile image under 64 KB.' });
  }

  const update = { name: `${firstName} ${lastName}` };
  if (profileImage !== undefined) update.profileImage = profileImage || '';

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: update },
    { new: true, runValidators: true, select: '+password name email phone profileImage isActive createdAt' }
  );
  if (!user) return res.status(404).json({ message: 'Account not found' });
  res.json(publicAccount(user));
}));

router.put('/account/password', auth, asyncRoute(async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmNewPassword = typeof req.body?.confirmNewPassword === 'string' ? req.body.confirmNewPassword : '';
  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ message: 'New password must be at least 8 characters and no more than 72 bytes.' });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: 'New passwords do not match.' });
  }

  const user = await User.findById(req.userId).select('+password');
  if (!user) return res.status(404).json({ message: 'Account not found' });
  if (user.password && !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  if (user.password && await bcrypt.compare(newPassword, user.password)) {
    return res.status(400).json({ message: 'Choose a password different from your current password.' });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  await PasswordReset.deleteOne({ user: user._id });
  res.json({ message: 'Password updated successfully.' });
}));

router.delete('/account', auth, asyncRoute(async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(req.userId).select('+password').session(session);
      if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
        const error = new Error('Current password is incorrect.');
        error.code = 'ACCOUNT_DELETE_UNAUTHORIZED';
        throw error;
      }

      const bookings = await Booking.find({ user: user._id, status: 'confirmed' }).select('show seats').session(session);
      const seatsByShow = new Map();
      for (const booking of bookings) {
        const showId = String(booking.show);
        seatsByShow.set(showId, [...(seatsByShow.get(showId) || []), ...booking.seats]);
      }
      for (const [showId, seats] of seatsByShow) {
        await Show.updateOne({ _id: showId }, { $pullAll: { bookedSeats: seats } }, { session });
      }

      await UserPreferences.deleteOne({ user: user._id }, { session });
      await PasswordReset.deleteOne({ user: user._id }, { session });
      await Review.deleteMany({ user: user._id }, { session });
      await Payment.deleteMany({ user: user._id }, { session });
      await Booking.deleteMany({ user: user._id }, { session });
      await User.deleteOne({ _id: user._id }, { session });
    });
  } catch (error) {
    if (error.code === 'ACCOUNT_DELETE_UNAUTHORIZED') {
      return res.status(400).json({ message: error.message });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  res.json({ message: 'Your account and associated records have been deleted.' });
}));

router.get('/oauth/:provider', (req, res) => {
  const { provider } = req.params;
  if (!oauthProviders.has(provider)) return redirectOAuthError(res, 'failed');
  try {
    const state = randomBytes(32).toString('base64url');
    res.cookie(oauthStateCookie(provider), state, {
      httpOnly: true,
      secure: K.NODE_ENV === 'production',
      sameSite: 'lax',
      path: OAUTH_COOKIE_PATH,
      maxAge: 10 * 60 * 1000
    });
    return res.redirect(oauth.authorizationUrl(provider, state));
  } catch (error) {
    clearOAuthState(res, provider);
    console.error(`${provider} sign-in could not start:`, error.message);
    return redirectOAuthError(res, error.message.includes('not configured') ? 'not_configured' : 'failed');
  }
});

router.get('/oauth/callback/:provider', async (req, res) => {
  const { provider } = req.params;
  if (!oauthProviders.has(provider)) return redirectOAuthError(res, 'failed');

  const cookieName = oauthStateCookie(provider);
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`));
  const expectedState = cookie ? cookie.slice(cookieName.length + 1) : '';
  const receivedState = typeof req.query.state === 'string' ? req.query.state : '';
  const stateMatches = expectedState.length === receivedState.length && expectedState.length > 0 &&
    timingSafeEqual(Buffer.from(expectedState), Buffer.from(receivedState));
  clearOAuthState(res, provider);
  if (!stateMatches) return redirectOAuthError(res, 'failed');
  if (req.query.error) return redirectOAuthError(res, 'cancelled');

  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code || code.length > 4096) return redirectOAuthError(res, 'failed');
    const profile = await oauth.getProfile(provider, code);
    const { user, isNewUser } = await findOrCreateOAuthUser(provider, profile);
    const ticket = randomBytes(32).toString('base64url');
    await OAuthLoginTicket.create({
      tokenHash: oauthTicketHash(ticket),
      user: user._id,
      isNewUser,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000)
    });
    const url = new URL('/auth/callback', clientUrl);
    url.searchParams.set('code', ticket);
    return res.redirect(url.toString());
  } catch (error) {
    console.error(`${provider} sign-in failed:`, error.message);
    return redirectOAuthError(res, 'failed');
  }
});

router.post('/oauth/exchange', oauthExchangeLimit, asyncRoute(async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
    return res.status(400).json({ message: 'This sign-in link has expired. Please try again.' });
  }
  const ticket = await OAuthLoginTicket.findOneAndDelete({
    tokenHash: oauthTicketHash(code),
    expiresAt: { $gt: new Date() }
  });
  if (!ticket) return res.status(400).json({ message: 'This sign-in link has expired. Please try again.' });
  const user = await User.findById(ticket.user).select('+password');
  if (!user || !user.isActive) return res.status(401).json({ message: 'This ShowTime account is unavailable.' });
  res.json({ ...sign(user), isNewUser: ticket.isNewUser });
}));

router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) return res.status(400).json({ message: 'Name, email, phone and password are required' });
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!isValidEmail(normalizedEmail)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  if (!isValidPhoneNumber(phone)) return res.status(400).json({ message: 'Please enter a valid phone number' });
  if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: 'This email is already registered' });
  const u = await User.create({ name, email: normalizedEmail, phone, password: await bcrypt.hash(password, 10) });
  res.status(201).json(sign(u));
});

router.post('/login', async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() }).select('+password');
  if (!u || !u.password || !(await bcrypt.compare(req.body.password || '', u.password)))
    return res.status(401).json({ message: 'Incorrect email or password' });
  res.json(sign(u));
});

router.put('/location', auth, asyncRoute(async (req, res) => {
  const input = req.body?.location;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return res.status(400).json({ message: 'Choose a valid location before continuing.' });
  }

  const textFields = ['city', 'locality', 'postalCode', 'country', 'displayName'];
  const location = {};
  for (const field of textFields) {
    if (input[field] !== undefined && input[field] !== null && typeof input[field] !== 'string') {
      return res.status(400).json({ message: 'The selected location is invalid.' });
    }
    location[field] = typeof input[field] === 'string' ? input[field].trim().slice(0, field === 'displayName' ? 240 : 120) : '';
  }
  const hasLatitude = input.latitude !== undefined && input.latitude !== null;
  const hasLongitude = input.longitude !== undefined && input.longitude !== null;
  if (hasLatitude !== hasLongitude) return res.status(400).json({ message: 'Location coordinates are incomplete.' });
  if (hasLatitude && (
    typeof input.latitude !== 'number' || !Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90 ||
    typeof input.longitude !== 'number' || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180
  )) return res.status(400).json({ message: 'The selected coordinates are invalid.' });
  if (!location.displayName || !(location.city || location.locality || location.postalCode)) {
    return res.status(400).json({ message: 'Choose a location with a city, area, or postal code.' });
  }
  if (hasLatitude) {
    location.latitude = input.latitude;
    location.longitude = input.longitude;
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: { location } },
    { new: true, runValidators: true }
  ).select('location');
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  return res.json({ location: user.location });
}));

router.post('/password-reset/request', resetRequestLimit, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!resetConfigReady()) return res.status(503).json({ message: 'Password recovery is not configured. Set the Twilio credentials and PASSWORD_RESET_OTP_SECRET in server/.env.' });
  if (!email || email.length > 254) return res.json({ message: genericResetMessage, resendAfterSeconds: RESEND_DELAY_MS / 1000 });

  const user = await User.findOne({ email }).select('phone');
  if (!user || !user.phone) return res.json({ message: genericResetMessage, resendAfterSeconds: RESEND_DELAY_MS / 1000 });
  return issueOtp(user, res);
}));

router.post('/password-reset/resend', resetRequestLimit, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!resetConfigReady()) return res.status(503).json({ message: 'Password recovery is not configured. Set the Twilio credentials and PASSWORD_RESET_OTP_SECRET in server/.env.' });
  const user = email ? await User.findOne({ email }).select('phone') : null;
  if (!user || !user.phone) return res.json({ message: genericResetMessage, resendAfterSeconds: RESEND_DELAY_MS / 1000 });
  return issueOtp(user, res);
}));

router.post('/password-reset/verify', requireTrustedOrigin, resetVerifyLimit, asyncRoute(async (req, res) => {
  if (!resetConfigReady()) return res.status(503).json({ message: 'Password recovery is not configured.' });
  const email = normalizeEmail(req.body.email);
  const otp = typeof req.body.otp === 'string' ? req.body.otp : '';
  if (!email || !/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'The code is invalid or expired.' });

  const user = await User.findOne({ email }).select('_id');
  if (!user) return res.status(400).json({ message: 'The code is invalid or expired.' });
  const now = new Date();
  const reset = await PasswordReset.findOneAndUpdate({
    user: user._id,
    expiresAt: { $gt: now },
    otpExpiresAt: { $gt: now },
    verifiedAt: null,
    attempts: { $lt: MAX_OTP_ATTEMPTS }
  }, { $inc: { attempts: 1 } }, { new: true }).select('+otpHash');

  if (!reset || !equalHashes(hashResetValue(otp), reset.otpHash)) {
    return res.status(400).json({ message: 'The code is invalid or expired.' });
  }

  const resetToken = randomBytes(32).toString('base64url');
  const resetTokenExpiresAt = new Date(now.getTime() + RESET_SESSION_MS);
  const updated = await PasswordReset.updateOne({
    _id: reset._id,
    otpHash: reset.otpHash,
    verifiedAt: null
  }, {
    $set: {
      verifiedAt: now,
      resetTokenHash: hashResetValue(resetToken),
      resetTokenExpiresAt,
      expiresAt: resetTokenExpiresAt
    },
    $unset: { otpHash: 1, otpExpiresAt: 1 }
  });
  if (!updated.modifiedCount) return res.status(400).json({ message: 'The code is invalid or expired.' });

  setResetCookie(res, resetToken);
  return res.json({ message: 'Code verified.' });
}));

router.post('/password-reset', requireTrustedOrigin, resetSaveLimit, asyncRoute(async (req, res) => {
  if (!resetConfigReady()) return res.status(503).json({ message: 'Password recovery is not configured.' });
  const password = req.body.password;
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72 || Buffer.byteLength(password, 'utf8') < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ message: 'Use at least 8 characters, including at least one letter and one number.' });
  }

  const resetToken = readResetCookie(req);
  if (!resetToken) return res.status(401).json({ message: 'Verify your code before saving a new password.' });
  const tokenHash = hashResetValue(resetToken);
  const passwordHash = await bcrypt.hash(password, 12);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const reset = await PasswordReset.findOne({
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { $gt: now },
        expiresAt: { $gt: now }
      }).select('+resetTokenHash').session(session);
      if (!reset) {
        const error = new Error('The verification session has expired. Please request a new code.');
        error.code = 'RESET_SESSION_EXPIRED';
        throw error;
      }
      const update = await User.updateOne({ _id: reset.user }, { $set: { password: passwordHash } }, { session });
      if (!update.matchedCount) throw new Error('The account could not be found.');
      await PasswordReset.deleteOne({ _id: reset._id }, { session });
    });
  } catch (error) {
    if (error.code === 'RESET_SESSION_EXPIRED') return res.status(401).json({ message: error.message });
    throw error;
  } finally {
    await session.endSession();
  }

  clearResetCookie(res);
  return res.json({ message: 'Your password has been updated.' });
}));

router.get('/me', auth, async (req, res) => {
  const u = await User.findById(req.userId).select('+password name email phone profileImage location isActive createdAt');
  if (!u) return res.status(401).json({ message: 'Account not found' });
  res.json(publicAccount(u));
});

module.exports = router;
