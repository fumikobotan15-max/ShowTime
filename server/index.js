const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const K = require('./config/keys');
const { connectDB } = require('./config/db');

const app = express();
const allowedOrigins = K.CLIENT_URL.split(',').map(origin => origin.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true, optionsSuccessStatus: 200 }));
app.use(express.json({ limit: '100kb' }));
app.use(mongoSanitize());
app.get('/', (_, res) => res.json({
  name: 'ShowTime API',
  ok: true,
  health: '/api/health'
}));
app.get('/api/health', (_, res) => res.json({
  ok: mongoose.connection.readyState === 1,
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  environment: K.NODE_ENV
}));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/location', require('./routes/location'));
app.use('/api/preferences', require('./routes/preferences'));
app.use('/api', require('./routes/catalog'));
app.use('/api', require('./routes/booking'));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: 'Server error' }); });

async function start() {
  try {
    await connectDB();
    app.listen(K.PORT, () => console.log('ShowTime API on http://localhost:' + K.PORT));
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) start();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    const { disconnectDB } = require('./config/db');
    await disconnectDB();
    process.exit(0);
  });
}

module.exports = { app, start };
