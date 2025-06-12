// routes/auth.js - Updated without QR code generation
const express = require('express');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const protect = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const redisClient = require('../config/redis');
const crypto = require('crypto');
const router = express.Router();

// Rate limiter for login and signup
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Signup Route - Simplified without QR generation
router.post(
  '/signup',
  authLimiter,
  [
    check('username', 'Username is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  ],
  async (req, res) => {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, gender } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      
      // Check if username is taken
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }

      let user = new User({
        username,
        email,
        password, 
        gender,
      });

      // shareCode will be automatically generated in pre-save middleware
      await user.save();
     
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });

      // Return user without password
      const userResponse = {
        _id: user._id,
        username: user.username,
        email: user.email,
        shareCode: user.shareCode,
        isPublic: user.isPublic,
        profilePicture: user.profilePicture,
        bio: user.bio
      };

      res.status(201).json({ token, user: userResponse });
    } catch (error) {
      console.error(error); 
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

const generateTwoFactorCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

router.post(
  '/login',
  authLimiter,
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    console.log("here");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    try {

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      
      if (user.twoFactorEnabled) {
        const twoFactorCode = generateTwoFactorCode();
        user.twoFactorCode = twoFactorCode;
        await user.save();

        // Send the 2FA code via email
        const transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
          },
        });
        const mailOptions = {
          from: process.env.EMAIL,
          to: user.email,
          subject: 'Your 2FA Code',
          text: `Your 2FA code is ${twoFactorCode}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return res.status(500).json({ message: 'Server error' });
          } else {
            return res.status(200).json({ message: '2FA code sent' });
          }
        });
      } 
      
      else {
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });

        // Return user without password
        const userResponse = {
          _id: user._id,
          username: user.username,
          email: user.email,
          shareCode: user.shareCode,
          isPublic: user.isPublic,
          profilePicture: user.profilePicture,
          bio: user.bio
        };

        res.status(200).json({ token, user: userResponse });
      }
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Verify 2FA Code
router.post('/verify-2fa', protect, async (req, res) => {
  const { code } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user || user.twoFactorCode !== code) {
      return res.status(400).json({ message: 'Invalid 2FA code' });
    }

    // Clear the 2FA code after successful verification
    user.twoFactorCode = null;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // Return user without password
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      shareCode: user.shareCode,
      isPublic: user.isPublic,
      profilePicture: user.profilePicture,
      bio: user.bio
    };

    res.status(200).json({ token, user: userResponse });
  } catch (error) {
    res.status (500).json({ message: 'Server error' });
  }
});

// Cache user profile data
router.get('/user/:id', protect, async (req, res) => {
  const userId = req.params.id;

  redisClient.get(userId, async (err, user) => {
    if (err) throw err;

    if (user) {
      return res.status(200).json(JSON.parse(user));
    } else {
      try {
        const user = await User.findById(userId).select('-password');

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        redisClient.setex(userId, 3600, JSON.stringify(user));

        res.status(200).json(user);
      } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  });
});

// Request Password Reset
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save();

    const resetURL = `http://localhost:3000/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransporter({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      to: user.email,
      from: 'passwordreset@example.com',
      subject: 'Password Reset',
      text: `You requested a password reset. Please click on the following link to reset your password: \n\n ${resetURL}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset link sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Token is invalid or has expired' });
    }

    user.password = password; // Hashing will be handled in pre-save middleware
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;