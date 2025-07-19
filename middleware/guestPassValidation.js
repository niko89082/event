// middleware/guestPassValidation.js - PHASE 1: Guest Pass Token Validation

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const GuestPass = require('../models/GuestPass');

/**
 * PHASE 1: Middleware to validate guest pass tokens for event access
 * Allows non-users to view events they have valid guest passes for
 */
const validateGuestPassAccess = async (req, res, next) => {
  try {
    // Check if guest pass token is provided
    const guestPassToken = req.query.guestToken || req.headers['x-guest-token'];
    
    if (!guestPassToken) {
      // No guest token provided, continue with normal auth flow
      return next();
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(guestPassToken, process.env.JWT_SECRET);
      const tokenHash = crypto.createHash('sha256').update(guestPassToken).digest('hex');
      
      // Find guest pass
      const guestPass = await GuestPass.findOne({
        _id: decoded.guestPassId,
        token: tokenHash,
        nonce: decoded.nonce,
        status: { $nin: ['expired', 'cancelled'] }
      }).populate('event');

      if (!guestPass || !guestPass.event) {
        return res.status(401).json({ message: 'Invalid or expired guest pass' });
      }

      // Check if guest pass is for this specific event
      const eventId = req.params.eventId || req.params.id;
      if (eventId && String(guestPass.event._id) !== String(eventId)) {
        return res.status(403).json({ message: 'Guest pass not valid for this event' });
      }

      // Check expiry
      if (new Date() > guestPass.expiresAt) {
        guestPass.status = 'expired';
        await guestPass.save();
        return res.status(401).json({ message: 'Guest pass has expired' });
      }

      // Add guest pass info to request
      req.guestPass = guestPass;
      req.isGuestAccess = true;
      req.guestEventId = guestPass.event._id;
      
      console.log(`✅ Valid guest pass access for ${guestPass.guestName} to event ${guestPass.event.title}`);
      
    } catch (jwtError) {
      console.error('❌ Guest pass token validation error:', jwtError.message);
      return res.status(401).json({ message: 'Invalid guest pass token' });
    }

    next();
  } catch (error) {
    console.error('❌ Guest pass validation middleware error:', error);
    next(); // Continue without guest access if middleware fails
  }
};

/**
 * PHASE 1: Middleware specifically for guest pass RSVP page access
 * More permissive validation for the RSVP flow
 */
const validateGuestRSVPAccess = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ message: 'Guest pass token required' });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find guest pass
      const guestPass = await GuestPass.findOne({
        _id: decoded.guestPassId,
        token: tokenHash,
        nonce: decoded.nonce
      }).populate({
        path: 'event',
        populate: {
          path: 'host',
          select: 'username paymentAccounts privacyLevel permissions'
        }
      });

      if (!guestPass || !guestPass.event) {
        return res.status(404).json({ message: 'Guest pass not found' });
      }

      // Check if already expired
      if (new Date() > guestPass.expiresAt && guestPass.status !== 'confirmed') {
        guestPass.status = 'expired';
        await guestPass.save();
        return res.status(410).json({ message: 'Guest pass has expired' });
      }

      // PHASE 1: Allow access regardless of privacy level for valid guest passes
      // This fixes the "Friends Only" issue where guests couldn't access RSVP pages
      
      req.guestPass = guestPass;
      req.isGuestRSVP = true;
      
      console.log(`✅ Guest RSVP access validated for ${guestPass.guestName} (Privacy: ${guestPass.event.privacyLevel})`);
      
    } catch (jwtError) {
      console.error('❌ Guest RSVP token validation error:', jwtError.message);
      return res.status(401).json({ message: 'Invalid or expired guest pass' });
    }

    next();
  } catch (error) {
    console.error('❌ Guest RSVP validation middleware error:', error);
    res.status(500).json({ message: 'Server error validating guest pass' });
  }
};

/**
 * PHASE 1: Helper function to check if user/guest can view specific event
 * Combines user auth and guest pass validation
 */
const canAccessEvent = async (eventId, userId = null, guestPassToken = null) => {
  const Event = require('../models/Event');
  
  try {
    const event = await Event.findById(eventId);
    if (!event) return { canAccess: false, reason: 'Event not found' };

    // If user is logged in, use normal user permissions
    if (userId) {
      // Get user's following list for permission checks
      const User = require('../models/User');
      const user = await User.findById(userId).select('following');
      const userFollowing = user ? user.following.map(f => String(f)) : [];
      
      const canView = event.canUserView(userId, userFollowing);
      return { 
        canAccess: canView, 
        reason: canView ? 'User has permission' : 'User lacks permission',
        accessType: 'user'
      };
    }

    // If guest token provided, validate guest access
    if (guestPassToken) {
      try {
        const decoded = jwt.verify(guestPassToken, process.env.JWT_SECRET);
        const tokenHash = crypto.createHash('sha256').update(guestPassToken).digest('hex');
        
        const guestPass = await GuestPass.findOne({
          _id: decoded.guestPassId,
          token: tokenHash,
          nonce: decoded.nonce,
          event: eventId,
          status: { $nin: ['expired', 'cancelled'] }
        });

        if (!guestPass) {
          return { canAccess: false, reason: 'Invalid guest pass', accessType: 'guest' };
        }

        if (new Date() > guestPass.expiresAt) {
          return { canAccess: false, reason: 'Guest pass expired', accessType: 'guest' };
        }

        // PHASE 1: Allow guest access for Friends Only events
        const canGuestView = event.canGuestView(guestPassToken);
        return { 
          canAccess: canGuestView, 
          reason: canGuestView ? 'Valid guest pass' : 'Guest access denied',
          accessType: 'guest',
          guestPass: guestPass
        };
        
      } catch (jwtError) {
        return { canAccess: false, reason: 'Invalid guest token', accessType: 'guest' };
      }
    }

    // No user or valid guest access
    return { canAccess: false, reason: 'No valid access method', accessType: 'none' };
    
  } catch (error) {
    console.error('❌ Error checking event access:', error);
    return { canAccess: false, reason: 'Server error', accessType: 'error' };
  }
};

module.exports = {
  validateGuestPassAccess,
  validateGuestRSVPAccess,
  canAccessEvent
};