// routes/guestPasses.js - Enhanced with Host Payment Integration
const express = require('express');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const Event = require('../models/Event');
const GuestPass = require('../models/GuestPass');
const User = require('../models/User');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');
const StripeConnectService = require('../services/stripeConnectService');

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
// ENHANCED: CREATE GUEST PASS WITH PAYMENT INTEGRATION
// ============================================
router.post('/:eventId/guest-pass', protect, createGuestPassLimiter, async (req, res) => {
  try {
    const { guestName, guestEmail, guestPhone } = req.body;
    
    if (!guestName?.trim()) {
      return res.status(400).json({ message: 'Guest name is required' });
    }
    
    // Find event and populate host payment info
    const event = await Event.findById(req.params.eventId).populate('host', 'paymentAccounts');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify user is host or co-host
    const isHost = String(event.host._id) === String(req.user._id);
    const isCoHost = event.coHosts.some(coHost => String(coHost) === String(req.user._id));
    
    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Only hosts and co-hosts can create guest passes' });
    }

    // Check if event is paid and validate host payment setup
    const isEventPaid = event.isPaidEvent();
    if (isEventPaid && !event.host.paymentAccounts?.stripe?.chargesEnabled) {
      return res.status(400).json({ 
        message: 'Host must complete payment setup before creating paid guest passes',
        needsPaymentSetup: true
      });
    }

    // Generate secure token
    const tokenPayload = {
      guestPassId: new Date().getTime(), // Temporary, will be replaced with actual ID
      eventId: event._id,
      nonce: crypto.randomBytes(16).toString('hex'),
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expiry (7 days from now or event time, whichever is earlier)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(Math.min(sevenDaysFromNow.getTime(), event.time.getTime()));

    // Create guest pass with enhanced payment information
    const guestPassData = {
      token: tokenHash,
      nonce: tokenPayload.nonce,
      event: event._id,
      createdBy: req.user._id,
      guestName: guestName.trim(),
      guestEmail: guestEmail?.trim(),
      guestPhone: guestPhone?.trim(),
      expiresAt: expiresAt,
      
      // Enhanced payment configuration
      payment: {
        required: isEventPaid,
        amount: isEventPaid ? event.getCurrentPrice() : 0,
        currency: event.pricing.currency || 'USD',
        status: 'pending'
      }
    };

    const guestPass = new GuestPass(guestPassData);
    await guestPass.save();

    // Update token with actual guest pass ID
    const updatedTokenPayload = {
      ...tokenPayload,
      guestPassId: guestPass._id
    };
    const updatedToken = jwt.sign(updatedTokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const updatedTokenHash = crypto.createHash('sha256').update(updatedToken).digest('hex');
    
    guestPass.token = updatedTokenHash;
    guestPass.nonce = updatedTokenPayload.nonce;
    await guestPass.save();

    // Generate invitation link
    const inviteUrl = `${process.env.API_URL}/api/guest-pass/rsvp/${updatedToken}`;

    console.log(`✅ Guest pass created: ${guestPass._id} for event ${event._id} (Paid: ${isEventPaid})`);

    res.status(201).json({
      success: true,
      guestPass: {
        id: guestPass._id,
        guestName: guestPass.guestName,
        inviteUrl: inviteUrl,
        expiresAt: guestPass.expiresAt,
        requiresPayment: isEventPaid,
        amount: guestPass.payment.amount,
        currency: guestPass.payment.currency
      },
      inviteUrl: inviteUrl
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
// ENHANCED: GUEST RSVP PAGE WITH PAYMENT FLOW
// ============================================
router.get('/rsvp/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
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
    }).populate({
      path: 'event',
      populate: {
        path: 'host',
        select: 'username paymentAccounts'
      }
    });
    
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

    // Check if already confirmed
    if (guestPass.status === 'confirmed') {
      return res.render('guest-rsvp-success', {
        guestPass,
        event: guestPass.event,
        alreadyConfirmed: true,
        qrCode: guestPass.qrData.code
      });
    }

    // Validate host payment setup for paid events
    if (guestPass.payment.required && !guestPass.event.host.paymentAccounts?.stripe?.chargesEnabled) {
      return res.status(400).render('guest-rsvp-error', { 
        error: 'Event host payment setup is incomplete. Please contact the host.' 
      });
    }
    
    // Store metadata
    guestPass.metadata = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      referrer: req.get('Referrer')
    };
    await guestPass.save();
    
    // Render RSVP page with enhanced payment info
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
      token: token
    });
    
  } catch (error) {
    console.error('❌ Error loading RSVP page:', error);
    res.status(500).render('guest-rsvp-error', { 
      error: 'Something went wrong. Please try again.'
    });
  }
});

// ============================================
// ENHANCED: PROCESS GUEST RSVP WITH HOST PAYMENT
// ============================================
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
    }).populate({
      path: 'event',
      populate: {
        path: 'host',
        select: 'paymentAccounts'
      }
    });
    
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
    
    // ============================================
    // ENHANCED PAYMENT PROCESSING TO HOST ACCOUNT
    // ============================================
    if (guestPass.payment.required && guestPass.payment.amount > 0) {
      if (!paymentMethodId) {
        return res.status(400).json({ message: 'Payment method required' });
      }

      // Verify host can receive payments
      if (!guestPass.event.host.paymentAccounts?.stripe?.chargesEnabled) {
        return res.status(400).json({ 
          message: 'Host payment setup is incomplete. Cannot process payment.' 
        });
      }
      
      try {
        // Create payment intent directly to host account
        const paymentResult = await StripeConnectService.createDirectPaymentIntent(
          guestPass.payment.amount,
          guestPass.payment.currency,
          guestPass.event.host.paymentAccounts.stripe.accountId,
          {
            guestPassId: guestPass._id.toString(),
            eventId: guestPass.event._id.toString(),
            guestName: guestPass.guestName,
            eventTitle: guestPass.event.title,
            hostId: guestPass.event.host._id.toString()
          }
        );

        // Confirm payment with provided payment method
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const confirmedPayment = await stripe.paymentIntents.confirm(
          paymentResult.paymentIntent.id,
          {
            payment_method: paymentMethodId,
            return_url: `${process.env.FRONTEND_URL}/guest-pass/success`
          },
          {
            stripeAccount: guestPass.event.host.paymentAccounts.stripe.accountId
          }
        );
        
        if (confirmedPayment.status === 'succeeded') {
          guestPass.payment.status = 'succeeded';
          guestPass.payment.stripePaymentIntentId = confirmedPayment.id;
          guestPass.payment.paidAt = new Date();

          // Add payment to event history
          const paymentData = {
            guestPass: guestPass._id,
            guestName: guestPass.guestName,
            amount: guestPass.payment.amount,
            currency: guestPass.payment.currency,
            stripePaymentIntentId: confirmedPayment.id,
            status: 'succeeded',
            paidAt: new Date(),
            type: 'guest',
            metadata: {
              userAgent: req.get('User-Agent'),
              ipAddress: req.ip,
              platform: 'guest-link'
            }
          };

          await guestPass.event.addPayment(paymentData);
          console.log(`✅ Guest payment processed: ${confirmedPayment.id} for event ${guestPass.event._id}`);
        } else {
          guestPass.payment.status = 'failed';
          return res.status(400).json({ message: 'Payment failed' });
        }
        
      } catch (stripeError) {
        console.error('❌ Stripe payment error:', stripeError);
        guestPass.payment.status = 'failed';
        await guestPass.save();
        return res.status(400).json({ 
          message: 'Payment processing failed', 
          error: stripeError.message 
        });
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
        eventTime: guestPass.event.time,
        paymentAmount: guestPass.payment.amount,
        paymentStatus: guestPass.payment.status
      }
    });
    
  } catch (error) {
    console.error('❌ RSVP processing error:', error);
    res.status(500).json({ 
      message: 'Failed to process RSVP', 
      error: error.message 
    });
  }
});

// ============================================
// QR CODE VERIFICATION FOR CHECK-IN
// ============================================
router.get('/qr/:qrCode', async (req, res) => {
  try {
    const { qrCode } = req.params;
    
    const guestPass = await GuestPass.findOne({ 
      'qrData.code': qrCode 
    }).populate('event', 'title time location host');
    
    if (!guestPass) {
      return res.status(404).json({ message: 'Invalid QR code' });
    }
    
    // Check if QR code is valid
    if (!guestPass.isValid()) {
      return res.status(400).json({ 
        message: 'QR code is expired or already used',
        status: guestPass.status,
        usedAt: guestPass.usedAt
      });
    }
    
    // Increment view count
    guestPass.qrData.viewCount += 1;
    await guestPass.save();
    
    res.json({
      valid: true,
      guestPass: {
        id: guestPass._id,
        guestName: guestPass.guestName,
        status: guestPass.status,
        event: {
          title: guestPass.event.title,
          time: guestPass.event.time,
          location: guestPass.event.location
        },
        paymentStatus: guestPass.payment.status,
        viewCount: guestPass.qrData.viewCount
      }
    });
    
  } catch (error) {
    console.error('❌ QR verification error:', error);
    res.status(500).json({ 
      message: 'Failed to verify QR code', 
      error: error.message 
    });
  }
});

// ============================================
// CHECK-IN GUEST WITH QR CODE
// ============================================
router.post('/checkin/:qrCode', protect, async (req, res) => {
  try {
    const { qrCode } = req.params;
    
    const guestPass = await GuestPass.findOne({ 
      'qrData.code': qrCode 
    }).populate('event');
    
    if (!guestPass) {
      return res.status(404).json({ message: 'Invalid QR code' });
    }
    
    // Verify user is host or co-host
    const isHost = String(guestPass.event.host) === String(req.user._id);
    const isCoHost = guestPass.event.coHosts.some(coHost => String(coHost) === String(req.user._id));
    
    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Only hosts and co-hosts can check in guests' });
    }
    
    // Check if guest pass is valid for check-in
    if (!guestPass.isValid()) {
      return res.status(400).json({ 
        message: 'Guest pass is not valid for check-in',
        status: guestPass.status,
        reason: guestPass.status === 'used' ? 'Already checked in' : 'Expired or invalid'
      });
    }
    
    // Mark as used
    await guestPass.markAsUsed(req.user._id);
    
    res.json({
      success: true,
      message: 'Guest checked in successfully',
      guestPass: {
        id: guestPass._id,
        guestName: guestPass.guestName,
        checkedInAt: guestPass.usedAt,
        checkedInBy: req.user._id
      }
    });
    
  } catch (error) {
    console.error('❌ Guest check-in error:', error);
    res.status(500).json({ 
      message: 'Failed to check in guest', 
      error: error.message 
    });
  }
});

// ============================================
// GET EVENT GUEST PASSES (HOST ONLY)
// ============================================
router.get('/event/:eventId/guests', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Verify user is host or co-host
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts.some(coHost => String(coHost) === String(req.user._id));
    
    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Only hosts and co-hosts can view guest passes' });
    }
    
    const guestPasses = await GuestPass.find({ event: req.params.eventId })
      .sort({ createdAt: -1 });
    
    // Calculate stats
    const stats = {
      total: guestPasses.length,
      confirmed: guestPasses.filter(gp => gp.status === 'confirmed').length,
      used: guestPasses.filter(gp => gp.status === 'used').length,
      expired: guestPasses.filter(gp => gp.status === 'expired').length,
      pending: guestPasses.filter(gp => gp.status === 'pending').length,
      totalRevenue: guestPasses
        .filter(gp => gp.payment.status === 'succeeded')
        .reduce((sum, gp) => sum + gp.payment.amount, 0)
    };
    
    res.json({
      guestPasses: guestPasses.map(gp => ({
        id: gp._id,
        guestName: gp.guestName,
        guestEmail: gp.guestEmail,
        status: gp.status,
        createdAt: gp.createdAt,
        confirmedAt: gp.confirmedAt,
        usedAt: gp.usedAt,
        expiresAt: gp.expiresAt,
        payment: {
          required: gp.payment.required,
          amount: gp.payment.amount,
          status: gp.payment.status,
          paidAt: gp.payment.paidAt
        }
      })),
      stats
    });
    
  } catch (error) {
    console.error('❌ Get guest passes error:', error);
    res.status(500).json({ 
      message: 'Failed to get guest passes', 
      error: error.message 
    });
  }
});

module.exports = router;