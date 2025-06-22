// routes/guestPasses.js - Guest pass API endpoints
const express = require('express');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const Event = require('../models/Event');
const GuestPass = require('../models/GuestPass');
const User = require('../models/User');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');

const router = express.Router();

// Rate limiting for guest pass creation
const createGuestPassLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many guest passes created from this IP'
});

// Rate limiting for RSVP submissions
const rsvpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 RSVP attempts per windowMs
  message: 'Too many RSVP attempts from this IP'
});

/* ───────────────────────────────────────────────────────────────────
   POST /api/events/:id/guest-pass - Create guest pass (event creator only)
──────────────────────────────────────────────────────────────────── */
router.post('/:eventId/guest-pass', protect, createGuestPassLimiter, async (req, res) => {
  try {
    const { guestName, guestEmail, guestPhone } = req.body;
    
    // Validate input
    if (!guestName?.trim()) {
      return res.status(400).json({ message: 'Guest name is required' });
    }
    
    // Find event and verify permissions
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Only event creator can issue guest passes
    if (event.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only event creator can issue guest passes' });
    }
    
    // Check if guest passes are enabled for this event
    if (!event.guestPassConfig.allowGuestPasses) {
      return res.status(400).json({ message: 'Guest passes not enabled for this event' });
    }
    
    // Check if event hasn't started
    if (new Date(event.time) <= new Date()) {
      return res.status(400).json({ message: 'Cannot create guest passes for past events' });
    }
    
    // Calculate expiry time
    const expiryHours = event.guestPassConfig.guestPassExpiry || 4;
    const eventStart = new Date(event.time);
    const expiresAt = new Date(eventStart.getTime() - (expiryHours * 60 * 60 * 1000));
    
    // Create guest pass
    const guestPass = await GuestPass.create({
      event: event._id,
      createdBy: req.user._id,
      guestName: guestName.trim(),
      guestEmail: guestEmail?.trim(),
      guestPhone: guestPhone?.trim(),
      expiresAt,
      payment: {
        required: event.guestPassConfig.coverCharge.enabled,
        amount: event.guestPassConfig.coverCharge.amount,
        currency: event.guestPassConfig.coverCharge.currency
      }
    });
    
    // Generate JWT token for deep link
    const tokenPayload = {
      guestPassId: guestPass._id,
      eventId: event._id,
      nonce: guestPass.nonce,
      exp: Math.floor(expiresAt.getTime() / 1000)
    };
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
    
    // Update guest pass with token hash (for security)
    guestPass.token = crypto.createHash('sha256').update(token).digest('hex');
    await guestPass.save();
    
    // Update event stats
    await Event.findByIdAndUpdate(event._id, {
      $inc: { 'stats.guestPassesIssued': 1 }
    });
    
    // Create deep link
    const deepLink = `${process.env.FRONTEND_URL}/r/${token}`;
    
    // Send notification to event creator
    await Notification.create({
      user: req.user._id,
      type: 'guest_pass_created',
      message: `Guest pass created for ${guestName} for "${event.title}"`,
      meta: { 
        eventId: event._id, 
        guestPassId: guestPass._id,
        guestName 
      }
    });
    
    res.status(201).json({
      success: true,
      guestPass: {
        id: guestPass._id,
        guestName,
        deepLink,
        expiresAt,
        status: guestPass.status
      }
    });
    
  } catch (error) {
    console.error('Error creating guest pass:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /r/:token - Web RSVP page (public endpoint)
──────────────────────────────────────────────────────────────────── */
router.get('/r/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).render('guest-rsvp-error', { 
        error: 'Invalid or expired invitation link' 
      });
    }
    
    // Find guest pass
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const guestPass = await GuestPass.findOne({ 
      _id: decoded.guestPassId,
      token: tokenHash,
      nonce: decoded.nonce
    }).populate('event');
    
    if (!guestPass || !guestPass.event) {
      return res.status(404).render('guest-rsvp-error', { 
        error: 'Invitation not found' 
      });
    }
    
    // Check if expired
    if (new Date() > guestPass.expiresAt) {
      guestPass.status = 'expired';
      await guestPass.save();
      return res.status(400).render('guest-rsvp-error', { 
        error: 'This invitation has expired' 
      });
    }
    
    // Store metadata
    guestPass.metadata = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      referrer: req.get('Referrer')
    };
    await guestPass.save();
    
    // Render RSVP page
    res.render('guest-rsvp', {
      guestPass,
      event: guestPass.event,
      requiresPayment: guestPass.payment.required,
      amount: guestPass.payment.amount,
      currency: guestPass.payment.currency,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
    
  } catch (error) {
    console.error('Error loading RSVP page:', error);
    res.status(500).render('guest-rsvp-error', { 
      error: 'Something went wrong. Please try again.' 
    });
  }
});

/* ───────────────────────────────────────────────────────────────────
   POST /api/guest-pass/rsvp - Submit RSVP with payment
──────────────────────────────────────────────────────────────────── */
router.post('/rsvp', rsvpLimiter, async (req, res) => {
  try {
    const { token, paymentMethodId } = req.body;
    
    // Verify token and find guest pass
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const guestPass = await GuestPass.findOne({
      _id: decoded.guestPassId,
      token: tokenHash,
      nonce: decoded.nonce
    }).populate('event');
    
    if (!guestPass) {
      return res.status(404).json({ message: 'Invalid invitation' });
    }
    
    if (guestPass.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation already processed' });
    }
    
    // Check expiry
    if (new Date() > guestPass.expiresAt) {
      guestPass.status = 'expired';
      await guestPass.save();
      return res.status(400).json({ message: 'Invitation expired' });
    }
    
    // Handle payment if required
    if (guestPass.payment.required && guestPass.payment.amount > 0) {
      if (!paymentMethodId) {
        return res.status(400).json({ message: 'Payment method required' });
      }
      
      try {
        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: guestPass.payment.amount,
          currency: guestPass.payment.currency,
          payment_method: paymentMethodId,
          confirm: true,
          metadata: {
            guestPassId: guestPass._id.toString(),
            eventId: guestPass.event._id.toString(),
            guestName: guestPass.guestName
          }
        });
        
        if (paymentIntent.status === 'succeeded') {
          guestPass.payment.status = 'succeeded';
          guestPass.payment.stripePaymentIntentId = paymentIntent.id;
          guestPass.payment.paidAt = new Date();
        } else {
          guestPass.payment.status = 'failed';
          return res.status(400).json({ message: 'Payment failed' });
        }
        
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        guestPass.payment.status = 'failed';
        await guestPass.save();
        return res.status(400).json({ message: 'Payment processing failed' });
      }
    }
    
    // Mark as confirmed and generate QR code
    guestPass.status = 'confirmed';
    guestPass.confirmedAt = new Date();
    const qrCode = guestPass.generateQRCode();
    await guestPass.save();
    
    // Generate QR code image
    const qrCodeUrl = `${process.env.API_URL}/api/guest-pass/qr/${qrCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Update event stats
    await Event.findByIdAndUpdate(guestPass.event._id, {
      $inc: { 'stats.totalAttendees': 1 }
    });
    
    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      qrCodeUrl,
      guestPass: {
        id: guestPass._id,
        status: guestPass.status,
        guestName: guestPass.guestName,
        eventTitle: guestPass.event.title,
        eventTime: guestPass.event.time
      }
    });
    
  } catch (error) {
    console.error('Error processing RSVP:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/guest-pass/qr/:code - Get QR code for scanning
──────────────────────────────────────────────────────────────────── */
router.get('/qr/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const guestPass = await GuestPass.findOne({
      'qrData.code': code,
      status: 'confirmed'
    }).populate('event');
    
    if (!guestPass) {
      return res.status(404).json({ message: 'Invalid QR code' });
    }
    
    // Increment view count
    guestPass.qrData.viewCount += 1;
    await guestPass.save();
    
    res.json({
      guestPassId: guestPass._id,
      guestName: guestPass.guestName,
      eventId: guestPass.event._id,
      eventTitle: guestPass.event.title,
      isValid: guestPass.isValid(),
      expiresAt: guestPass.expiresAt
    });
    
  } catch (error) {
    console.error('Error retrieving QR code data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   POST /api/scan - Updated scan endpoint to handle guest passes
──────────────────────────────────────────────────────────────────── */
router.post('/scan', protect, async (req, res) => {
  try {
    const { qrData, eventId } = req.body;
    
    // Check if it's a user QR code or guest pass QR code
    if (qrData.startsWith('user_')) {
      // Existing user QR code logic
      const userId = qrData.replace('user_', '');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if user is attending event
      const event = await Event.findById(eventId);
      if (!event.attendees.includes(userId)) {
        return res.status(400).json({ message: 'User not registered for this event' });
      }
      
      // Mark as checked in (existing logic)
      // ... existing check-in logic
      
    } else {
      // Guest pass QR code
      const guestPass = await GuestPass.findOne({
        'qrData.code': qrData,
        event: eventId
      }).populate('event');
      
      if (!guestPass) {
        return res.status(404).json({ message: 'Invalid guest pass' });
      }
      
      if (!guestPass.isValid()) {
        return res.status(400).json({ 
          message: 'Guest pass is invalid or expired',
          status: guestPass.status
        });
      }
      
      if (guestPass.usedAt) {
        return res.status(400).json({ 
          message: 'Guest pass already used',
          usedAt: guestPass.usedAt
        });
      }
      
      // Mark guest pass as used
      await guestPass.markAsUsed(req.user._id);
      
      // Update event check-in stats
      await Event.findByIdAndUpdate(eventId, {
        $inc: { 
          'stats.checkedInCount': 1,
          'stats.guestPassesUsed': 1
        }
      });
      
      res.json({
        success: true,
        type: 'guest_pass',
        guestName: guestPass.guestName,
        checkedInAt: guestPass.usedAt,
        message: `${guestPass.guestName} checked in successfully`
      });
    }
    
  } catch (error) {
    console.error('Error scanning QR code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;