const express = require('express');
const multer = require('multer');
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
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profilePicture = `/uploads/${req.file.filename}`; 
    await user.save();

    res.status(200).json({ message: 'Profile picture uploaded successfully', profilePicture: user.profilePicture });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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
    if (typeof isPublic !== 'undefined') {
      user.isPublic = isPublic;
    }
    await user.save();
    res.status(200).json({ message: 'Profile visibility updated successfully', isPublic: user.isPublic });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update profile
router.put('/', protect, async (req, res) => {
  const { bio, socialMediaLinks, backgroundImage, theme, colorScheme } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (bio) user.bio = bio;
    if (socialMediaLinks) user.socialMediaLinks = JSON.parse(socialMediaLinks || '{}');
    if (backgroundImage) user.backgroundImage = backgroundImage;
    if (theme) user.theme = theme;
    if (colorScheme) user.colorScheme = colorScheme;

    await user.save();
    res.status(200).json(user);
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

// Get user profile
router.get('/', protect, async (req, res) => {
  try {
    // This is key: you must populate('photos')
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('photos');  // <--- populate the photos array

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user); // user.photos => array of Photo docs
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user profile by ID OLD
// router.get('/:userId', protect, async (req, res) => {
//   try {
//     const user = await User.findById(req.params.userId).select('-password');
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });
// routes/profile.js (or wherever your /profile/:userId route is)
router.get('/:userId', protect, async (req, res) => {
  try {
    // userId we want to view:
    const targetUserId = req.params.userId;

    // current user from token:
    const currentUserId = req.user._id;

    // find the user we want to view, populate followers if needed
    const user = await User.findById(targetUserId)
      .populate('followers', '_id username')
      .populate('following', '_id username')
      .populate('photos');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the current user is in this user’s followers array
    const isFollowing = user.followers.some(
      (follower) => follower._id.toString() === currentUserId.toString()
    );

    // Return all user info, plus isFollowing
    res.json({
      ...user.toObject(), // Convert Mongoose doc to a plain object
      isFollowing
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's uploaded photos
router.get('/:userId/photos', protect, async (req, res) => {
  try {
    const photos = await Photo.find({ user: req.params.userId }).populate('event', 'title');
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get photos where user is tagged
router.get('/:userId/tagged', protect, async (req, res) => {
  try {
    const photos = await Photo.find({ tags: req.params.userId }).populate('event', 'title').populate('user', 'username');
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's featured events
router.get('/:userId/featured-events', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('featuredEvents', 'title time location');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user.featuredEvents);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile customization
router.put('/customize', protect, upload.single('backgroundImage'), async (req, res) => {
  const { theme, colorScheme, bio, socialMediaLinks } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (req.file) {
      user.backgroundImage = `/uploads/${req.file.filename}`;
    }
    if (theme) user.theme = theme;
    if (colorScheme) user.colorScheme = colorScheme;
    if (bio) user.bio = bio;
    if (socialMediaLinks) user.socialMediaLinks = JSON.parse(socialMediaLinks);

    await user.save();
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Block a user
router.put('/block/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.blockedUsers.includes(req.params.userId)) {
      user.blockedUsers.push(req.params.userId);
      await user.save();
    }

    res.status(200).json({ message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unblock a user
router.put('/unblock/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.blockedUsers.includes(req.params.userId)) {
      user.blockedUsers.pull(req.params.userId);
      await user.save();
    }

    res.status(200).json({ message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report a user
router.post('/report/:userId', protect, async (req, res) => {
  const { reason } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reportedUser = await User.findById(req.params.userId);
    if (!reportedUser) {
      return res.status(404).json({ message: 'Reported user not found' });
    }

    // Here you can handle the report logic, such as saving the report in the database,
    // sending an email to the admin, etc.

    res.status(200).json({ message: 'User reported successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;