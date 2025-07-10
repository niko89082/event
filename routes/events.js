const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Photo = require('../models/Photo');
const User = require('../models/User');
const GuestPass = require('../models/GuestPass');
const protect = require('../middleware/auth');
const EventPrivacyService = require('../services/eventPrivacyService');
const StripeConnectService = require('../services/stripeConnectService');
const PayPalProvider = require('../services/paymentProviders/paypalProvider');
const PaymentProviderFactory = require('../services/paymentProviders/paymentProviderFactory');
const fs = require('fs');
const path = require('path');
const notificationService = require('../services/notificationService');
require('dotenv').config();

const router = express.Router();

const UP_DIR = path.join(__dirname, '..', 'uploads');
const PHOTO_DIR = path.join(UP_DIR, 'photos');
const COVER_DIR = path.join(UP_DIR, 'event-covers');
const COVERS_DIR = path.join(UP_DIR, 'covers');

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
router.post('/create', protect, uploadCover.single('coverImage'), async (req, res) => {
  try {
    console.log('📝 Creating new event...');
    console.log('Request body:', req.body);

    const {
      title, description, category = 'General',
      time, location, maxAttendees = 10,
      
      // Enhanced pricing fields
      isPaidEvent, eventPrice, priceDescription,
      refundPolicy, earlyBirdEnabled, earlyBirdPrice, earlyBirdDeadline,
      
      // Privacy and permissions
      privacyLevel = 'public', permissions,
      
      // Co-hosts and invitations
      coHosts, invitedUsers, tags, coordinates, groupId,
      
      // Legacy fields
      price, isPublic, openToPublic, allowPhotos, allowUploads, allowUploadsBeforeStart,
      weatherDependent, interests, ageMin, ageMax,
      
      // ============================================
      // PHASE 1: CHECK-IN FORM INTEGRATION
      // ============================================
      checkInFormId,
      requiresFormForCheckIn = false,
      
    } = req.body;

    // Enhanced validation
    if (!title?.trim()) return res.status(400).json({ message: 'Event title is required' });
    if (!time) return res.status(400).json({ message: 'Event time is required' });
    if (!location?.trim()) return res.status(400).json({ message: 'Event location is required' });

    // Validate event time
    const eventDate = new Date(time);
    if (isNaN(eventDate.getTime()) || eventDate <= new Date()) {
      return res.status(400).json({ message: 'Event time must be in the future' });
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

    // Parse permissions
    let permissionsObj = {};
    if (permissions) {
      try {
        permissionsObj = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
      } catch (e) {
        console.log('Invalid permissions format:', permissions);
      }
    }

    // Handle pricing
    const isPaid = isPaidEvent === 'true' || isPaidEvent === true;
    const eventPriceNum = isPaid ? parseFloat(eventPrice) || 0 : 0;
    const earlyBirdPriceNum = earlyBirdEnabled ? parseFloat(earlyBirdPrice) || 0 : 0;

    // Helper functions
    const bool = (val) => val === 'true' || val === true;
    const parseIntSafe = (val) => {
      const parsed = parseInt(val);
      return isNaN(parsed) ? undefined : parsed;
    };

    // Create event
    const event = new Event({
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
      
      // Privacy system
      privacyLevel,
      permissions: {
        appearInFeed: bool(permissionsObj.appearInFeed) ?? (privacyLevel === 'public'),
        appearInSearch: bool(permissionsObj.appearInSearch) ?? (privacyLevel === 'public'),
        canJoin: permissionsObj.canJoin || (privacyLevel === 'public' ? 'anyone' : 'invited-only'),
        canShare: permissionsObj.canShare || 'attendees',
        canInvite: permissionsObj.canInvite || 'attendees',
        showAttendeesToPublic: bool(permissionsObj.showAttendeesToPublic) ?? (privacyLevel === 'public'),
        ...permissionsObj
      },
      
      // Legacy compatibility
      price: eventPriceNum,
      isPublic: bool(isPublic) ?? (privacyLevel === 'public'),
      allowPhotos: bool(allowPhotos) ?? true,
      openToPublic: bool(openToPublic) ?? (permissionsObj.canJoin === 'anyone'),
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
    });

    // Handle coordinates
    if (req.body.coordinates) {
      try {
        const coords = typeof req.body.coordinates === 'string' 
          ? JSON.parse(req.body.coordinates) 
          : req.body.coordinates;
        
        if (Array.isArray(coords) && coords.length === 2) {
          event.geo = {
            type: 'Point',
            coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
          };
          console.log('✅ Geo coordinates set:', event.geo);
        }
      } catch (error) {
        console.log('❌ Error parsing coordinates:', error);
      }
    }

    // Handle check-in form assignment
    if (checkInFormId && requiresFormForCheckIn) {
      // Verify form exists and belongs to user
      const form = await Form.findById(checkInFormId);
      if (!form) {
        return res.status(400).json({ 
          message: 'Check-in form not found' 
        });
      }
      
      if (String(form.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ 
          message: 'You can only use forms you created' 
        });
      }
      
      event.checkInForm = checkInFormId;
      event.requiresFormForCheckIn = true;
      
      console.log(`✅ Event ${event._id} assigned check-in form ${checkInFormId}`);
    }

    if (req.file) {
      event.coverImage = `/uploads/covers/${req.file.filename}`;
    }

    await event.save();
    
    if (group) { 
      group.events.push(event._id); 
      await group.save(); 
    }

    // Auto-invite for private/secret events created from groups
    if ((privacyLevel === 'private' || privacyLevel === 'secret') && group) {
      event.invitedUsers = group.members.filter(m => String(m) !== String(req.user._id));
      await event.save();
    }

    console.log(`✅ Event created: ${event._id} (Paid: ${isPaid}, Form: ${!!checkInFormId})`);

    res.status(201).json({
      message: 'Event created successfully',
      _id: event._id,
      event: event,
      isPaidEvent: isPaid,
      hasCheckInForm: !!checkInFormId,
      needsPaymentSetup: false
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

// Get Events with Privacy Filtering
router.get('/', protect, async (req, res) => {
  try {
    const { 
      host,
      attendee, 
      location, 
      radius, 
      interests, 
      includeSecret,
      includePast = 'false',
      limit = 20, 
      skip = 0 
    } = req.query;

    // If specific user filters are provided, handle them
    if (host || attendee) {
      let query = {};
      
      if (host) {
        query.host = host;
      }
      
      if (attendee) {
        query.attendees = attendee;
        // If both host and attendee are the same, get all user's events
        if (host === attendee) {
          query = {
            $or: [
              { host: attendee },
              { attendees: attendee }
            ]
          };
        }
      }

      // Add time filter
      if (includePast !== 'true') {
        query.time = { $gte: new Date() };
      }

      // Check if requesting user can see these events
      const requestingUserId = req.user._id;
      const targetUserId = host || attendee;
      const isOwnEvents = String(requestingUserId) === String(targetUserId);

      if (!isOwnEvents) {
        // Apply privacy filtering for other users' events
        const visibleEvents = await EventPrivacyService.getVisibleEvents(requestingUserId, {
          hostFilter: targetUserId,
          limit: parseInt(limit),
          skip: parseInt(skip)
        });
        return res.json({ events: visibleEvents });
      }

      // For own events, return all with metadata
      const events = await Event.find(query)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ time: includePast === 'true' ? -1 : 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      return res.json({ events });
    }

    // Default behavior - get recommended/visible events
    const options = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      includeSecret: includeSecret === 'true'
    };

    if (location) {
      try {
        options.location = JSON.parse(location);
        if (radius) options.radius = parseInt(radius);
      } catch (e) {
        console.log('Invalid location format');
      }
    }

    if (interests) {
      options.interests = Array.isArray(interests) ? interests : interests.split(',');
    }

    const events = await EventPrivacyService.getVisibleEvents(req.user._id, options);
    res.json({ events });

  } catch (e) { 
    console.error('Get events error:', e);
    res.status(500).json({ message: 'Server error' }); 
  }
});

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

    // Check if user is already attending
    const isAlreadyAttending = event.attendees.some(attendee => 
      String(attendee._id || attendee) === String(userId)
    );

    if (isAlreadyAttending) {
      return res.status(400).json({ message: 'You are already attending this event' });
    }

    // ✅ FIX: Use instance methods from Event model (now works because we have full document)
    try {
      // Check if user can join this event
      const canJoin = event.canUserJoin(userId, userFollowing);
      
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

      // Add user to attendees
      event.attendees.push(userId);
      await event.save();

      // Add event to user's attending list
      if (!user.attendingEvents) {
        user.attendingEvents = [];
      }
      user.attendingEvents.push(eventId);
      await user.save();

      // Create notification for event host
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

      console.log(`✅ User ${userId} successfully joined event ${eventId}`);

      res.json({ 
        message: 'Successfully joined the event!',
        event: {
          _id: event._id,
          title: event.title,
          attendeeCount: event.attendees.length
        },
        alreadyPaid: isPaidEvent && event.paymentHistory && event.paymentHistory.some(p => 
          String(p.user) === String(userId) && p.status === 'succeeded'
        )
      });

    } catch (methodError) {
      console.error('❌ Event method error:', methodError);
      
      // Fallback permission check if instance methods fail
      const isHost = String(event.host._id || event.host) === String(userId);
      const isInvited = event.invitedUsers && event.invitedUsers.some(u => 
        String(u._id || u) === String(userId)
      );
      const isPublic = event.privacyLevel === 'public';
      const isFollowingHost = userFollowing.includes(String(event.host._id || event.host));

      let canJoinFallback = false;

      if (isHost) {
        return res.status(400).json({ message: 'You cannot attend your own event' });
      }

      // Basic permission checks
      switch (event.privacyLevel) {
        case 'public':
          canJoinFallback = true;
          break;
        case 'friends':
          canJoinFallback = isFollowingHost;
          break;
        case 'private':
        case 'secret':
          canJoinFallback = isInvited;
          break;
        default:
          canJoinFallback = false;
      }

      if (!canJoinFallback) {
        return res.status(403).json({ 
          message: 'You do not have permission to join this event' 
        });
      }

      // If we reach here, allow joining with fallback logic
      event.attendees.push(userId);
      await event.save();

      if (!user.attendingEvents) {
        user.attendingEvents = [];
      }
      user.attendingEvents.push(eventId);
      await user.save();

      res.json({ 
        message: 'Successfully joined the event!',
        event: {
          _id: event._id,
          title: event.title,
          attendeeCount: event.attendees.length
        }
      });
    }

  } catch (error) {
    console.error('❌ Event attendance error:', error);
    res.status(500).json({ 
      message: 'Failed to process attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

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

        try {
          console.log(`✅ Notification would be sent to user ${userId}`);
        } catch (notifError) {
          console.error(`❌ Failed to send notification to user ${userId}:`, notifError);
        }

      } catch (userError) {
        console.error(`❌ Error processing user ${userId}:`, userError);
        invalidUsers.push(userId);
      }
    }

    await event.save();

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

// Get Event by ID with Privacy Check - MUST BE LAST
// ============================================
// URGENT FIX: Get Event by ID with PROPER PAYMENT DATA POPULATION
// ============================================
router.get('/:eventId', protect, async (req, res) => {
  try {
    console.log(`🔍 GET Event Details: ${req.params.eventId} for user ${req.user._id}`);
    
    const event = await Event.findById(req.params.eventId)
      // ✅ CRITICAL FIX: Include paymentAccounts in host population
      .populate('host', 'username profilePicture paymentAccounts')
      .populate('coHosts', 'username paymentAccounts')
      .populate('attendees invitedUsers', 'username')
      .populate('joinRequests.user', 'username profilePicture')
      .populate({
        path: 'photos',
        populate: { path: 'user', select: 'username isPrivate followers' }
      });

    if (!event) {
      console.log(`❌ Event not found: ${req.params.eventId}`);
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log(`✅ Event found: ${event.title}`);
    console.log(`🔍 Host payment data check:`, {
      hostId: event.host._id,
      hasPaymentAccounts: !!event.host.paymentAccounts,
      paypalVerified: event.host.paymentAccounts?.paypal?.verified,
      stripeEnabled: event.host.paymentAccounts?.stripe?.chargesEnabled
    });

    // Check if user can view this event
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      req.params.eventId, 
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
        String(event.host._id) !== String(req.user._id) &&
        !event.coHosts.some(c => String(c._id) === String(req.user._id))) {
      eventObj.attendees = eventObj.attendees.slice(0, 3); // Show only first 3
    }

    // ✅ ENHANCED: Add detailed user relationship to event
    const isHost = String(event.host._id) === String(req.user._id);
    const isCoHost = event.coHosts.some(c => String(c._id) === String(req.user._id));
    const isAttending = event.attendees.some(a => String(a._id) === String(req.user._id));
    const isInvited = event.invitedUsers.some(i => String(i._id) === String(req.user._id));
    const hasRequestedToJoin = event.joinRequests.some(jr => String(jr.user._id) === String(req.user._id));

    eventObj.userRelation = {
      isHost,
      isCoHost,
      isAttending,
      isInvited,
      hasRequestedToJoin
    };

    // ✅ ENHANCED: Add payment status for current user
    if (event.isPaidEvent && event.isPaidEvent()) {
      eventObj.userPaymentStatus = {
        hasUserPaid: event.hasUserPaid ? event.hasUserPaid(req.user._id) : false,
        currentPrice: event.getCurrentPrice ? event.getCurrentPrice() : event.pricing?.amount || 0,
        currency: event.pricing?.currency || 'usd'
      };
    }

    // ✅ ENHANCED: Add host payment capabilities with debug info
    if (event.host.paymentAccounts) {
      eventObj.hostPaymentCapabilities = {
        canReceivePayments: event.host.canReceivePayments ? event.host.canReceivePayments() : false,
        availablePaymentMethods: event.host.getAvailablePaymentMethods ? event.host.getAvailablePaymentMethods() : [],
        primaryPaymentMethod: event.host.getPrimaryPaymentMethod ? event.host.getPrimaryPaymentMethod() : null,
        paymentMethods: {
          paypal: {
            available: !!event.host.paymentAccounts.paypal?.verified,
            email: event.host.paymentAccounts.paypal?.email
          },
          stripe: {
            available: !!event.host.paymentAccounts.stripe?.chargesEnabled,
            accountId: event.host.paymentAccounts.stripe?.accountId
          }
        }
      };
    } else {
      eventObj.hostPaymentCapabilities = {
        canReceivePayments: false,
        availablePaymentMethods: [],
        primaryPaymentMethod: null,
        paymentMethods: {
          paypal: { available: false },
          stripe: { available: false }
        }
      };
    }

    // Add timing metadata with 3-hour buffer
    const eventEndTime = new Date(event.time).getTime() + (3 * 60 * 60 * 1000);
    eventObj.isOver = Date.now() > eventEndTime;
    eventObj.canCheckIn = Date.now() <= eventEndTime;

    console.log(`✅ Sending event data with payment capabilities:`, {
      eventId: eventObj._id,
      canReceivePayments: eventObj.hostPaymentCapabilities.canReceivePayments,
      availableMethods: eventObj.hostPaymentCapabilities.availablePaymentMethods,
      isPaidEvent: event.isPaidEvent ? event.isPaidEvent() : false
    });

    res.json(eventObj);

  } catch (e) { 
    console.error('❌ Get event error:', e);
    res.status(500).json({ message: 'Server error', error: e.message }); 
  }
});

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
    console.log(`🔄 Updating event ${req.params.eventId}`);
    
    const { eventId } = req.params;
    const {
      title,
      description,
      category,
      time,
      location,
      maxAttendees,
      privacyLevel,
      permissions,
      tags,
      coordinates,
      
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
      
      // Form requirements
      requiresFormForCheckIn,
      checkInForm,
      
      // Legacy compatibility
      price,
      isPublic,
      openToPublic
    } = req.body;

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is host or co-host
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts?.some(
      (cId) => String(cId) === String(req.user._id)
    );

    if (!isHost && !isCoHost) {
      return res.status(403).json({ 
        message: 'Only the host or co-hosts can update this event' 
      });
    }

    // Validate required fields
    if (!title?.trim()) {
      return res.status(400).json({ message: 'Event title is required' });
    }

    if (!time) {
      return res.status(400).json({ message: 'Event time is required' });
    }

    if (!location?.trim()) {
      return res.status(400).json({ message: 'Event location is required' });
    }

    // Validate event time is in the future (only for major changes)
    const eventTime = new Date(time);
    const now = new Date();
    
    // Allow updates up to 1 hour before event starts
    const oneHourBefore = new Date(eventTime.getTime() - (60 * 60 * 1000));
    
    if (now > oneHourBefore && String(event.time) !== String(time)) {
      return res.status(400).json({ 
        message: 'Cannot change event time less than 1 hour before the event' 
      });
    }

    // Handle pricing updates
    let pricingData = null;
    
    if (isPaidEvent || price > 0 || eventPrice > 0) {
      const finalPrice = eventPrice || price || 0;
      
      if (finalPrice <= 0) {
        return res.status(400).json({ 
          message: 'Paid events must have a price greater than 0' 
        });
      }

      pricingData = {
        isFree: false,
        amount: Math.round(finalPrice * 100), // Convert to cents
        currency: 'USD',
        description: priceDescription || '',
        refundPolicy: refundPolicy || 'No refunds',
        earlyBirdPricing: earlyBirdEnabled ? {
          enabled: true,
          amount: Math.round((earlyBirdPrice || finalPrice) * 100),
          deadline: earlyBirdDeadline ? new Date(earlyBirdDeadline) : null
        } : { enabled: false }
      };

      // Validate early bird pricing
      if (earlyBirdEnabled) {
        if (!earlyBirdDeadline || new Date(earlyBirdDeadline) >= eventTime) {
          return res.status(400).json({ 
            message: 'Early bird deadline must be before the event time' 
          });
        }
        
        if ((earlyBirdPrice || finalPrice) >= finalPrice) {
          return res.status(400).json({ 
            message: 'Early bird price must be less than regular price' 
          });
        }
      }
    } else {
      pricingData = {
        isFree: true,
        amount: 0,
        currency: 'USD'
      };
    }

    // Handle permissions
    let permissionsData = {
      canJoin: 'open', // open, approval-required, invite-only
      canInvite: 'attendees', // host-only, co-hosts, attendees
      canShare: 'everyone', // host-only, attendees, everyone
      showAttendeesToPublic: true,
      allowGuestPasses: false
    };

    if (permissions) {
      permissionsData = { ...permissionsData, ...permissions };
    }

    // Legacy compatibility
    if (isPublic === false || openToPublic === false) {
      permissionsData.canJoin = 'invite-only';
    }

    // Handle privacy level
    let finalPrivacyLevel = privacyLevel || 'public';
    
    // Legacy compatibility
    if (isPublic === false) {
      finalPrivacyLevel = 'private';
    }

    // Validate and process co-hosts
    let validCoHosts = [];
    if (coHosts && Array.isArray(coHosts)) {
      // Remove duplicates and host from co-hosts
      const uniqueCoHosts = [...new Set(coHosts)].filter(
        coHostId => String(coHostId) !== String(req.user._id)
      );
      
      if (uniqueCoHosts.length > 0) {
        const validUsers = await User.find({
          _id: { $in: uniqueCoHosts }
        }).select('_id');
        
        validCoHosts = validUsers.map(user => user._id);
      }
    }

    // Update event fields
    event.title = title.trim();
    event.description = description?.trim() || '';
    event.category = category || 'General';
    event.time = new Date(time);
    event.location = location.trim();
    event.maxAttendees = parseInt(maxAttendees) || 10;
    event.privacyLevel = finalPrivacyLevel;
    event.permissions = permissionsData;
    event.pricing = pricingData;
    event.coHosts = validCoHosts;
    event.tags = Array.isArray(tags) ? tags : [];
    
    // Handle coordinates if provided
    if (coordinates && coordinates.latitude && coordinates.longitude) {
      event.coordinates = {
        latitude: parseFloat(coordinates.latitude),
        longitude: parseFloat(coordinates.longitude)
      };
    }

    // Handle form requirements
    if (requiresFormForCheckIn !== undefined) {
      event.requiresFormForCheckIn = Boolean(requiresFormForCheckIn);
      
      if (requiresFormForCheckIn && checkInForm) {
        // Validate that the form exists and belongs to the user
        const form = await Form.findOne({
          _id: checkInForm,
          createdBy: req.user._id,
          isActive: true
        });
        
        if (!form) {
          return res.status(400).json({ 
            message: 'Invalid check-in form selected' 
          });
        }
        
        event.checkInForm = checkInForm;
      } else if (!requiresFormForCheckIn) {
        event.checkInForm = undefined;
      }
    }

    // Update timestamp
    event.updatedAt = new Date();

    // Save the event
    await event.save();

    console.log(`✅ Event updated successfully: ${event._id}`);

    // Populate the updated event for response
    const updatedEvent = await Event.findById(eventId)
      .populate('host', 'username profilePicture')
      .populate('coHosts', 'username profilePicture')
      .populate('attendees', 'username profilePicture')
      .populate('checkInForm', 'title description');

    // Send response
    res.json({
      success: true,
      message: 'Event updated successfully',
      event: updatedEvent
    });

  } catch (error) {
    console.error('❌ Update event error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid event ID format' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
    const isAttending = event.attendees.includes(userId);
    if (!isAttending) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not registered for this event' 
      });
    }

    // Check if already checked in
    const isAlreadyCheckedIn = event.checkedIn.includes(userId);
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

    // Check in user
    const checkInResult = await event.checkInUser(userId);
    await event.save();

    console.log(`✅ User ${userId} manually checked in to event ${eventId} by ${req.user._id}`);

    res.json({
      success: true,
      message: 'User checked in successfully',
      checkIn: checkInResult
    });

  } catch (error) {
    console.error('Manual check-in error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check in user' 
    });
  }
});

/**
 * POST /api/events/:eventId/undo-checkin
 * Undo a user's check-in (for hosts)
 */
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
    const isCheckedIn = event.checkedIn.includes(userId);
    if (!isCheckedIn) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not checked in' 
      });
    }

    // Remove from checked in list
    event.checkedIn = event.checkedIn.filter(id => String(id) !== String(userId));
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
    
module.exports = router;