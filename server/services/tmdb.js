const K = require('../config/keys');

async function searchMovies(title) {
  if (!K.TMDB_API_KEY) {
    const error = new Error('Movie search is not configured. Set TMDB_API_KEY on the server.');
    error.statusCode = 503;
    throw error;
  }

  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('api_key', K.TMDB_API_KEY);
  url.searchParams.set('query', title);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch {
    const error = new Error('Could not reach TMDb. Please try again.');
    error.statusCode = 502;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error('TMDb returned an invalid response.');
    error.statusCode = 502;
    throw error;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const error = new Error('TMDb returned an invalid response.');
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok) {
    const invalidKey = data.status_code === 7;
    const error = new Error(invalidKey ?
      'The TMDb API key is invalid. Check TMDB_API_KEY on the server.' :
      'TMDb movie search failed. Please try again.');
    error.statusCode = invalidKey ? 503 : 502;
    throw error;
  }

  if (!Array.isArray(data.results)) {
    const error = new Error('TMDb returned an invalid movie search response.');
    error.statusCode = 502;
    throw error;
  }

  return data.results;
}

module.exports = { searchMovies };
