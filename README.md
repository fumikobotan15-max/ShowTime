# ShowTime - Movie ticket booking (MERN)

React (Vite) + Express + MongoDB Atlas. The application uses Mongoose, JWT auth, atomic seat booking, Razorpay payments (or built-in demo payment), and persistent catalog/booking data.

## Environment setup

The backend reads configuration from `server/.env`. Copy the placeholders in `server/.env.example` into `server/.env` and provide a MongoDB Atlas connection string and a long random JWT secret.

Required values:

- `MONGODB_URI` - MongoDB Atlas connection string.
- `JWT_SECRET` - long random signing secret.
- `CLIENT_URL` - frontend origin, normally `http://localhost:5173` in development.

Optional values:

- `PUBLIC_API_URL` - public base URL of the API, normally `http://localhost:5000/api`; use the deployed API URL in production.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - Google OAuth web application credentials.
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` - Sign in with Apple service ID and key credentials. Store the private key in the server environment; use `\n` for line breaks if the hosting dashboard requires a single-line value.
- `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` - Facebook Login app credentials.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` - leave empty for demo payment mode.
- `TMDB_API_KEY` - TMDb API key used for movie title searches. Keep it on the server.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` - Twilio SMS credentials and sender number for password-reset OTP delivery.
- `PASSWORD_RESET_OTP_SECRET` - separate random secret of at least 32 characters used to hash OTPs and reset-session tokens.

Password recovery is available after all Twilio and OTP-secret values are configured. Generate the OTP secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the result in `server/.env`; do not use a shared example value or commit this file. Password recovery sends a six-digit OTP to the account's registered phone number. Codes expire after 5 minutes, can be sent at most 3 times in a 15-minute window (at least 60 seconds apart), and allow at most 5 verification attempts. After OTP verification, the browser receives a short-lived HttpOnly reset cookie; the cookie is invalidated when the password is saved. Reset passwords must be 8–72 characters and include a letter and a number.

Location search and reverse geocoding currently use the public OpenStreetMap Nominatim service. Requests are made by the server, search is submitted explicitly (not on each keystroke), lookups are cached, and requests are spaced to stay within the public service's one-request-per-second limit. Review the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) before deployment; use a dedicated geocoding provider if traffic or production requirements exceed the public service policy.

If OTP delivery fails, check the backend terminal for the Twilio HTTP status and provider error code. Common causes include an unverified destination on a Twilio trial account, an SMS-ineligible sender, disabled destination-country permissions, or incorrect Twilio credentials. A failed delivery clears the pending OTP and does not consume the resend quota.

Movie search queries TMDb and matches results against the MongoDB catalog, so only movies with scheduled ShowTime listings can be booked. Set your key as `TMDB_API_KEY` in `server/.env`; it is used only by the server.

Never commit `server/.env` or place database credentials in frontend files.

## Social sign-in

Google, Apple, and Facebook sign-in use server-side OAuth authorization-code flows. Create a web OAuth app/service for each provider, then register these callback URLs:

- Google: `${PUBLIC_API_URL}/auth/oauth/callback/google`
- Apple: `${PUBLIC_API_URL}/auth/oauth/callback/apple` (configure this as the Sign in with Apple return URL for the service ID in `APPLE_CLIENT_ID`)
- Facebook: `${PUBLIC_API_URL}/auth/oauth/callback/facebook`

For local development, these resolve to `http://localhost:5000/api/auth/oauth/callback/{google|apple|facebook}`. Set the matching server environment variables from `.env.example`; unconfigured providers return a clear sign-in error. A provider must return a verified email address. New social accounts can be created without a phone number and continue through the existing location/preferences setup. They can add an email password later in Account Settings. Password recovery by SMS is available only to accounts with a phone number.

## Run

1. Create a MongoDB Atlas cluster and database user. Add the application IP to the Atlas network access list.
2. Complete `server/.env` using `server/.env.example`.
3. Server: `cd server && npm install && npm run seed && npm run dev`
4. Client: `cd client && npm install && npm run dev` -> http://localhost:5173

The backend API runs on `http://localhost:5000` by default. Its root (`/`) returns API information, and `/api/health` reports database connectivity. Open the client at `http://localhost:5173` to use the booking app.

The server fails visibly if `MONGODB_URI` is missing, invalid, or still contains the placeholder. A locally installed MongoDB server is not required.

## Flow
Splash -> Login / Sign up -> 3-step preferences -> Home -> Movie -> Showtimes -> Seats -> Checkout -> Ticket (QR) -> My bookings (cancel up to 2h before).

## Payments
Leave Razorpay keys empty = demo card form (no charge). Add TEST keys = real Razorpay checkout; the server verifies the signature and amount before booking.
Seats are reserved only after payment succeeds, using an atomic MongoDB update so two people can never get the same seat.

The seed script upserts the 19 listed movies and does not delete existing bookings or movie history. Older sample titles are hidden from the homepage; upcoming releases are shown as Coming Soon and receive no showtimes before their release date.
