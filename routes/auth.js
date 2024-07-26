const express = require('express');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const QRCode = require('qrcode');

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

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });

      res.status(200).json({ token, user });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;