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
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ SIMPLIFIED: Use userId directly
    const qrData = {
      type: 'user',
      userId: user._id.toString(),
      username: user.username
    };

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
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/qr/scan
 * Scan any QR code and return info
 */
router.post('/scan', protect, async (req, res) => {
  try {
    const { qrData } = req.body;

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
      // ✅ SIMPLIFIED: Use userId directly
      const userId = parsedQR.userId;
      
      if (String(userId) === String(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot scan your own QR code'
        });
      }

      // ✅ Direct findById lookup - faster than shareCode lookup
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
      // Event QR code handling stays the same
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


module.exports = router;