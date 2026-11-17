const crypto = require('crypto');
const K = require('../config/keys');

const providerConfig = {
  google: () => ({ clientId: K.GOOGLE_CLIENT_ID, clientSecret: K.GOOGLE_CLIENT_SECRET }),
  apple: () => ({
    clientId: K.APPLE_CLIENT_ID,
    teamId: K.APPLE_TEAM_ID,
    keyId: K.APPLE_KEY_ID,
    privateKey: K.APPLE_PRIVATE_KEY
  }),
  facebook: () => ({ appId: K.FACEBOOK_APP_ID, appSecret: K.FACEBOOK_APP_SECRET })
};

const requiredConfig = {
  google: ['clientId', 'clientSecret'],
  apple: ['clientId', 'teamId', 'keyId', 'privateKey'],
  facebook: ['appId', 'appSecret']
};

const callbackUrl = provider => `${K.PUBLIC_API_URL}/auth/oauth/callback/${provider}`;
const getConfig = provider => {
  const config = providerConfig[provider]?.();
  if (!config || requiredConfig[provider].some(key => !config[key])) {
    throw new Error(`${provider} sign-in is not configured.`);
  }
  return config;
};

function authorizationUrl(provider, state) {
  const config = getConfig(provider);
  const redirectUri = callbackUrl(provider);
  const url = provider === 'google'
    ? new URL('https://accounts.google.com/o/oauth2/v2/auth')
    : provider === 'apple'
      ? new URL('https://appleid.apple.com/auth/authorize')
      : new URL('https://www.facebook.com/v24.0/dialog/oauth');
  const params = provider === 'google'
    ? { client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', prompt: 'select_account', state }
    : provider === 'apple'
      ? { client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', response_mode: 'query', scope: 'email', state }
      : { client_id: config.appId, redirect_uri: redirectUri, response_type: 'code', scope: 'email,public_profile', state };
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error('The identity provider could not be reached.');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('The identity provider returned an invalid response.');
  }
  if (!response.ok) throw new Error('The identity provider rejected the sign-in request.');
  return body;
}

async function exchangeCode(provider, code) {
  const config = getConfig(provider);
  const params = provider === 'google'
    ? {
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: callbackUrl(provider),
      grant_type: 'authorization_code'
    }
    : provider === 'apple'
      ? {
        code,
        client_id: config.clientId,
        client_secret: createAppleClientSecret(config),
        redirect_uri: callbackUrl(provider),
        grant_type: 'authorization_code'
      }
      : {
        code,
        client_id: config.appId,
        client_secret: config.appSecret,
        redirect_uri: callbackUrl(provider)
      };
  const endpoint = provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : provider === 'apple'
      ? 'https://appleid.apple.com/auth/token'
      : `https://graph.facebook.com/v24.0/oauth/access_token?${new URLSearchParams(params)}`;
  const options = provider === 'facebook'
    ? { method: 'GET' }
    : {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params)
    };
  const token = await requestJson(endpoint, options);
  if (!token.access_token && provider !== 'apple') throw new Error('The identity provider did not return an access token.');
  return token;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64 + '='.repeat((4 - base64.length % 4) % 4), 'base64');
}

function createAppleClientSecret(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: config.keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: config.teamId,
    iat: now,
    exp: now + 5 * 60,
    aud: 'https://appleid.apple.com',
    sub: config.clientId
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const privateKey = config.privateKey.replace(/\\n/g, '\n');
  const signature = crypto.sign('sha256', Buffer.from(unsigned), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363'
  }).toString('base64url');
  return `${unsigned}.${signature}`;
}

let appleKeysCache;
let appleKeysExpiresAt = 0;
async function getAppleKeys() {
  if (appleKeysCache && Date.now() < appleKeysExpiresAt) return appleKeysCache;
  const keys = await requestJson('https://appleid.apple.com/auth/keys');
  if (!Array.isArray(keys.keys)) throw new Error('Apple signing keys are unavailable.');
  appleKeysCache = keys.keys;
  appleKeysExpiresAt = Date.now() + 60 * 60 * 1000;
  return appleKeysCache;
}

async function verifyAppleIdentityToken(identityToken, clientId) {
  const parts = identityToken.split('.');
  if (parts.length !== 3) throw new Error('Apple returned an invalid identity token.');
  const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
  const claims = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Apple returned an unsupported identity token.');
  }
  const jwk = (await getAppleKeys()).find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('Apple signing key was not found.');
  const signedContent = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signatureValid = crypto.verify(
    'RSA-SHA256',
    signedContent,
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    decodeBase64Url(parts[2])
  );
  const audienceMatches = claims.aud === clientId || (Array.isArray(claims.aud) && claims.aud.includes(clientId));
  if (!signatureValid || claims.iss !== 'https://appleid.apple.com' || !audienceMatches ||
    !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 ||
    typeof claims.sub !== 'string' || (claims.email_verified !== true && claims.email_verified !== 'true')) {
    throw new Error('Apple identity verification failed.');
  }
  return {
    providerId: claims.sub,
    email: claims.email,
    emailVerified: true,
    name: typeof claims.name === 'string' ? claims.name : ''
  };
}

async function getProfile(provider, code) {
  const config = getConfig(provider);
  const token = await exchangeCode(provider, code);
  if (provider === 'google') {
    const profile = await requestJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    if (profile.email_verified !== true || typeof profile.sub !== 'string') {
      throw new Error('Google did not verify the email address.');
    }
    return { providerId: profile.sub, email: profile.email, emailVerified: true, name: profile.name || '' };
  }
  if (provider === 'apple') return verifyAppleIdentityToken(token.id_token || '', config.clientId);

  const debugUrl = new URL('https://graph.facebook.com/v24.0/debug_token');
  debugUrl.search = new URLSearchParams({
    input_token: token.access_token,
    access_token: `${config.appId}|${config.appSecret}`
  }).toString();
  const debug = await requestJson(debugUrl.toString());
  if (!debug.data?.is_valid || debug.data.app_id !== config.appId || typeof debug.data.user_id !== 'string') {
    throw new Error('Facebook access token verification failed.');
  }
  const profile = await requestJson(`https://graph.facebook.com/v24.0/me?${new URLSearchParams({
    fields: 'id,name,email',
    access_token: token.access_token
  })}`);
  if (profile.id !== debug.data.user_id || typeof profile.email !== 'string') {
    throw new Error('Facebook did not provide an email address. Allow email access and try again.');
  }
  return { providerId: profile.id, email: profile.email, emailVerified: true, name: profile.name || '' };
}

module.exports = { authorizationUrl, callbackUrl, getProfile };
