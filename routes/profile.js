// routes/profile.js - FULLY CLEANED: Remove all featuredEvents references
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

// Upload profile picture
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

// Get/Update visibility
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

// Update profile
router.put('/', protect, async (req, res) => {
  const { bio, socialMediaLinks, backgroundImage, theme, colorScheme } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (bio) user.bio = bio;
    if (socialMediaLinks) {
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

// Delete profile
router.delete('/delete', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    return res.status(200).json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
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

// FIXED: Get user profile by ID - removed featuredEvents
router.get('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    console.log(`🟡 Profile request: userId=${userId}, currentUserId=${currentUserId}`);

    // FIXED: Only populate fields that exist in the schema
    const user = await User.findById(userId)
      .populate('followers', 'username profilePicture displayName')
      .populate('following', 'username profilePicture displayName')
      .populate('photos', 'paths uploadDate likes comments')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check follow relationships
    const isFollowing = user.followers.some(
      (f) => f._id.toString() === currentUserId.toString()
    );

    const isSelf = user._id.toString() === currentUserId.toString();

    // Check for pending follow requests
    let hasRequested = false;
    if (user.followRequests && user.followRequests.length > 0) {
      hasRequested = user.followRequests.some(
        (rId) => rId.toString() === currentUserId.toString()
      );
    }

    // Add follower/following counts
    const followersCount = user.followers?.length || 0;
    const followingCount = user.following?.length || 0;

    console.log(`🟢 Profile data: followers=${followersCount}, following=${followingCount}, isFollowing=${isFollowing}`);

    // If user is private and we're not authorized, return limited data
    if (!user.isPublic && !isSelf && !isFollowing) {
      return res.json({
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        displayName: user.displayName,
        bio: user.bio,
        isPublic: user.isPublic,
        isFollowing: false,
        hasRequested,
        followersCount: 0,
        followingCount: 0,
        followers: [],
        following: [],
        photos: [],
        message: 'This account is private.',
      });
    }

    // Return full profile data
    return res.json({
      ...user,
      isFollowing,
      hasRequested,
      followersCount,
      followingCount,
      followers: user.followers || [],
      following: user.following || [],
      photos: user.photos || [],
    });

  } catch (error) {
    console.error('Profile endpoint error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get followers list
router.get('/:userId/followers', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const user = await User.findById(userId)
      .populate('followers', 'username profilePicture displayName bio')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isSelf = userId === currentUserId.toString();
    const isFollowing = user.followers.some(f => f._id.toString() === currentUserId);

    if (!user.isPublic && !isSelf && !isFollowing) {
      return res.status(403).json({ message: 'This account is private' });
    }

    res.json({
      followers: user.followers || [],
      count: user.followers?.length || 0
    });

  } catch (error) {
    console.error('Followers endpoint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get following list
router.get('/:userId/following', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const user = await User.findById(userId)
      .populate('following', 'username profilePicture displayName bio')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isSelf = userId === currentUserId.toString();
    const isFollowing = user.followers?.some(f => f._id.toString() === currentUserId) || false;

    if (!user.isPublic && !isSelf && !isFollowing) {
      return res.status(403).json({ message: 'This account is private' });
    }

    res.json({
      following: user.following || [],
      count: user.following?.length || 0
    });

  } catch (error) {
    console.error('Following endpoint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user photos
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

// Get tagged photos
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

// REMOVED: featuredEvents endpoint since the field doesn't exist

// Profile customization
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

// Block/unblock/report users
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

router.post('/report/:userId', protect, async (req, res) => {
  const { reason } = req.body;
  try {
    const reportedUser = await User.findById(req.params.userId);
    if (!reportedUser) {
      return res.status(404).json({ message: 'Reported user not found' });
    }

    // Handle report logic here
    return res.status(200).json({ message: 'User reported successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Shared events endpoints (if sharedEvents field exists in your schema)
router.get('/:userId/shared-events', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const isOwnProfile = String(userId) === String(currentUserId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user can view this profile
    if (!isOwnProfile && !user.isPublic) {
      const isFollowing = user.followers?.some(f => String(f) === String(currentUserId)) || false;
      if (!isFollowing) {
        return res.status(403).json({ message: 'This account is private' });
      }
    }

    // Get shared events if the field exists
    const sharedEventIds = user.sharedEvents || [];
    
    if (sharedEventIds.length === 0) {
      return res.json({ sharedEvents: [] });
    }

    const sharedEvents = await Event.find({
      _id: { $in: sharedEventIds }
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 });

    let visibleEvents = sharedEvents;
    
    if (!isOwnProfile) {
      visibleEvents = sharedEvents.filter(event => event.isPublic);
    }

    res.json({ sharedEvents: visibleEvents });

  } catch (error) {
    console.error('Get shared events error:', error);
    res.json({ sharedEvents: [] }); // Return empty array instead of error
  }
});

module.exports = router;