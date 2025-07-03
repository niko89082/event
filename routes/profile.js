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
// ============================================
// PAYMENT MANAGEMENT ROUTES
// Add these to routes/profile.js around line 50
// ============================================

/**
 * Get current user's payment methods
 */
router.get('/payment-methods', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('paymentAccounts earnings');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const paymentAccounts = user.paymentAccounts || {};
    
    const paymentMethods = {
      paypal: {
        connected: !!paymentAccounts.paypal?.verified,
        email: paymentAccounts.paypal?.email,
        connectedAt: paymentAccounts.paypal?.connectedAt,
        canEdit: true
      },
      stripe: {
        connected: !!paymentAccounts.stripe?.chargesEnabled,
        accountId: paymentAccounts.stripe?.accountId,
        onboardingComplete: paymentAccounts.stripe?.onboardingComplete,
        chargesEnabled: paymentAccounts.stripe?.chargesEnabled,
        connectedAt: paymentAccounts.stripe?.connectedAt,
        canEdit: false // Stripe requires going through their onboarding
      },
      primary: {
        type: paymentAccounts.primary?.type,
        canReceivePayments: user.canReceivePayments()
      },
      earnings: {
        total: user.earnings?.totalEarned || 0,
        available: user.earnings?.availableBalance || 0,
        pending: user.earnings?.pendingBalance || 0,
        currency: user.earnings?.currency || 'USD'
      }
    };

    res.json({
      success: true,
      paymentMethods
    });

  } catch (error) {
    console.error('❌ Get payment methods error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get payment methods',
      error: error.message 
    });
  }
});

/**
 * Setup PayPal payments
 */
router.post('/setup-paypal', protect, async (req, res) => {
  try {
    const { paypalEmail } = req.body;
    
    // Validate input
    if (!paypalEmail || !paypalEmail.includes('@')) {
      return res.status(400).json({ 
        success: false,
        message: 'Valid PayPal email address is required' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Initialize payment accounts if not exists
    if (!user.paymentAccounts) {
      user.paymentAccounts = {};
    }

    // Set up PayPal account
    user.paymentAccounts.paypal = {
      email: paypalEmail.toLowerCase().trim(),
      verified: true,
      connectedAt: new Date(),
      country: 'US'
    };

    // Set as primary if no primary method exists
    if (!user.paymentAccounts.primary?.type) {
      user.paymentAccounts.primary = {
        type: 'paypal',
        isVerified: true,
        canReceivePayments: true,
        lastUpdated: new Date()
      };
    }

    await user.save();

    console.log(`✅ PayPal setup successful for user ${req.user._id}`);
    
    res.json({
      success: true,
      message: 'PayPal account connected successfully',
      provider: 'paypal',
      accountEmail: paypalEmail
    });

  } catch (error) {
    console.error('❌ PayPal setup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to setup PayPal payments',
      error: error.message 
    });
  }
});

/**
 * Update PayPal email address
 */
router.put('/paypal-email', protect, async (req, res) => {
  try {
    const { paypalEmail } = req.body;
    
    // Validate input
    if (!paypalEmail || !paypalEmail.includes('@')) {
      return res.status(400).json({ 
        success: false,
        message: 'Valid PayPal email address is required' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (!user.paymentAccounts?.paypal?.verified) {
      return res.status(400).json({ 
        success: false,
        message: 'No PayPal account found. Please connect PayPal first.' 
      });
    }

    const oldEmail = user.paymentAccounts.paypal.email;

    // Update PayPal account
    user.paymentAccounts.paypal.email = paypalEmail.toLowerCase().trim();
    user.paymentAccounts.paypal.updatedAt = new Date();

    await user.save();

    console.log(`✅ PayPal email updated for user ${req.user._id}: ${oldEmail} -> ${paypalEmail}`);
    
    res.json({
      success: true,
      message: 'PayPal email updated successfully',
      paypalEmail: paypalEmail
    });

  } catch (error) {
    console.error('❌ Update PayPal email error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update PayPal email',
      error: error.message 
    });
  }
});

/**
 * Remove PayPal account
 */
router.delete('/paypal', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (!user.paymentAccounts?.paypal?.verified) {
      return res.status(400).json({ 
        success: false,
        message: 'No PayPal account to remove' 
      });
    }

    const removedEmail = user.paymentAccounts.paypal.email;

    // Remove PayPal account
    delete user.paymentAccounts.paypal;

    // If PayPal was primary, switch to Stripe or clear primary
    if (user.paymentAccounts.primary?.type === 'paypal') {
      if (user.paymentAccounts.stripe?.chargesEnabled) {
        user.paymentAccounts.primary = {
          type: 'stripe',
          isVerified: true,
          canReceivePayments: true,
          lastUpdated: new Date()
        };
      } else {
        delete user.paymentAccounts.primary;
      }
    }

    await user.save();

    console.log(`✅ PayPal account removed for user ${req.user._id}: ${removedEmail}`);
    
    res.json({
      success: true,
      message: 'PayPal account removed successfully'
    });

  } catch (error) {
    console.error('❌ Remove PayPal error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to remove PayPal account',
      error: error.message 
    });
  }
});

/**
 * Set primary payment method
 */
router.put('/primary-payment', protect, async (req, res) => {
  try {
    const { provider } = req.body; // 'paypal' or 'stripe'
    
    if (!['paypal', 'stripe'].includes(provider)) {
      return res.status(400).json({ 
        success: false,
        message: 'Provider must be either "paypal" or "stripe"' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const paymentAccounts = user.paymentAccounts || {};

    // Validate that the requested provider is available
    if (provider === 'paypal' && !paymentAccounts.paypal?.verified) {
      return res.status(400).json({ 
        success: false,
        message: 'PayPal account is not connected' 
      });
    }

    if (provider === 'stripe' && !paymentAccounts.stripe?.chargesEnabled) {
      return res.status(400).json({ 
        success: false,
        message: 'Stripe account is not properly configured' 
      });
    }

    // Set as primary
    user.paymentAccounts.primary = {
      type: provider,
      isVerified: true,
      canReceivePayments: true,
      lastUpdated: new Date()
    };

    await user.save();

    console.log(`✅ Primary payment method set to ${provider} for user ${req.user._id}`);
    res.json({
      success: true,
      message: `${provider === 'paypal' ? 'PayPal' : 'Stripe'} set as primary payment method`,
      primaryProvider: provider
    });

  } catch (error) {
    console.error('❌ Set primary payment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to set primary payment method',
      error: error.message 
    });
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