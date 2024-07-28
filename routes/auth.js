const express = require('express');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const router = express.Router();

// Signup Route
router.post(
  '/signup',
  [
    check('username', 'Username is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('dateOfBirth', 'Please include a valid date of birth in the format YYYY-MM-DD').isDate(),
    check('gender', 'Gender is required').isIn(['Male', 'Female', 'Other']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, gender, dateOfBirth, backgroundImage, theme, colorScheme, bio, socialMediaLinks } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      let user = new User({
        username,
        email,
        password, // Password will be hashed in the pre-save hook
        gender,
        dateOfBirth,
        backgroundImage,
        theme,
        colorScheme,
        bio,
        socialMediaLinks: JSON.parse(socialMediaLinks)
      });

      // Generate the QR code
      const qrCodeData = user._id.toString(); // Using the user ID
      const qrCode = await QRCode.toDataURL(qrCodeData);

      // Update user with QR code
      user.qrCode = qrCode;
      await user.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });

      res.status(201).json({ token, user });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Generate 2FA Code
const generateTwoFactorCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Login Route
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
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

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      if (user.twoFactorEnabled) {
        const twoFactorCode = generateTwoFactorCode();
        user.twoFactorCode = twoFactorCode;
        await user.save();

        // Send the 2FA code via email
        const transporter = nodemailer.createTransport({
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
      } else {
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });

        res.status(200).json({ token, user });
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

    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;