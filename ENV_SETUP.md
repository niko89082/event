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

