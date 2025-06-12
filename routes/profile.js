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
    path: 'photos',                   // 🌟  remove the old   match:{ visibleInEvent:false }
    populate: [
      { path: 'user',  select: 'username _id' },
      { path: 'event', select: 'title time'   },
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
        path: 'photos',                  // 🌟 no match filter ⇒ event-photos now show
        populate: [
          { path: 'user',  select: 'username _id' },
          { path: 'event', select: 'title time'   },
        ],
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Are we following them?
    const isFollowing = user.followers.some(
      (f) => f._id.toString() === currentUserId.toString()
    );

    // Are we the same user?
    const isSelf = user._id.toString() === currentUserId.toString();

    // If you store followRequests on the user doc:
    let hasRequested = false;
    if (user.followRequests && user.followRequests.length > 0) {
      hasRequested = user.followRequests.some(
        (rId) => rId.toString() === currentUserId.toString()
      );
    }

    // If user is private, but we are not self or follower => hide photos, followers, following
    if (!user.isPublic && !isSelf && !isFollowing) {
      // Return a minimal “private” view:
      return res.json({
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        isPublic: user.isPublic,
        isFollowing,       // we know it's false
        hasRequested,      // show if we have a pending request
        // Hide these arrays entirely:
        followers: [],
        following: [],
        photos: [],
        message: 'This account is private.',
      });
    }

    // Otherwise, they are public or we are allowed => return full doc
    return res.json({
      ...user.toObject(),
      isFollowing,
      hasRequested,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
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
router.get('/:userId/shared-events', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate({
        path: 'sharedEvents',
        populate: { path: 'host', select: 'username' }
      });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sharedEvents = user.sharedEvents || [];
    res.json({ sharedEvents });
  } catch (error) {
    console.error('GET /profile/:userId/shared-events =>', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.put('/:userId/shared-events', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { eventIds } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.sharedEvents = eventIds;
    await user.save();

    return res.json({
      message: 'Shared events updated',
      sharedEvents: user.sharedEvents
    });
  } catch (error) {
    console.error('PUT /profile/:userId/shared-events =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// routes/profile.js
router.get('/:userId/attended-events', protect, async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId)
      .populate({
        path: 'attendingEvents',
        populate: { path: 'host', select: 'username' }
      });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const events = user.attendingEvents || [];

    res.status(200).json({ events });
  } catch (error) {
    console.error('GET /profile/:userId/attended-events =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


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
      // Check if current user follows this user
      const isFollowing = user.followers.some(f => String(f) === String(currentUserId));
      if (!isFollowing) {
        return res.status(403).json({ message: 'This account is private' });
      }
    }

    // Get shared events with full details
    const sharedEventIds = user.sharedEvents || [];
    
    if (sharedEventIds.length === 0) {
      return res.json({ sharedEvents: [] });
    }

    const sharedEvents = await Event.find({
      _id: { $in: sharedEventIds }
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 }); // Sort by upcoming first

    // Filter out events that the requesting user shouldn't see due to privacy
    let visibleEvents = sharedEvents;
    
    if (!isOwnProfile) {
      visibleEvents = [];
      for (const event of sharedEvents) {
        const canView = await EventPrivacyService.checkPermission(
          currentUserId, 
          event._id, 
          'view'
        );
        if (canView.allowed) {
          visibleEvents.push(event);
        }
      }
    }

    res.json({ sharedEvents: visibleEvents });

  } catch (error) {
    console.error('Get shared events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update shared events list
router.put('/:userId/shared-events', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { eventIds } = req.body;
    
    // Only allow users to update their own shared events
    if (String(userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Validate that all events exist and user has access to them
    if (eventIds && eventIds.length > 0) {
      const events = await Event.find({ _id: { $in: eventIds } });
      
      for (const event of events) {
        const isHost = String(event.host) === String(userId);
        const isAttending = event.attendees.some(a => String(a) === String(userId));
        
        if (!isHost && !isAttending) {
          return res.status(400).json({ 
            message: 'You can only share events you are hosting or attending' 
          });
        }
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.sharedEvents = eventIds || [];
    await user.save();

    res.json({
      message: 'Shared events updated successfully',
      sharedEvents: user.sharedEvents
    });

  } catch (error) {
    console.error('Update shared events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;