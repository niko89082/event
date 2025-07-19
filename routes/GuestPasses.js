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

    // PHASE 1: Privacy level validation for guest pass creation
    const privacyValidation = validatePrivacyForGuestPass(event.privacyLevel, event.permissions);
    if (!privacyValidation.allowed) {
      return res.status(400).json({ 
        message: privacyValidation.message,
        privacyLevel: event.privacyLevel,
        suggestion: privacyValidation.suggestion
      });
    }

    // Check if event is paid and validate host payment setup
    const isEventPaid = event.isPaidEvent();
    if (isEventPaid && !event.host.paymentAccounts?.stripe?.chargesEnabled) {
      return res.status(400).json({ 
        message: 'Host must complete payment setup before creating paid guest passes',
        needsPaymentSetup: true
      });
    }

    // Create guest pass with privacy-appropriate settings
    const guestPass = new GuestPass({
      event: event._id,
      guestName: guestName.trim(),
      guestEmail: guestEmail?.trim(),
      guestPhone: guestPhone?.trim(),
      status: 'pending',
      
      // Payment configuration
      payment: {
        required: isEventPaid,
        amount: isEventPaid ? event.ticketPrice : 0,
        currency: event.currency || 'USD',
        status: isEventPaid ? 'pending' : 'not_required'
      },
      
      // Set expiry based on privacy level
      expiresAt: calculateGuestPassExpiry(event),
      
      // PHASE 1: Set permissions based on privacy level
      permissions: getGuestPermissionsForPrivacyLevel(event.privacyLevel)
    });

    // Generate secure token
    const payload = {
      guestPassId: guestPass._id,
      eventId: event._id,
      nonce: crypto.randomBytes(16).toString('hex')
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    guestPass.token = tokenHash;
    guestPass.nonce = payload.nonce;
    await guestPass.save();

    // Create invitation URL
    const inviteUrl = `${process.env.FRONTEND_URL}/guest-pass/rsvp/${token}`;

    console.log(`✅ Guest pass created for ${guestName} (Privacy: ${event.privacyLevel})`);

    res.status(201).json({
      success: true,
      message: 'Guest pass created successfully',
      guestPass: {
        id: guestPass._id,
        guestName: guestPass.guestName,
        status: guestPass.status,
        expiresAt: guestPass.expiresAt,
        privacyLevel: event.privacyLevel
      },
      payment: {
        required: isEventPaid,
        amount: guestPass.payment.amount,
        currency: guestPass.payment.currency
      },
      inviteUrl: inviteUrl,
      privacyInfo: privacyValidation.info
    });

  } catch (error) {
    console.error('❌ Create guest pass error:', error);
    res.status(500).json({ 
      message: 'Failed to create guest pass', 
      error: error.message 
    });
  }
});

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

/**
 * Validate if guest passes are allowed for this privacy level
 */
function validatePrivacyForGuestPass(privacyLevel, permissions) {
  switch (privacyLevel) {
    case 'public':
      return {
        allowed: true,
        message: 'Guest passes allowed for public events',
        info: 'Guests can join this public event'
      };
      
    case 'friends':
      return {
        allowed: true,
        message: 'Guest passes allowed for friends-only events',
        info: 'Guests can access this event via direct invitation, but it won\'t appear in their feeds',
        warning: 'Event is limited to your followers, but guests can still join via invitation'
      };
      
    case 'private':
      return {
        allowed: true,
        message: 'Guest passes allowed for private events',
        info: 'Only invited guests can access this private event'
      };
      
    case 'secret':
      // Secret events allow guest passes but with restrictions
      if (permissions?.canInvite === 'host-only') {
        return {
          allowed: true,
          message: 'Guest passes allowed but restricted for secret events',
          info: 'Only you can create invitations for this secret event',
          warning: 'Guest passes will not be shareable by attendees'
        };
      }
      return {
        allowed: false,
        message: 'Guest passes not allowed for this secret event configuration',
        suggestion: 'Change privacy settings to allow host-only invitations'
      };
      
    default:
      return {
        allowed: false,
        message: 'Unknown privacy level'
      };
  }
}

/**
 * Calculate guest pass expiry based on privacy level and event settings
 */
function calculateGuestPassExpiry(event) {
  const eventTime = new Date(event.time);
  const now = new Date();
  
  // For secret events, shorter expiry window
  if (event.privacyLevel === 'secret') {
    return new Date(eventTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before
  }
  
  // For friends/private events, moderate expiry
  if (['friends', 'private'].includes(event.privacyLevel)) {
    return new Date(eventTime.getTime() - (4 * 60 * 60 * 1000)); // 4 hours before
  }
  
  // For public events, standard expiry
  return new Date(eventTime.getTime() - (1 * 60 * 60 * 1000)); // 1 hour before
}

/**
 * Get guest permissions based on privacy level
 */
function getGuestPermissionsForPrivacyLevel(privacyLevel) {
  switch (privacyLevel) {
    case 'public':
      return {
        canUploadPhotos: true,
        canViewAttendees: true,
        canInviteOthers: false
      };
      
    case 'friends':
      return {
        canUploadPhotos: true,
        canViewAttendees: false, // Don't show attendee list to guests
        canInviteOthers: false
      };
      
    case 'private':
      return {
        canUploadPhotos: true,
        canViewAttendees: false,
        canInviteOthers: false
      };
      
    case 'secret':
      return {
        canUploadPhotos: false, // Very restricted
        canViewAttendees: false,
        canInviteOthers: false
      };
      
    default:
      return {
        canUploadPhotos: false,
        canViewAttendees: false,
        canInviteOthers: false
      };
  }
}

/**
 * Get privacy information to display to guests
 */
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