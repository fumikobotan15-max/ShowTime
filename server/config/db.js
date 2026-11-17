const mongoose = require('mongoose');
const { MONGO_URI, NODE_ENV } = require('./keys');
const models = require('../models');

let listenersAttached = false;

function assertMongoUri() {
  const value = String(MONGO_URI || '').trim();
  const isPlaceholder = !value || value.includes('YOUR_MONGODB_ATLAS_CONNECTION_STRING');

  if (isPlaceholder) {
    const message = 'MONGODB_URI is missing or still contains the placeholder value. Add a MongoDB Atlas URI to server/.env.';
    if (NODE_ENV === 'production') throw new Error(message);
    throw new Error(message);
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(value)) {
    throw new Error('MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection string.');
  }
}

function assertAuthConfig() {
  const secret = String(require('./keys').JWT_SECRET || '').trim();
  if (!secret || secret === 'YOUR_SECRET_KEY' || secret.length < 32) {
    throw new Error('JWT_SECRET must be a random value with at least 32 characters in server/.env.');
  }
}

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => console.log('MongoDB Atlas connected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB Atlas reconnected'));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB Atlas disconnected; Mongoose will continue retrying when possible'));
  mongoose.connection.on('error', error => console.error('MongoDB connection error:', error.message));
}

async function connectDB() {
  assertMongoUri();
  assertAuthConfig();
  attachConnectionListeners();

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true
  });

  await Promise.all(Object.values(models).map(currentModel => currentModel.init()));

  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
