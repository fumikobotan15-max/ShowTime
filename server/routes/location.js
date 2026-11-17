const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const auth = require('../middleware/auth');

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
let lastLookupAt = 0;
let lookupQueue = Promise.resolve();

const lookupLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many location searches. Please wait a few minutes and try again.' }
});

function queueNominatimLookup(params) {
  const url = new URL('https://nominatim.openstreetmap.org/' + params.path);
  for (const [key, value] of Object.entries(params.query)) url.searchParams.set(key, value);
  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

  const lookup = lookupQueue.then(async () => {
    const cachedResult = cache.get(cacheKey);
    if (cachedResult && cachedResult.expiresAt > Date.now()) return cachedResult.value;
    const waitMs = Math.max(0, 1000 - (Date.now() - lastLookupAt));
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
    lastLookupAt = Date.now();

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ShowTime/1.0 (movie ticket booking application)'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Location service returned HTTP ${response.status}`);
    const results = await response.json();
    cache.set(cacheKey, { value: results, expiresAt: Date.now() + CACHE_TTL_MS });
    if (cache.size > 250) {
      for (const [key, value] of cache) {
        if (value.expiresAt <= Date.now() || cache.size > 200) cache.delete(key);
        if (cache.size <= 200) break;
      }
    }
    return results;
  });
  lookupQueue = lookup.catch(() => {});
  return lookup;
}

function toLocation(result) {
  const address = result.address || {};
  const city = address.city || address.town || address.village || address.municipality || address.county || address.state || '';
  const locality = address.neighbourhood || address.suburb || address.quarter || address.residential || address.hamlet || '';
  const postalCode = address.postcode || '';
  const country = address.country || '';
  const displayName = [locality, city, postalCode, country].filter(Boolean).join(', ') || result.display_name || '';
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  return {
    city,
    locality,
    postalCode,
    country,
    displayName: displayName.slice(0, 240),
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : {})
  };
}

router.get('/search', auth, lookupLimit, async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  if (query.length < 2) return res.json({ locations: [] });
  try {
    const results = await queueNominatimLookup({
      path: 'search',
      query: { q: query, format: 'jsonv2', addressdetails: '1', limit: '6' }
    });
    const locations = Array.isArray(results)
      ? results.map(toLocation).filter(location => location.displayName && (location.city || location.locality || location.postalCode))
      : [];
    return res.json({ locations });
  } catch (error) {
    console.error('Location search provider failed:', error.name || 'Error');
    return res.status(502).json({ message: 'Location search is temporarily unavailable. Please try again or use current location.' });
  }
});

router.get('/reverse', auth, lookupLimit, async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: 'A valid latitude and longitude are required.' });
  }
  try {
    const results = await queueNominatimLookup({
      path: 'reverse',
      query: { lat: String(latitude), lon: String(longitude), format: 'jsonv2', addressdetails: '1', zoom: '18' }
    });
    if (!results || results.error) return res.status(404).json({ message: 'We could not identify a nearby city or area. Try searching for it instead.' });
    const location = toLocation(results);
    if (!location.displayName || !(location.city || location.locality || location.postalCode)) {
      return res.status(404).json({ message: 'We could not identify a nearby city or area. Try searching for it instead.' });
    }
    return res.json({ location });
  } catch (error) {
    console.error('Location reverse lookup provider failed:', error.name || 'Error');
    return res.status(502).json({ message: 'We could not detect your location right now. Search for your city or area instead.' });
  }
});

module.exports = router;
