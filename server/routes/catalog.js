const router = require('express').Router();
const { Movie, Theatre, Show } = require('../models');
const { searchMovies } = require('../services/tmdb');
const { DEFAULT_LAYOUT_CONFIG, generateSeatLayout } = require('../services/seatLayout');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleKey = title => title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const asArray = value => {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  return list.flatMap(v => String(v).split(',')).map(v => v.trim()).filter(Boolean);
};

router.get('/movies', async (req, res) => {
  const { actor, q, format } = req.query, f = { homeVisible: true };
  const languages = asArray(req.query.language);
  const actors = asArray(req.query.actor);

  if (languages.length) {
    const matches = languages.map(language => new RegExp('^' + esc(language) + '$', 'i'));
    f.$or = [{ language: { $in: matches } }, { languages: { $in: matches } }];
  }
  if (actors.length) f.cast = { $in: actors.map(name => new RegExp(esc(name), 'i')) };
  if (format) f.formats = format;

  if (q !== undefined) {
    if (typeof q !== 'string' || !q.trim() || q.trim().length > 100) {
      return res.status(400).json({ message: 'Search query must be between 1 and 100 characters.' });
    }

    let matches;
    try {
      matches = await searchMovies(q.trim());
    } catch (error) {
      return res.status(error.statusCode || 502).json({ message: error.message });
    }

    const movies = await Movie.find(f);
    const byTitle = new Map(movies.map(movie => [titleKey(movie.title), movie]));
    const results = matches.flatMap(match => {
      const movie = byTitle.get(titleKey(match.title));
      if (!movie) return [];
      const result = movie.toObject();
      if (match.poster_path) result.posterUrl = `https://image.tmdb.org/t/p/w500${match.poster_path}`;
      return [result];
    });
    return res.json(results);
  }

  res.json(await Movie.find(f).sort({ rank: 1 }));
});
router.get('/movies/:id', async (req, res) => {
  const m = await Movie.findById(req.params.id).catch(() => null);
  m ? res.json(m) : res.status(404).json({ message: 'Movie not found' });
});
router.get('/theatres', async (_, res) => res.json(await Theatre.find({ homeVisible: true })));

router.get('/shows', async (req, res) => {
  const f = {};
  ['movie', 'date', 'theatre'].forEach(k => req.query[k] && (f[k] = req.query[k]));
  if (typeof req.query.language === 'string' && req.query.language.trim()) f.language = req.query.language.trim();
  const formats = asArray(req.query.format);
  if (formats.length) f.format = { $in: formats };
  res.json(await Show.find(f).populate('theatre').sort({ startsAt: 1 }).select('-bookedSeats'));
});
router.get('/shows/:id', async (req, res) => {
  const s = await Show.findById(req.params.id).populate('movie theatre screenRef').catch(() => null);
  if (!s) return res.status(404).json({ message: 'Show not found' });
  const result = s.toObject();
  result.seatLayout = result.screenRef?.layout?.length
    ? result.screenRef.layout
    : generateSeatLayout(DEFAULT_LAYOUT_CONFIG);
  res.json(result);
});
module.exports = router;
