const mongoose = require('mongoose');
const { Schema } = mongoose;

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);
const objectId = Schema.Types.ObjectId;

const userLocationSchema = new Schema({
  city: { type: String, trim: true, maxlength: 120 },
  locality: { type: String, trim: true, maxlength: 120 },
  postalCode: { type: String, trim: true, maxlength: 24 },
  country: { type: String, trim: true, maxlength: 120 },
  displayName: { type: String, required: true, trim: true, maxlength: 240 },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 }
}, { _id: false });

const User = model('User', new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, index: true },
  phone: { type: String, trim: true, match: /^\+[1-9]\d{1,14}$/ },
  profileImage: { type: String, default: '', maxlength: 90000 },
  location: { type: userLocationSchema, default: undefined },
  password: { type: String, select: false, minlength: 60 },
  authProviders: [{
    provider: { type: String, enum: ['google', 'apple', 'facebook'], required: true },
    providerId: { type: String, required: true }
  }],
  role: { type: String, enum: ['user', 'admin', 'staff'], default: 'user', index: true },
  isActive: { type: Boolean, default: true, index: true }
}, { collection: 'users', timestamps: true }));
User.schema.index({ 'authProviders.provider': 1, 'authProviders.providerId': 1 }, { unique: true, sparse: true });

const OAuthLoginTicket = model('OAuthLoginTicket', new Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  user: { type: objectId, ref: 'User', required: true },
  isNewUser: { type: Boolean, required: true },
  expiresAt: { type: Date, required: true }
}, { collection: 'oauthlogintickets', timestamps: true }));
OAuthLoginTicket.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordReset = model('PasswordReset', new Schema({
  user: { type: objectId, ref: 'User', required: true, unique: true, index: true },
  otpHash: { type: String, select: false },
  otpExpiresAt: { type: Date },
  attempts: { type: Number, default: 0, min: 0 },
  sendCount: { type: Number, default: 0, min: 0 },
  sendWindowStartedAt: { type: Date },
  lastSentAt: { type: Date },
  verifiedAt: { type: Date },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date },
  expiresAt: { type: Date, required: true }
}, { collection: 'passwordresets', timestamps: true }));
PasswordReset.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Movie = model('Movie', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200, index: true },
  language: { type: String, required: true, trim: true, maxlength: 50, index: true },
  genre: { type: [String], required: true, validate: v => Array.isArray(v) && v.length > 0 },
  duration: { type: String, required: true, trim: true, maxlength: 30 },
  rating: { type: String, required: true, trim: true, maxlength: 40 },
  votes: { type: String, default: '', trim: true, maxlength: 80 },
  languages: { type: [String], default: [] },
  certification: { type: String, default: '', trim: true, maxlength: 30 },
  releaseDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  synopsis: { type: String, default: '', trim: true, maxlength: 3000 },
  director: { type: String, default: '', trim: true, maxlength: 120 },
  cast: { type: [String], default: [] },
  castImages: {
    type: [{
      name: { type: String, required: true, trim: true, maxlength: 120 },
      imageUrl: { type: String, required: true, trim: true }
    }],
    default: []
  },
  formats: { type: [String], default: [] },
  languageFormats: {
    type: [{
      language: { type: String, required: true, trim: true, maxlength: 50 },
      formats: { type: [String], default: [] }
    }],
    default: []
  },
  rank: { type: Number, default: 0, min: 0, index: true },
  homeVisible: { type: Boolean, default: false, index: true },
  posterUrl: { type: String, default: '', trim: true },
  backdropUrl: { type: String, default: '', trim: true },
  color: { type: String, default: '#374151', trim: true }
}, { collection: 'movies', timestamps: true }));

const Theatre = model('Theatre', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  chain: { type: String, required: true, trim: true, maxlength: 80, index: true },
  area: { type: String, required: true, trim: true, maxlength: 100, index: true },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  amenities: { type: [String], default: [] },
  screenCount: { type: Number, min: 1, validate: Number.isInteger },
  screenCountIsMinimum: { type: Boolean, default: false },
  rating: { type: Number, min: 0, max: 5 },
  homeVisible: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true }
}, { collection: 'theatres', timestamps: true }));

const screenCellSchema = new Schema({
  type: { type: String, enum: ['seat', 'aisle', 'empty_space', 'indent'], required: true },
  number: { type: Number, min: 1, max: 100, validate: Number.isInteger, required: function () { return this.type === 'seat'; } },
  categoryName: { type: String, trim: true, maxlength: 50, required: function () { return this.type === 'seat'; } },
  price: { type: Number, min: 0, validate: Number.isInteger, required: function () { return this.type === 'seat'; } }
}, { _id: false });

const screenRowSchema = new Schema({
  label: { type: String, required: true, trim: true, maxlength: 5 },
  cells: { type: [screenCellSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 }
}, { _id: false });

const Screen = model('Screen', new Schema({
  theatre: { type: objectId, ref: 'Theatre', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  format: { type: String, required: true, trim: true, maxlength: 30 },
  rows: { type: [String], required: true, validate: v => Array.isArray(v) && v.length > 0 },
  layout: { type: [screenRowSchema], default: [] },
  columns: { type: Number, required: true, min: 1, max: 100 },
  totalSeats: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true, index: true }
}, { collection: 'screens', timestamps: true }));
Screen.schema.index({ theatre: 1, name: 1 }, { unique: true });

const Seat = model('Seat', new Schema({
  screen: { type: objectId, ref: 'Screen', required: true, index: true },
  row: { type: String, required: true, trim: true, maxlength: 5 },
  number: { type: Number, required: true, min: 1, max: 100, validate: Number.isInteger },
  category: { type: String, enum: ['Classic', 'Prime', 'Recliner'] },
  categoryName: { type: String, required: true, trim: true, maxlength: 50 },
  price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  isActive: { type: Boolean, default: true, index: true }
}, { collection: 'seats', timestamps: true }));
Seat.schema.index({ screen: 1, row: 1, number: 1 }, { unique: true });

const Show = model('Show', new Schema({
  movie: { type: objectId, ref: 'Movie', required: true, index: true },
  theatre: { type: objectId, ref: 'Theatre', required: true, index: true },
  screenRef: { type: objectId, ref: 'Screen', index: true },
  screen: { type: String, required: true, trim: true, maxlength: 80 },
  language: { type: String, trim: true, maxlength: 50, index: true },
  format: { type: String, required: true, trim: true, maxlength: 30 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  startsAt: { type: Date, required: true, index: true },
  bookedSeats: { type: [String], default: [] },
  status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled', index: true }
}, { collection: 'shows', timestamps: true }));
Show.schema.index({ movie: 1, theatre: 1, date: 1, time: 1, screen: 1 }, { unique: true });

const amountSchema = new Schema({
  tickets: { type: Number, required: true, min: 0 },
  fee: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const Booking = model('Booking', new Schema({
  ref: { type: String, required: true, unique: true, index: true },
  user: { type: objectId, ref: 'User', required: true, index: true },
  show: { type: objectId, ref: 'Show', required: true, index: true },
  seats: { type: [String], required: true, validate: v => Array.isArray(v) && v.length >= 1 },
  amount: { type: amountSchema, required: true },
  payment: {
    mode: { type: String, enum: ['razorpay', 'demo'], required: true },
    paymentId: { type: String, required: true, trim: true },
    orderId: { type: String, trim: true }
  },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'failed'], default: 'confirmed', index: true }
}, { collection: 'bookings', timestamps: true }));
Booking.schema.index({ user: 1, createdAt: -1 });
Booking.schema.index({ show: 1, status: 1 });

const Payment = model('Payment', new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  booking: { type: objectId, ref: 'Booking', index: true },
  show: { type: objectId, ref: 'Show', required: true, index: true },
  orderId: { type: String, trim: true },
  paymentId: { type: String, trim: true },
  provider: { type: String, enum: ['razorpay', 'demo'], required: true },
  currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['created', 'authorized', 'captured', 'failed', 'refunded'], default: 'created', index: true },
  idempotencyKey: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { collection: 'payments', timestamps: true }));
Payment.schema.index({ orderId: 1 }, { unique: true, sparse: true });
Payment.schema.index({ paymentId: 1 }, { unique: true, sparse: true });
Payment.schema.index({ user: 1, createdAt: -1 });

const Offer = model('Offer', new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  discountType: { type: String, enum: ['flat', 'percentage'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  minimumAmount: { type: Number, default: 0, min: 0 },
  validFrom: { type: Date, required: true, index: true },
  validUntil: { type: Date, required: true, index: true },
  usageLimit: { type: Number, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true, index: true }
}, { collection: 'offers', timestamps: true }));

const Review = model('Review', new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  movie: { type: objectId, ref: 'Movie', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', trim: true, maxlength: 2000 },
  isPublished: { type: Boolean, default: true, index: true }
}, { collection: 'reviews', timestamps: true }));
Review.schema.index({ user: 1, movie: 1 }, { unique: true });

const UserPreferences = model('UserPreferences', new Schema({
  user: { type: objectId, ref: 'User', required: true, unique: true, index: true },
  language: { type: [String], default: undefined },
  theatre: { type: [String], default: undefined },
  actor: { type: [String], default: undefined }
}, { collection: 'userpreferences', timestamps: true }));

module.exports = { User, PasswordReset, OAuthLoginTicket, Movie, Theatre, Screen, Seat, Show, Booking, Payment, Offer, Review, UserPreferences };
