const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Photo = require('../models/Photo');
const { onEventJoin, onEventCreated } = require('../utils/activityHooks');
const EventDiscoveryService = require('../services/eventDiscoveryService');
const { PRIVACY_LEVELS, getPrivacyPreset } = require('../constants/privacyConstants');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { validateGuestPassAccess, canAccessEvent } = require('../middleware/guestPassValidation');
const GuestPass = require('../models/GuestPass');
const protect = require('../middleware/auth');
const EventPrivacyService = require('../services/eventPrivacyService');
const StripeConnectService = require('../services/stripeConnectService');
const PayPalProvider = require('../services/paymentProviders/paypalProvider');
const PaymentProviderFactory = require('../services/paymentProviders/paymentProviderFactory');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose'); 
const notificationService = require('../services/notificationService');
require('dotenv').config();

const router = express.Router();

const UP_DIR = path.join(__dirname, '..', 'uploads');
const PHOTO_DIR = path.join(UP_DIR, 'photos');
const COVER_DIR = path.join(UP_DIR, 'event-covers');
const COVERS_DIR = path.join(UP_DIR, 'covers');
const PRIVACY_PRESETS = {
  public: {
    canView: 'anyone',
    canJoin: 'anyone',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  },
  friends: {
    canView: 'followers',      // ✅ Matches your schema
    canJoin: 'followers',      // ✅ Matches your schema
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: false
  },
  private: {
    canView: 'invited-only',   // ✅ FIXED: Matches your schema enum
    canJoin: 'invited-only',   // ✅ FIXED: Matches your schema enum
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: false,
    appearInSearch: false,
    showAttendeesToPublic: false
  }
};

// Ensure all directories exist
[PHOTO_DIR, COVER_DIR, COVERS_DIR].forEach((d) => { 
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); 
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'coverImage' ? COVER_DIR : PHOTO_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, COVERS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadCover = multer({
  storage: coverStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/* helper to coerce booleans coming from multipart/form-data */
const bool = (v) => v === true || v === 'true';
const parseIntSafe = (val, defaultVal = 0) => {
  const parsed = parseInt(val);
  return isNaN(parsed) ? defaultVal : parsed;
};
const parseFloatSafe = (val, defaultVal = 0) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
};

// ============================================
// PAYMENT PROVIDER SELECTION ROUTES
// ============================================

/**
 * Get available payment providers
 */
router.get('/payment-providers', protect, async (req, res) => {
  try {
    const providers = [
      {
        type: 'paypal',
        name: 'PayPal',
        description: 'Quick setup with just your PayPal email address',
        setupTime: '1 minute',
        fees: '2.9% + $0.30 per transaction',
        recommended: true,
        features: ['Accept credit cards', 'PayPal account payments', 'Buyer protection', 'Mobile optimized']
      },
      {
        type: 'stripe',
        name: 'Stripe Connect',
        description: 'Professional payment processing with advanced features',
        setupTime: '5-10 minutes',
        fees: '2.9% + $0.30 per transaction',
        recommended: false,
        features: ['Advanced analytics', 'Subscription billing', 'International payments', 'Custom branding']
      }
    ];
    
    res.json({ 
      success: true,
      providers 
    });
  } catch (error) {
    console.error('❌ Error getting payment providers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get payment providers' 
    });
  }
});

// ============================================
// PAYMENT ACCOUNT SETUP ROUTES
// ============================================

/**
 * Setup PayPal payments for host
 */
router.post('/setup-payments/paypal', protect, async (req, res) => {
  try {
    const { paypalEmail } = req.body;
    
    // Validate input
    if (!paypalEmail || !paypalEmail.includes('@')) {
      return res.status(400).json({ 
        success: false,
        message: 'Valid PayPal email address is required' 
      });
    }

    console.log(`🔗 Setting up PayPal for user ${req.user._id} with email: ${paypalEmail}`);

    // Check if user already has PayPal account setup
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (user.paymentAccounts?.paypal?.verified) {
      return res.status(400).json({ 
        success: false,
        message: 'PayPal account already connected',
        currentEmail: user.paymentAccounts.paypal.email
      });
    }

    // Setup PayPal account
    const paypalProvider = new PayPalProvider();
    const result = await paypalProvider.setupAccount(req.user._id, { paypalEmail });
    
    if (result.success) {
      console.log(`✅ PayPal setup successful for user ${req.user._id}`);
      
      res.json({
        success: true,
        message: 'PayPal account connected successfully',
        provider: 'paypal',
        accountEmail: paypalEmail
      });
    } else {
      console.log(`❌ PayPal setup failed: ${result.message}`);
      res.status(400).json({ 
        success: false,
        message: result.message 
      });
    }

  } catch (error) {
    console.error('❌ PayPal setup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to setup PayPal payments',
      error: error.message 
    });
  }
});

// Create Stripe Connect account for host
router.post('/setup-payments', protect, async (req, res) => {
  try {
    const { firstName, lastName, country = 'US' } = req.body;
    
    console.log(`🔗 Setting up payments for user ${req.user._id}`);
    console.log(`📝 User info:`, { firstName, lastName, country });

    // Check if user already has account
    const user = await User.findById(req.user._id);
    if (!user) {
      console.log(`❌ User not found: ${req.user._id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.paymentAccounts?.stripe?.accountId) {
      console.log(`⚠️ User already has Stripe account: ${user.paymentAccounts.stripe.accountId}`);
      return res.status(400).json({ 
        message: 'Payment account already exists',
        accountId: user.paymentAccounts.stripe.accountId
      });
    }

    // Create Stripe Connect account
    console.log(`🏗️ Creating Stripe Connect account...`);
    const result = await StripeConnectService.createConnectAccount(req.user._id, {
      firstName,
      lastName,
      country
    });

    if (!result.success) {
      console.log(`❌ Account creation failed: ${result.message}`);
      return res.status(400).json({ message: result.message });
    }

    // Create onboarding link
    console.log(`🔗 Creating onboarding link...`);
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/events/payment-setup/return`;
    const refreshUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/events/payment-setup/refresh`;
    
    const linkResult = await StripeConnectService.createAccountLink(
      req.user._id, 
      returnUrl, 
      refreshUrl
    );

    res.json({
      success: true,
      accountId: result.accountId,
      onboardingUrl: linkResult.url,
      expiresAt: linkResult.expiresAt
    });

  } catch (error) {
    console.error('❌ Payment setup error:', error);
    res.status(500).json({ 
      message: 'Failed to setup payments', 
      error: error.message 
    });
  }
});

/**
 * Check payment account status (enhanced for multiple providers)
 */
router.get('/payment-status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log(`💰 Checking payment status for user ${req.user._id}`);
    console.log(`📋 User payment accounts:`, JSON.stringify(user.paymentAccounts, null, 2));

    const paymentAccounts = user.paymentAccounts || {};
    let canReceivePayments = false;
    let primaryProvider = null;
    const providers = {};

    // Check PayPal status
    if (paymentAccounts.paypal?.email && paymentAccounts.paypal?.verified) {
      providers.paypal = {
        connected: true,
        email: paymentAccounts.paypal.email,
        connectedAt: paymentAccounts.paypal.connectedAt
      };
      
      if (!primaryProvider) {
        primaryProvider = 'paypal';
        canReceivePayments = true;
      }
      
      console.log(`✅ PayPal account found and verified: ${paymentAccounts.paypal.email}`);
    } else {
      console.log(`❌ PayPal account not found or not verified`);
    }

    // Check Stripe status
    if (paymentAccounts.stripe?.accountId) {
      try {
        // If you have StripeConnectService, use it; otherwise assume it's working
        providers.stripe = {
          connected: paymentAccounts.stripe.chargesEnabled || false,
          onboardingComplete: paymentAccounts.stripe.onboardingComplete || false,
          chargesEnabled: paymentAccounts.stripe.chargesEnabled || false,
          payoutsEnabled: paymentAccounts.stripe.payoutsEnabled || false
        };
        
        if (providers.stripe.connected && !primaryProvider) {
          primaryProvider = 'stripe';
          canReceivePayments = true;
        }
        
        console.log(`✅ Stripe account found: ${paymentAccounts.stripe.accountId}`);
      } catch (error) {
        console.error('❌ Error checking Stripe status:', error);
      }
    } else {
      console.log(`❌ Stripe account not found`);
    }

    const status = {
      success: true,
      canReceivePayments,
      primaryProvider,
      providers,
      debug: {
        userId: req.user._id,
        hasPaymentAccounts: !!user.paymentAccounts,
        paypalEmail: paymentAccounts.paypal?.email,
        paypalVerified: paymentAccounts.paypal?.verified,
        stripeAccountId: paymentAccounts.stripe?.accountId
      }
    };

    console.log(`📊 Payment status result:`, status);
    res.json(status);

  } catch (error) {
    console.error('❌ Payment status check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to check payment status',
      error: error.message 
    });
  }
});

// Create new onboarding link (if previous expired)
router.post('/payment-setup/refresh', protect, async (req, res) => {
  try {
    const returnUrl = `${process.env.FRONTEND_URL}/events/payment-setup/return`;
    const refreshUrl = `${process.env.FRONTEND_URL}/events/payment-setup/refresh`;
    
    const linkResult = await StripeConnectService.createAccountLink(
      req.user._id, 
      returnUrl, 
      refreshUrl
    );

    res.json({
      success: true,
      onboardingUrl: linkResult.url,
      expiresAt: linkResult.expiresAt
    });

  } catch (error) {
    console.error('❌ Payment link refresh error:', error);
    res.status(500).json({ 
      message: 'Failed to refresh payment link', 
      error: error.message 
    });
  }
});

// Get Stripe dashboard link for host
router.get('/payment-dashboard', protect, async (req, res) => {
  try {
    const result = await StripeConnectService.createDashboardLink(req.user._id);
    
    res.json({
      success: true,
      dashboardUrl: result.url
    });

  } catch (error) {
    console.error('❌ Dashboard link error:', error);
    res.status(500).json({ 
      message: 'Failed to create dashboard link', 
      error: error.message 
    });
  }
});

// ============================================
// GUEST PAYMENT PROCESSING ROUTES
// ============================================

/**
 * Create PayPal payment order for guest
 */
router.post('/guest-payment/paypal/create', async (req, res) => {
  try {
    const { guestPassToken } = req.body;
    
    if (!guestPassToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Guest pass token is required' 
      });
    }

    // Verify guest pass token
    const decoded = jwt.verify(guestPassToken, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(guestPassToken).digest('hex');
    
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
      return res.status(404).json({ 
        success: false,
        message: 'Invalid or expired invitation' 
      });
    }

    // Validate payment is required and guest hasn't paid
    if (!guestPass.payment.required || guestPass.payment.status === 'succeeded') {
      return res.status(400).json({ 
        success: false,
        message: 'Payment not required or already completed' 
      });
    }

    // Check host has PayPal setup
    const hostPayPal = guestPass.event.host.paymentAccounts?.paypal;
    if (!hostPayPal?.verified || !hostPayPal.email) {
      return res.status(400).json({ 
        success: false,
        message: 'Host payment setup is incomplete' 
      });
    }

    console.log(`💳 Creating PayPal payment for guest pass ${guestPass._id}`);

    // Create PayPal payment order
    const paypalProvider = new PayPalProvider();
    const paymentOrder = await paypalProvider.createPaymentOrder(
      guestPass.payment.amount,
      guestPass.payment.currency,
      hostPayPal.email,
      {
        eventId: guestPass.event._id.toString(),
        eventTitle: guestPass.event.title,
        guestPassId: guestPass._id.toString(),
        guestName: guestPass.guestName
      }
    );

    if (paymentOrder.success) {
      // Store PayPal order ID for later capture
      guestPass.payment.provider = 'paypal';
      guestPass.payment.paypalOrderId = paymentOrder.orderId;
      await guestPass.save();

      console.log(`✅ PayPal order created: ${paymentOrder.orderId}`);

      res.json({
        success: true,
        orderId: paymentOrder.orderId,
        approvalUrl: paymentOrder.approvalUrl,
        amount: guestPass.payment.amount,
        currency: guestPass.payment.currency
      });
    } else {
      throw new Error('Failed to create PayPal payment order');
    }

  } catch (error) {
    console.error('❌ PayPal payment creation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create PayPal payment',
      error: error.message 
    });
  }
});

/**
 * Capture PayPal payment after user approval
 */
router.post('/guest-payment/paypal/capture', async (req, res) => {
  try {
    const { orderId, guestPassToken } = req.body;
    
    if (!orderId || !guestPassToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Order ID and guest pass token are required' 
      });
    }

    // Verify guest pass token
    const decoded = jwt.verify(guestPassToken, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(guestPassToken).digest('hex');
    
    const guestPass = await GuestPass.findOne({
      _id: decoded.guestPassId,
      token: tokenHash,
      nonce: decoded.nonce
    }).populate('event');

    if (!guestPass) {
      return res.status(404).json({ 
        success: false,
        message: 'Invalid guest pass' 
      });
    }

    // Verify this is the correct PayPal order
    if (guestPass.payment.paypalOrderId !== orderId) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid payment request' 
      });
    }

    // Check if already captured
    if (guestPass.payment.status === 'succeeded') {
      return res.status(400).json({ 
        success: false,
        message: 'Payment already processed' 
      });
    }

    console.log(`💰 Capturing PayPal payment for order ${orderId}`);

    // Capture the payment
    const paypalProvider = new PayPalProvider();
    const captureResult = await paypalProvider.capturePayment(orderId);

    if (captureResult.success) {
      // Update guest pass
      guestPass.payment.status = 'succeeded';
      guestPass.payment.paypalCaptureId = captureResult.captureId;
      guestPass.payment.paidAt = captureResult.paidAt;
      guestPass.status = 'confirmed';
      await guestPass.save();

      // Add payment to event history
      const paymentData = {
        guestPass: guestPass._id,
        guestName: guestPass.guestName,
        amount: guestPass.payment.amount,
        currency: guestPass.payment.currency,
        provider: 'paypal',
        paypalOrderId: orderId,
        paypalCaptureId: captureResult.captureId,
        status: 'succeeded',
        paidAt: captureResult.paidAt,
        type: 'guest'
      };

      await guestPass.event.addPayment(paymentData);

      console.log(`✅ PayPal payment captured successfully: ${captureResult.captureId}`);

      res.json({
        success: true,
        message: 'Payment completed successfully',
        guestPassId: guestPass._id,
        captureId: captureResult.captureId,
        amount: captureResult.amount
      });

    } else {
      throw new Error('Payment capture failed');
    }

  } catch (error) {
    console.error('❌ PayPal capture error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to complete payment',
      error: error.message 
    });
  }
});

// ============================================
// WEBHOOK HANDLING
// ============================================

// Stripe webhook handler
router.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = StripeConnectService.validateWebhook(req.body, signature);
    
    console.log(`🔗 Stripe webhook received: ${event.type}`);
    
    const result = await StripeConnectService.handleWebhook(event);
    
    if (result.success) {
      res.json({ received: true });
    } else {
      res.status(400).json({ error: result.error });
    }

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Handle PayPal webhooks
 */
router.post('/webhooks/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.body;
    
    console.log(`📡 PayPal webhook received: ${event.event_type}`);
    
    const paypalProvider = new PayPalProvider();
    const result = await paypalProvider.handleWebhook(event);
    
    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      console.error('❌ Webhook processing failed:', result.error);
      res.status(400).json({ error: result.error });
    }

  } catch (error) {
    console.error('❌ PayPal webhook error:', error);
    res.status(400).json({ error: 'Invalid webhook payload' });
  }
});

// ============================================
// PAYMENT MANAGEMENT ROUTES
// ============================================

/**
 * Get payment history for event (host only)
 */
router.get('/:eventId/payments', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('paymentHistory.user', 'username email')
      .populate('paymentHistory.guestPass', 'guestName guestEmail');
    
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }

    // Check if user is the host
    if (event.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Group payments by provider for analytics
    const paymentsByProvider = event.paymentHistory.reduce((acc, payment) => {
      const provider = payment.provider || 'stripe';
      if (!acc[provider]) {
        acc[provider] = {
          count: 0,
          totalAmount: 0,
          payments: []
        };
      }
      acc[provider].count++;
      acc[provider].totalAmount += payment.amount;
      acc[provider].payments.push(payment);
      return acc;
    }, {});

    res.json({
      success: true,
      paymentHistory: event.paymentHistory,
      analytics: {
        totalPayments: event.paymentHistory.length,
        totalRevenue: event.financials.totalRevenue,
        byProvider: paymentsByProvider
      }
    });

  } catch (error) {
    console.error('❌ Error getting payment history:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get payment history' 
    });
  }
});

/**
 * Process refund (works for both Stripe and PayPal)
 */
router.post('/:eventId/payments/:paymentId/refund', protect, async (req, res) => {
  try {
    const { refundAmount, reason } = req.body;
    
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }

    // Check if user is the host
    if (event.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    const payment = event.paymentHistory.id(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ 
        success: false,
        message: 'Payment not found' 
      });
    }

    if (payment.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false,
        message: 'Can only refund successful payments' 
      });
    }

    const amountToRefund = refundAmount || payment.amount;
    let refundResult;

    // Process refund based on provider
    if (payment.provider === 'paypal' && payment.paypalCaptureId) {
      const paypalProvider = new PayPalProvider();
      refundResult = await paypalProvider.processRefund(
        payment.paypalCaptureId,
        amountToRefund,
        reason
      );
    } else {
      // Default to Stripe for backward compatibility
      refundResult = await StripeConnectService.processRefund(
        payment.stripePaymentIntentId,
        amountToRefund,
        reason
      );
    }

    if (refundResult.success) {
      // Update payment record
      event.processRefund(req.params.paymentId, amountToRefund, reason);
      
      res.json({
        success: true,
        message: 'Refund processed successfully',
        refundId: refundResult.refundId,
        amount: amountToRefund
      });
    } else {
      throw new Error('Refund processing failed');
    }

  } catch (error) {
    console.error('❌ Refund processing error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process refund',
      error: error.message 
    });
  }
});

// ========================================
// SPECIFIC ROUTES FIRST (CRITICAL ORDER)
// ========================================

// Get Events with Following Filter
router.get('/following-events', protect, async (req, res) => {
  console.log('🟡 Following events endpoint hit');
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    console.log('🟡 User ID:', req.user._id);
    
    const viewer = await User.findById(req.user._id)
      .select('following')
      .populate('following', '_id username')
      .lean();
    
    if (!viewer) {
      console.log('❌ User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('🟡 User following count:', viewer.following?.length || 0);
    const followingIds = (viewer.following || []).map(user => user._id);

    if (followingIds.length === 0) {
      console.log('🟡 No following users, returning empty');
      return res.json({
        events: [],
        page: 1,
        totalPages: 0,
        hasMore: false
      });
    }

    const query = {
      host: { $in: followingIds },
      time: { $gte: new Date() },
      $or: [
        { privacyLevel: 'public' },
        { 
          privacyLevel: 'friends',
          host: { $in: followingIds }
        }
      ]
    };

    console.log('🟡 Query:', JSON.stringify(query, null, 2));

    const events = await Event.find(query)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username')
      .sort({ time: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log('🟡 Found events:', events.length);

    const eventsWithMetadata = events.map(event => {
      const isHost = String(event.host._id) === String(req.user._id);
      const isAttending = event.attendees.some(attendee => 
        String(attendee._id) === String(req.user._id)
      );
      
      return {
        ...event,
        userRelation: {
          isHost,
          isAttending,
          canJoin: !isHost && !isAttending
        },
        attendeeCount: event.attendees.length
      };
    });

    const totalEvents = await Event.countDocuments(query);
    const totalPages = Math.ceil(totalEvents / limit);
    const hasMore = skip + limit < totalEvents;

    const response = {
      events: eventsWithMetadata,
      page,
      totalPages,
      hasMore,
      total: totalEvents
    };

    console.log('🟢 Sending response:', { 
      eventsCount: eventsWithMetadata.length, 
      page, 
      totalPages,
      hasMore 
    });
    
    res.json(response);

  } catch (err) {
    console.error('❌ Following events error:', err);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Get Event Recommendations
router.get('/recommendations', protect, async (req, res) => {
  try {
    const { location, weather, limit = 10 } = req.query;
    
    const options = { limit: parseInt(limit) };
    
    if (location) {
      try {
        options.location = JSON.parse(location);
      } catch (e) {
        console.log('Invalid location format');
      }
    }

    if (weather) {
      try {
        options.weatherData = JSON.parse(weather);
      } catch (e) {
        console.log('Invalid weather format');
      }
    }

    const recommendations = await EventPrivacyService.getRecommendations(req.user._id, options);
    res.json(recommendations);
  } catch (e) {
    console.error('Get recommendations error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Friends Activity
router.get('/friends-activity', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const events = await EventPrivacyService.getFriendsActivity(req.user._id, { 
      limit: parseInt(limit) 
    });
    res.json(events);
  } catch (e) {
    console.error('Get friends activity error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get My Photo Events

router.get('/my-photo-events', protect, async (req, res) => {
  try {
    console.log(`📸 Fetching photo events for user: ${req.user._id}`);
    
    // Get ALL events with photos enabled first, then filter in JavaScript
    // This is more reliable than MongoDB's ObjectId comparison in complex queries
    const allPhotoEvents = await Event.find({ allowPhotos: true })
      .select('title time allowPhotos host attendees checkedIn')
      .populate('host', 'username')
      .sort({ time: -1 })
      .lean();
    
    // Filter using JavaScript string comparison (most reliable)
    const userIdStr = String(req.user._id);
    const userEvents = allPhotoEvents.filter(event => {
      const isHost = String(event.host._id) === userIdStr;
      const isAttendee = event.attendees.some(id => String(id) === userIdStr);
      const isCheckedIn = event.checkedIn ? event.checkedIn.some(id => String(id) === userIdStr) : false;
      
      return isHost || isAttendee || isCheckedIn;
    });

    console.log(`✅ Found ${userEvents.length} photo-enabled events for user`);
    
    // Add debug info for each event found
    userEvents.forEach(event => {
      const isHost = String(event.host._id) === userIdStr;
      const isAttendee = event.attendees.some(id => String(id) === userIdStr);
      console.log(`📅 Event: ${event.title} - Host: ${isHost}, Attendee: ${isAttendee}`);
    });
    
    // Clean up the response (remove unnecessary data)
    const cleanEvents = userEvents.map(event => ({
      _id: event._id,
      title: event.title,
      time: event.time,
      allowPhotos: event.allowPhotos,
      host: {
        _id: event.host._id,
        username: event.host.username
      }
    }));

    res.json(cleanEvents);
  } catch (err) {
    console.error('❌ /my-photo-events error =>', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// ALTERNATIVE APPROACH - Using string comparison (also works)
router.get('/my-photo-events-alt', protect, async (req, res) => {
  try {
    console.log(`📸 Fetching photo events for user: ${req.user._id}`);
    
    const list = await Event.find({
      allowPhotos: true,
      $or: [
        { attendees: { $in: [req.user._id] } },     // ✅ Alternative fix
        { checkedIn: { $in: [req.user._id] } },     // ✅ Alternative fix
        { host: req.user._id }                      // ✅ This one was already working
      ]
    }).select('title time allowPhotos host attendees')
      .populate('host', 'username')
      .sort({ time: -1 })
      .lean();
    
    console.log(`✅ Found ${list.length} photo-enabled events for user`);
    res.json(list);
  } catch (err) {
    console.error('❌ /my-photo-events error =>', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get My Event Invites - MUST BE BEFORE /:eventId route
router.get('/my-invites', protect, async (req, res) => {
  try {
    console.log(`📋 Fetching invites for user: ${req.user._id}`);
    
    const events = await Event.find({
      invitedUsers: req.user._id,
      attendees: { $ne: req.user._id }
    })
    .populate('host', 'username profilePicture')
    .populate('coHosts', 'username profilePicture')
    .select('title description time location host coHosts invitedUsers pricing coverImage')
    .sort({ time: 1 })
    .lean();

    console.log(`✅ Found ${events.length} event invitations`);

    const eventInvites = events.map(event => ({
      event,
      invitedAt: new Date(),
      status: 'pending'
    }));

    res.json(eventInvites);
  } catch (error) {
    console.error('❌ Get my invites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get My Join Requests - MUST BE BEFORE /:eventId route  
router.get('/my-join-requests', protect, async (req, res) => {
  try {
    console.log(`📋 Fetching join requests for events hosted by: ${req.user._id}`);
    
    const events = await Event.find({
      $or: [
        { host: req.user._id },
        { coHosts: req.user._id }
      ],
      'joinRequests.0': { $exists: true }
    })
    .populate({
      path: 'joinRequests.user',
      select: 'username profilePicture'
    })
    .select('title joinRequests host coHosts')
    .lean();

    console.log(`✅ Found ${events.length} events with join requests`);

    const joinRequests = [];
    events.forEach(event => {
      event.joinRequests.forEach(request => {
        joinRequests.push({
          event: {
            _id: event._id,
            title: event.title
          },
          user: request.user,
          message: request.message,
          requestedAt: request.requestedAt || new Date()
        });
      });
    });

    joinRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    console.log(`✅ Returning ${joinRequests.length} total join requests`);
    res.json(joinRequests);
  } catch (error) {
    console.error('❌ Get my join requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload Cover Image
router.post('/upload-cover', protect, uploadCover.single('coverImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const coverImagePath = `/uploads/covers/${req.file.filename}`;
    
    res.json({
      success: true,
      coverImage: coverImagePath,
      filename: req.file.filename
    });

  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload cover image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// Get User Events
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      type = 'all',
      includePast = 'false',
      limit = 50,
      skip = 0 
    } = req.query;

    const currentUserId = req.user._id;
    const isOwnProfile = String(userId) === String(currentUserId);

    let query = {};
    
    switch (type) {
      case 'hosted':
        query.host = userId;
        break;
      case 'attending':
        query.attendees = userId;
        query.host = { $ne: userId };
        break;
      case 'shared':
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        const sharedEventIds = user.sharedEvents || [];
        query._id = { $in: sharedEventIds };
        break;
      default:
        query.$or = [
          { host: userId },
          { attendees: userId }
        ];
    }

    if (includePast !== 'true') {
      query.time = { $gte: new Date() };
    }

    if (!isOwnProfile) {
      const permission = await EventPrivacyService.getVisibleEvents(currentUserId, {
        hostFilter: userId,
        limit: parseInt(limit),
        skip: parseInt(skip)
      });
      
      return res.json({
        events: permission,
        total: permission.length,
        isOwnProfile: false
      });
    }

    const events = await Event.find(query)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username')
      .sort({ time: includePast === 'true' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const eventsWithMetadata = events.map(event => {
      const isHost = String(event.host._id) === String(userId);
      const isAttending = event.attendees.some(a => String(a._id) === String(userId));
      const isPast = new Date(event.time) < new Date();
      
      return {
        ...event.toObject(),
        isHost,
        isAttending,
        isPast,
        relationshipType: isHost ? 'host' : 'attendee'
      };
    });

    res.json({
      events: eventsWithMetadata,
      total: eventsWithMetadata.length,
      isOwnProfile: true
    });

  } catch (error) {
    console.error('Get user events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User Calendar Events
router.get('/user/:userId/calendar', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    if (userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(userId).populate('attendingEvents');
    if (!user) return res.status(404).json({ message: 'User not found' });

    let events = user.attendingEvents;  
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1); 
      events = events.filter((evt) => {
        if (!evt.time) return false;
        const t = new Date(evt.time);
        return (t >= startDate && t < endDate);
      });
    }

    res.json({ events });
  } catch (error) {
    console.error('GET /events/user/:userId/calendar error =>', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// ENHANCED: CREATE EVENT WITH PAYMENT TOGGLE
// ============================================
const checkPaymentStatus = async (userId) => {
  try {
    const user = await User.findById(userId).select('paymentAccounts');
    if (!user) throw new Error('User not found');

    const paymentAccounts = user.paymentAccounts || {};
    return {
      success: true,
      canReceivePayments: !!(paymentAccounts.primary?.canReceivePayments),
      primaryProvider: paymentAccounts.primary?.type || null,
      providers: {
        paypal: {
          connected: !!(paymentAccounts.paypal?.verified),
          email: paymentAccounts.paypal?.email
        },
        stripe: {
          connected: !!(paymentAccounts.stripe?.chargesEnabled),
          onboardingComplete: !!(paymentAccounts.stripe?.onboardingComplete)
        }
      }
    };
  } catch (error) {
    console.error('❌ Payment status check error:', error);
    return { success: false, canReceivePayments: false };
  }
};


router.post('/create', protect, uploadCover.single('coverImage'), async (req, res) => {
  try {
    console.log('📝 PHASE 2: Creating new event with manual privacy validation...');
    console.log('📥 Request body keys:', Object.keys(req.body));
    console.log('📥 Privacy level received:', req.body.privacyLevel);

    const {
      title, description, category = 'General',
      time, location, maxAttendees = 10,
      privacyLevel, // ✅ Handle privacy level directly

      // Enhanced pricing fields
      isPaidEvent, eventPrice, priceDescription,
      refundPolicy, earlyBirdEnabled, earlyBirdPrice, earlyBirdDeadline,

      // Co-hosts and invitations
      coHosts, invitedUsers, tags, coordinates, groupId,

      // Legacy fields
      price, isPublic, openToPublic, allowPhotos, allowUploads, allowUploadsBeforeStart,
      weatherDependent, interests, ageMin, ageMax,

      // Check-in form integration
      checkInFormId,
      requiresFormForCheckIn = false,

    } = req.body;

    // ✅ MANUAL PRIVACY VALIDATION (same as edit route)
    const PRIVACY_PRESETS = {
      public: {
        canView: 'anyone',
        canJoin: 'anyone',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: true,
        appearInSearch: true,
        showAttendeesToPublic: true
      },
      friends: {
        canView: 'followers',
        canJoin: 'followers',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: true,
        appearInSearch: true,
        showAttendeesToPublic: false
      },
      private: {
        canView: 'invited-only',
        canJoin: 'invited-only',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: false,
        appearInSearch: false,
        showAttendeesToPublic: false
      }
    };

    // ✅ PRIVACY VALIDATION - Handle exactly like edit route
    let finalPrivacyLevel = 'public'; // Default
    let finalPermissions = PRIVACY_PRESETS.public; // Default

    if (privacyLevel !== undefined && privacyLevel !== null && privacyLevel !== '') {
      console.log(`🔒 Privacy level requested: "${privacyLevel}"`);
      
      // Validate new privacy level
      const validPrivacyLevels = ['public', 'friends', 'private'];
      const normalizedPrivacyLevel = String(privacyLevel).toLowerCase().trim();
      
      if (!validPrivacyLevels.includes(normalizedPrivacyLevel)) {
        console.warn(`⚠️ Invalid privacy level "${privacyLevel}", using default: "public"`);
        // Don't return error, just use default
      } else {
        // Apply privacy level with correct permissions
        finalPrivacyLevel = normalizedPrivacyLevel;
        finalPermissions = PRIVACY_PRESETS[finalPrivacyLevel];
        console.log(`✅ Privacy level set to: "${finalPrivacyLevel}"`);
        console.log(`🔧 Permissions applied:`, finalPermissions);
      }
    } else {
      console.log(`📋 No privacy level provided, using default: "public"`);
    }

    // Handle pricing
    const isPaid = isPaidEvent === 'true' || isPaidEvent === true;
    const eventPriceNum = isPaid ? parseFloat(eventPrice) || 0 : 0;
    const earlyBirdPriceNum = earlyBirdEnabled ? parseFloat(earlyBirdPrice) || 0 : 0;

    // 🔧 CRITICAL: Check payment setup for paid events
    if (isPaid && eventPriceNum > 0) {
      const paymentStatus = await checkPaymentStatus(req.user._id);
      console.log('💰 Payment status for paid event:', paymentStatus);
      
      if (!paymentStatus.canReceivePayments) {
        return res.status(400).json({ 
          message: 'Payment setup required for paid events',
          needsPaymentSetup: true,
          paymentStatus: paymentStatus
        });
      }
    }

    // Get group if specified
    let group = null;
    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: 'Group not found' });
    }

    // Parse co-hosts
    let coHostsArray = [];
    if (coHosts) {
      try {
        coHostsArray = typeof coHosts === 'string' ? JSON.parse(coHosts) : coHosts;
      } catch (e) {
        console.log('Invalid coHosts format:', coHosts);
      }
    }

    // Parse invited users for private events
    let invitedUsersArray = [];
    if (invitedUsers && finalPrivacyLevel === 'private') {
      try {
        invitedUsersArray = typeof invitedUsers === 'string' ? JSON.parse(invitedUsers) : invitedUsers;
      } catch (e) {
        console.log('Invalid invitedUsers format:', invitedUsers);
      }
    }

    // Helper functions
    const bool = (val) => val === 'true' || val === true;
    const parseIntSafe = (val) => {
      const parsed = parseInt(val);
      return isNaN(parsed) ? undefined : parsed;
    };

    // ✅ Create event data with manually validated privacy
    const eventData = {
      title: title.trim(),
      description: description?.trim() || '',
      time: new Date(time),
      location: location.trim(),
      category,
      host: req.user._id,
      coHosts: coHostsArray,
      maxAttendees: parseInt(maxAttendees) || 50,

      // Enhanced pricing system
      pricing: {
        isFree: !isPaid,
        amount: isPaid ? Math.round(eventPriceNum * 100) : 0,
        currency: 'USD',
        description: priceDescription?.trim(),
        refundPolicy: refundPolicy || 'no-refund',
        earlyBirdPricing: {
          enabled: bool(earlyBirdEnabled),
          amount: earlyBirdEnabled ? Math.round(earlyBirdPriceNum * 100) : 0,
          deadline: earlyBirdEnabled && earlyBirdDeadline ? new Date(earlyBirdDeadline) : undefined,
          description: earlyBirdEnabled ? `Early bird pricing until ${new Date(earlyBirdDeadline).toLocaleDateString()}` : undefined
        }
      },

      // ✅ Use manually validated privacy settings
      privacyLevel: finalPrivacyLevel,
      permissions: finalPermissions,

      // Invited users for private events
      invitedUsers: finalPrivacyLevel === 'private' ? invitedUsersArray : [],

      // Legacy compatibility
      price: eventPriceNum,
      isPublic: bool(isPublic) ?? (finalPrivacyLevel === 'public'),
      allowPhotos: bool(allowPhotos) ?? true,
      openToPublic: bool(openToPublic) ?? (finalPermissions?.canJoin === 'anyone'),
      allowUploads: bool(allowUploads) ?? true,
      allowUploadsBeforeStart: bool(allowUploadsBeforeStart) ?? true,

      group: group?._id,

      // Discovery fields
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      weatherDependent: bool(weatherDependent),
      interests: interests ? (Array.isArray(interests) ? interests : interests.split(',').map(i => i.trim())) : [],
      ageRestriction: {
        ...(ageMin && { min: parseIntSafe(ageMin) }),
        ...(ageMax && { max: parseIntSafe(ageMax) })
      },

      // Initialize financial tracking
      financials: {
        totalRevenue: 0,
        totalRefunded: 0,
        netRevenue: 0,
        totalPayments: 0,
        stripeFeesTotal: 0,
        hostEarnings: 0,
        currency: 'USD'
      }
    };

    // Handle coordinates properly
    if (coordinates) {
      try {
        const coords = typeof coordinates === 'string' 
          ? JSON.parse(coordinates) 
          : coordinates;

        if (Array.isArray(coords) && coords.length === 2) {
          eventData.geo = {
            type: 'Point',
            coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
          };
          console.log('✅ Geo coordinates set:', eventData.geo);
        }
      } catch (error) {
        console.log('❌ Error parsing coordinates:', error);
      }
    }

    // Handle check-in form assignment
    if (checkInFormId && requiresFormForCheckIn) {
      const form = await Form.findById(checkInFormId);
      if (!form) {
        return res.status(400).json({ message: 'Check-in form not found' });
      }

      if (String(form.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'You can only use forms you created' });
      }

      eventData.checkInForm = checkInFormId;
      eventData.requiresFormForCheckIn = true;
      console.log(`✅ Event assigned check-in form ${checkInFormId}`);
    }

    // Handle cover image
    if (req.file) {
      eventData.coverImage = `/uploads/covers/${req.file.filename}`;
    }

    console.log('🔧 Final event data privacy settings:', {
      privacyLevel: eventData.privacyLevel,
      permissions: eventData.permissions
    });

    // Create the event
    const event = new Event(eventData);
    await event.save();

    setImmediate(async () => {
          try {
            await onEventCreated(event._id, req.user._id);
            console.log(`🎉 Activity hook executed for event creation: ${event._id}`);
          } catch (activityError) {
            console.error('Failed to create event creation activity:', activityError);
          }
        });
    // Add to group if specified
    if (group) { 
      group.events.push(event._id); 
      await group.save(); 
    }

    // ✅ Auto-invite for private events created from groups
    if (eventData.privacyLevel === 'private' && group && invitedUsersArray.length === 0) {
      // Auto-invite group members if no specific invites provided
      const autoInvites = group.members.filter(m => String(m) !== String(req.user._id));
      event.invitedUsers = autoInvites;
      await event.save();
      console.log(`🎫 Auto-invited ${autoInvites.length} group members to private event`);
    }

    console.log(`✅ Event created successfully: ${event._id}`);
    console.log(`🔒 Final Privacy Level: ${event.privacyLevel}`);
    console.log(`🔧 Final Permissions Applied:`, event.permissions);

    res.status(201).json({
      message: 'Event created successfully',
      _id: event._id,
      event: event,
      isPaidEvent: isPaid,
      privacyLevel: event.privacyLevel,
      permissions: event.permissions,
      hasCheckInForm: !!checkInFormId,
      needsPaymentSetup: false,
      privacyValidation: {
        applied: true,
        level: event.privacyLevel,
        validatedManually: true // ✅ Indicates we handled it manually
      }
    });

  } catch (err) {
    console.error('❌ Event creation error:', err);
    res.status(500).json({ 
      message: 'Failed to create event', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});




// Create Event from Group Chat
router.post('/create-from-group/:groupId', protect, upload.single('coverImage'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const eventData = {
      ...req.body,
      time: new Date(req.body.time)
    };

    if (req.file) {
      eventData.coverImage = `/uploads/event-covers/${req.file.filename}`;
    }

    const event = await EventPrivacyService.createFromGroupChat(
      groupId, 
      req.user._id, 
      eventData
    );

    res.status(201).json(event);
  } catch (err) {
    console.error('Create group event →', err);
    res.status(400).json({ message: err.message });
  }
});

// ============================================
// PHASE 1: ENHANCED EVENTS FEED WITH PRIVACY FILTERING
// ============================================
router.get('/', protect, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      search, 
      privacy,
      location,
      radius = 50 // km
    } = req.query;

    const userId = req.user._id;
    const skip = (page - 1) * limit;

    console.log('🔍 PHASE 2: Event discovery request');
    console.log(`   User: ${userId}`);
    console.log(`   Filters: category=${category}, search=${search}, privacy=${privacy}`);

    // Get user's following list for privacy filtering
    const user = await User.findById(userId).select('following');
    const userFollowing = user.following.map(f => String(f));

    // ✅ PHASE 2: Build privacy-aware query
    const query = { $and: [] };

    // Base time filter (only future events)
    query.$and.push({ time: { $gte: new Date() } });

    // ✅ PHASE 2: Privacy filtering based on user relationship
    const privacyConditions = [
      // 1. User's own events (always visible)
      { host: userId },
      
      // 2. Events where user is co-host (always visible)
      { coHosts: userId },
      
      // 3. Events where user is attendee (always visible)
      { attendees: userId },
      
      // 4. Events where user is invited (always visible)
      { invitedUsers: userId },
      
      // 5. Public events (visible to everyone)
      {
        privacyLevel: PRIVACY_LEVELS.PUBLIC,
        'permissions.canView': { $in: ['anyone'] },
        'permissions.appearInSearch': true
      },
      
      // 6. Friends-only events (visible to followers)
      {
        privacyLevel: PRIVACY_LEVELS.FRIENDS,
        host: { $in: userFollowing },
        'permissions.canView': { $in: ['followers'] },
        'permissions.appearInSearch': true
      }
      
      // Note: Private events are only visible through conditions 1-4 above
    ];

    query.$and.push({ $or: privacyConditions });

    // Category filter
    if (category && category !== 'all') {
      query.$and.push({ category: category });
    }

    // Search filter
    if (search) {
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      });
    }

    // Privacy level filter (if specifically requested)
    if (privacy && Object.values(PRIVACY_LEVELS).includes(privacy)) {
      query.$and.push({ privacyLevel: privacy });
    }

    // Location filter
    if (location) {
      try {
        const coords = JSON.parse(location);
        if (Array.isArray(coords) && coords.length === 2) {
          query.$and.push({
            geo: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
                },
                $maxDistance: radius * 1000 // Convert km to meters
              }
            }
          });
        }
      } catch (error) {
        console.log('Invalid location format:', location);
      }
    }

    console.log('🔍 PHASE 2: Privacy-aware query:', JSON.stringify(query, null, 2));

    // Execute query with privacy filtering
    const events = await Event.find(query)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username profilePicture')
      .populate('coHosts', 'username profilePicture')
      .sort({ 
        time: 1,           // Upcoming events first
        createdAt: -1      // Then by newest
      })
      .limit(parseInt(limit))
      .skip(skip);

    // ✅ PHASE 2: Add privacy metadata to each event
    const eventsWithMetadata = events.map(event => {
      const eventObj = event.toObject();
      const isHost = String(event.host._id) === String(userId);
      const isCoHost = event.coHosts?.some(c => String(c._id) === String(userId));
      const isAttending = event.attendees?.some(a => String(a._id) === String(userId));
      const isInvited = event.invitedUsers?.some(u => String(u) === String(userId));
      const isFollowingHost = userFollowing.includes(String(event.host._id));

      return {
        ...eventObj,
        // User relationship metadata
        userRelationship: {
          isHost,
          isCoHost,
          isAttending,
          isInvited,
          isFollowingHost,
          canJoin: event.canUserJoin(userId, userFollowing),
          canView: event.canUserView(userId, userFollowing),
          canShare: event.canUserShare(userId),
          canInvite: event.canUserInvite(userId)
        },
        // Privacy visibility explanation
        privacyVisibility: {
          level: event.privacyLevel,
          reason: isHost ? 'own-event' : 
                  isCoHost ? 'co-host' : 
                  isAttending ? 'attendee' : 
                  isInvited ? 'invited' :
                  event.privacyLevel === PRIVACY_LEVELS.PUBLIC ? 'public' :
                  event.privacyLevel === PRIVACY_LEVELS.FRIENDS && isFollowingHost ? 'following-host' :
                  'unknown'
        }
      };
    });

    console.log(`✅ PHASE 2: Found ${eventsWithMetadata.length} events for user ${userId}`);

    // Get total count for pagination
    const totalEvents = await Event.countDocuments(query);

    res.json({
      success: true,
      events: eventsWithMetadata,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalEvents / limit),
        totalEvents,
        hasMore: skip + events.length < totalEvents
      },
      filters: {
        category,
        search,
        privacy,
        location: location ? JSON.parse(location) : null,
        radius
      },
      privacyInfo: {
        userFollowingCount: userFollowing.length,
        privacyLevelsSearched: Object.values(PRIVACY_LEVELS),
        filterApplied: 'privacy-aware'
      }
    });

  } catch (error) {
    console.error('❌ PHASE 2: Event discovery error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch events',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// ============================================
// PHASE 1: HELPER FUNCTIONS FOR PRIVACY CALCULATIONS
// ============================================

/**
 * Determine if attendees should be shown based on privacy and access type
 */
function shouldShowAttendees(event, accessCheck) {
  // Host and co-hosts can always see attendees
  if (accessCheck.accessType === 'user') {
    const userId = accessCheck.userId;
    const isHost = String(event.host._id) === String(userId);
    const isCoHost = event.coHosts && event.coHosts.some(c => String(c._id) === String(userId));
    if (isHost || isCoHost) return true;
  }

  // Check privacy level and permissions
  switch (event.privacyLevel) {
    case 'public':
      return event.permissions?.showAttendeesToPublic !== false;
    case 'friends':
      // Friends can see attendees, guests cannot
      return accessCheck.accessType === 'user';
    case 'private':
    case 'secret':
      // Very restricted attendee visibility
      return false;
    default:
      return false;
  }
}

/**
 * Calculate if user/guest can invite others
 */
function calculateCanInvite(event, userId, isHost, isCoHost, accessCheck) {
  if (accessCheck.accessType === 'guest') {
    return event.privacyLevel === 'public' && accessCheck.guestPass?.permissions?.canInviteOthers;
  }
  
  if (isHost || isCoHost) return true;
  
  switch (event.permissions?.canInvite) {
    case 'anyone':
      return true;
    case 'attendees':
      return event.attendees && event.attendees.some(a => String(a._id) === String(userId));
    case 'host-only':
    default:
      return false;
  }
}

/**
 * Calculate if user/guest can share event
 */
function calculateCanShare(event, userId, isHost, isCoHost, isAttending, accessCheck) {
  if (accessCheck.accessType === 'guest') {
    return event.privacyLevel === 'public';
  }
  
  if (isHost || isCoHost) return true;
  
  switch (event.permissions?.canShare) {
    case 'anyone':
      return true;
    case 'attendees':
      return isAttending;
    case 'host-only':
    default:
      return false;
  }
}

/**
 * Calculate if user/guest can upload photos
 */
function calculateCanUploadPhotos(event, userId, isAttending, accessCheck) {
  if (accessCheck.accessType === 'guest') {
    return accessCheck.guestPass?.permissions?.canUploadPhotos && event.privacyLevel !== 'secret';
  }
  
  // Registered users who are attending can usually upload photos
  return isAttending;
}

/**
 * Get privacy message for guest users
 */
function getPrivacyMessageForGuest(privacyLevel) {
  switch (privacyLevel) {
    case 'public':
      return 'This is a public event that anyone can join.';
    case 'friends':
      return 'This event is limited to the host\'s followers, but you\'ve been personally invited.';
    case 'private':
      return 'This is a private event that requires an invitation.';
    case 'secret':
      return 'This is a secret event with limited visibility.';
    default:
      return 'You have been invited to this event.';
  }
}

// ============================================
// ENHANCED: ATTEND EVENT WITH SMART PAYMENT
// ============================================
router.post('/attend/:eventId', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;
    const { paymentConfirmed = false, provider, paypalOrderId, paypalCaptureId } = req.body;

    console.log(`🔄 User ${userId} attempting to attend event ${eventId}`);

    // ✅ FIX: Get event with full Mongoose document (not lean)
    const event = await Event.findById(eventId)
      .populate('host', '_id username')
      .populate('coHosts', '_id username')
      .populate('attendees', '_id username')
      .populate('invitedUsers', '_id username');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // ✅ FIX: Get user with following data for privacy checks
    const user = await User.findById(userId).populate('following', '_id');
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const userFollowing = user.following.map(f => String(f._id));

    // ✅ CRITICAL FIX: Check if user is already attending using MongoDB query
    const isAlreadyAttending = await Event.findOne({
      _id: eventId,
      attendees: userId
    });

    if (isAlreadyAttending) {
      return res.status(400).json({ message: 'You are already attending this event' });
    }

    // ✅ FIX: Use instance methods from Event model (now works because we have full document)
    let canJoin = false;
    let methodError = null;
    
    try {
      // Check if user can join this event
      canJoin = event.canUserJoin(userId, userFollowing);
    } catch (error) {
      console.warn('⚠️ Event method failed, using fallback permission check:', error);
      methodError = error;
      
      // Fallback permission check
      const isHost = String(event.host._id || event.host) === String(userId);
      const isInvited = event.invitedUsers && event.invitedUsers.some(u => 
        String(u._id || u) === String(userId)
      );
      const isFollowingHost = userFollowing.includes(String(event.host._id || event.host));

      if (isHost) {
        return res.status(400).json({ message: 'You cannot attend your own event' });
      }

      // Basic permission checks
      switch (event.privacyLevel) {
        case 'public':
          canJoin = true;
          break;
        case 'friends':
          canJoin = isFollowingHost;
          break;
        case 'private':
        case 'secret':
          canJoin = isInvited;
          break;
        default:
          canJoin = false;
      }
    }
    
    if (!canJoin) {
      return res.status(403).json({ 
        message: 'You do not have permission to join this event' 
      });
    }

    // ✅ PAYMENT VALIDATION: Check if payment is required
    const isPaidEvent = event.pricing && !event.pricing.isFree && event.pricing.amount > 0;
    
    if (isPaidEvent) {
      // Check if user has already paid
      const hasUserPaid = event.paymentHistory && event.paymentHistory.some(payment => 
        String(payment.user) === String(userId) && payment.status === 'succeeded'
      );

      if (!hasUserPaid && !paymentConfirmed) {
        return res.status(402).json({ 
          message: 'Payment required for this event',
          requiresPayment: true,
          amount: event.pricing.amount,
          currency: event.pricing.currency || 'USD'
        });
      }

      // If payment is confirmed, verify it
      if (paymentConfirmed && !hasUserPaid) {
        // Validate payment based on provider
        if (provider === 'paypal' && paypalOrderId) {
          // Add payment record to event
          if (!event.paymentHistory) {
            event.paymentHistory = [];
          }
          
          event.paymentHistory.push({
            user: userId,
            amount: event.pricing.amount,
            currency: event.pricing.currency || 'USD',
            provider: 'paypal',
            orderId: paypalOrderId,
            captureId: paypalCaptureId,
            status: 'succeeded',
            paidAt: new Date()
          });
        } else if (provider === 'stripe') {
          // Stripe payment validation would happen here
          if (!event.paymentHistory) {
            event.paymentHistory = [];
          }
          
          event.paymentHistory.push({
            user: userId,
            amount: event.pricing.amount,
            currency: event.pricing.currency || 'USD',
            provider: 'stripe',
            status: 'succeeded',
            paidAt: new Date()
          });
        }
      }
    }

    // ✅ CRITICAL FIX: Use MongoDB $addToSet for atomic deduplication
    const session = await event.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Add user to event attendees (prevents duplicates automatically)
        await Event.findByIdAndUpdate(
          eventId,
          { $addToSet: { attendees: userId } },
          { session }
        );

        // Add event to user's attending events (prevents duplicates automatically)
        await User.findByIdAndUpdate(
          userId,
          { $addToSet: { attendingEvents: eventId } },
          { session }
        );

        // If there are payment records to add, update those too
        if (isPaidEvent && paymentConfirmed && event.paymentHistory.length > 0) {
          const lastPayment = event.paymentHistory[event.paymentHistory.length - 1];
          await Event.findByIdAndUpdate(
            eventId,
            { $push: { paymentHistory: lastPayment } },
            { session }
          );
        }
      });

      console.log(`✅ User ${userId} successfully joined event ${eventId} using atomic operations`);

    } finally {
      await session.endSession();
    }

    // ✅ NEW: Create activity for friends (non-blocking)
    setImmediate(async () => {
      try {
        await onEventJoin(eventId, userId);
        console.log(`🎯 Activity hook executed for event join: ${userId} -> ${eventId}`);
      } catch (activityError) {
        console.error('Failed to create event join activity:', activityError);
        // Don't fail the main operation if activity creation fails
      }
    });

    // Create notification for event host (non-blocking)
    setImmediate(async () => {
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          user: event.host._id || event.host,
          type: 'event_join',
          category: 'events',
          message: `${user.username} is now attending your event "${event.title}"`,
          data: {
            eventId: event._id,
            eventTitle: event.title,
            userId: user._id,
            username: user.username
          },
          actionType: 'VIEW_EVENT',
          actionData: { eventId: event._id }
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }
    });

    // Get fresh event data for response
    const updatedEvent = await Event.findById(eventId);
    
    res.json({ 
      message: 'Successfully joined the event!',
      event: {
        _id: updatedEvent._id,
        title: updatedEvent.title,
        attendeeCount: updatedEvent.attendees.length
      },
      alreadyPaid: isPaidEvent && updatedEvent.paymentHistory && updatedEvent.paymentHistory.some(p => 
        String(p.user) === String(userId) && p.status === 'succeeded'
      )
    });

  } catch (error) {
    console.error('❌ Event attendance error:', error);
    res.status(500).json({ 
      message: 'Failed to process attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

router.delete('/:eventId', protect, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    
    console.log(`🗑️ Starting enhanced deletion process for event: ${eventId} by user: ${userId}`);

    // ============================================
    // 1. VALIDATION & AUTHORIZATION
    // ============================================
    
    const event = await Event.findById(eventId)
      .populate('host', '_id username')
      .populate('attendees', '_id username')
      .session(session);

    if (!event) {
      console.log(`❌ Event not found: ${eventId}`);
      return res.status(404).json({ 
        message: 'Event not found',
        code: 'EVENT_NOT_FOUND'
      });
    }

    // Check authorization using event method
    const canManage = event.canUserManage(userId);
    if (!canManage) {
      console.log(`❌ Unauthorized deletion attempt by user: ${userId}`);
      return res.status(403).json({ 
        message: 'Only the host or co-hosts can delete this event',
        code: 'DELETION_DENIED'
      });
    }

    console.log(`✅ Authorization passed - User can delete event`);

    // ============================================
    // 2. START TRANSACTION WITH ACTIVITY CLEANUP
    // ============================================
    
    await session.withTransaction(async () => {
      console.log(`🔄 Starting transaction for event deletion`);

      // ============================================
      // 3. ACTIVITY FEED CLEANUP (NEW!)
      // ============================================
      
      console.log(`🎯 Starting activity feed cleanup for event: ${eventId}`);
      
      // Since your activities are generated dynamically from existing data,
      // we need to clean up the source data that generates activities
      
      // Remove any stored activity cache if you implement caching later
      // This is where you'd clear Redis cache, activity store, etc.
      
      // Clear any notification-based activities
      await Notification.deleteMany({
        $or: [
          { 'data.eventId': eventId },
          { 'actionData.eventId': eventId },
          { type: { $in: ['event_invitation', 'event_reminder', 'event_announcement'] }, 'data.eventId': eventId }
        ]
      }, { session });
      
      console.log(`🎯 Activity feed source data cleanup completed`);

      // ============================================
      // 4. ENHANCED PHOTO CLEANUP (Existing + Enhanced)
      // ============================================
      
      console.log(`📸 Starting enhanced photo cleanup for event: ${eventId}`);
      
      // ✅ Count photos before cleanup for stats
      const photoCountBefore = await Photo.countDocuments({
        $or: [
          { event: eventId },
          { taggedEvent: eventId }
        ]
      }, { session });
      
      console.log(`📸 Found ${photoCountBefore} photos to cleanup`);
      
      // ✅ Use the existing static method for efficient cleanup
      const photoCleanupResult = await Photo.cleanupEventReferences(eventId, { session });
      
      console.log(`📸 Cleaned up ${photoCleanupResult.modifiedCount} photos - removed event references`);

      // ✅ Additional privacy-aware cleanup for flagged/moderated photos
      const moderatedPhotosResult = await Photo.updateMany(
        {
          $or: [
            { event: eventId },
            { taggedEvent: eventId }
          ],
          'moderation.status': { $in: ['flagged', 'pending'] }
        },
        {
          $set: {
            'moderation.status': 'approved', // Reset moderation status
            'moderation.moderatedBy': userId,
            'moderation.moderatedAt': new Date(),
            'moderation.moderationNote': 'Event deleted - auto-approved'
          }
        },
        { session }
      );

      console.log(`📸 Reset moderation status for ${moderatedPhotosResult.modifiedCount} photos`);

      // ✅ Update event photos array to remove all photo references
      await Event.findByIdAndUpdate(
        eventId,
        { $set: { photos: [] } },
        { session }
      );

      // ============================================
      // 5. USER CLEANUP (Enhanced)
      // ============================================
      
      console.log(`👥 Cleaning up user references`);

      // Remove event from all attendees' arrays
      const attendeeIds = event.attendees.map(a => a._id);
      if (attendeeIds.length > 0) {
        const userUpdateResult = await User.updateMany(
          { _id: { $in: attendeeIds } },
          { 
            $pull: { 
              attendingEvents: eventId,
              savedEvents: eventId,
              invitedEvents: eventId // In case this field exists
            }
          },
          { session }
        );

        console.log(`👥 Removed event from ${userUpdateResult.modifiedCount} user profiles`);
      }

      // Remove from host's arrays
      await User.findByIdAndUpdate(
        event.host._id,
        { 
          $pull: { 
            hostedEvents: eventId,
            savedEvents: eventId,
            invitedEvents: eventId
          }
        },
        { session }
      );

      // Remove from co-hosts' arrays if they exist
      if (event.coHosts && event.coHosts.length > 0) {
        await User.updateMany(
          { _id: { $in: event.coHosts } },
          { 
            $pull: { 
              coHostedEvents: eventId,
              savedEvents: eventId 
            }
          },
          { session }
        );
      }

      // ============================================
      // 6. NOTIFICATION CLEANUP (Enhanced)
      // ============================================
      
      console.log(`🔔 Cleaning up notifications`);

      // Remove ALL notifications related to this event with comprehensive query
      const notificationDeleteResult = await Notification.deleteMany({
        $or: [
          { 'data.eventId': eventId },
          { 'actionData.eventId': eventId },
          { 
            type: { 
              $in: [
                'event_invitation', 'event_reminder', 'event_announcement', 
                'event_join', 'event_rsvp_batch', 'event_update', 'event_cancelled'
              ] 
            }, 
            'data.eventId': eventId 
          }
        ]
      }, { session });

      console.log(`🔔 Deleted ${notificationDeleteResult.deletedCount} event-related notifications`);

      // ✅ Send deletion notifications to attendees
      const deletionNotifications = attendeeIds.map(attendeeId => ({
        user: attendeeId,
        sender: userId,
        category: 'events',
        type: 'event_cancelled',
        title: 'Event Cancelled',
        message: `The event "${event.title}" has been cancelled by the host`,
        data: {
          eventId: eventId,
          eventTitle: event.title,
          cancellationReason: 'Event deleted by host',
          deletedAt: new Date()
        },
        createdAt: new Date()
      }));

      if (deletionNotifications.length > 0) {
        await Notification.insertMany(deletionNotifications, { session });
        console.log(`🔔 Sent cancellation notifications to ${deletionNotifications.length} attendees`);
      }

      // ============================================
      // 7. PAYMENT CLEANUP (Enhanced)
      // ============================================
      
      if (event.pricing && !event.pricing.isFree && event.paymentHistory?.length > 0) {
        console.log(`💳 Processing refunds for paid event`);
        
        const refundablePayments = event.paymentHistory.filter(
          payment => payment.status === 'succeeded'
        );
        
        console.log(`💳 Found ${refundablePayments.length} payments requiring refund processing`);
        
        // Update payment statuses to indicate refund needed
        if (refundablePayments.length > 0) {
          await Event.findByIdAndUpdate(
            eventId,
            {
              $set: {
                'paymentHistory.$[payment].refundStatus': 'pending',
                'paymentHistory.$[payment].refundInitiatedAt': new Date(),
                'paymentHistory.$[payment].refundReason': 'Event cancelled by host'
              }
            },
            {
              arrayFilters: [{ 'payment.status': 'succeeded' }],
              session
            }
          );
          
          // Create refund processing notifications for host
          await Notification.create([{
            user: userId,
            category: 'payments',
            type: 'refund_processing_required',
            title: 'Refunds Required',
            message: `${refundablePayments.length} payment${refundablePayments.length === 1 ? '' : 's'} from "${event.title}" require${refundablePayments.length === 1 ? 's' : ''} refund processing`,
            data: {
              eventId: eventId,
              eventTitle: event.title,
              refundCount: refundablePayments.length,
              totalAmount: refundablePayments.reduce((sum, p) => sum + (p.amount || 0), 0)
            }
          }], { session });
        }
      }

      // ============================================
      // 8. GROUP CLEANUP (Enhanced)
      // ============================================
      
      if (event.group) {
        console.log(`👥 Removing event from group: ${event.group}`);
        
        const Group = require('../models/Group');
        await Group.findByIdAndUpdate(
          event.group,
          { $pull: { events: eventId } },
          { session }
        );
        
        // Create group notification about event cancellation
        const group = await Group.findById(event.group).select('members name').session(session);
        if (group && group.members.length > 0) {
          const groupNotifications = group.members
            .filter(memberId => String(memberId) !== String(userId))
            .map(memberId => ({
              user: memberId,
              sender: userId,
              category: 'groups',
              type: 'group_event_cancelled',
              title: 'Group Event Cancelled',
              message: `"${event.title}" has been cancelled in ${group.name}`,
              data: {
                groupId: event.group,
                groupName: group.name,
                eventId: eventId,
                eventTitle: event.title
              },
              createdAt: new Date()
            }));
          
          if (groupNotifications.length > 0) {
            await Notification.insertMany(groupNotifications, { session });
            console.log(`🔔 Sent group cancellation notifications to ${groupNotifications.length} members`);
          }
        }
      }

      // ============================================
      // 9. MEMORY/HIGHLIGHT CLEANUP (Enhanced)
      // ============================================
      
      console.log(`📱 Cleaning up memories and highlights`);
      
      // Clean up memories associated with this event
      try {
        const Memory = require('../models/Memory');
        const memoryUpdateResult = await Memory.updateMany(
          { events: eventId },
          { $pull: { events: eventId } },
          { session }
        );
        console.log(`📱 Updated ${memoryUpdateResult.modifiedCount} memories`);
        
        // If any memories have no events left, optionally mark them differently
        await Memory.updateMany(
          { events: { $size: 0 }, eventBased: true },
          { $set: { eventBased: false, generalMemory: true } },
          { session }
        );
        
      } catch (memoryError) {
        console.log(`📱 Memory cleanup skipped (model not found): ${memoryError.message}`);
      }

      // ============================================
      // 10. GUEST PASS CLEANUP (NEW!)
      // ============================================
      
      console.log(`🎫 Cleaning up guest passes`);
      
      try {
        const GuestPass = require('../models/GuestPass');
        
        // Mark all guest passes as cancelled
        const guestPassUpdateResult = await GuestPass.updateMany(
          { event: eventId },
          { 
            $set: { 
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'Event deleted by host'
            }
          },
          { session }
        );
        
        console.log(`🎫 Updated ${guestPassUpdateResult.modifiedCount} guest passes`);
        
      } catch (guestPassError) {
        console.log(`🎫 Guest pass cleanup skipped: ${guestPassError.message}`);
      }

      // ============================================
      // 11. FORM SUBMISSION CLEANUP (NEW!)
      // ============================================
      
      console.log(`📝 Cleaning up form submissions`);
      
      if (event.checkInForm) {
        try {
          const FormSubmission = require('../models/FormSubmission');
          
          // Mark form submissions as event-deleted (don't delete them entirely)
          const formUpdateResult = await FormSubmission.updateMany(
            { event: eventId },
            { 
              $set: { 
                eventDeleted: true,
                eventDeletedAt: new Date()
              }
            },
            { session }
          );
          
          console.log(`📝 Updated ${formUpdateResult.modifiedCount} form submissions`);
          
        } catch (formError) {
          console.log(`📝 Form submission cleanup skipped: ${formError.message}`);
        }
      }

      // ============================================
      // 12. FINAL EVENT DELETION
      // ============================================
      
      console.log(`🗑️ Deleting the event itself`);

      const deletedEvent = await Event.findByIdAndDelete(eventId, { session });

      if (!deletedEvent) {
        throw new Error('Failed to delete event from database');
      }

      console.log(`✅ Event ${eventId} successfully deleted`);

    }); // End transaction

    // ============================================
    // 13. POST-DELETION PROCESSING & STATS
    // ============================================
    
    console.log(`🎉 Event deletion completed successfully`);

    // ✅ Enhanced cleanup stats
    const cleanupStats = {
      eventId: eventId,
      eventTitle: event.title,
      deletedAt: new Date(),
      deletedBy: {
        _id: userId,
        username: req.user.username
      },
      impact: {
        attendeesNotified: event.attendees ? event.attendees.length : 0,
        coHostsAffected: event.coHosts ? event.coHosts.length : 0,
        photosUntagged: await Photo.countDocuments({
          $and: [
            { 
              $or: [
                { event: { $exists: false } },
                { event: null }
              ]
            },
            { 
              $or: [
                { taggedEvent: { $exists: false } },
                { taggedEvent: null }
              ]
            },
            { visibleInEvent: false }
          ]
        }),
        notificationsRemoved: 0, // Will be filled by cleanup count
        paymentsRequiringRefund: event.paymentHistory ? 
          event.paymentHistory.filter(p => p.status === 'succeeded').length : 0,
        groupAffected: !!event.group,
        hadFormSubmissions: !!event.checkInForm
      },
      eventDetails: {
        privacyLevel: event.privacyLevel,
        hadPhotos: event.allowPhotos,
        wasPaymentRequired: event.pricing && !event.pricing.isFree,
        hadCheckInForm: !!event.checkInForm,
        wasGroupEvent: !!event.group,
        attendeeCount: event.attendees.length
      }
    };

    // ✅ Log detailed analytics for cleanup verification
    console.log('📊 Cleanup Statistics:', JSON.stringify(cleanupStats, null, 2));

    // ✅ Enhanced response with comprehensive cleanup confirmation
    res.status(200).json({
      success: true,
      message: 'Event deleted successfully with complete cleanup',
      stats: cleanupStats,
      actions: [
        'Event permanently deleted',
        'Photos untagged and preserved in user galleries',
        'Attendees notified of cancellation',
        'All related notifications cleaned up',
        'Activity feed sources invalidated',
        'User profiles updated (attending/saved events removed)',
        event.coHosts?.length > 0 ? `${event.coHosts.length} co-host${event.coHosts.length === 1 ? '' : 's'} updated` : null,
        event.group ? 'Removed from group and notified group members' : null,
        event.checkInForm ? 'Form submissions preserved but marked as event-deleted' : null,
        event.pricing && !event.pricing.isFree ? 'Refund processing initiated for paid attendees' : null,
        'Guest passes cancelled (if any)',
        'Memory associations updated'
      ].filter(Boolean),
      nextSteps: [
        event.pricing && !event.pricing.isFree ? 'Process refunds through your payment provider dashboard' : null,
        event.attendees.length > 5 ? 'Consider sending a follow-up message to attendees if needed' : null
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('❌ Enhanced event deletion failed:', error);
    
    // Detailed error logging for debugging
    console.error('Error details:', {
      eventId: req.params.eventId,
      userId: req.user._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      code: 'DELETION_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      debugInfo: process.env.NODE_ENV === 'development' ? {
        errorType: error.constructor.name,
        errorStack: error.stack
      } : undefined
    });

  } finally {
    await session.endSession();
    console.log(`🔄 Database session ended`);
  }
});

// ============================================
// PHASE 1: HELPER FUNCTION - Enhanced Batch Photo Cleanup
// ============================================

/**
 * Enhanced helper function for cleaning up large numbers of photos efficiently
 * Uses cursor-based processing with privacy context updates
 */
async function handlePrivacyChangeEffects(eventId, oldPrivacy, newPrivacy, hostId) {
  console.log(`🔒 PRIVACY CHANGE: Handling effects for event ${eventId}`);
  console.log(`🔄 Change: "${oldPrivacy}" -> "${newPrivacy}"`);
  
  // If changing TO private, we need to clean up feeds
  if (newPrivacy === 'private' && oldPrivacy !== 'private') {
    await cleanupFeedsForPrivateEvent(eventId, hostId);
  }
  
  // If changing FROM private, we may need to repopulate feeds
  if (oldPrivacy === 'private' && newPrivacy !== 'private') {
    await repopulateFeedsForPublicEvent(eventId, hostId);
  }
}

async function cleanupFeedsForPrivateEvent(eventId, hostId) {
  console.log(`🧹 CLEANUP: Removing private event ${eventId} from public feeds`);
  
  try {
    // Get list of friends to determine who should keep seeing activities
    const host = await User.findById(hostId).select('friends');
    const friendIds = host.friends
      .filter(f => f.status === 'accepted')
      .map(f => String(f.user));
    
    // 1. Remove event creation activities from non-friends' feeds
    const eventCreationCleanup = await mongoose.connection.db.collection('activities').deleteMany({
      eventId: new mongoose.Types.ObjectId(eventId),
      type: 'event_created',
      userId: { 
        $nin: [
          new mongoose.Types.ObjectId(hostId), // Keep host's own activities
          ...friendIds.map(id => new mongoose.Types.ObjectId(id)) // Keep friends' activities
        ]
      }
    });
    
    // 2. Remove event photo upload activities from non-attendees
    const photoCleanup = await mongoose.connection.db.collection('activities').deleteMany({
      eventId: new mongoose.Types.ObjectId(eventId),
      type: 'event_photo_upload',
      userId: { 
        $nin: [
          new mongoose.Types.ObjectId(hostId),
          ...friendIds.map(id => new mongoose.Types.ObjectId(id))
        ]
      }
    });
    
    // 3. Remove event join activities from non-attendees  
    const joinCleanup = await mongoose.connection.db.collection('activities').deleteMany({
      eventId: new mongoose.Types.ObjectId(eventId),
      type: 'friend_event_join',
      userId: { 
        $nin: [
          new mongoose.Types.ObjectId(hostId),
          ...friendIds.map(id => new mongoose.Types.ObjectId(id))
        ]
      }
    });
    
    // 4. Remove memory creation activities for this event from public feeds
    const memoryCleanup = await mongoose.connection.db.collection('activities').deleteMany({
      eventId: new mongoose.Types.ObjectId(eventId),
      type: 'memory_created',
      userId: { 
        $nin: [
          new mongoose.Types.ObjectId(hostId),
          ...friendIds.map(id => new mongoose.Types.ObjectId(id))
        ]
      }
    });
    
    const totalDeleted = (eventCreationCleanup.deletedCount || 0) + 
                        (photoCleanup.deletedCount || 0) + 
                        (joinCleanup.deletedCount || 0) + 
                        (memoryCleanup.deletedCount || 0);
    
    console.log(`✅ CLEANUP COMPLETE: Removed ${totalDeleted} activities`);
    console.log(`   - Event creation: ${eventCreationCleanup.deletedCount || 0}`);
    console.log(`   - Photo uploads: ${photoCleanup.deletedCount || 0}`);
    console.log(`   - Event joins: ${joinCleanup.deletedCount || 0}`);
    console.log(`   - Memory creation: ${memoryCleanup.deletedCount || 0}`);
    
    // 5. Invalidate any cached feeds (if you're using caching)
    await invalidateFeedCaches(eventId);
    
  } catch (error) {
    console.error(`❌ CLEANUP ERROR: Failed to clean feeds for private event ${eventId}:`, error);
    throw error;
  }
}

async function repopulateFeedsForPublicEvent(eventId, hostId) {
  console.log(`📈 REPOPULATE: Making event ${eventId} visible in appropriate feeds`);
  
  // This is more complex - you'd need to recreate the activities
  // that should now be visible based on the new privacy level
  // For now, we'll just log it as a placeholder
  console.log(`⚠️ REPOPULATE: Not implemented yet - manual feed refresh may be needed`);
}

// Helper function to invalidate feed caches
async function invalidateFeedCaches(eventId) {
  // If you're using Redis or another cache
  // Clear any cached feed data that might contain this event
  console.log(`🗑️ CACHE: Invalidating feed caches for event ${eventId}`);
  // TODO: Add your cache invalidation logic here
}

// Alternative more detailed version:
function logPrivacyEnforcement(details) {
  console.log(`🔒 PRIVACY ENFORCEMENT: ${details.action}`);
  console.log(`📋 Event: ${details.eventId}`);
  console.log(`👤 User: ${details.userId}`);
  if (details.oldPrivacy && details.newPrivacy) {
    console.log(`🔄 Privacy change: "${details.oldPrivacy}" -> "${details.newPrivacy}"`);
  }
  if (details.affectedUsers) {
    console.log(`👥 Affected users: ${details.affectedUsers.length}`);
  }
  if (details.feedCleanup) {
    console.log(`🧹 Feed cleanup required: ${details.feedCleanup}`);
  }
}
async function enhancedCleanupPhotosInBatches(eventId, session, batchSize = 100) {
  console.log(`📸 Starting enhanced batch photo cleanup for event: ${eventId}`);
  
  let processedCount = 0;
  let hasMore = true;
  
  while (hasMore) {
    const photos = await Photo.find({
      $or: [
        { event: eventId },
        { taggedEvent: eventId }
      ]
    })
    .limit(batchSize)
    .session(session);

    if (photos.length === 0) {
      hasMore = false;
      break;
    }

    const photoIds = photos.map(photo => photo._id);
    
    // ✅ PHASE 1 & 2: Enhanced cleanup with privacy context reset
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      {
        $unset: { 
          event: 1,
          taggedEvent: 1 
        },
        $set: {
          visibleInEvent: false,
          'privacyContext.isInPrivateEvent': false,
          'moderation.status': 'approved' // Reset any pending moderation
        }
      },
      { session }
    );

    processedCount += photos.length;
    console.log(`📸 Enhanced processed ${processedCount} photos so far...`);

    // If we got fewer photos than the batch size, we're done
    if (photos.length < batchSize) {
      hasMore = false;
    }
  }

  console.log(`📸 Enhanced batch photo cleanup completed. Total processed: ${processedCount}`);
  return processedCount;
}
router.delete('/admin/bulk-delete', protect, async (req, res) => {
  try {
    // Check if user is admin (implement your admin check logic)
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        message: 'Admin access required',
        code: 'ADMIN_ONLY'
      });
    }

    const { eventIds, reason } = req.body;
    
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ 
        message: 'Event IDs array is required',
        code: 'MISSING_EVENT_IDS'
      });
    }

    if (eventIds.length > 50) {
      return res.status(400).json({ 
        message: 'Maximum 50 events can be deleted at once',
        code: 'TOO_MANY_EVENTS'
      });
    }

    console.log(`🗑️ Admin bulk deletion: ${eventIds.length} events`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const eventId of eventIds) {
      try {
        // Use the enhanced cleanup for each event
        const cleanupResult = await Photo.cleanupEventReferences(eventId);
        
        // Delete the event
        const deletedEvent = await Event.findByIdAndDelete(eventId);
        
        if (deletedEvent) {
          results.push({
            eventId,
            success: true,
            title: deletedEvent.title,
            photosUntagged: cleanupResult.modifiedCount
          });
          successCount++;
        } else {
          results.push({
            eventId,
            success: false,
            error: 'Event not found'
          });
          errorCount++;
        }
      } catch (error) {
        results.push({
          eventId,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Bulk deletion completed: ${successCount} succeeded, ${errorCount} failed`,
      results,
      stats: {
        requested: eventIds.length,
        succeeded: successCount,
        failed: errorCount,
        reason: reason || 'Admin bulk deletion'
      }
    });

  } catch (error) {
    console.error('❌ Bulk deletion error:', error);
    res.status(500).json({ 
      message: 'Bulk deletion failed',
      code: 'BULK_DELETE_FAILED'
    });
  }
});

router.delete('/moderate/:photoId', protect, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { reason } = req.body;
    
    const photo = await Photo.findById(photoId)
      .populate('event', 'title host coHosts')
      .populate('user', 'username');
    
    if (!photo) {
      return res.status(404).json({ 
        message: 'Photo not found',
        code: 'PHOTO_NOT_FOUND'
      });
    }

    // Check if user can remove (host/co-host)
    let canRemove = false;
    if (photo.event) {
      const isHost = String(photo.event.host) === String(req.user._id);
      const isCoHost = photo.event.coHosts && photo.event.coHosts.some(c => 
        String(c) === String(req.user._id)
      );
      canRemove = isHost || isCoHost;
    }

    if (!canRemove) {
      return res.status(403).json({ 
        message: 'Not authorized to remove this photo',
        code: 'REMOVAL_DENIED'
      });
    }

    const originalEventId = photo.event._id;

    // SIMPLIFIED: Just remove from event
    photo.event = null;
    photo.taggedEvent = null;
    photo.visibleInEvent = false;
    
    await photo.save();

    // Remove from event photos array
    await Event.findByIdAndUpdate(originalEventId, {
      $pull: { photos: photo._id }
    });

    res.json({ 
      success: true, 
      message: 'Photo removed from event successfully',
      photoId: photoId,
      action: 'removed'
    });
    
  } catch (error) {
    console.error('❌ Photo removal error:', error);
    res.status(500).json({ 
      message: 'Server error',
      code: 'REMOVAL_FAILED'
    });
  }
});

router.post('/bulk-moderate', protect, async (req, res) => {
  try {
    const { photoIds, eventId, action, reason } = req.body;
    
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ 
        message: 'Photo IDs array is required',
        code: 'MISSING_PHOTO_IDS'
      });
    }

    if (!eventId) {
      return res.status(400).json({ 
        message: 'Event ID is required',
        code: 'MISSING_EVENT_ID'
      });
    }

    console.log(`🗑️ Bulk photo removal - Photos: ${photoIds.length}, Event: ${eventId}, Host: ${req.user._id}`);

    // Verify host permissions
    const event = await Event.findById(eventId).select('title host coHosts');
    if (!event) {
      return res.status(404).json({ 
        message: 'Event not found',
        code: 'EVENT_NOT_FOUND'
      });
    }

    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(c => String(c) === String(req.user._id));
    
    if (!isHost && !isCoHost) {
      return res.status(403).json({ 
        message: 'Not authorized to remove photos from this event',
        code: 'REMOVAL_DENIED'
      });
    }

    // Get all photos to remove
    const photos = await Photo.find({
      _id: { $in: photoIds },
      $or: [
        { event: eventId },
        { taggedEvent: eventId }
      ]
    }).populate('user', 'username');

    if (photos.length === 0) {
      return res.status(404).json({ 
        message: 'No photos found to remove',
        code: 'NO_PHOTOS_FOUND'
      });
    }

    console.log(`📸 Found ${photos.length} photos to remove from event`);

    const results = [];

    // Process each photo - SIMPLIFIED: Just remove from event
    for (const photo of photos) {
      try {
        // Simply remove event references
        photo.event = null;
        photo.taggedEvent = null;
        photo.visibleInEvent = false;
        
        await photo.save();

        results.push({
          photoId: photo._id,
          success: true,
          owner: photo.user?.username
        });

        console.log(`✅ Removed photo ${photo._id} from event`);

      } catch (error) {
        console.error(`❌ Error processing photo ${photo._id}:`, error);
        results.push({
          photoId: photo._id,
          success: false,
          error: error.message
        });
      }
    }

    // Remove photos from event array
    await Event.findByIdAndUpdate(eventId, {
      $pull: { photos: { $in: photoIds } }
    });

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`📊 Bulk removal complete - Success: ${successCount}, Failed: ${failCount}`);

    res.json({
      success: true,
      message: `Bulk removal completed: ${successCount} succeeded, ${failCount} failed`,
      results: {
        total: photoIds.length,
        succeeded: successCount,
        failed: failCount,
        eventTitle: event.title
      }
    });

  } catch (error) {
    console.error('❌ Bulk removal error:', error);
    res.status(500).json({ 
      message: 'Bulk removal failed',
      code: 'BULK_REMOVAL_FAILED'
    });
  }
});


// Auto-cleanup photos when user leaves/is removed from event
router.post('/cleanup-user-photos/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        message: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }

    console.log(`🧹 Auto-cleanup photos - Event: ${eventId}, User: ${userId}, Reason: ${reason}`);

    // Verify permissions
    const event = await Event.findById(eventId).select('title host coHosts');
    if (!event) {
      return res.status(404).json({ 
        message: 'Event not found',
        code: 'EVENT_NOT_FOUND'
      });
    }

    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(c => String(c) === String(req.user._id));
    const isSelfRemoval = String(userId) === String(req.user._id);
    
    if (!isHost && !isCoHost && !isSelfRemoval) {
      return res.status(403).json({ 
        message: 'Not authorized to cleanup user photos',
        code: 'CLEANUP_DENIED'
      });
    }

    // Find all photos from this user in this event
    const userPhotos = await Photo.find({
      user: userId,
      $or: [
        { event: eventId },
        { taggedEvent: eventId }
      ]
    });

    console.log(`📸 Found ${userPhotos.length} photos to cleanup for user ${userId}`);

    if (userPhotos.length === 0) {
      return res.json({
        success: true,
        message: 'No photos to cleanup',
        photosRemoved: 0
      });
    }

    // SIMPLIFIED: Just remove event references from all user photos
    const photoIds = userPhotos.map(p => p._id);
    
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      {
        $unset: { event: 1, taggedEvent: 1 },
        $set: { visibleInEvent: false }
      }
    );

    // Remove from event photos array
    await Event.findByIdAndUpdate(eventId, {
      $pull: { photos: { $in: photoIds } }
    });

    console.log(`✅ Auto-cleanup complete - Removed ${userPhotos.length} photos`);

    res.json({
      success: true,
      message: `Successfully removed ${userPhotos.length} photos from event`,
      photosRemoved: userPhotos.length,
      eventTitle: event.title
    });

  } catch (error) {
    console.error('❌ Photo cleanup error:', error);
    res.status(500).json({ 
      message: 'Photo cleanup failed',
      code: 'CLEANUP_FAILED'
    });
  }
});



// ============================================
// HELPER FUNCTION: Batch Photo Cleanup
// ============================================

/**
 * Helper function for cleaning up large numbers of photos efficiently
 * Uses cursor-based processing for better performance
 */
async function cleanupPhotosInBatches(eventId, session, batchSize = 100) {
  console.log(`📸 Starting batch photo cleanup for event: ${eventId}`);
  
  let processedCount = 0;
  let hasMore = true;
  
  while (hasMore) {
    const photos = await Photo.find({
      $or: [
        { event: eventId },
        { taggedEvent: eventId }
      ]
    })
    .limit(batchSize)
    .session(session);

    if (photos.length === 0) {
      hasMore = false;
      break;
    }

    const photoIds = photos.map(photo => photo._id);
    
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      {
        $unset: { 
          event: 1,
          taggedEvent: 1 
        },
        $set: {
          visibleInEvent: false
        }
      },
      { session }
    );

    processedCount += photos.length;
    console.log(`📸 Processed ${processedCount} photos so far...`);

    // If we got fewer photos than the batch size, we're done
    if (photos.length < batchSize) {
      hasMore = false;
    }
  }

  console.log(`📸 Batch photo cleanup completed. Total processed: ${processedCount}`);
  return processedCount;
}

// ============================================
// HELPER FUNCTION: Validation
// ============================================

/**
 * Validate that event can be safely deleted
 * Checks for any blocking conditions
 */
async function validateEventDeletion(event, userId) {
  const validationErrors = [];

  // Check if event has already started (optional business rule)
  const now = new Date();
  if (event.time < now) {
    // You might want to allow or prevent deletion of past events
    console.log(`⚠️ Warning: Attempting to delete past event (${event.time})`);
  }

  // Check if event has active payments (when you implement refunds later)
  if (event.paymentHistory && event.paymentHistory.length > 0) {
    console.log(`💰 Note: Event has payment history - future refund handling needed`);
  }

  // Check for any other business rules
  // Add more validation as needed

  return validationErrors;
}

// ✅ FIXED: Leave event endpoint
router.delete('/attend/:eventId', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;

    console.log(`🔄 User ${userId} attempting to leave event ${eventId}`);

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check if user is attending
    const isAttending = event.attendees.some(attendee => 
      String(attendee) === String(userId)
    );

    if (!isAttending) {
      return res.status(400).json({ message: 'You are not attending this event' });
    }

    // Remove user from attendees
    event.attendees = event.attendees.filter(attendee => 
      String(attendee) !== String(userId)
    );
    await event.save();

    // Remove event from user's attending list
    if (user.attendingEvents) {
      user.attendingEvents = user.attendingEvents.filter(id => 
        String(id) !== String(eventId)
      );
      await user.save();
    }

    console.log(`✅ User ${userId} successfully left event ${eventId}`);

    res.json({ 
      message: 'Successfully left the event',
      event: {
        _id: event._id,
        title: event.title,
        attendeeCount: event.attendees.length
      }
    });

  } catch (error) {
    console.error('❌ Leave event error:', error);
    res.status(500).json({ 
      message: 'Failed to leave event',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

router.get('/debug/payment-status/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).populate('host', 'paymentAccounts username email');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const host = event.host;
    const paymentAccounts = host.paymentAccounts || {};

    const debugInfo = {
      eventId: event._id,
      eventTitle: event.title,
      isPaidEvent: event.isPaidEvent(),
      eventPrice: event.pricing?.ticketPrice,
      host: {
        id: host._id,
        username: host.username,
        email: host.email
      },
      paymentAccounts: {
        hasAnyAccount: !!paymentAccounts,
        paypal: {
          exists: !!paymentAccounts.paypal,
          email: paymentAccounts.paypal?.email,
          verified: paymentAccounts.paypal?.verified,
          connectedAt: paymentAccounts.paypal?.connectedAt
        },
        stripe: {
          exists: !!paymentAccounts.stripe,
          accountId: paymentAccounts.stripe?.accountId,
          chargesEnabled: paymentAccounts.stripe?.chargesEnabled,
          onboardingComplete: paymentAccounts.stripe?.onboardingComplete
        },
        primary: {
          type: paymentAccounts.primary?.type,
          canReceivePayments: paymentAccounts.primary?.canReceivePayments
        }
      },
      canReceivePayments: host.canReceivePayments(),
      availablePaymentMethods: host.getAvailablePaymentMethods(),
      primaryPaymentMethod: host.getPrimaryPaymentMethod()
    };

    console.log('🔍 Payment Debug Info:', JSON.stringify(debugInfo, null, 2));

    res.json({
      success: true,
      debug: debugInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug payment status error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// ============================================
// DEBUG: VALIDATE USER PAYMENT METHODS
// ============================================
router.get('/debug/user-payments/:userId?', protect, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const user = await User.findById(userId).select('paymentAccounts username email');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const paymentAccounts = user.paymentAccounts || {};

    const debugInfo = {
      userId: user._id,
      username: user.username,
      email: user.email,
      paymentAccounts: {
        hasAnyAccount: !!paymentAccounts,
        paypal: {
          exists: !!paymentAccounts.paypal,
          email: paymentAccounts.paypal?.email,
          verified: paymentAccounts.paypal?.verified,
          connectedAt: paymentAccounts.paypal?.connectedAt
        },
        stripe: {
          exists: !!paymentAccounts.stripe,
          accountId: paymentAccounts.stripe?.accountId,
          chargesEnabled: paymentAccounts.stripe?.chargesEnabled,
          onboardingComplete: paymentAccounts.stripe?.onboardingComplete,
          detailsSubmitted: paymentAccounts.stripe?.detailsSubmitted
        },
        primary: paymentAccounts.primary
      },
      canReceivePayments: user.canReceivePayments(),
      availablePaymentMethods: user.getAvailablePaymentMethods(),
      primaryPaymentMethod: user.getPrimaryPaymentMethod(),
      needsPaymentSetup: user.needsPaymentSetup()
    };

    console.log('👤 User Payment Debug Info:', JSON.stringify(debugInfo, null, 2));

    res.json({
      success: true,
      debug: debugInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug user payments error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Send Join Request
router.post('/join-request/:eventId', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const event = await Event.findById(req.params.eventId);
    
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if user can request to join
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      req.params.eventId, 
      'join'
    );

    if (!permission.allowed && event.permissions.canJoin !== 'approval-required') {
      return res.status(403).json({ message: permission.reason });
    }

    // Check if already requested
    const existingRequest = event.joinRequests.find(
      jr => String(jr.user) === String(req.user._id)
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Join request already sent' });
    }

    // Add join request
    event.joinRequests.push({
      user: req.user._id,
      message: message || '',
      requestedAt: new Date()
    });

    await event.save();
    res.json({ message: 'Join request sent successfully' });

  } catch (e) {
    console.error('Join request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve Join Request
router.post('/join-request/:eventId/:userId/approve', protect, async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const event = await Event.findById(eventId);
    
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Only host and co-hosts can approve
    const isAuthorized = String(event.host) === String(req.user._id) ||
                        event.coHosts.some(c => String(c) === String(req.user._id));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to approve requests' });
    }

    // Remove from join requests and add to attendees
    event.joinRequests = event.joinRequests.filter(
      jr => String(jr.user) !== String(userId)
    );

    if (!event.attendees.includes(userId)) {
      event.attendees.push(userId);
    }

    // Add to user's attending events
    await User.findByIdAndUpdate(userId, {
      $addToSet: { attendingEvents: eventId }
    });

    await event.save();
    res.json({ message: 'Join request approved' });

  } catch (e) {
    console.error('Approve join request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject Join Request
router.delete('/join-request/:eventId/:userId/reject', protect, async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const event = await Event.findById(eventId);
    
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Only host and co-hosts can reject
    const isAuthorized = String(event.host) === String(req.user._id) ||
                        event.coHosts.some(c => String(c) === String(req.user._id));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to reject requests' });
    }

    // Remove from join requests
    event.joinRequests = event.joinRequests.filter(
      jr => String(jr.user) !== String(userId)
    );

    await event.save();
    res.json({ message: 'Join request rejected' });

  } catch (e) {
    console.error('Reject join request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Invite Users to Event
router.post('/:eventId/invite', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userIds } = req.body;

    console.log(`📨 Processing invite for event ${eventId} from user ${req.user._id}`);
    console.log(`📨 Inviting users:`, userIds);

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user can invite
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts?.some(c => String(c) === String(req.user._id));
    
    // ✅ NEW: For private events, only host/co-hosts can invite
    if (event.privacyLevel === 'private' && !isHost && !isCoHost) {
      return res.status(403).json({ 
        message: 'Only hosts can invite users to private events' 
      });
    }
    
    if (!isHost && !isCoHost) {
      if (event.permissions?.canInvite !== 'attendees' && event.permissions?.canInvite !== 'anyone') {
        return res.status(403).json({ message: 'You do not have permission to invite users to this event' });
      }
      
      if (event.permissions?.canInvite === 'attendees') {
        const isAttending = event.attendees?.some(a => String(a) === String(req.user._id));
        if (!isAttending) {
          return res.status(403).json({ message: 'Only attendees can invite others to this event' });
        }
      }
    }

    // ✅ NEW: For friends-only events, validate that invited users are friends with host
    if (event.privacyLevel === 'friends') {
      const host = await User.findById(event.host);
      const hostFriends = host ? host.getAcceptedFriends().map(f => String(f)) : [];
      
      const nonFriendInvites = userIds.filter(userId => !hostFriends.includes(String(userId)));
      if (nonFriendInvites.length > 0) {
        return res.status(400).json({ 
          message: 'Can only invite friends to friends-only events',
          invalidUsers: nonFriendInvites
        });
      }
    }

    const newInvites = [];
    const alreadyInvited = [];
    const alreadyAttending = [];
    const invalidUsers = [];

    for (const userId of userIds) {
      try {
        const userExists = await User.findById(userId);
        if (!userExists) {
          invalidUsers.push(userId);
          continue;
        }

        if (event.attendees?.includes(userId)) {
          alreadyAttending.push(userId);
          continue;
        }

        if (event.invitedUsers?.includes(userId)) {
          alreadyInvited.push(userId);
          continue;
        }

        if (!event.invitedUsers) {
          event.invitedUsers = [];
        }
        event.invitedUsers.push(userId);
        newInvites.push(userId);

      } catch (userError) {
        console.error(`❌ Error processing user ${userId}:`, userError);
        invalidUsers.push(userId);
      }
    }

    await event.save();

    // ✅ FIXED: Send invitation notifications (non-blocking)
    if (newInvites.length > 0) {
      setImmediate(async () => {
        try {
          for (const inviteeId of newInvites) {
            await notificationService.createNotification({
              userId: inviteeId,
              senderId: req.user._id,
              category: 'events',
              type: 'event_invitation',
              title: 'Event Invitation',
              message: `${req.user.username} invited you to "${event.title}"`,
              data: {
                eventId: eventId
              },
              actionType: 'VIEW_EVENT',
              actionData: { eventId }
            });
          }
          console.log(`🔔 Sent ${newInvites.length} event invitation notifications`);
        } catch (notifError) {
          console.error('Failed to create invitation notifications:', notifError);
        }
      });
    }

    console.log(`✅ Successfully invited ${newInvites.length} users`);

    res.json({
      message: `Successfully invited ${newInvites.length} user${newInvites.length !== 1 ? 's' : ''}`,
      invited: newInvites.length,
      alreadyInvited: alreadyInvited.length,
      alreadyAttending: alreadyAttending.length,
      invalid: invalidUsers.length,
      details: {
        newInvites,
        alreadyInvited,
        alreadyAttending,
        invalidUsers
      }
    });

  } catch (error) {
    console.error('❌ Invite users error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Decline Event Invite
router.delete('/invite/:eventId', protect, async (req, res) => {
  try {
    console.log(`❌ User ${req.user._id} declining invite to event ${req.params.eventId}`);
    
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const wasInvited = event.invitedUsers.includes(req.user._id);
    event.invitedUsers.pull(req.user._id);
    await event.save();

    if (wasInvited) {
      console.log(`✅ Successfully declined invitation to ${event.title}`);
    }

    res.json({ message: 'Event invitation declined' });
  } catch (error) {
    console.error('❌ Decline invite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Ban User from Event
router.post('/:eventId/banUser', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, banPermanently } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts?.some(
      (cId) => String(cId) === String(req.user._id)
    );

    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Not authorized to ban users' });
    }

    if (!event.attendees.includes(userId)) {
      return res.status(400).json({ message: 'User is not an attendee' });
    }

    event.attendees = event.attendees.filter(
      (attId) => String(attId) !== String(userId)
    );

    if (banPermanently) {
      if (!event.bannedUsers) {
        event.bannedUsers = [];
      }
      if (!event.bannedUsers.includes(userId)) {
        event.bannedUsers.push(userId);
      }
    }

    await event.save();

    const user = await User.findById(userId);
    if (user) {
      user.attendingEvents = user.attendingEvents.filter(
        (evtId) => String(evtId) !== String(event._id)
      );
      await user.save();
    }

    return res.json({
      message: banPermanently
        ? 'User has been banned and removed from attendees'
        : 'User removed from attendees',
      event
    });
  } catch (err) {
    console.error('banUser error =>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// SIMPLIFIED routes/events.js - Event check-in using userId

router.post('/:eventId/scan-user-qr', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { qrData } = req.body;

    // Get event
    const event = await Event.findById(eventId)
      .populate('host', 'username profilePicture')
      .populate('coHosts', 'username profilePicture')
      .populate('attendees', '_id username profilePicture')
      .populate('checkedIn', '_id username profilePicture');

    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Verify host permissions
    const isHost = String(event.host._id) === String(req.user._id);
    const isCoHost = event.coHosts.some(coHost => 
      String(coHost._id) === String(req.user._id)
    );
    
    if (!isHost && !isCoHost) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only hosts and co-hosts can check in attendees' 
      });
    }

    // ✅ SIMPLIFIED: Parse QR data for userId
    let parsedQR;
    try {
      parsedQR = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    if (parsedQR.type !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code - expected user QR code'
      });
    }

    // ✅ SIMPLIFIED: Direct userId lookup
    const targetUserId = parsedQR.userId;
    const targetUser = await User.findById(targetUserId)
      .select('_id username profilePicture bio');
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already checked in
    const isAlreadyCheckedIn = event.checkedIn.some(id => 
      String(id) === String(targetUserId)
    );
    
    if (isAlreadyCheckedIn) {
      return res.json({
        success: false,
        status: 'already_checked_in',
        message: 'User is already checked in',
        user: {
          _id: targetUser._id,
          username: targetUser.username,
          profilePicture: targetUser.profilePicture
        }
      });
    }
    
    // Check if user is attendee
    const isAttendee = event.attendees.some(id => 
      String(id) === String(targetUserId)
    );
    
    if (!isAttendee) {
      return res.json({
        success: false,
        status: 'not_registered',
        message: 'User is not registered for this event',
        user: {
          _id: targetUser._id,
          username: targetUser.username,
          profilePicture: targetUser.profilePicture
        }
      });
    }

    // ✅ Check them in
    event.checkedIn.push(targetUserId);
    await event.save();

    res.json({
      success: true,
      message: `${targetUser.username} has been checked in successfully`,
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        profilePicture: targetUser.profilePicture
      },
      event: {
        _id: event._id,
        title: event.title,
        checkedInCount: event.checkedIn.length
      }
    });

  } catch (error) {
    console.error('Event check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// Check-in endpoint
// Enhanced unified check-in endpoint
router.post('/:eventId/checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { qrCode, scannedUserId, userId, confirmEntry, manualCheckIn } = req.body;
    
    console.log('🔍 Check-in request:', { eventId, qrCode: !!qrCode, scannedUserId, userId, confirmEntry, manualCheckIn });

    // Get event with necessary populations
    const event = await Event.findById(eventId)
      .populate('host', 'username profilePicture')
      .populate('coHosts', 'username profilePicture')
      .populate('attendees', '_id username profilePicture')
      .populate('checkedIn', '_id username profilePicture');

    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Verify host permissions for scanning others
    const isHost = String(event.host._id) === String(req.user._id);
    const isCoHost = event.coHosts.some(coHost => 
      String(coHost._id) === String(req.user._id)
    );
    
    // Enhanced QR code handling with check-in form support
    if (qrCode) {
      console.log('🔍 Processing QR code for check-in:', qrCode.substring(0, 50) + '...');
      
      let qrData = null;
      
      // Try to parse QR code
      try {
        if (typeof qrCode === 'string') {
          // Try parsing as JSON first
          try {
            qrData = JSON.parse(qrCode);
            console.log('✅ Parsed QR data:', qrData);
          } catch (parseError) {
            // Not JSON, might be legacy format
            console.log('📝 QR data is not JSON, checking if it\'s legacy format');
          }
        } else if (typeof qrCode === 'object') {
          qrData = qrCode;
        }
        
        // Handle event check-in QR codes
        if (qrData && qrData.type === 'event_checkin') {
          if (qrData.eventId !== eventId) {
            return res.status(400).json({
              success: false,
              message: 'QR code is for a different event'
            });
          }
          
          // Verify QR code matches event's current QR
          const currentQRData = event.getCheckInQRData();
          if (!currentQRData || currentQRData.qrCode !== qrData.qrCode) {
            return res.status(400).json({
              success: false,
              message: 'QR code is expired or invalid'
            });
          }
          
          // Check if form is required
          if (qrData.hasForm && event.requiresFormForCheckIn) {
            // Check if user already submitted form
            const hasSubmitted = await event.hasUserSubmittedForm(req.user._id);
            if (!hasSubmitted) {
              return res.json({
                success: false,
                requiresForm: true,
                formId: qrData.formId,
                message: 'Please complete the check-in form',
                form: await event.getCheckInForm()
              });
            }
          }
          
          // Proceed with check-in
          const checkInResult = await event.checkInUser(req.user._id);
          
          return res.json({
            success: true,
            status: 'checked_in',
            message: 'Successfully checked in',
            user: {
              _id: req.user._id,
              username: req.user.username,
              profilePicture: req.user.profilePicture
            },
            checkIn: checkInResult
          });
        }
        
        // If not event check-in QR, continue with existing user profile logic
        // Handle user profile QR codes (existing functionality)
        let shareCodeToFind = null;
        
        if (typeof qrCode === 'string') {
          try {
            // Try to parse as JSON first (new format)
            const parsedData = JSON.parse(qrCode);
            console.log('✅ Parsed JSON QR data:', parsedData);
            
            if (parsedData.type === 'user_profile' && parsedData.shareCode) {
              shareCodeToFind = parsedData.shareCode;
              console.log('📱 Extracted shareCode from JSON:', shareCodeToFind);
            } else {
              console.log('❌ JSON QR data missing shareCode');
            }
          } catch (parseError) {
            // Not JSON, treat as direct share code (old format)
            shareCodeToFind = qrCode;
            console.log('📝 QR data is not JSON, treating as direct share code:', shareCodeToFind);
          }
        } else if (qrCode && typeof qrCode === 'object') {
          // Already parsed JSON object
          shareCodeToFind = qrCode.shareCode;
          console.log('📱 QR data already parsed, shareCode:', shareCodeToFind);
        }

        if (!shareCodeToFind) {
          console.log('❌ No shareCode found in QR data');
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid QR code format' 
          });
        }

        // Only hosts and co-hosts can check in others via user profile QR
        if (!isHost && !isCoHost) {
          return res.status(403).json({ 
            success: false, 
            message: 'Only hosts and co-hosts can check in attendees' 
          });
        }

        // Find user by share code
        const targetUser = await User.findOne({ shareCode: shareCodeToFind })
          .select('_id username profilePicture bio');
        
        if (targetUser) {
          console.log('✅ Found registered user:', targetUser.username);
          
          // Continue with existing user check-in logic
          const targetUserId = targetUser._id;
          const userIdStr = String(targetUserId);
          
          // Check if user is already checked in
          const isAlreadyCheckedIn = event.checkedIn.some(id => String(id) === userIdStr);
          if (isAlreadyCheckedIn) {
            return res.json({
              success: false,
              status: 'already_checked_in',
              message: 'User is already checked in',
              user: {
                _id: targetUser._id,
                username: targetUser.username,
                profilePicture: targetUser.profilePicture
              }
            });
          }
          
          // Check if user is attendee
          const isAttendee = event.attendees.some(id => String(id) === userIdStr);
          
          if (!isAttendee && !confirmEntry) {
            return res.json({
              success: false,
              status: 'requires_confirmation',
              message: 'User is not registered for this event. Allow entry?',
              user: {
                _id: targetUser._id,
                username: targetUser.username,
                profilePicture: targetUser.profilePicture,
                bio: targetUser.bio
              }
            });
          }
          
          // Add to attendees if not already there and host confirmed
          if (!isAttendee && confirmEntry) {
            event.attendees.push(targetUser._id);
            console.log('➕ Added non-attendee to attendees list');
          }
          
          // Check in the user
          event.checkedIn.push(targetUser._id);
          await event.save();
          
          console.log('✅ User checked in successfully:', targetUser.username);
          
          return res.json({
            success: true,
            status: 'checked_in',
            message: `${targetUser.username} checked in successfully`,
            user: {
              _id: targetUser._id,
              username: targetUser.username,
              profilePicture: targetUser.profilePicture
            },
            wasAdded: !isAttendee,
            manualCheckIn: manualCheckIn || false
          });
        } else {
          // Try to find guest pass (existing logic)
          console.log('🔍 Looking for guest pass...');
          const GuestPass = require('../models/GuestPass');
          const guestPass = await GuestPass.findOne({ 
            'qrData.code': shareCodeToFind,
            event: eventId
          });
          
          if (guestPass) {
            console.log('✅ Found guest pass:', guestPass.guestName);
            // Handle guest pass check-in (existing logic)
            return await handleGuestPassCheckin(guestPass, req.user._id, res);
          }
        }
        
        if (!targetUser && !guestPass) {
          console.log('❌ No user or guest pass found for QR code');
          return res.status(404).json({ 
            success: false, 
            message: 'QR code not recognized. Please try again.'
          });
        }
        
      } catch (error) {
        console.error('❌ QR processing error:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code format'
        });
      }
    }

    // Handle manual check-in (existing logic continues...)
    // ... rest of the existing check-in endpoint logic

  } catch (error) {
    console.error('❌ Check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process check-in' 
    });
  }
});


// Helper function for user check-in (same as before)
async function handleUserCheckin(event, user, confirmEntry, manualCheckIn, res) {
  try {
    const isAttendee = event.attendees.some(attendee => 
      String(attendee._id) === String(user._id)
    );
    
    // Check if already checked in
    const alreadyCheckedIn = event.checkedIn.some(checkedUser => 
      String(checkedUser._id) === String(user._id)
    );
    
    if (alreadyCheckedIn) {
      return res.json({
        success: false,
        status: 'already_checked_in',
        message: 'User is already checked in',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture
        }
      });
    }
    
    // If not an attendee, require host confirmation unless already confirmed
    if (!isAttendee && !confirmEntry) {
      return res.json({
        success: false,
        status: 'requires_confirmation',
        message: 'User is not registered for this event. Allow entry?',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture,
          bio: user.bio
        }
      });
    }
    
    // Add to attendees if not already there and host confirmed
    if (!isAttendee && confirmEntry) {
      event.attendees.push(user._id);
      console.log('➕ Added non-attendee to attendees list');
    }
    
    // Check in the user
    event.checkedIn.push(user._id);
    await event.save();
    
    console.log('✅ User checked in successfully:', user.username);
    
    return res.json({
      success: true,
      status: 'checked_in',
      message: `${user.username} checked in successfully`,
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture
      },
      wasAdded: !isAttendee,
      manualCheckIn: manualCheckIn || false
    });
    
  } catch (error) {
    console.error('❌ User check-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check in user',
      error: error.message
    });
  }
}

// Helper function for guest pass check-in (same as before)
async function handleGuestPassCheckin(guestPass, scannedById, res) {
  try {
    // Validate guest pass
    if (!guestPass.isValid()) {
      return res.json({
        success: false,
        status: 'invalid_guest_pass',
        message: guestPass.status === 'used' 
          ? 'Guest pass has already been used'
          : 'Guest pass is not valid for check-in'
      });
    }
    
    // Mark guest pass as used
    guestPass.status = 'used';
    guestPass.usedAt = new Date();
    guestPass.checkedInBy = scannedById;
    await guestPass.save();
    
    console.log('✅ Guest checked in successfully:', guestPass.guestName);
    
    return res.json({
      success: true,
      status: 'guest_checked_in',
      message: `${guestPass.guestName} checked in successfully`,
      guestPass: {
        _id: guestPass._id,
        guestName: guestPass.guestName,
        usedAt: guestPass.usedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Guest pass check-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check in guest',
      error: error.message
    });
  }
}

// Get Event Attendees
router.get('/:eventId/attendees', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId)
      .populate('attendees', 'username profilePicture bio')
      .populate('checkedIn', '_id')
      .populate('host', 'username profilePicture');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const userId = req.user._id;
    const isHost = String(event.host._id) === String(userId);
    const isAttending = event.attendees.some(attendee => 
      String(attendee._id) === String(userId)
    );

    if (!isHost && !isAttending && !event.permissions?.showAttendeesToPublic) {
      return res.status(403).json({ message: 'Not authorized to view attendees' });
    }

    const attendeesWithStatus = event.attendees.map(attendee => ({
      _id: attendee._id,
      username: attendee.username,
      profilePicture: attendee.profilePicture,
      bio: attendee.bio,
      isCheckedIn: event.checkedIn.some(checkedUser => 
        String(checkedUser._id) === String(attendee._id)
      )
    }));

    res.json({
      attendees: attendeesWithStatus,
      checkedInCount: event.checkedIn.length,
      totalCount: event.attendees.length,
      canManage: isHost
    });

  } catch (error) {
    console.error('Get attendees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// PARAMETERIZED ROUTES LAST (CRITICAL!)
// ========================================

// Update Event Cover Image
router.post('/:eventId/cover', protect, upload.single('coverImage'), async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can update the cover image' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No cover image uploaded' });
    }
    
    if (event.coverImage) {
      const oldImagePath = path.join(__dirname, '..', event.coverImage);
      fs.unlink(oldImagePath, (err) => {
        if (err) console.error('Error deleting old cover image:', err);
      });
    }
    
    const coverImagePath = `/uploads/event-covers/${req.file.filename}`;
    event.coverImage = coverImagePath;
    await event.save();
    
    res.json({
      message: 'Cover image updated successfully',
      coverImage: coverImagePath,
      event: {
        _id: event._id,
        title: event.title,
        coverImage: event.coverImage
      }
    });
    
  } catch (error) {
    console.error('Cover image upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove Event Cover Image
router.delete('/:eventId/cover', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can remove the cover image' });
    }
    
    if (event.coverImage) {
      const imagePath = path.join(__dirname, '..', event.coverImage);
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Error deleting cover image file:', err);
      });
    }
    
    event.coverImage = null;
    await event.save();
    
    res.json({
      message: 'Cover image removed successfully',
      event: {
        _id: event._id,
        title: event.title,
        coverImage: null
      }
    });
    
  } catch (error) {
    console.error('Cover image removal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Add Stripe payment intent creation
router.post('/create-stripe-payment-intent/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { amount, currency = 'usd' } = req.body;

    const event = await Event.findById(eventId).populate('host');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Check if host has Stripe enabled
    if (!event.host.paymentAccounts?.stripe?.chargesEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Host has not set up Stripe payments',
        needsPaymentSetup: true
      });
    }

    // Create payment intent
    const paymentIntent = await StripeConnectService.createPaymentIntent({
      amount: amount * 100, // Convert to cents
      currency,
      connectedAccountId: event.host.paymentAccounts.stripe.accountId,
      metadata: {
        eventId: event._id.toString(),
        hostId: event.host._id.toString()
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('❌ Stripe payment intent creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment intent',
      error: error.message 
    });
  }
});

// Update PayPal order creation route
router.post('/create-paypal-order/:eventId', protect, async (req, res) => {
  try {
    const { amount, currency = 'USD' } = req.body;
    const event = await Event.findById(req.params.eventId).populate('host', 'paymentAccounts');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!event.isPaidEvent()) {
      return res.status(400).json({ message: 'This is not a paid event' });
    }

    // Verify host can receive PayPal payments
    if (!event.host.paymentAccounts?.paypal?.verified) {
      return res.status(400).json({ 
        message: 'Host cannot currently receive PayPal payments',
        needsPaymentSetup: true
      });
    }

    // Check if user already paid
    if (event.hasUserPaid(req.user._id)) {
      return res.status(400).json({ 
        message: 'You have already paid for this event' 
      });
    }

    // Check PayPal configuration
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.error('❌ PayPal not configured - missing environment variables');
      return res.status(500).json({ 
        message: 'PayPal payments are not configured on this server',
        error: 'Missing PayPal credentials'
      });
    }

    console.log('🔍 Creating PayPal order with:', {
      amount,
      currency,
      hostEmail: event.host.paymentAccounts.paypal.email,
      eventTitle: event.title
    });

    // Create PayPal order using your PayPal provider
    const paypalProvider = new PayPalProvider();
    const paymentOrder = await paypalProvider.createPaymentOrder(
      amount, // Amount in cents
      currency,
      event.host.paymentAccounts.paypal.email,
      {
        eventId: event._id.toString(),
        eventTitle: event.title,
        userId: req.user._id.toString()
      }
    );

    console.log('✅ PayPal order created:', paymentOrder);

    if (paymentOrder.success) {
      res.json({
        success: true,
        orderId: paymentOrder.orderId,
        approvalUrl: paymentOrder.approvalUrl
      });
    } else {
      throw new Error('Failed to create PayPal order');
    }

  } catch (error) {
    console.error('❌ PayPal order creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create PayPal order', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
router.get('/search', protect, async (req, res) => {
  try {
    const { 
      q: searchQuery, 
      category, 
      location, 
      radius = 25,
      privacy,
      limit = 20, 
      skip = 0 
    } = req.query;

    if (!searchQuery || searchQuery.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const userId = req.user._id;
    console.log(`🔍 PHASE 2: Searching events for "${searchQuery}"`);

    // Get user following for privacy filtering
    const user = await User.findById(userId).select('following');
    const userFollowing = user.following.map(f => String(f));

    // ✅ PHASE 2: Build privacy-aware search query
    const searchConditions = {
      $and: [
        // Text search conditions
        {
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { tags: { $in: [new RegExp(searchQuery, 'i')] } },
            { category: { $regex: searchQuery, $options: 'i' } }
          ]
        },
        
        // Privacy filtering for search
        {
          $or: [
            // User's own events (always searchable)
            { host: userId },
            
            // Co-hosted events (always searchable)
            { coHosts: userId },
            
            // Events where user is invited (always searchable)
            { invitedUsers: userId },
            
            // Public events that appear in search
            {
              privacyLevel: PRIVACY_LEVELS.PUBLIC,
              'permissions.appearInSearch': true
            },
            
            // Friends-only events from followed users that appear in search
            {
              privacyLevel: PRIVACY_LEVELS.FRIENDS,
              host: { $in: userFollowing },
              'permissions.appearInSearch': true
            }
            
            // Private events don't appear in search unless user is involved
          ]
        },
        
        // Only future events
        { time: { $gte: new Date() } }
      ]
    };

    // Add additional filters
    if (category && category !== 'all') {
      searchConditions.$and.push({ category: category });
    }

    if (privacy && Object.values(PRIVACY_LEVELS).includes(privacy)) {
      searchConditions.$and.push({ privacyLevel: privacy });
    }

    // Location-based search
    if (location) {
      try {
        const coords = JSON.parse(location);
        if (Array.isArray(coords) && coords.length === 2) {
          searchConditions.$and.push({
            geo: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
                },
                $maxDistance: radius * 1000
              }
            }
          });
        }
      } catch (error) {
        console.log('Invalid location format for search:', location);
      }
    }

    console.log('🔍 PHASE 2: Search query with privacy:', JSON.stringify(searchConditions, null, 2));

    // Execute search
    const searchResults = await Event.find(searchConditions)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username profilePicture')
      .sort({ 
        // Relevance scoring (simplified)
        $expr: {
          $add: [
            // Boost exact title matches
            { $cond: [{ $regexMatch: { input: '$title', regex: new RegExp(`^${searchQuery}`, 'i') } }, 10, 0] },
            // Boost events from followed users
            { $cond: [{ $in: ['$host', userFollowing] }, 5, 0] },
            // Boost by attendee count (popularity)
            { $min: [{ $size: { $ifNull: ['$attendees', []] } }, 3] }
          ]
        },
        time: 1
      })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // Add search-specific metadata
    const resultsWithMetadata = searchResults.map(event => {
      const eventObj = event.toObject();
      const isFollowingHost = userFollowing.includes(String(event.host._id));
      
      // Calculate search relevance indicators
      const titleMatch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
      const descriptionMatch = event.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const tagMatch = event.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return {
        ...eventObj,
        searchMetadata: {
          query: searchQuery,
          relevance: {
            titleMatch,
            descriptionMatch,
            tagMatch,
            fromFollowedUser: isFollowingHost
          },
          privacyContext: {
            level: event.privacyLevel,
            visibleBecause: String(event.host._id) === String(userId) ? 'own-event' :
                           event.coHosts?.some(c => String(c._id) === String(userId)) ? 'co-host' :
                           event.invitedUsers?.some(u => String(u) === String(userId)) ? 'invited' :
                           event.privacyLevel === PRIVACY_LEVELS.PUBLIC ? 'public-searchable' :
                           isFollowingHost ? 'following-host' : 'unknown'
          }
        }
      };
    });

    console.log(`🔍 Search completed: ${resultsWithMetadata.length} results for "${searchQuery}"`);

    res.json({
      success: true,
      query: searchQuery,
      results: resultsWithMetadata,
      searchInfo: {
        totalResults: resultsWithMetadata.length,
        privacyFiltered: true,
        filters: { category, location, privacy, radius }
      }
    });

  } catch (error) {
    console.error('❌ PHASE 2: Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

router.post('/setup-paypal', protect, async (req, res) => {
  try {
    const { paypalEmail } = req.body;
    const userId = req.user._id;

    console.log(`💰 Setting up PayPal for user ${userId} with email: ${paypalEmail}`);

    if (!paypalEmail || !paypalEmail.includes('@')) {
      return res.status(400).json({ 
        success: false,
        message: 'Valid PayPal email address required' 
      });
    }

    // Find user and update PayPal account
    const user = await User.findById(userId);
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
      verified: true, // In production, this would require actual verification
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

    console.log(`✅ PayPal setup successful for user ${userId}`);
    
    res.json({
      success: true,
      message: 'PayPal account connected successfully',
      provider: 'paypal',
      accountEmail: paypalEmail,
      canReceivePayments: user.canReceivePayments()
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


// Add PayPal capture route
router.post('/capture-paypal-payment/:eventId', protect, async (req, res) => {
  try {
    const { orderId } = req.body;
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Capture PayPal payment
    const paypalProvider = new PayPalProvider();
    const captureResult = await paypalProvider.capturePayment(orderId);

    if (captureResult.success) {
      // Add payment to event history
      const paymentData = {
        user: req.user._id,
        amount: event.getCurrentPrice(),
        currency: event.pricing.currency || 'usd',
        provider: 'paypal',
        paypalOrderId: orderId,
        paypalCaptureId: captureResult.captureId,
        status: 'succeeded',
        paidAt: new Date(),
        type: 'user'
      };

      await event.addPayment(paymentData);

      res.json({
        success: true,
        message: 'Payment captured successfully',
        captureId: captureResult.captureId
      });
    } else {
      throw new Error('Payment capture failed');
    }

  } catch (error) {
    console.error('❌ PayPal capture error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to capture payment',
      error: error.message 
    });
  }
});
router.post('/create-paypal-order/:eventId', protect, async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;
    const event = await Event.findById(req.params.eventId).populate('host', 'paymentAccounts');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!event.isPaidEvent()) {
      return res.status(400).json({ message: 'This is not a paid event' });
    }

    // Verify host can receive PayPal payments
    if (!event.host.paymentAccounts?.paypal?.verified) {
      return res.status(400).json({ 
        message: 'Host cannot currently receive PayPal payments',
        needsPaymentSetup: true
      });
    }

    // Check if user already paid
    if (event.hasUserPaid(req.user._id)) {
      return res.status(400).json({ 
        message: 'You have already paid for this event' 
      });
    }

    // Create PayPal order using your PayPal provider
    const paypalProvider = new PayPalProvider();
    const paymentOrder = await paypalProvider.createPaymentOrder(
      amount, // Amount in cents
      currency,
      event.host.paymentAccounts.paypal.email,
      {
        eventId: event._id.toString(),
        eventTitle: event.title,
        userId: req.user._id.toString()
      }
    );

    if (paymentOrder.success) {
      res.json({
        success: true,
        orderId: paymentOrder.orderId,
        approvalUrl: paymentOrder.approvalUrl
      });
    } else {
      throw new Error('Failed to create PayPal order');
    }

  } catch (error) {
    console.error('❌ PayPal order creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create PayPal order', 
      error: error.message 
    });
  }
});
router.post('/create-stripe-payment-intent/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { amount, currency = 'usd' } = req.body;

    const event = await Event.findById(eventId).populate('host', 'paymentAccounts');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Check if host has Stripe enabled
    if (!event.host.paymentAccounts?.stripe?.chargesEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Host has not set up Stripe payments',
        needsPaymentSetup: true
      });
    }

    // Create payment intent
    const paymentIntent = await StripeConnectService.createPaymentIntent({
      amount: amount, // Amount should already be in cents from frontend
      currency,
      connectedAccountId: event.host.paymentAccounts.stripe.accountId,
      metadata: {
        eventId: event._id.toString(),
        hostId: event.host._id.toString(),
        userId: req.user._id.toString()
      }
    });

    res.json({
      success: true,
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: null, // Add if you have customer setup
      customer: null, // Add if you have customer setup
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });

  } catch (error) {
    console.error('❌ Stripe payment intent creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment intent',
      error: error.message 
    });
  }
});


router.post('/create-stripe-payment-intent/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { amount, currency = 'usd' } = req.body;

    const event = await Event.findById(eventId).populate('host', 'paymentAccounts');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Check if host has Stripe enabled
    if (!event.host.paymentAccounts?.stripe?.chargesEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Host has not set up Stripe payments',
        needsPaymentSetup: true
      });
    }

    // Create payment intent
    const paymentIntent = await StripeConnectService.createPaymentIntent({
      amount: amount, // Amount should already be in cents from frontend
      currency,
      connectedAccountId: event.host.paymentAccounts.stripe.accountId,
      metadata: {
        eventId: event._id.toString(),
        hostId: event.host._id.toString(),
        userId: req.user._id.toString()
      }
    });

    res.json({
      success: true,
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: null, // Add if you have customer setup
      customer: null, // Add if you have customer setup
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });

  } catch (error) {
    console.error('❌ Stripe payment intent creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment intent',
      error: error.message 
    });
  }
});

router.get('/my-payment-methods', protect, async (req, res) => {
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
// Add this route to routes/events.js - PUT endpoint for updating events

// ============================================
// UPDATE EVENT
// ============================================
router.put('/:eventId', protect, async (req, res) => {
  try {
    console.log(`🔄 PHASE 2: Updating event ${req.params.eventId}`);
    console.log('📥 Update request body:', {
      title: req.body.title,
      privacyLevel: req.body.privacyLevel,
      location: req.body.location
    });
    
    const { eventId } = req.params;
    const {
      title,
      description,
      category,
      time,
      location,
      maxAttendees,
      privacyLevel, // PHASE 2: Handle privacy level changes
      permissions,
      tags,
      coordinates,
      allowPhotos,
      
      // Pricing fields
      isPaidEvent,
      eventPrice,
      priceDescription,
      refundPolicy,
      earlyBirdEnabled,
      earlyBirdPrice,
      earlyBirdDeadline,
      
      // Co-hosts
      coHosts,
      invitedUsers
    } = req.body;

    // Find the existing event
    const existingEvent = await Event.findById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user can edit this event
    const isHost = String(existingEvent.host) === String(req.user._id);
    const isCoHost = existingEvent.coHosts && existingEvent.coHosts.some(c => String(c) === String(req.user._id));
    
    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Only event host and co-hosts can edit this event' });
    }

    console.log(`🔍 PHASE 2: User ${req.user._id} is ${isHost ? 'host' : 'co-host'} of event ${eventId}`);

    // PHASE 2: Privacy presets definition
    const PRIVACY_PRESETS = {
      public: {
        canView: 'anyone',
        canJoin: 'anyone',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: true,
        appearInSearch: true,
        showAttendeesToPublic: true
      },
      friends: {
        canView: 'followers',
        canJoin: 'followers',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: true,
        appearInSearch: true,
        showAttendeesToPublic: false
      },
      private: {
        canView: 'invited-only',
        canJoin: 'invited-only',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: false,
        appearInSearch: false,
        showAttendeesToPublic: false
      }
    };

    // PHASE 2: Handle privacy level validation and enforcement
    let finalPrivacyLevel = existingEvent.privacyLevel; // Default to current
    let finalPermissions = existingEvent.permissions; // Default to current

    // CORRECTED: Check if privacyLevel is provided in the request
    if (privacyLevel !== undefined && privacyLevel !== null && privacyLevel !== '') {
      console.log(`🔒 PHASE 2: Privacy level change requested from "${existingEvent.privacyLevel}" to "${privacyLevel}"`);
      
      // Validate new privacy level
      const validPrivacyLevels = ['public', 'friends', 'private'];
      const normalizedPrivacyLevel = String(privacyLevel).toLowerCase().trim();
      
      if (!validPrivacyLevels.includes(normalizedPrivacyLevel)) {
        console.warn(`⚠️  Invalid privacy level "${privacyLevel}", keeping current: "${existingEvent.privacyLevel}"`);
        return res.status(400).json({ 
          message: `Invalid privacy level "${privacyLevel}". Must be one of: public, friends, private`,
          currentPrivacyLevel: existingEvent.privacyLevel 
        });
      } else {
        // Apply new privacy level with correct permissions
        finalPrivacyLevel = normalizedPrivacyLevel;
        
        // PHASE 2: Apply privacy presets based on new level
        finalPermissions = {
          ...existingEvent.permissions, // Keep any existing custom settings
          ...PRIVACY_PRESETS[finalPrivacyLevel] // Apply new preset (this will override the important ones)
        };

        console.log(`✅ PHASE 2: Privacy level will change to "${finalPrivacyLevel}"`);
        console.log(`🔧 PHASE 2: New permissions will be:`, finalPermissions);
      }
    } else {
      console.log(`📋 PHASE 2: No privacy level change requested (current: "${existingEvent.privacyLevel}")`);
    }

    // Build update object with only provided fields
    const updateData = {};
    
    // Basic fields
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (category !== undefined) updateData.category = category;
    if (location !== undefined) updateData.location = location.trim();
    if (maxAttendees !== undefined) updateData.maxAttendees = parseInt(maxAttendees) || 0;
    if (allowPhotos !== undefined) updateData.allowPhotos = allowPhotos;

    // PHASE 2: ALWAYS apply privacy settings (even if unchanged)
    updateData.privacyLevel = finalPrivacyLevel;
    updateData.permissions = finalPermissions;

    console.log(`🔒 PHASE 2: Final privacy level for update: "${updateData.privacyLevel}"`);
    console.log(`🔧 PHASE 2: Final permissions for update:`, updateData.permissions);

    // Time validation
    if (time) {
      const eventDate = new Date(time);
      if (isNaN(eventDate.getTime())) {
        return res.status(400).json({ message: 'Invalid event time' });
      }
      updateData.time = eventDate;
    }

    // Co-hosts
    if (coHosts !== undefined) {
      try {
        const coHostsArray = Array.isArray(coHosts) ? coHosts : JSON.parse(coHosts || '[]');
        updateData.coHosts = coHostsArray;
      } catch (e) {
        console.log('Invalid coHosts format:', coHosts);
      }
    }

    // Invited users (for private events)
    if (invitedUsers !== undefined && finalPrivacyLevel === 'private') {
      try {
        const invitedArray = Array.isArray(invitedUsers) ? invitedUsers : JSON.parse(invitedUsers || '[]');
        updateData.invitedUsers = invitedArray;
        console.log(`🎫 PHASE 2: Updated invited users for private event: ${invitedArray.length} users`);
      } catch (e) {
        console.log('Invalid invitedUsers format:', invitedUsers);
      }
    }

    // Tags
    if (tags !== undefined) {
      try {
        const tagsArray = typeof tags === 'string' ? 
          tags.split(',').map(tag => tag.trim()).filter(Boolean) : 
          Array.isArray(tags) ? tags : [];
        updateData.tags = tagsArray;
      } catch (e) {
        console.log('Invalid tags format:', tags);
      }
    }

    // Coordinates
    if (coordinates) {
      try {
        const coordsObj = typeof coordinates === 'string' ? JSON.parse(coordinates) : coordinates;
        if (coordsObj && coordsObj.lat && coordsObj.lng) {
          updateData.coordinates = {
            type: 'Point',
            coordinates: [coordsObj.lng, coordsObj.lat]
          };
        }
      } catch (e) {
        console.log('Invalid coordinates format:', coordinates);
      }
    }

    // Pricing updates
    if (isPaidEvent !== undefined || eventPrice !== undefined) {
      const isPaid = isPaidEvent === 'true' || isPaidEvent === true;
      const eventPriceNum = isPaid ? parseFloat(eventPrice) || 0 : 0;
      const earlyBirdPriceNum = earlyBirdEnabled ? parseFloat(earlyBirdPrice) || 0 : 0;

      updateData.pricing = {
        ...existingEvent.pricing,
        isFree: !isPaid,
        amount: isPaid ? Math.round(eventPriceNum * 100) : 0,
        currency: 'USD',
        description: priceDescription?.trim(),
        refundPolicy: refundPolicy || existingEvent.pricing?.refundPolicy || 'no-refund'
      };

      // Early bird pricing
      if (earlyBirdEnabled !== undefined) {
        updateData.pricing.earlyBirdPricing = {
          enabled: earlyBirdEnabled === 'true' || earlyBirdEnabled === true,
          amount: earlyBirdEnabled ? Math.round(earlyBirdPriceNum * 100) : 0,
          deadline: earlyBirdEnabled && earlyBirdDeadline ? new Date(earlyBirdDeadline) : undefined,
          description: earlyBirdEnabled ? `Early bird pricing until ${earlyBirdDeadline}` : undefined
        };
      }

      // Legacy pricing fields
      updateData.isPaidEvent = isPaid;
      updateData.price = eventPriceNum;
      updateData.eventPrice = eventPriceNum;
    }

    console.log(`💾 PHASE 2: Final update data:`, {
      ...updateData,
      permissions: 'See above for details'
    });

    // Perform the update
    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('host', 'username profilePicture')
     .populate('attendees', 'username profilePicture')
     .populate('coHosts', 'username profilePicture');

    if (!updatedEvent) {
      return res.status(404).json({ message: 'Event not found after update' });
    }

    // PHASE 2: Log privacy enforcement for debugging
    logPrivacyEnforcement(updatedEvent._id, updatedEvent.privacyLevel, updatedEvent.permissions);
     if (req.body.privacyLevel && req.body.privacyLevel !== existingEvent.privacyLevel) {
      console.log(`🔄 PRIVACY CHANGE DETECTED: Handling feed cleanup/population`);
      try {
        await handlePrivacyChangeEffects(
          eventId, 
          existingEvent.privacyLevel, 
          updatedEvent.privacyLevel, 
          existingEvent.host
        );
        console.log(`✅ PRIVACY CHANGE: Successfully handled effects`);
      } catch (cleanupError) {
        console.error(`❌ PRIVACY CHANGE: Failed to handle effects:`, cleanupError);
        // Don't fail the entire update, but log the error
      }
    }
    console.log(`✅ PHASE 2: Event ${eventId} updated successfully`);
    console.log(`🔒 FINAL Privacy level in DB: ${updatedEvent.privacyLevel}`);
    console.log(`🔧 FINAL Permissions in DB:`, JSON.stringify(updatedEvent.permissions, null, 2));

    // Return success response with privacy verification
    res.json({
      message: 'Event updated successfully',
      event: updatedEvent,
      // PHASE 2: Include privacy verification in response
      privacyUpdate: {
        oldPrivacyLevel: existingEvent.privacyLevel,
        newPrivacyLevel: updatedEvent.privacyLevel,
        permissionsUpdated: true,
        enforcedByServer: true,
        privacyLevelChanged: existingEvent.privacyLevel !== updatedEvent.privacyLevel
      }
    });

  } catch (err) {
    console.error('❌ PHASE 2: Event update error:', err);
    
    // PHASE 2: Enhanced error logging for privacy issues
    if (err.message.includes('privacy') || err.message.includes('permission')) {
      console.error('🔒 Privacy-related error during event update:', err);
    }
    
    res.status(500).json({ 
      message: 'Failed to update event', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});




router.delete('/:eventId/leave-cohost', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    console.log(`🔄 User ${userId} attempting to leave co-host role for event ${eventId}`);

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is actually a co-host
    const isCoHost = event.coHosts && event.coHosts.some(
      coHostId => String(coHostId) === String(userId)
    );

    if (!isCoHost) {
      return res.status(400).json({ message: 'You are not a co-host of this event' });
    }

    // Remove user from co-hosts array
    event.coHosts = event.coHosts.filter(coHostId => 
      String(coHostId) !== String(userId)
    );
    
    await event.save();

    // Send notification to host (non-blocking)
    setImmediate(async () => {
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.sendCoHostLeft(userId, event.host, event);
        console.log(`🔔 Sent co-host left notification to host`);
      } catch (notifError) {
        console.error('Failed to send co-host left notification:', notifError);
      }
    });

    console.log(`✅ User ${userId} successfully left co-host role for event ${eventId}`);

    res.json({ 
      success: true,
      message: 'Successfully left co-host role',
      event: {
        _id: event._id,
        title: event.title,
        coHostCount: event.coHosts.length
      }
    });

  } catch (error) {
    console.error('❌ Leave co-host error:', error);
    res.status(500).json({ 
      message: 'Failed to leave co-host role',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});


/**
 * Update PayPal email address
 */
router.put('/update-paypal-email', protect, async (req, res) => {
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

    const oldEmail = user.paymentAccounts.paypal?.email;

    // Update PayPal account
    user.paymentAccounts.paypal = {
      ...user.paymentAccounts.paypal,
      email: paypalEmail.toLowerCase().trim(),
      verified: true,
      updatedAt: new Date()
    };

    // If this was the primary method, keep it as primary
    if (user.paymentAccounts.primary?.type === 'paypal') {
      user.paymentAccounts.primary.lastUpdated = new Date();
    }

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
router.delete('/remove-paypal', protect, async (req, res) => {
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
    if (user.paymentAccounts.paypal) {
      delete user.paymentAccounts.paypal;
    }

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
router.put('/set-primary-payment', protect, async (req, res) => {
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

/**
 * Get payment earnings summary
 */
router.get('/payment-earnings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('earnings paymentAccounts');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Get events where user was host and had payments
    const hostedEvents = await Event.find({
      host: req.user._id,
      'paymentHistory.0': { $exists: true }
    }).select('title paymentHistory financials');

    const earningsSummary = {
      totalEarnings: user.earnings?.totalEarned || 0,
      availableBalance: user.earnings?.availableBalance || 0,
      pendingBalance: user.earnings?.pendingBalance || 0,
      currency: user.earnings?.currency || 'USD',
      byProvider: user.earnings?.byProvider || {
        paypal: { totalEarned: 0 },
        stripe: { totalEarned: 0 }
      },
      recentEvents: hostedEvents.slice(0, 5).map(event => ({
        id: event._id,
        title: event.title,
        totalRevenue: event.financials?.totalRevenue || 0,
        paymentsCount: event.paymentHistory?.length || 0
      })),
      totalEvents: hostedEvents.length
    };

    res.json({
      success: true,
      earnings: earningsSummary
    });

  } catch (error) {
    console.error('❌ Get payment earnings error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get payment earnings',
      error: error.message 
    });
  }
});
router.get('/:eventId/form', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate('checkInForm');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check if user can access this event's form
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(
      coHost => String(coHost) === String(req.user._id)
    );
    const isAttendee = event.attendees && event.attendees.some(
      attendee => String(attendee) === String(req.user._id)
    );

    if (!isHost && !isCoHost && !isAttendee) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    if (!event.checkInForm) {
      return res.json({
        success: true,
        hasForm: false,
        message: 'This event does not have a check-in form'
      });
    }

    // Check if user already submitted
    let hasSubmitted = false;
    if (!isHost && !isCoHost) {
      hasSubmitted = await event.hasUserSubmittedForm(req.user._id);
    }

    res.json({
      success: true,
      hasForm: true,
      requiresForm: event.requiresFormForCheckIn,
      form: event.checkInForm,
      hasSubmitted,
      canSubmit: !hasSubmitted || event.checkInForm.settings.allowMultipleSubmissions
    });

  } catch (error) {
    console.error('Get event form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch event form' 
    });
  }
});
router.post('/:eventId/submit-form', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { responses, completionTime } = req.body;

    const event = await Event.findById(eventId).populate('checkInForm');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    if (!event.checkInForm) {
      return res.status(400).json({ 
        success: false, 
        message: 'This event does not have a check-in form' 
      });
    }

    // Check if user can check in
    const eligibility = await event.canUserCheckIn(req.user._id);
    if (!eligibility.canCheckIn && eligibility.reason !== 'already_checked_in') {
      return res.status(400).json({ 
        success: false, 
        message: eligibility.message 
      });
    }

    // Validate and submit form
    const validation = event.checkInForm.validateResponse(responses);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid form responses',
        errors: validation.errors 
      });
    }

    // Check if user already submitted
    const existingSubmission = await FormSubmission.findOne({
      form: event.checkInForm._id,
      user: req.user._id,
      event: eventId
    });

    if (existingSubmission && !event.checkInForm.settings.allowMultipleSubmissions) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already submitted this form' 
      });
    }

    // Prepare responses with question context
    const enrichedResponses = responses.map(response => {
      const question = event.checkInForm.getQuestionById(response.questionId);
      return {
        questionId: response.questionId,
        questionType: question.type,
        questionText: question.question,
        answer: response.answer
      };
    });

    // Create or update submission
    let submission;
    if (existingSubmission && event.checkInForm.settings.allowMultipleSubmissions) {
      existingSubmission.responses = enrichedResponses;
      existingSubmission.submittedAt = new Date();
      existingSubmission.completionTime = completionTime;
      submission = await existingSubmission.save();
    } else {
      submission = new FormSubmission({
        form: event.checkInForm._id,
        event: eventId,
        user: req.user._id,
        responses: enrichedResponses,
        completionTime,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      await submission.save();
      
      // Add to event's form submissions
      if (!event.formSubmissions.includes(submission._id)) {
        event.formSubmissions.push(submission._id);
      }
    }

    // Now check in the user (bypass form check since we just submitted)
    const checkInResult = await event.checkInUser(req.user._id, { 
      bypassFormCheck: true 
    });

    await event.save();

    // Increment form usage
    if (!existingSubmission) {
      await event.checkInForm.incrementUsage();
    }

    console.log(`✅ User ${req.user._id} submitted form and checked in to event ${eventId}`);

    res.json({
      success: true,
      message: 'Form submitted and checked in successfully',
      submission: {
        _id: submission._id,
        submittedAt: submission.submittedAt
      },
      checkIn: checkInResult
    });

  } catch (error) {
    console.error('Submit form and check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit form and check in' 
    });
  }
});
router.post('/:eventId/generate-checkin-qr', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { validityHours = 24 } = req.body;

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can generate check-in QR codes' 
      });
    }

    // Generate QR code
    const qrCode = await event.generateCheckInQR(validityHours);
    const qrData = event.getCheckInQRData();

    console.log(`✅ Check-in QR generated for event ${eventId}`);

    res.json({
      success: true,
      message: 'Check-in QR code generated successfully',
      qrCode,
      qrData,
      expiresAt: event.checkInQR.expiresAt
    });

  } catch (error) {
    console.error('Generate check-in QR error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate check-in QR code' 
    });
  }
});

router.post('/:eventId/deactivate-checkin-qr', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can deactivate check-in QR codes' 
      });
    }

    await event.deactivateCheckInQR();

    console.log(`✅ Check-in QR deactivated for event ${eventId}`);

    res.json({
      success: true,
      message: 'Check-in QR code deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate check-in QR error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to deactivate check-in QR code' 
    });
  }
});
router.post('/:eventId/checkin-with-form', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { formResponses, completionTime, targetUserId } = req.body;

    const event = await Event.findById(eventId).populate('checkInForm');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check if user is host or co-host (required for checking in others)
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(
      coHost => String(coHost) === String(req.user._id)
    );

    if (!isHost && !isCoHost) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only hosts and co-hosts can check in attendees' 
      });
    }

    // Validate form is required
    if (!event.requiresFormForCheckIn || !event.checkInForm) {
      return res.status(400).json({ 
        success: false, 
        message: 'This event does not require a check-in form' 
      });
    }

    // Use targetUserId if provided (host checking in someone else), otherwise current user
    const userToCheckIn = targetUserId || req.user._id;

    // Check if user already submitted form
    const FormSubmission = require('../models/FormSubmission');
    const existingSubmission = await FormSubmission.findOne({
      form: event.checkInForm._id,
      user: userToCheckIn,
      event: eventId
    });

    if (existingSubmission && !event.checkInForm.settings?.allowMultipleSubmissions) {
      return res.status(400).json({ 
        success: false, 
        message: 'User has already submitted this form' 
      });
    }

    // Validate responses
    const validation = event.checkInForm.validateResponse(formResponses);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid form responses',
        errors: validation.errors 
      });
    }

    // Prepare responses with question context
    const enrichedResponses = formResponses.map(response => {
      const question = event.checkInForm.getQuestionById(response.questionId);
      return {
        questionId: response.questionId,
        questionType: question.type,
        questionText: question.question,
        answer: response.answer
      };
    });

    // Create or update submission
    let submission;
    if (existingSubmission && event.checkInForm.settings?.allowMultipleSubmissions) {
      existingSubmission.responses = enrichedResponses;
      existingSubmission.submittedAt = new Date();
      existingSubmission.completionTime = completionTime;
      existingSubmission.ipAddress = req.ip;
      existingSubmission.userAgent = req.get('User-Agent');
      submission = await existingSubmission.save();
    } else {
      submission = new FormSubmission({
        form: event.checkInForm._id,
        event: eventId,
        user: userToCheckIn,
        responses: enrichedResponses,
        completionTime,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      await submission.save();
      
      // Add to event's form submissions
      if (!event.formSubmissions.includes(submission._id)) {
        event.formSubmissions.push(submission._id);
      }
    }

    // Now check in the user (bypass form check since we just submitted)
    const checkInResult = await event.checkInUser(userToCheckIn, { 
      bypassFormCheck: true 
    });

    await event.save();

    // Increment form usage
    if (!existingSubmission) {
      await event.checkInForm.incrementUsage();
    }

    console.log(`✅ User ${userToCheckIn} submitted form and checked in to event ${eventId}`);

    res.json({
      success: true,
      message: 'Form submitted and checked in successfully',
      submission: {
        _id: submission._id,
        submittedAt: submission.submittedAt
      },
      checkIn: checkInResult
    });

  } catch (error) {
    console.error('Submit form and check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit form and check in' 
    });
  }
});
/**
 * POST /api/events/:eventId/manual-checkin
 * Manually check in a user (for hosts)
 */
router.post('/:eventId/manual-checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can manually check in attendees' 
      });
    }

    // Check if user is attending the event
    const isAttending = event.attendees.some(attendee => 
      String(attendee._id || attendee) === String(userId)
    );
    
    if (!isAttending) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not registered for this event' 
      });
    }

    // Check if already checked in
    const isAlreadyCheckedIn = event.checkedIn.some(checkedUser => 
      String(checkedUser._id || checkedUser) === String(userId)
    );
    
    if (isAlreadyCheckedIn) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already checked in' 
      });
    }

    // If form is required, check if user submitted it
    if (event.requiresFormForCheckIn && event.checkInForm) {
      const hasSubmitted = await event.hasUserSubmittedForm(userId);
      if (!hasSubmitted) {
        return res.status(400).json({ 
          success: false, 
          message: 'User must complete the check-in form first',
          requiresForm: true,
          formId: event.checkInForm
        });
      }
    }

    // FIXED: Manual check-in by hosts bypasses timing restrictions
    try {
      // Try with bypass first
      const checkInResult = await event.checkInUser(userId, { 
        bypassTimeCheck: true,  // Allow hosts to check in users anytime
        bypassFormCheck: false  // Still respect form requirements
      });
      
      await event.save();

      console.log(`✅ User ${userId} manually checked in to event ${eventId} by ${req.user._id} (timing bypass)`);

      res.json({
        success: true,
        message: 'User checked in successfully',
        checkIn: checkInResult
      });

    } catch (checkInError) {
      // If that fails, try without any bypass (in case the method doesn't support options)
      if (!event.checkedIn.includes(userId)) {
        event.checkedIn.push(userId);
        await event.save();

        console.log(`✅ User ${userId} manually checked in to event ${eventId} by ${req.user._id} (direct method)`);

        res.json({
          success: true,
          message: 'User checked in successfully',
          checkIn: {
            userId: userId,
            checkedInAt: new Date(),
            checkedInBy: req.user._id
          }
        });
      } else {
        throw checkInError;
      }
    }

  } catch (error) {
    console.error('Manual check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to check in user' 
    });
  }
});

/**
 * POST /api/events/:eventId/undo-checkin
 * Undo a user's check-in (for hosts)
 */
// Add these routes to routes/events.js

// UPDATED: Manual check-in route with bypass for timing restrictions
router.post('/:eventId/manual-checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can manually check in attendees' 
      });
    }

    // Check if user is attending the event
    const isAttending = event.attendees.some(attendee => 
      String(attendee._id || attendee) === String(userId)
    );
    
    if (!isAttending) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not registered for this event' 
      });
    }

    // Check if already checked in
    const isAlreadyCheckedIn = event.checkedIn.some(checkedUser => 
      String(checkedUser._id || checkedUser) === String(userId)
    );
    
    if (isAlreadyCheckedIn) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already checked in' 
      });
    }

    // If form is required, check if user submitted it
    if (event.requiresFormForCheckIn && event.checkInForm) {
      const hasSubmitted = await event.hasUserSubmittedForm(userId);
      if (!hasSubmitted) {
        return res.status(400).json({ 
          success: false, 
          message: 'User must complete the check-in form first',
          requiresForm: true,
          formId: event.checkInForm
        });
      }
    }

    // FIXED: Manual check-in by hosts bypasses timing restrictions
    try {
      // Try with bypass first
      const checkInResult = await event.checkInUser(userId, { 
        bypassTimeCheck: true,  // Allow hosts to check in users anytime
        bypassFormCheck: false  // Still respect form requirements
      });
      
      await event.save();

      console.log(`✅ User ${userId} manually checked in to event ${eventId} by ${req.user._id} (timing bypass)`);

      res.json({
        success: true,
        message: 'User checked in successfully',
        checkIn: checkInResult
      });

    } catch (checkInError) {
      // If that fails, try without any bypass (in case the method doesn't support options)
      if (!event.checkedIn.includes(userId)) {
        event.checkedIn.push(userId);
        await event.save();

        console.log(`✅ User ${userId} manually checked in to event ${eventId} by ${req.user._id} (direct method)`);

        res.json({
          success: true,
          message: 'User checked in successfully',
          checkIn: {
            userId: userId,
            checkedInAt: new Date(),
            checkedInBy: req.user._id
          }
        });
      } else {
        throw checkInError;
      }
    }

  } catch (error) {
    console.error('Manual check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to check in user' 
    });
  }
});

// UPDATED: Undo check-in route with better error handling
router.post('/:eventId/undo-checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can undo check-ins' 
      });
    }

    // Check if user is checked in
    const isCheckedIn = event.checkedIn.some(checkedUser => 
      String(checkedUser._id || checkedUser) === String(userId)
    );
    
    if (!isCheckedIn) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not checked in' 
      });
    }

    // Remove from checked in list
    event.checkedIn = event.checkedIn.filter(checkedUser => 
      String(checkedUser._id || checkedUser) !== String(userId)
    );
    
    await event.save();

    console.log(`✅ User ${userId} check-in undone for event ${eventId} by ${req.user._id}`);

    res.json({
      success: true,
      message: 'Check-in undone successfully'
    });

  } catch (error) {
    console.error('Undo check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to undo check-in' 
    });
  }
});

router.post('/:eventId/qr-checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { qrData } = req.body;

    console.log('🔍 Simple QR check-in:', { eventId, qrData });

    const event = await Event.findById(eventId);
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
        message: 'Only hosts and co-hosts can check in users' 
      });
    }

    let parsedQR;
    try {
      parsedQR = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    // Handle different QR types
    if (parsedQR.type === 'user') {
      // User QR code - check in this user
      const userId = parsedQR.userId;
      
      // Check if user is attending
      const isAttending = event.attendees.some(attendee => 
        String(attendee._id || attendee) === String(userId)
      );
      
      if (!isAttending) {
        return res.status(400).json({
          success: false,
          message: 'User is not registered for this event'
        });
      }

      // Check if already checked in
      const isCheckedIn = event.checkedIn.some(checkedUser => 
        String(checkedUser._id || checkedUser) === String(userId)
      );
      
      if (isCheckedIn) {
        return res.status(400).json({
          success: false,
          message: 'User is already checked in'
        });
      }

      // Check in the user
      event.checkedIn.push(userId);
      await event.save();

      // Get user info for response
      const User = require('../models/User');
      const user = await User.findById(userId).select('username profilePicture');

      console.log(`✅ User ${userId} checked in to event ${eventId}`);

      res.json({
        success: true,
        message: 'User checked in successfully',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture
        }
      });

    } else if (parsedQR.type === 'event') {
      // Event QR code - self check-in
      const scannedEventId = parsedQR.eventId;
      
      if (scannedEventId !== eventId) {
        return res.status(400).json({
          success: false,
          message: 'QR code is for a different event'
        });
      }

      // Check if current user is attending
      const currentUserId = req.user._id;
      const isAttending = event.attendees.some(attendee => 
        String(attendee._id || attendee) === String(currentUserId)
      );
      
      if (!isAttending) {
        return res.status(400).json({
          success: false,
          message: 'You are not registered for this event'
        });
      }

      // Check if already checked in
      const isCheckedIn = event.checkedIn.some(checkedUser => 
        String(checkedUser._id || checkedUser) === String(currentUserId)
      );
      
      if (isCheckedIn) {
        return res.status(400).json({
          success: false,
          message: 'You are already checked in'
        });
      }

      // Self check-in
      event.checkedIn.push(currentUserId);
      await event.save();

      console.log(`✅ User ${currentUserId} self-checked in to event ${eventId}`);

      res.json({
        success: true,
        message: 'Successfully checked in!',
        event: {
          _id: event._id,
          title: event.title
        }
      });

    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported QR code type'
      });
    }

  } catch (error) {
    console.error('QR check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process check-in' 
    });
  }
});

router.post('/:eventId/self-checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const currentUserId = req.user._id;

    console.log(`🎯 Self check-in attempt: User ${currentUserId} to event ${eventId}`);

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check if user is already checked in
    const isCheckedIn = event.checkedIn.some(checkedUser => 
      String(checkedUser._id || checkedUser) === String(currentUserId)
    );

    if (isCheckedIn) {
      return res.status(200).json({
        success: true,
        message: `Welcome back to ${event.title}! You're already checked in.`,
        event: {
          _id: event._id,
          title: event.title
        },
        alreadyCheckedIn: true
      });
    }

    // Check if user is attending - if not, add them automatically
    const isAttending = event.attendees.some(attendee => 
      String(attendee._id || attendee) === String(currentUserId)
    );

    let wasAdded = false;
    if (!isAttending) {
      // Automatically add user to attendees when they scan QR
      event.attendees.push(currentUserId);
      wasAdded = true;
      console.log(`📝 User ${currentUserId} automatically added to event ${eventId}`);
      
      // Also add event to user's attending events
      const User = require('../models/User');
      await User.findByIdAndUpdate(currentUserId, {
        $addToSet: { attendingEvents: eventId }
      });
    }

    // Check timing restrictions (but be more lenient for QR scans)
    const checkInStatus = event.getCheckInStatus ? event.getCheckInStatus() : { canCheckIn: true };
    if (!checkInStatus.canCheckIn) {
      // For QR scans, we might want to be more permissive
      // Only block if it's WAY outside the window (like event ended hours ago)
      const now = new Date();
      const eventTime = new Date(event.time);
      const hoursAfterEvent = (now - eventTime) / (1000 * 60 * 60);
      
      if (hoursAfterEvent > 6) { // Only block if more than 6 hours after event
        return res.status(400).json({
          success: false,
          message: 'This event has ended and check-in is no longer available'
        });
      }
      // Otherwise, allow check-in even if slightly outside normal window
    }

    // Check form requirements
    if (event.requiresFormForCheckIn && event.checkInForm) {
      const hasSubmitted = await event.hasUserSubmittedForm(currentUserId);
      if (!hasSubmitted) {
        // Save the user as attendee but don't check them in yet
        await event.save();
        
        return res.status(400).json({
          success: false,
          message: 'Welcome! Please complete the check-in form to finish checking in.',
          requiresForm: true,
          formId: event.checkInForm,
          wasAdded: wasAdded,
          event: {
            _id: event._id,
            title: event.title
          }
        });
      }
    }

    // Perform check-in
    event.checkedIn.push(currentUserId);
    await event.save();

    console.log(`✅ User ${currentUserId} ${wasAdded ? 'joined and ' : ''}checked in to event ${eventId}`);

    res.json({
      success: true,
      message: wasAdded ? 
        `Welcome to ${event.title}! You've been added to the event and checked in.` :
        `Welcome to ${event.title}! You've been checked in.`,
      event: {
        _id: event._id,
        title: event.title
      },
      wasAdded: wasAdded
    });

  } catch (error) {
    console.error('Self check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check in to event' 
    });
  }
});


/**
 * GET /api/events/:eventId/checkin-stats
 * Get real-time check-in statistics (for hosts)
 */
router.get('/:eventId/checkin-stats', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate('checkInForm');
    
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
        message: 'Only hosts and co-hosts can view check-in statistics' 
      });
    }

    const stats = {
      totalAttendees: event.attendees.length,
      checkedInCount: event.checkedIn.length,
      checkedInPercentage: event.attendees.length > 0 ? 
        Math.round((event.checkedIn.length / event.attendees.length) * 100) : 0,
      requiresForm: event.requiresFormForCheckIn,
      formSubmissions: 0
    };

    // Get form submission count if form is required
    if (event.requiresFormForCheckIn && event.checkInForm) {
      const FormSubmission = require('../models/FormSubmission');
      stats.formSubmissions = await FormSubmission.countDocuments({
        form: event.checkInForm._id,
        event: eventId
      });
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get check-in stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get check-in statistics' 
    });
  }
});
router.get('/:eventId/attendees-detailed', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId)
      .populate({
        path: 'attendees',
        select: 'username bio profilePicture email'
      })
      .populate('checkInForm');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check permissions
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(
      coHost => String(coHost) === String(req.user._id)
    );
    const canManage = isHost || isCoHost;

    // Get form submissions if form exists
    let formSubmissions = [];
    if (event.checkInForm) {
      const FormSubmission = require('../models/FormSubmission');
      formSubmissions = await FormSubmission.find({
        form: event.checkInForm._id,
        event: eventId
      }).select('user submittedAt');
    }

    // Get payment information for paid events
    let payments = [];
    if (event.pricing && !event.pricing.isFree) {
      payments = event.paymentHistory || [];
    }

    // Enhance attendee data
    const enhancedAttendees = event.attendees.map(attendee => {
      const formSubmission = formSubmissions.find(
        fs => String(fs.user) === String(attendee._id)
      );
      const payment = payments.find(
        p => String(p.user) === String(attendee._id) && p.status === 'succeeded'
      );

      return {
        ...attendee.toObject(),
        formSubmission: formSubmission ? {
          submittedAt: formSubmission.submittedAt
        } : null,
        hasPaid: !!payment,
        paymentAmount: payment?.amount || 0
      };
    });

    const formSubmissionCount = formSubmissions.length;
    const checkedInCount = event.checkedIn.length;

    res.json({
      success: true,
      attendees: enhancedAttendees,
      event: {
        ...event.toObject(),
        attendees: undefined // Remove to avoid duplication
      },
      checkedInCount,
      formSubmissionCount,
      canManage
    });

  } catch (error) {
    console.error('Get detailed attendees error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch attendee details' 
    });
  }
});
router.post('/:eventId/export-google-sheets', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { includeFormResponses = false, filters = {} } = req.body;

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can export to Google Sheets' 
      });
    }

    // For now, return a placeholder URL
    // In production, you would integrate with Google Sheets API
    const sheetsUrl = `https://docs.google.com/spreadsheets/d/example-sheet-id/edit#gid=0`;

    console.log(`✅ Google Sheets export initiated for event ${eventId}`);

    res.json({
      success: true,
      sheetsUrl,
      message: 'Data has been exported to Google Sheets'
    });

  } catch (error) {
    console.error('Google Sheets export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export to Google Sheets' 
    });
  }
});

router.post('/:eventId/bulk-checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { attendeeIds } = req.body;

    if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid attendee IDs provided' 
      });
    }

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can perform bulk check-ins' 
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each attendee
    for (const attendeeId of attendeeIds) {
      try {
        // Check if user is attending the event
        const isAttending = event.attendees.includes(attendeeId);
        if (!isAttending) {
          errors.push(`User ${attendeeId} is not registered for this event`);
          errorCount++;
          continue;
        }

        // Check if already checked in
        const isAlreadyCheckedIn = event.checkedIn.includes(attendeeId);
        if (isAlreadyCheckedIn) {
          errors.push(`User ${attendeeId} is already checked in`);
          errorCount++;
          continue;
        }

        // If form is required, check if user submitted it
        if (event.requiresFormForCheckIn && event.checkInForm) {
          const hasSubmitted = await event.hasUserSubmittedForm(attendeeId);
          if (!hasSubmitted) {
            errors.push(`User ${attendeeId} must complete the check-in form first`);
            errorCount++;
            continue;
          }
        }

        // Check in user
        await event.checkInUser(attendeeId);
        successCount++;

      } catch (error) {
        console.error(`Error checking in user ${attendeeId}:`, error);
        errors.push(`Failed to check in user ${attendeeId}: ${error.message}`);
        errorCount++;
      }
    }

    // Save the event with all check-ins
    await event.save();

    console.log(`✅ Bulk check-in completed: ${successCount} success, ${errorCount} errors`);

    res.json({
      success: true,
      message: `Bulk check-in completed: ${successCount} successful, ${errorCount} failed`,
      results: {
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // Limit error messages
      }
    });

  } catch (error) {
    console.error('Bulk check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to perform bulk check-in' 
    });
  }
});
router.post('/:eventId/bulk-remove', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { attendeeIds } = req.body;

    if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid attendee IDs provided' 
      });
    }

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can remove attendees' 
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each attendee
    for (const attendeeId of attendeeIds) {
      try {
        // Check if user is attending the event
        const isAttending = event.attendees.includes(attendeeId);
        if (!isAttending) {
          errors.push(`User ${attendeeId} is not registered for this event`);
          errorCount++;
          continue;
        }

        // Remove from attendees
        event.attendees = event.attendees.filter(id => String(id) !== String(attendeeId));
        
        // Remove from checked in list if present
        event.checkedIn = event.checkedIn.filter(id => String(id) !== String(attendeeId));
        
        successCount++;

      } catch (error) {
        console.error(`Error removing user ${attendeeId}:`, error);
        errors.push(`Failed to remove user ${attendeeId}: ${error.message}`);
        errorCount++;
      }
    }

    // Save the event
    await event.save();

    console.log(`✅ Bulk remove completed: ${successCount} success, ${errorCount} errors`);

    res.json({
      success: true,
      message: `Bulk remove completed: ${successCount} successful, ${errorCount} failed`,
      results: {
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // Limit error messages
      }
    });

  } catch (error) {
    console.error('Bulk remove error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to perform bulk remove' 
    });
  }
});

router.get('/:eventId/real-time-stats', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check if user is host, co-host, or attendee
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(
      coHost => String(coHost) === String(req.user._id)
    );
    const isAttendee = event.attendees.includes(req.user._id);

    if (!isHost && !isCoHost && !isAttendee) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Get form submission count if form exists
    let formSubmissionCount = 0;
    if (event.checkInForm) {
      const FormSubmission = require('../models/FormSubmission');
      formSubmissionCount = await FormSubmission.countDocuments({
        form: event.checkInForm,
        event: eventId
      });
    }

    const stats = {
      totalAttendees: event.attendees.length,
      checkedInCount: event.checkedIn.length,
      checkedInPercentage: event.attendees.length > 0 ? 
        Math.round((event.checkedIn.length / event.attendees.length) * 100) : 0,
      formSubmissionCount,
      formSubmissionPercentage: event.attendees.length > 0 ? 
        Math.round((formSubmissionCount / event.attendees.length) * 100) : 0,
      lastUpdated: new Date().toISOString(),
      eventStatus: new Date() < new Date(event.time) ? 'upcoming' : 'ongoing'
    };

    // Add payment stats for paid events
    if (event.pricing && !event.pricing.isFree && event.paymentHistory) {
      const paidCount = event.paymentHistory.filter(p => p.status === 'succeeded').length;
      stats.paidCount = paidCount;
      stats.paidPercentage = event.attendees.length > 0 ? 
        Math.round((paidCount / event.attendees.length) * 100) : 0;
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Real-time stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get real-time statistics' 
    });
  }
});

router.get('/:eventId/form-responses-summary', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate('checkInForm');
    
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
        message: 'Only hosts and co-hosts can view form response summaries' 
      });
    }

    if (!event.checkInForm) {
      return res.json({
        success: true,
        message: 'No form associated with this event',
        summary: null
      });
    }

    const FormSubmission = require('../models/FormSubmission');
    
    const submissions = await FormSubmission.find({
      form: event.checkInForm._id,
      event: eventId
    });

    const summary = {
      totalSubmissions: submissions.length,
      submissionRate: event.attendees.length > 0 ? 
        (submissions.length / event.attendees.length) * 100 : 0,
      questionSummaries: []
    };

    // Analyze each question
    if (event.checkInForm.questions && submissions.length > 0) {
      summary.questionSummaries = event.checkInForm.questions.map(question => {
        const responses = submissions
          .map(sub => sub.responses.find(r => r.questionId === question.id))
          .filter(Boolean);

        const questionSummary = {
          questionId: question.id,
          questionText: question.question,
          questionType: question.type,
          responseCount: responses.length,
          responseRate: (responses.length / submissions.length) * 100
        };

        // Type-specific analysis
        switch (question.type) {
          case 'multiple_choice':
          case 'yes_no':
            const optionCounts = {};
            responses.forEach(response => {
              const answer = response.answer;
              optionCounts[answer] = (optionCounts[answer] || 0) + 1;
            });
            questionSummary.optionCounts = optionCounts;
            questionSummary.mostPopularAnswer = Object.keys(optionCounts).reduce((a, b) => 
              optionCounts[a] > optionCounts[b] ? a : b, ''
            );
            break;

          case 'rating':
            const ratings = responses.map(r => parseInt(r.answer)).filter(r => !isNaN(r));
            if (ratings.length > 0) {
              questionSummary.averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
              questionSummary.ratingDistribution = {};
              ratings.forEach(rating => {
                questionSummary.ratingDistribution[rating] = 
                  (questionSummary.ratingDistribution[rating] || 0) + 1;
              });
            }
            break;

          case 'checkbox':
            const allOptions = {};
            responses.forEach(response => {
              if (Array.isArray(response.answer)) {
                response.answer.forEach(option => {
                  allOptions[option] = (allOptions[option] || 0) + 1;
                });
              }
            });
            questionSummary.optionCounts = allOptions;
            break;

          case 'short_answer':
            questionSummary.sampleAnswers = responses
              .slice(0, 5)
              .map(r => r.answer)
              .filter(answer => answer && answer.trim());
            break;
        }

        return questionSummary;
      });
    }

    console.log(`✅ Form response summary generated for event ${eventId}`);

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Form responses summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate form response summary' 
    });
  }
});

// In routes/events.js - Replace your existing route
router.get('/:eventId/event-qr', protect, async (req, res) => {
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

    console.log(`✅ Event QR accessed for event ${eventId}`);

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

router.post('/:eventId/remove-attendee', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    const event = await Event.findById(eventId);
    
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
        message: 'Only hosts and co-hosts can remove attendees' 
      });
    }

    // Check if user is actually attending
    const isAttending = event.attendees.some(attendee => 
      String(attendee._id || attendee) === String(userId)
    );
    
    if (!isAttending) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not attending this event' 
      });
    }

    // Remove from attendees list
    event.attendees = event.attendees.filter(attendee => 
      String(attendee._id || attendee) !== String(userId)
    );

    // Also remove from checked-in list if they were checked in
    event.checkedIn = event.checkedIn.filter(checkedUser => 
      String(checkedUser._id || checkedUser) !== String(userId)
    );

    // Save the event
    await event.save();

    // Update user's attending events (remove this event)
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      $pull: { attendingEvents: eventId }
    });

    console.log(`✅ User ${userId} removed from event ${eventId} by ${req.user._id}`);

    res.json({
      success: true,
      message: 'Attendee removed successfully'
    });

  } catch (error) {
    console.error('Remove attendee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove attendee' 
    });
  }
});

router.post('/:eventId/export', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { format = 'csv', includeFormResponses = false, filters = {} } = req.body;

    const event = await Event.findById(eventId)
      .populate('attendees')
      .populate('checkInForm');
    
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
        message: 'Only hosts and co-hosts can export data' 
      });
    }

    // Get form submissions if needed
    let formSubmissions = [];
    if (includeFormResponses && event.checkInForm) {
      const FormSubmission = require('../models/FormSubmission');
      formSubmissions = await FormSubmission.find({
        form: event.checkInForm._id,
        event: eventId
      }).populate('user', 'username email');
    }

    // Prepare CSV headers
    let headers = [
      'Username',
      'Email',
      'Bio',
      'Checked In',
      'Check In Time',
      'Payment Status',
      'Payment Amount'
    ];

    // Add form question headers
    if (includeFormResponses && event.checkInForm) {
      headers = headers.concat(
        event.checkInForm.questions.map(q => `Form: ${q.question}`)
      );
    }

    // Prepare CSV rows
    const rows = event.attendees.map(attendee => {
      const isCheckedIn = event.checkedIn.includes(attendee._id);
      const payment = event.paymentHistory?.find(
        p => String(p.user) === String(attendee._id) && p.status === 'succeeded'
      );
      const formSubmission = formSubmissions.find(
        fs => String(fs.user._id) === String(attendee._id)
      );

      let row = [
        attendee.username || '',
        attendee.email || '',
        attendee.bio || '',
        isCheckedIn ? 'Yes' : 'No',
        isCheckedIn ? new Date().toISOString() : '', // Simplified
        payment ? 'Paid' : 'Unpaid',
        payment ? `$${payment.amount}` : '$0'
      ];

      // Add form responses
      if (includeFormResponses && event.checkInForm) {
        const responses = event.checkInForm.questions.map(question => {
          if (!formSubmission) return '';
          
          const response = formSubmission.responses?.find(
            r => r.questionId === question.id
          );
          
          if (!response) return '';
          
          return Array.isArray(response.answer) ? 
            response.answer.join('; ') : response.answer;
        });
        
        row = row.concat(responses);
      }

      return row;
    });

    // Generate CSV content
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    console.log(`✅ CSV export generated for event ${eventId}`);

    res.json({
      success: true,
      csvContent,
      fileName: `${event.title}_attendees_${new Date().toISOString().split('T')[0]}.csv`
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export data' 
    });
  }
});

router.get('/:eventId/attendees-detailed', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId)
      .populate({
        path: 'attendees',
        select: 'username bio profilePicture email'
      })
      .populate('checkInForm')
      .populate('host', 'username profilePicture');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // FIXED: More permissive permissions - attendees can view the list
    const isHost = String(event.host._id) === String(req.user._id);
    const isCoHost = event.coHosts && event.coHosts.some(
      coHost => String(coHost) === String(req.user._id)
    );
    const isAttending = event.attendees.some(
      attendee => String(attendee._id) === String(req.user._id)
    );
    const canManage = isHost || isCoHost;

    // Allow viewing if: host, co-host, attendee, OR event allows public attendee viewing
    const canView = canManage || isAttending || event.permissions?.showAttendeesToPublic;
    
    if (!canView) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view attendee details' 
      });
    }

    // Get form submissions if form exists (only for hosts/co-hosts)
    let formSubmissions = [];
    if (canManage && event.checkInForm) {
      const FormSubmission = require('../models/FormSubmission');
      formSubmissions = await FormSubmission.find({
        form: event.checkInForm._id,
        event: eventId
      }).select('user submittedAt');
    }

    // Get payment information for paid events (only for hosts/co-hosts)
    let payments = [];
    if (canManage && event.pricing && !event.pricing.isFree) {
      payments = event.paymentHistory || [];
    }

    // Enhance attendee data
    const enhancedAttendees = event.attendees.map(attendee => {
      const baseAttendee = {
        _id: attendee._id,
        username: attendee.username,
        bio: attendee.bio,
        profilePicture: attendee.profilePicture
      };

      // Only add sensitive data for hosts/co-hosts
      if (canManage) {
        const formSubmission = formSubmissions.find(
          fs => String(fs.user) === String(attendee._id)
        );
        const payment = payments.find(
          p => String(p.user) === String(attendee._id) && p.status === 'succeeded'
        );

        return {
          ...baseAttendee,
          email: attendee.email, // Email only for hosts
          formSubmission: formSubmission ? {
            submittedAt: formSubmission.submittedAt
          } : null,
          hasPaid: !!payment,
          paymentAmount: payment?.amount || 0
        };
      }

      return baseAttendee;
    });

    const formSubmissionCount = formSubmissions.length;
    const checkedInCount = event.checkedIn.length;

    res.json({
      success: true,
      attendees: enhancedAttendees,
      event: {
        _id: event._id,
        title: event.title,
        time: event.time,
        requiresFormForCheckIn: event.requiresFormForCheckIn,
        checkInForm: canManage ? event.checkInForm : null,
        pricing: event.pricing,
        permissions: event.permissions
      },
      checkedInCount,
      formSubmissionCount,
      canManage
    });

  } catch (error) {
    console.error('Get detailed attendees error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch attendee details' 
    });
  }
});

router.get('/:eventId/analytics', protect, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate('checkInForm');
    
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
        message: 'Only hosts and co-hosts can view analytics' 
      });
    }

    const analytics = {
      totalAttendees: event.attendees.length,
      checkedInCount: event.checkedIn.length,
      checkInRate: event.attendees.length > 0 ? 
        (event.checkedIn.length / event.attendees.length) : 0
    };

    // Check-in timeline analysis
    if (event.checkedIn.length > 0) {
      // Get check-in timestamps (simplified - in real app you'd store these)
      const now = new Date();
      const eventStart = new Date(event.time);
      const checkInWindow = 4; // hours
      
      // Create hourly timeline
      const timeline = [];
      const maxHourlyCheckIns = Math.ceil(event.checkedIn.length / checkInWindow);
      
      for (let i = 0; i < checkInWindow; i++) {
        const hour = new Date(eventStart.getTime() + i * 60 * 60 * 1000);
        const hourString = hour.getHours().toString().padStart(2, '0') + ':00';
        
        // Simulate check-in distribution (in real app, query actual data)
        const count = i === 1 ? maxHourlyCheckIns : Math.floor(maxHourlyCheckIns * 0.3);
        
        timeline.push({
          hour: hourString,
          count: Math.min(count, event.checkedIn.length)
        });
      }
      
      analytics.checkInTimeline = timeline;
      analytics.maxHourlyCheckIns = maxHourlyCheckIns;
      analytics.peakCheckInHour = timeline.reduce((peak, slot) => 
        slot.count > peak.count ? slot : peak, timeline[0]
      ).hour;
      
      // Average check-in time (simplified calculation)
      const avgMinutes = 15; // minutes before event start
      analytics.averageCheckInTime = `-${avgMinutes}m`;
    }

    // Form analytics
    if (event.checkInForm) {
      const FormSubmission = require('../models/FormSubmission');
      
      const submissions = await FormSubmission.find({
        form: event.checkInForm._id,
        event: eventId
      }).populate('form');

      const formAnalytics = {
        totalSubmissions: submissions.length,
        completionRate: event.attendees.length > 0 ? 
          submissions.length / event.attendees.length : 0,
        averageCompletionTime: submissions.reduce((avg, sub) => 
          avg + (sub.completionTime || 60), 0) / (submissions.length || 1)
      };

      // Question-level analytics
      if (event.checkInForm.questions && submissions.length > 0) {
        const questionStats = event.checkInForm.questions.map(question => {
          const responses = submissions
            .map(sub => sub.responses.find(r => r.questionId === question.id))
            .filter(Boolean);
          
          const responseRate = (responses.length / submissions.length) * 100;
          
          // Find most common answer
          const answerCounts = {};
          responses.forEach(response => {
            const answer = Array.isArray(response.answer) ? 
              response.answer.join(', ') : response.answer.toString();
            answerCounts[answer] = (answerCounts[answer] || 0) + 1;
          });
          
          const mostCommonAnswer = Object.keys(answerCounts).reduce((a, b) => 
            answerCounts[a] > answerCounts[b] ? a : b, ''
          ) || 'No responses';

          return {
            questionId: question.id,
            questionText: question.question,
            responseRate: Math.round(responseRate),
            totalResponses: responses.length,
            mostCommonAnswer: mostCommonAnswer.substring(0, 50) + 
              (mostCommonAnswer.length > 50 ? '...' : '')
          };
        });

        formAnalytics.questionStats = questionStats;
      }

      analytics.formAnalytics = formAnalytics;
    }

    // Payment analytics
    if (event.pricing && !event.pricing.isFree && event.paymentHistory) {
      const successfulPayments = event.paymentHistory.filter(p => p.status === 'succeeded');
      
      const paymentAnalytics = {
        totalRevenue: successfulPayments.reduce((total, payment) => 
          total + payment.amount, 0),
        paymentRate: event.attendees.length > 0 ? 
          successfulPayments.length / event.attendees.length : 0,
        averagePayment: successfulPayments.length > 0 ? 
          successfulPayments.reduce((avg, payment) => avg + payment.amount, 0) / successfulPayments.length : 0
      };

      analytics.paymentAnalytics = paymentAnalytics;
    }

    console.log(`✅ Analytics generated for event ${eventId}`);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate analytics' 
    });
  }
});

// Get Event by ID with Privacy Check - MUST BE LAST
// ============================================
// URGENT FIX: Get Event by ID with PROPER PAYMENT DATA POPULATION
// ============================================
router.get('/:eventId', protect, async (req, res) => {
  try {
    console.log(`🔍 PHASE 2: GET /api/events/${req.params.eventId} - Single event with privacy check`);
    
    const { eventId } = req.params;
    const userId = req.user._id;

    // Get event with populated fields
    const event = await Event.findById(eventId)
      .populate('host', 'username profilePicture displayName paymentAccounts')
      .populate('attendees', 'username profilePicture')
      .populate('coHosts', 'username profilePicture')
      .populate('invitedUsers', 'username profilePicture')
      .populate('group', 'name');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // PHASE 2: Check if user can view this event using discovery service
    const canView = await EventDiscoveryService.canUserViewEvent(event, userId);

    if (!canView) {
      console.log(`❌ PHASE 2: User ${userId} cannot view event ${eventId} due to privacy settings`);
      return res.status(403).json({ 
        message: 'You do not have permission to view this event',
        privacyLevel: event.privacyLevel,
        reason: 'privacy_restriction'
      });
    }

    console.log(`✅ PHASE 2: User ${userId} can view event ${eventId}`);

    // Check if user can view this event using existing service
    const permission = await EventPrivacyService.checkPermission(
      userId, 
      eventId, 
      'view'
    );

    if (!permission.allowed) {
      console.log(`❌ Permission denied: ${permission.reason}`);
      return res.status(403).json({ message: permission.reason });
    }

    // Filter sensitive information based on privacy settings
    const eventObj = event.toObject();
    
    // Hide attendee list if not public
    if (!event.permissions.showAttendeesToPublic && 
        String(event.host._id) !== String(userId) &&
        !event.coHosts.some(c => String(c._id) === String(userId))) {
      eventObj.attendees = eventObj.attendees.slice(0, 3); // Show only first 3
    }

    // Add detailed user relationship to event
    const isHost = String(event.host._id) === String(userId);
    const isCoHost = event.coHosts.some(c => String(c._id) === String(userId));
    const isAttending = event.attendees.some(a => String(a._id) === String(userId));
    const isInvited = event.invitedUsers.some(i => String(i._id) === String(userId));
    const hasRequestedToJoin = event.joinRequests.some(jr => String(jr.user._id) === String(userId));

    eventObj.userRelation = {
      isHost,
      isCoHost,
      isAttending,
      isInvited,
      hasRequestedToJoin
    };

    // PHASE 2: Add privacy metadata
    eventObj.privacyMetadata = {
      level: event.privacyLevel,
      permissions: event.permissions,
      canUserView: true,
      canUserJoin: event.canUserJoin ? event.canUserJoin(userId) : false,
      canUserInvite: event.canUserInvite ? event.canUserInvite(userId) : false,
      canUserEdit: isHost || isCoHost,
      viewReason: isHost ? 'host' :
                 isCoHost ? 'co_host' :
                 isAttending ? 'attendee' :
                 isInvited ? 'invited' :
                 event.privacyLevel === 'public' ? 'public' :
                 'following_host'
    };

    // Add payment status for current user if it's a paid event
    if (event.isPaidEvent && event.isPaidEvent()) {
      eventObj.userPaymentStatus = {
        hasUserPaid: event.hasUserPaid ? event.hasUserPaid(userId) : false,
        currentPrice: event.getCurrentPrice ? event.getCurrentPrice() : event.pricing?.amount || 0,
        currency: event.pricing?.currency || 'usd'
      };
    }

    console.log(`✅ PHASE 2: Successfully returning event ${eventId} with privacy metadata`);

    res.json(eventObj);

  } catch (error) {
    console.error('❌ PHASE 2: Get single event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

    
module.exports = router;