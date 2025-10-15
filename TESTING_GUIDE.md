# Testing Guide - Authentication System

## Pre-Testing Setup

### 1. Environment Configuration

**Backend `.env` file:**
```bash
MONGODB_URI=mongodb://localhost:27017/social-app
JWT_SECRET=your_secure_jwt_secret_here
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
EMAIL=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
PORT=5001
```

**Frontend `SocialApp/.env` file:**
```bash
API_BASE_URL=http://localhost:5001
PUBLISHABLE_KEY=your_stripe_key
```

### 2. Start Services

```bash
# Terminal 1 - MongoDB
mongod

# Terminal 2 - Backend
cd /path/to/new_project
npm start

# Terminal 3 - Frontend
cd /path/to/new_project/SocialApp
npm start
```

## Test Scenarios

### Scenario 1: New User Signup (Happy Path)

**Steps:**
1. Open the app, tap "Create New Account"
2. **Step 1 - Personal Info:**
   - Enter first name: "John"
   - Enter last name: "Doe"
   - Enter username: "johndoe123" (3-20 chars)
   - Select date of birth: January 15, 2000
   - Tap "Next"
3. **Step 2 - Contact & Security:**
   - Enter email: "jd123@cornell.edu"
   - Enter phone: "+1 234 567 8901"
   - Enter password: "password123" (6+ chars)
   - Confirm password: "password123"
   - Tap "Create Account"
4. **Phone Verification:**
   - Check SMS for 6-digit code (or check backend console if Twilio not configured)
   - Enter the 6-digit code
   - Should auto-verify and login

**Expected Results:**
- ✅ Progress through both steps
- ✅ SMS code received
- ✅ Auto-login after verification
- ✅ User lands on home feed

### Scenario 2: Signup Validation Errors

**Test Cases:**

**A. Invalid First/Last Name:**
- Leave first name empty → Error: "First name is required"

**B. Invalid Username:**
- Enter "ab" → Error: "Username must be 3-20 characters"
- Enter "user_with_very_long_username" (21+ chars) → Error: "Username must be 3-20 characters"
- Enter "user@name" → Error: "Username can only contain letters, numbers, and underscores"

**C. Invalid Date of Birth:**
- Select date less than 13 years ago → Error: "You must be at least 13 years old"

**D. Invalid Email:**
- Enter "test@gmail.com" → Error: "Must use a Cornell email address (@cornell.edu)"
- Enter "test@cornell" → Error: "Invalid email format"

**E. Invalid Password:**
- Enter "12345" → Error: "Password must be at least 6 characters"
- Password doesn't match confirmation → Error: "Passwords do not match"

**F. Duplicate User:**
- Try to register with existing email → Error: "Email already registered"
- Try to register with existing username → Error: "Username already taken"
- Try to register with existing phone → Error: "Phone number already registered"

### Scenario 3: Phone Verification

**Test Cases:**

**A. Correct Code:**
- Enter correct 6-digit code → Success, auto-login

**B. Incorrect Code:**
- Enter wrong code → Error: "Invalid verification code"
- Code entry should clear

**C. Expired Code:**
- Wait 11 minutes after signup
- Try to verify → Error: "Verification code has expired"

**D. Resend Code:**
- Tap "Resend Code"
- New code should be sent
- 60-second countdown should start
- Can't resend until countdown finishes

### Scenario 4: Login with Email

**Steps:**
1. On login screen, ensure "Email" is selected
2. Enter email: "jd123@cornell.edu"
3. Enter password: "password123"
4. Tap "Log In"
5. 2FA screen appears
6. Enter 6-digit SMS code
7. Should be logged in

**Expected Results:**
- ✅ 2FA screen shows masked phone: ***-***-8901
- ✅ SMS code received
- ✅ Successfully logged in after verification

### Scenario 5: Login with Phone

**Steps:**
1. On login screen, tap "Phone" toggle
2. Enter phone: "+1 234 567 8901"
3. Enter password: "password123"
4. Tap "Log In"
5. Enter 2FA code
6. Should be logged in

**Expected Results:**
- ✅ Input field changes to phone-pad keyboard
- ✅ Phone formatted correctly
- ✅ 2FA flow identical to email login

### Scenario 6: Login Errors

**Test Cases:**

**A. Wrong Credentials:**
- Enter wrong email/phone → Error: "Invalid credentials"
- Enter wrong password → Error: "Invalid credentials"

**B. Unverified Phone:**
- Try to login with account that hasn't verified phone
- Error: "Please verify your phone number before logging in"
- Should redirect to phone verification

**C. Expired 2FA Code:**
- Get 2FA code
- Wait 11 minutes
- Try to verify → Error: "2FA code has expired. Please request a new one."

### Scenario 7: Password Strength Indicator

**Test in Signup Step 2:**
1. Type "pass" → Shows "Weak" in red
2. Type "password" → Shows "Medium" in orange
3. Type "strongpassword123" → Shows "Strong" in green
4. Visual bar grows with password length

### Scenario 8: Multi-Step Navigation

**Test Cases:**

**A. Back Button Behavior:**
- In Step 1, back button → Returns to login
- In Step 2, back button → Returns to Step 1
- Data should be preserved when going back

**B. Progress Indicator:**
- Step 1: First dot active, line inactive, second dot inactive
- Step 2: Both dots active, line active

### Scenario 9: Edge Cases

**A. Keyboard Handling:**
- Input fields should scroll into view when keyboard appears
- Keyboard should dismiss when tapping outside
- Tab/return should focus next field

**B. Network Errors:**
- Turn off backend
- Try to signup → Error: "Network error. Please check your connection"
- Should handle gracefully without crash

**C. Rate Limiting:**
- Try to resend SMS code 6 times within an hour
- Should get: "Too many SMS requests. Please try again later."

**D. Phone Number Formats:**
- Test with: "+1 (234) 567-8901"
- Test with: "2345678901"
- Test with: "234-567-8901"
- All should be normalized to: "+12345678901"

## Testing Without Twilio

If you haven't set up Twilio yet:

1. Check backend console for verification codes
2. Look for logs like: `📱 Sending verification code to +12345678901`
3. The actual code should be logged (only in development)
4. Use that code in the verification screen

**Note:** SMS will NOT actually be sent without proper Twilio credentials.

## Mobile Testing

### iOS Simulator:
```bash
cd SocialApp
npm start
# Press 'i' for iOS
```

### Android Emulator:
```bash
cd SocialApp
npm start
# Press 'a' for Android
```

### Physical Device:
1. Install Expo Go app
2. Scan QR code from terminal
3. App will load on device

## Backend API Testing (Postman/cURL)

### Test Signup:
```bash
curl -X POST http://localhost:5001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "email": "jd123@cornell.edu",
    "phoneNumber": "+12345678901",
    "password": "password123",
    "dateOfBirth": "2000-01-15"
  }'
```

### Test Login:
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "jd123@cornell.edu",
    "password": "password123"
  }'
```

### Test Phone Verification:
```bash
curl -X POST http://localhost:5001/api/auth/verify-phone \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_FROM_SIGNUP",
    "code": "123456"
  }'
```

## Database Testing

### Check User in MongoDB:
```javascript
// Connect to MongoDB
mongosh

// Use database
use social-app

// Find user
db.users.findOne({ email: "jd123@cornell.edu" })

// Verify fields exist:
// - firstName, lastName
// - phoneNumber (should be E.164 format: +12345678901)
// - phoneVerified (should be true after verification)
// - dateOfBirth
// - college (should be "Cornell University")
```

## Cleanup Between Tests

### Delete Test User:
```javascript
// MongoDB
db.users.deleteOne({ email: "jd123@cornell.edu" })

// Or delete all test users
db.users.deleteMany({ email: /@cornell\.edu$/ })
```

## Common Issues & Solutions

### Issue: "Cannot read property 'navigate' of undefined"
**Solution:** Ensure navigation prop is passed correctly

### Issue: "Network request failed"
**Solution:** 
- Check backend is running on port 5001
- Verify API_BASE_URL in .env
- For iOS simulator, use http://localhost:5001
- For Android emulator, use http://10.0.2.2:5001
- For physical device, use your computer's IP

### Issue: SMS not received
**Solution:**
- Check Twilio credentials
- Verify phone number is verified in Twilio (free trial)
- Check backend console for errors
- Ensure TWILIO_PHONE_NUMBER includes country code

### Issue: "Invalid verification code"
**Solution:**
- Code is case-sensitive (though it's only digits)
- Code expires after 10 minutes
- Try resending the code

### Issue: Date picker not showing
**Solution:**
- iOS: Should show spinner picker
- Android: Should show calendar dialog
- Check @react-native-community/datetimepicker is installed

### Issue: Phone input not working
**Solution:**
- Check react-native-phone-number-input is installed
- Verify import is correct
- May need to rebuild app after installing

## Success Criteria

All tests pass if:
- ✅ Users can only register with @cornell.edu email
- ✅ All required fields are validated
- ✅ Phone verification is required before access
- ✅ 2FA is required on every login
- ✅ Both email and phone login work
- ✅ SMS codes are sent and verified correctly
- ✅ UI is responsive and user-friendly
- ✅ Error messages are clear and helpful
- ✅ No crashes or unhandled exceptions
- ✅ Data is correctly stored in MongoDB

## Performance Testing

- Signup should complete in < 3 seconds (excluding SMS)
- Login should complete in < 2 seconds (excluding SMS)
- Phone verification should complete instantly
- SMS delivery should be < 10 seconds
- No memory leaks during repeated auth flows

## Security Testing

- ✅ Passwords are hashed in database
- ✅ JWT tokens are required for protected routes
- ✅ Rate limiting prevents brute force
- ✅ Verification codes expire
- ✅ Old codes can't be reused
- ✅ Phone numbers are validated
- ✅ Cornell emails are enforced

---

## Reporting Issues

When reporting issues, include:
1. Exact steps to reproduce
2. Expected vs actual result
3. Screenshots/screen recording
4. Console errors (both backend and frontend)
5. Environment (iOS/Android, simulator/device)
6. Package versions

