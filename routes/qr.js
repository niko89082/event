// routes/qr.js - QR Code API Routes
const express = require('express');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

router.get('/:eventId/qr', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('title host coHosts');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check if user is host or co-host
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(
      coHost => String(coHost) === String(req.user._id)
    );

    if (!isHost && !isCoHost) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only hosts and co-hosts can access event QR codes' 
      });
    }

    // SIMPLIFIED: Just use the event ID directly
    const qrData = {
      type: 'event',
      eventId: eventId,
      eventTitle: event.title
    };

    console.log(`✅ Generated simple event QR for ${eventId}`);

    res.json({
      success: true,
      event: {
        _id: event._id,
        title: event.title
      },
      qrData: qrData
    });

  } catch (error) {
    console.error('Get event QR error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get event QR code' 
    });
  }
});

router.get('/my-code', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('username profilePicture');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // SIMPLIFIED: Just use the user ID directly
    const qrData = {
      type: 'user',
      userId: user._id.toString(),
      username: user.username
    };

    console.log('📱 Generated simple user QR:', qrData);

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture
      },
      qrData: qrData
    });
  } catch (error) {
    console.error('Get user QR error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * POST /api/qr/scan
 * Scan any QR code and return info
 */
router.post('/scan', protect, async (req, res) => {
  try {
    const { qrData } = req.body;

    console.log('🔍 Simple QR scan:', qrData);

    let parsedQR;
    try {
      parsedQR = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    if (parsedQR.type === 'user') {
      // User QR code
      const userId = parsedQR.userId;
      
      if (String(userId) === String(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot scan your own QR code'
        });
      }

      const User = require('../models/User');
      const user = await User.findById(userId).select('username profilePicture bio isPublic followers');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const isFollowing = user.followers.includes(req.user._id);

      res.json({
        success: true,
        type: 'user',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture,
          bio: user.bio,
          isPublic: user.isPublic,
          isFollowing: isFollowing,
          followerCount: user.followers.length
        }
      });

    } else if (parsedQR.type === 'event') {
      // Event QR code
      const eventId = parsedQR.eventId;
      
      const Event = require('../models/Event');
      const event = await Event.findById(eventId).select('title time location host attendees');
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const isAttending = event.attendees.some(attendee => 
        String(attendee._id || attendee) === String(req.user._id)
      );

      res.json({
        success: true,
        type: 'event',
        event: {
          _id: event._id,
          title: event.title,
          time: event.time,
          location: event.location,
          isAttending: isAttending,
          attendeeCount: event.attendees.length
        }
      });

    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported QR code type'
      });
    }

  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scan QR code'
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