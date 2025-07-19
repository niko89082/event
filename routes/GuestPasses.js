// routes/guestPasses.js - PHASE 1: Updated routes with privacy level support

const express = require('express');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const Event = require('../models/Event');
const GuestPass = require('../models/GuestPass');
const User = require('../models/User');
const protect = require('../middleware/auth');
const { validateGuestRSVPAccess, canAccessEvent } = require('../middleware/guestPassValidation');

const router = express.Router();

// Rate limiting
const createGuestPassLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many guest passes created from this IP'
});

const rsvpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: 'Too many RSVP attempts from this IP'
});

// ============================================
// PHASE 1: ENHANCED GUEST PASS CREATION WITH PRIVACY VALIDATION
// ============================================
router.post('/:eventId/guest-pass', protect, createGuestPassLimiter, async (req, res) => {
  try {
    const { guestName, guestEmail, guestPhone } = req.body;
    
    if (!guestName?.trim()) {
      return res.status(400).json({ message: 'Guest name is required' });
    }
    
    // Find event and populate host info
    const event = await Event.findById(req.params.eventId).populate('host', 'paymentAccounts username');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify user can create guest passes for this event
    const isHost = String(event.host._id) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(coHost => String(coHost) === String(req.user._id));
    
    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Only hosts and co-hosts can create guest passes' });
    }

    // PHASE 1: Fixed privacy level validation (removed secret)
    const privacyValidation = validatePrivacyForGuestPass(event.privacyLevel, event.permissions);
    
    if (!privacyValidation.allowed) {
      return res.status(400).json({
        message: privacyValidation.message,
        suggestion: privacyValidation.suggestion
      });
    }

    // Show warnings if any
    if (privacyValidation.warning) {
      console.log(`⚠️ Guest pass warning for event ${event._id}:`, privacyValidation.warning);
    }

    // Calculate expiry based on privacy level and event settings
    const expiresAt = calculateGuestPassExpiry(event);

    // Generate unique token
    const guestPassData = {
      eventId: event._id,
      guestName: guestName.trim(),
      guestEmail: guestEmail?.trim(),
      guestPhone: guestPhone?.trim(),
      createdBy: req.user._id,
      expiresAt,
      privacyLevel: event.privacyLevel // Store for validation
    };

    const token = jwt.sign(guestPassData, process.env.JWT_SECRET, {
      expiresIn: '7d' // Max 7 days
    });

    // Create guest pass record
    const guestPass = new GuestPass({
      event: event._id,
      createdBy: req.user._id,
      guestName: guestName.trim(),
      guestEmail: guestEmail?.trim(),
      guestPhone: guestPhone?.trim(),
      token,
      expiresAt,
      privacyLevel: event.privacyLevel
    });

    await guestPass.save();

    // Generate QR code
    const qrCodeData = {
      type: 'guest-pass',
      token,
      eventId: event._id,
      eventTitle: event.title
    };

    const qrCode = await QRCode.toDataURL(JSON.stringify(qrCodeData));

    // Create shareable link
    const shareableLink = `${process.env.FRONTEND_URL}/guest-pass/${token}`;

    console.log(`✅ Guest pass created for event ${event._id} by ${req.user._id}`);

    res.status(201).json({
      success: true,
      guestPass: {
        _id: guestPass._id,
        guestName: guestPass.guestName,
        token,
        qrCode,
        shareableLink,
        expiresAt,
        eventTitle: event.title,
        privacyLevel: event.privacyLevel
      },
      privacyInfo: {
        level: event.privacyLevel,
        message: privacyValidation.message,
        info: privacyValidation.info,
        warning: privacyValidation.warning
      }
    });

  } catch (error) {
    console.error('Guest pass creation error:', error);
    res.status(500).json({
      message: 'Failed to create guest pass',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Please try again.'
    });
  }
});

// ============================================
// PHASE 1 COMPLETED: HELPER FUNCTIONS WITH FIXED PRIVACY VALIDATION
// ============================================

/**
 * PHASE 1 COMPLETED: Validate if guest passes are allowed for this privacy level
 */
function validatePrivacyForGuestPass(privacyLevel, permissions) {
  switch (privacyLevel) {
    case PRIVACY_LEVELS.PUBLIC:
      return {
        allowed: true,
        message: 'Guest passes allowed for public events',
        info: 'Guests can join this public event'
      };
      
    case PRIVACY_LEVELS.FRIENDS:
      return {
        allowed: true,
        message: 'Guest passes allowed for friends-only events',
        info: 'Guests can access this event via direct invitation, but it won\'t appear in their feeds',
        warning: 'Event is limited to your followers, but guests can still join via invitation'
      };
      
    case PRIVACY_LEVELS.PRIVATE:
      return {
        allowed: true,
        message: 'Guest passes allowed for private events',
        info: 'Only invited guests can access this private event'
      };
      
    default:
      return {
        allowed: false,
        message: 'Unknown privacy level'
      };
  }
}

/**
 * PHASE 1 COMPLETED: Calculate guest pass expiry based on privacy level and event settings
 */
function calculateGuestPassExpiry(event) {
  const eventTime = new Date(event.time);
  const now = new Date();
  
  // For friends/private events, moderate expiry
  if ([PRIVACY_LEVELS.FRIENDS, PRIVACY_LEVELS.PRIVATE].includes(event.privacyLevel)) {
    return new Date(eventTime.getTime() - (4 * 60 * 60 * 1000)); // 4 hours before
  }
  
  // For public events, standard expiry
  return new Date(eventTime.getTime() - (1 * 60 * 60 * 1000)); // 1 hour before
}

// ============================================
// PHASE 1: ENHANCED GUEST RSVP PAGE WITH PRIVACY SUPPORT
// ============================================
router.get('/rsvp/:token', validateGuestRSVPAccess, async (req, res) => {
  try {
    const guestPass = req.guestPass; // Set by middleware
    
    // Check if already confirmed
    if (guestPass.status === 'confirmed') {
      return res.render('guest-rsvp-success', {
        guestPass,
        event: guestPass.event,
        alreadyConfirmed: true,
        qrCode: guestPass.qrData.code,
        privacyLevel: guestPass.event.privacyLevel
      });
    }

    // PHASE 1: Privacy-specific messaging
    const privacyInfo = getPrivacyInfoForGuest(guestPass.event.privacyLevel);

    // Render RSVP page with privacy context
    res.render('guest-rsvp', {
      guestPass,
      event: guestPass.event,
      requiresPayment: guestPass.payment.required,
      amount: guestPass.payment.amount,
      currency: guestPass.payment.currency,
      priceDisplay: `${(guestPass.payment.amount / 100).toFixed(2)}`,
      eventDate: guestPass.event.time.toLocaleDateString(),
      eventTime: guestPass.event.time.toLocaleTimeString(),
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      token: req.params.token,
      privacyLevel: guestPass.event.privacyLevel,
      privacyInfo: privacyInfo
    });
    
  } catch (error) {
    console.error('❌ Error loading RSVP page:', error);
    res.status(500).render('guest-rsvp-error', { 
      error: 'Something went wrong. Please try again.'
    });
  }
});

// ============================================
// PHASE 1: HELPER FUNCTIONS FOR PRIVACY VALIDATION
// ============================================


function getPrivacyInfoForGuest(privacyLevel) {
  switch (privacyLevel) {
    case 'public':
      return {
        type: 'Public Event',
        description: 'This is a public event that anyone can discover and join.',
        icon: 'globe'
      };
      
    case 'friends':
      return {
        type: 'Friends Only Event',
        description: 'This event is limited to the host\'s followers, but you\'ve been personally invited.',
        icon: 'people'
      };
      
    case 'private':
      return {
        type: 'Private Event',
        description: 'This is a private event that requires an invitation to attend.',
        icon: 'lock'
      };
      
    case 'secret':
      return {
        type: 'Secret Event',
        description: 'This is a secret event with limited visibility and sharing.',
        icon: 'eye-off'
      };
      
    default:
      return {
        type: 'Event',
        description: 'You\'ve been invited to this event.',
        icon: 'calendar'
      };
  }
}

module.exports = router;