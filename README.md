# Social App - Cornell University

A social networking platform built for Cornell University students with event management, photo sharing, and enhanced security features.

## 🚀 Features

### Authentication & Security
- **Cornell Email Restriction**: Only @cornell.edu email addresses can register
- **Phone-Based 2FA**: SMS verification via Twilio for enhanced security
- **Multi-Step Registration**: Comprehensive user data collection
- **Flexible Login**: Login with either email or phone number
- **Phone Verification**: Required phone number verification for all users

### User Management
- First and last name collection
- Username (3-20 characters)
- Date of birth validation
- Profile customization
- Friends system with request management

### Events & Social Features
- Event creation and management
- QR code check-in system
- Photo sharing and memories
- Real-time notifications
- Payment integration (Stripe)
- Event discovery and search

## 📋 Prerequisites

- Node.js (v20.19.3 or higher)
- MongoDB
- Redis (optional, for caching)
- Twilio account (for SMS functionality)
- Expo CLI (for mobile app development)

## 🔧 Installation

### Backend Setup

1. Clone the repository and navigate to the project root:
```bash
cd new_project
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in all required credentials
   - See [ENV_SETUP.md](ENV_SETUP.md) for detailed instructions

4. Start the backend server:
```bash
npm start
```

### Frontend Setup

1. Navigate to the SocialApp directory:
```bash
cd SocialApp
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in SocialApp directory with:
```bash
API_BASE_URL=http://localhost:5001
PUBLISHABLE_KEY=your_stripe_publishable_key
```

4. Start the Expo development server:
```bash
npm start
```

## 🔐 Authentication Flow

### New User Registration

1. **Personal Information** (Step 1)
   - First Name
   - Last Name
   - Username (3-20 characters)
   - Date of Birth

2. **Contact & Security** (Step 2)
   - Cornell Email (@cornell.edu required)
   - Phone Number (with country code)
   - Password (minimum 6 characters)
   - Password Confirmation

3. **Phone Verification**
   - SMS code sent to provided phone number
   - 6-digit verification code
   - 10-minute expiration
   - Resend option available

### User Login

1. Choose login method (Email or Phone)
2. Enter credentials
3. Receive 2FA code via SMS
4. Enter verification code
5. Access granted

## 📱 Mobile App Features

- Modern, intuitive UI matching iOS/Android design guidelines
- Real-time updates and notifications
- Camera integration for photo uploads
- QR code scanning for event check-in
- Smooth animations and transitions

## 🛠️ Technology Stack

### Backend
- Node.js + Express
- MongoDB (Mongoose)
- JWT for authentication
- Twilio for SMS
- Stripe for payments
- Redis for caching
- bcrypt for password hashing

### Frontend (React Native)
- Expo
- React Navigation
- React Native Phone Input
- DateTimePicker
- Ionicons

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/signup`
Register a new user (Cornell email required)

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "jd123@cornell.edu",
  "phoneNumber": "+12345678901",
  "password": "securepassword",
  "dateOfBirth": "2000-01-15"
}
```

#### POST `/api/auth/login`
Login with email or phone number

**Request Body:**
```json
{
  "identifier": "jd123@cornell.edu",  // or phone number
  "password": "securepassword"
}
```

#### POST `/api/auth/verify-phone`
Verify phone number with SMS code

**Request Body:**
```json
{
  "userId": "user_id_here",
  "code": "123456"
}
```

#### POST `/api/auth/verify-2fa`
Verify 2FA code during login

**Request Body:**
```json
{
  "userId": "user_id_here",
  "code": "123456"
}
```

#### POST `/api/auth/resend-phone-code`
Resend verification code

**Request Body:**
```json
{
  "userId": "user_id_here"
}
```

## 🔒 Security Features

- Rate limiting on authentication endpoints
- SMS rate limiting (5 per hour per IP)
- Password hashing with bcrypt
- JWT token authentication
- Phone number verification required
- Cornell email domain validation
- 2FA for all logins

## 🧪 Testing

### Testing Without Twilio

During development, if Twilio is not configured, verification codes will be logged to the console. Check your backend terminal for codes.

### Adding Test Users

For testing, you can temporarily modify the Cornell email restriction in `routes/auth.js` (not recommended for production).

## 📝 Environment Variables

See [ENV_SETUP.md](ENV_SETUP.md) for complete environment variable documentation.

Required variables:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `JWT_SECRET`
- `MONGODB_URI`

## 🤝 Contributing

This is a Cornell University project. Please follow the contribution guidelines and ensure all tests pass before submitting pull requests.

## 📄 License

Private - Cornell University

## 🐛 Troubleshooting

### SMS Not Sending
- Verify Twilio credentials are correct
- Check Twilio console for errors
- Ensure phone number is in E.164 format
- For free trial, verify recipient phone number in Twilio console

### Registration Failing
- Ensure email ends with @cornell.edu
- Verify all required fields are provided
- Check phone number format
- Ensure username is 3-20 characters

### Login Issues
- Verify phone number is verified
- Check 2FA code hasn't expired (10 minutes)
- Ensure correct credentials
- Try resending verification code

## 📞 Support

For issues or questions, please open an issue in the repository or contact the development team.

