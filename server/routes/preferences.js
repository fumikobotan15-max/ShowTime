const router = require('express').Router();
const auth = require('../middleware/auth');
const { UserPreferences } = require('../models');

const fields = ['language', 'theatre', 'actor'];
const normalizeValues = value => {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  return [...new Set(list.flatMap(v => String(v).split(',')).map(v => v.trim()).filter(Boolean).slice(0, 20))];
};
const clean = value => normalizeValues(value).map(v => v.slice(0, 120));
const cleanPreferences = preferences => Object.fromEntries(
  fields
    .filter(field => clean(preferences?.[field]).length)
    .map(field => [field, clean(preferences[field])])
);

router.get('/', auth, async (req, res) => {
  const preferences = await UserPreferences.findOne({ user: req.userId }).select('language theatre actor').lean();
  res.json(cleanPreferences(preferences));
});

router.put('/', auth, async (req, res) => {
  const update = {};
  const unset = {};
  for (const field of fields) {
    const values = clean(req.body?.[field]);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      if (values.length) update[field] = values;
      else unset[field] = 1;
    }
  }

  const preferences = await UserPreferences.findOneAndUpdate(
    { user: req.userId },
    { $set: update, $unset: unset, $setOnInsert: { user: req.userId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  await UserPreferences.collection.updateOne(
    { _id: preferences._id },
    { $unset: { format: 1, when: 1 } }
  );

  res.json(cleanPreferences(preferences));
});

module.exports = router;
