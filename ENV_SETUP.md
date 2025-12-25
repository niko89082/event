# Environment Variables Setup

## Backend Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/social-app

# JWT Secret (use a strong random string)
JWT_SECRET=your_jwt_secret_here_change_this

# Email Configuration (for password reset)
EMAIL=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# Twilio Configuration (for SMS 2FA and phone verification) - REQUIRED
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Redis Configuration (optional, for caching)
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
PORT=5001
NODE_ENV=development

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# ✅ NEW: Twitter Features - Movie & Song Reviews
# TMDB API (for movie reviews) - Get free API key at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_tmdb_api_key_here

# Spotify API (for song reviews) - Get credentials at https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

## Frontend Environment Variables

Create a `.env` file in the `SocialApp/` directory with:

```bash
API_BASE_URL=http://localhost:5001
PUBLISHABLE_KEY=your_stripe_publishable_key
```

## Twilio Setup Instructions

1. Sign up for a Twilio account at https://www.twilio.com/
2. Get a phone number from the Twilio console
3. Find your Account SID and Auth Token in the Twilio console
4. Add these credentials to your `.env` file

### Twilio Free Trial Notes:
- On the free trial, you can only send SMS to verified phone numbers
- Add test phone numbers in the Twilio console under "Verified Caller IDs"
- Upgrade to a paid account for production use

## Testing Without Twilio

If you don't have Twilio credentials yet:
- The app will log SMS codes to the console instead of sending them
- Check your backend terminal for verification codes
- This is useful for development/testing

## Cornell Email Restriction

The signup process requires users to have a `@cornell.edu` email address. To test with other domains during development, you can temporarily modify the validation in `routes/auth.js`.

## Movie & Song Review API Setup

### TMDB (The Movie Database) API Setup

1. **Get a free API key:**
   - Go to https://www.themoviedb.org/
   - Sign up for a free account
   - Navigate to Settings → API
   - Request an API key (automatic approval for free tier)
   - Copy your API key

2. **Add to `.env` file:**
   ```bash
   TMDB_API_KEY=your_api_key_here
   ```

3. **Note:** The free tier has rate limits but is sufficient for development and moderate use.

### Spotify API Setup

1. **Create a Spotify Developer account:**
   - Go to https://developer.spotify.com/
   - Log in with your Spotify account (or create one)
   - Navigate to Dashboard: https://developer.spotify.com/dashboard

2. **Create a new app:**
   - Click "Create an app"
   - Fill in app name and description
   - Accept the terms
   - Click "Save"

3. **Get your credentials:**
   - In your app dashboard, you'll see:
     - **Client ID** (visible immediately)
     - **Client Secret** (click "Show Client Secret" to reveal)

4. **Add to `.env` file:**
   ```bash
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

5. **Note:** 
   - Spotify uses OAuth 2.0 Client Credentials flow (no user login required)
   - The app will automatically handle token refresh
   - Free tier has generous rate limits for development

### Testing Without API Keys

If you don't have API keys yet, the services will use **mock data** for development:
- Movie searches will return sample results (e.g., "Inception")
- Song searches will return sample results (e.g., "Bohemian Rhapsody")
- This allows you to test the review feature without API keys

### After Adding API Keys

1. **Restart your backend server** for the environment variables to take effect:
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm start
   # or
   node server.js
   ```

2. **Test the review feature:**
   - Open the Create Post screen
   - Tap the movie or music icon
   - Try searching for a movie or song
   - If API keys are working, you'll see real results
   - If not, you'll see mock data

