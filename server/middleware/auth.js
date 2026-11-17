const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/keys');
module.exports = (req, res, next) => {
  const h = req.headers.authorization || '';
  try {
    req.userId = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET).id;
    next();
  } catch { res.status(401).json({ message: 'Please log in to continue' }); }
};
