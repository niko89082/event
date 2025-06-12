// routes/qr.js - QR Code API Routes
const express = require('express');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/qr/my-code
 * Get current user's share code for QR generation
 */
router.get('/my-code', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('shareCode username profilePicture');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return data needed for QR code generation
    res.json({
      shareCode: user.shareCode,
      username: user.username,
      profilePicture: user.profilePicture,
      qrData: {
        type: 'user_profile',
        shareCode: user.shareCode,
        username: user.username,
        appVersion: '1.0'
      }
    });
  } catch (error) {
    console.error('Get share code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/qr/scan
 * Process scanned QR code and return user information
 */
router.post('/scan', protect, async (req, res) => {
  try {
    const { qrData, shareCode } = req.body;

    let targetShareCode;

    // Handle different QR data formats
    if (typeof qrData === 'string') {
      // Direct share code
      targetShareCode = qrData;
    } else if (qrData && qrData.shareCode) {
      // JSON format
      targetShareCode = qrData.shareCode;
    } else if (shareCode) {
      // Fallback to shareCode parameter
      targetShareCode = shareCode;
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid QR code format' 
      });
    }

    // Find user by share code
    const targetUser = await User.findOne({ shareCode: targetShareCode })
      .select('_id username profilePicture bio isPublic followers');

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if scanning own code
    if (String(targetUser._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot scan your own QR code'
      });
    }

    // Check if already following
    const isFollowing = targetUser.followers.includes(req.user._id);

    // Return user information
    res.json({
      success: true,
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        profilePicture: targetUser.profilePicture,
        bio: targetUser.bio,
        isPublic: targetUser.isPublic,
        isFollowing,
        followerCount: targetUser.followers.length
      }
    });

  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing QR code'
    });
  }
});

/**
 * POST /api/qr/regenerate
 * Regenerate user's share code (invalidates old QR codes)
 */
router.post('/regenerate', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new share code
    await user.regenerateShareCode();

    res.json({
      success: true,
      message: 'Share code regenerated successfully',
      shareCode: user.shareCode,
      qrData: {
        type: 'user_profile',
        shareCode: user.shareCode,
        username: user.username,
        appVersion: '1.0'
      }
    });

  } catch (error) {
    console.error('Regenerate share code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/qr/user/:shareCode
 * Get public user info by share code (for deep linking)
 */
router.get('/user/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;

    const user = await User.findOne({ shareCode })
      .select('_id username profilePicture bio isPublic followers');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return minimal public information
    res.json({
      _id: user._id,
      username: user.username,
      profilePicture: user.profilePicture,
      bio: user.bio,
      isPublic: user.isPublic,
      followerCount: user.followers.length
    });

  } catch (error) {
    console.error('Get user by share code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/qr/quick-follow
 * Quick follow action from QR scan
 */
router.post('/quick-follow', protect, async (req, res) => {
  try {
    const { shareCode } = req.body;

    const targetUser = await User.findOne({ shareCode });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = req.user;

    // Check if already following
    if (targetUser.followers.includes(currentUser._id)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Check if user is private
    if (!targetUser.isPublic) {
      // Handle follow request for private accounts
      if (!targetUser.followRequests.includes(currentUser._id)) {
        targetUser.followRequests.push(currentUser._id);
        await targetUser.save();
      }

      return res.json({
        success: true,
        message: 'Follow request sent',
        action: 'request_sent'
      });
    }

    // Public account - follow directly
    targetUser.followers.push(currentUser._id);
    currentUser.following.push(targetUser._id);

    await Promise.all([
      targetUser.save(),
      currentUser.save()
    ]);

    res.json({
      success: true,
      message: 'Successfully followed user',
      action: 'followed'
    });

  } catch (error) {
    console.error('Quick follow error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;