// routes/profile.js
const express = require('express');
const multer = require('multer');
const User = require('../models/User');
const protect = require('../middleware/auth');
const router = express.Router();

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Destination folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Filename format
  },
});

const upload = multer({ storage });

// Upload Profile Picture
router.post('/upload', protect, upload.single('profilePicture'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profilePicture = `/uploads/${req.file.filename}`; // Store the URL of the uploaded image
    await user.save();

    res.status(200).json({ message: 'Profile picture uploaded successfully', profilePicture: user.profilePicture });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get profile visibility status
router.get('/visibility', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ isPublic: user.isPublic });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile visibility status
router.put('/visibility', protect, async (req, res) => {
  const { isPublic } = req.body;

  try {
    const user = await User.findById(req.user._id);
    user.isPublic = isPublic;
    await user.save();
    res.status(200).json({ message: 'Profile visibility updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete profile
router.delete('/delete', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.status(200).json({ message: 'Profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;