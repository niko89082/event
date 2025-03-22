// routes/profile.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const protect = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

router.post('/upload', protect, upload.single('profilePicture'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profilePicture = `/uploads/${req.file.filename}`;
    await user.save();

    return res.status(200).json({
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ------------------------
// 2) Get / Update Visibility
//    GET /profile/visibility
//    PUT /profile/visibility
// ------------------------
router.get('/visibility', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return res.status(200).json({ isPublic: user.isPublic });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/visibility', protect, async (req, res) => {
  const { isPublic } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (typeof isPublic !== 'undefined') {
      user.isPublic = !!isPublic;
    }
    await user.save();
    return res.status(200).json({
      message: 'Profile visibility updated successfully',
      isPublic: user.isPublic
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ------------------------
// 3) Update Profile (bio, etc.)
//    PUT /profile
// ------------------------
router.put('/', protect, async (req, res) => {
  const { bio, socialMediaLinks, backgroundImage, theme, colorScheme } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (bio) user.bio = bio;
    if (socialMediaLinks) {
      // If you are sending JSON as a string from the client
      user.socialMediaLinks = typeof socialMediaLinks === 'string'
        ? JSON.parse(socialMediaLinks)
        : socialMediaLinks;
    }
    if (backgroundImage) user.backgroundImage = backgroundImage;
    if (theme) user.theme = theme;
    if (colorScheme) user.colorScheme = colorScheme;

    await user.save();
    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/delete', protect, async (req, res) => {
  try {
    // (Optional) remove user’s uploads from disk, events, etc.
    // For now, just removing the user doc:
    await User.findByIdAndDelete(req.user._id);
    return res.status(200).json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username _id' },
          { path: 'event', select: 'title time' },
        ],
      })
      .populate('followers', '_id username')
      .populate('following', '_id username');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    const user = await User.findById(targetUserId)
      .select('-password')
      .populate('followers', '_id username')
      .populate('following', '_id username')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username _id' },
          { path: 'event', select: 'title time' },
        ],
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = user.followers.some(
      (follower) => follower._id.toString() === currentUserId.toString()
    );

    return res.json({
      ...user.toObject(),
      isFollowing,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:userId/photos', protect, async (req, res) => {
  try {
    const photos = await Photo.find({ user: req.params.userId })
      .populate('event', 'title time')
      .populate('user', 'username _id');
    return res.status(200).json(photos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:userId/tagged', protect, async (req, res) => {
  try {
    const photos = await Photo.find({ tags: req.params.userId })
      .populate('event', 'title time')
      .populate('user', 'username');
    return res.status(200).json(photos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:userId/featured-events', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('featuredEvents', 'title time location');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(user.featuredEvents);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 7d) Update user profile customization (backgroundImage, theme, etc.)
router.put('/customize', protect, upload.single('backgroundImage'), async (req, res) => {
  const { theme, colorScheme, bio, socialMediaLinks } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.file) {
      user.backgroundImage = `/uploads/${req.file.filename}`;
    }
    if (theme) user.theme = theme;
    if (colorScheme) user.colorScheme = colorScheme;
    if (bio) user.bio = bio;
    if (socialMediaLinks) {
      user.socialMediaLinks = typeof socialMediaLinks === 'string'
        ? JSON.parse(socialMediaLinks)
        : socialMediaLinks;
    }

    await user.save();
    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 7e) Block a user
router.put('/block/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.blockedUsers.includes(req.params.userId)) {
      user.blockedUsers.push(req.params.userId);
      await user.save();
    }

    return res.status(200).json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 7f) Unblock a user
router.put('/unblock/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.blockedUsers.includes(req.params.userId)) {
      user.blockedUsers.pull(req.params.userId);
      await user.save();
    }

    return res.status(200).json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 7g) Report a user
router.post('/report/:userId', protect, async (req, res) => {
  const { reason } = req.body;
  try {
    const reportedUser = await User.findById(req.params.userId);
    if (!reportedUser) {
      return res.status(404).json({ message: 'Reported user not found' });
    }

    // Handle your "report" logic as needed (logging, admin notification, etc.)
    return res.status(200).json({ message: 'User reported successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Finally, export the router
module.exports = router;