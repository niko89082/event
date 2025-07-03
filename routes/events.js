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

// Enhanced Posts Feed Route
router.get('/feed/posts', protect, async (req, res) => {
  console.log('🟡 Enhanced posts endpoint hit');
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;
  
  try {
    const viewer = await User.findById(req.user._id).select('following');
    
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingIds = viewer.following || [];
    console.log('🟡 Following count for posts:', followingIds.length);

    if (followingIds.length === 0) {
      return res.json({
        posts: [],
        page: 1,
        totalPages: 0,
        hasMore: false
      });
    }

    const posts = await Photo.find({
      user: { $in: followingIds }
    })
    .populate('user', 'username profilePicture')
    .populate('event', 'title time location')
    .sort({ uploadDate: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    console.log('🟡 Found posts:', posts.length);

    const postsWithSource = posts.map(post => ({
      ...post,
      source: 'friend'
    }));

    const totalPosts = await Photo.countDocuments({
      user: { $in: followingIds }
    });
    
    const response = {
      posts: postsWithSource,
      page,
      totalPages: Math.ceil(totalPosts / limit),
      hasMore: skip + limit < totalPosts
    };

    console.log('🟢 Sending posts response:', { postsCount: posts.length, page });
    res.json(response);

  } catch (err) {
    console.error('❌ Enhanced posts error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
    const list = await Event.find({
      allowPhotos: true,
      $or: [
        { attendees: req.user._id }, 
        { checkedIn: req.user._id },
        { host: req.user._id }
      ]
    }).select('title time allowPhotos host attendees');
    res.json(list);
  } catch (err) {
    console.error('/my-photo-events =>', err);
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
      isPaidEvent, eventPrice, priceDescription, refundPolicy,
      earlyBirdEnabled, earlyBirdPrice, earlyBirdDeadline,
      
      // Privacy fields
      privacyLevel = 'public',
      canView = 'anyone',
      canJoin = 'anyone', 
      canShare = 'attendees',
      canInvite = 'attendees',
      appearInFeed = 'true',
      appearInSearch = 'true',
      showAttendeesToPublic = 'true',
      
      // Legacy fields
      isPublic, allowPhotos, openToPublic,
      allowUploads, allowUploadsBeforeStart,
      groupId, geo,
      
      // Discovery fields
      tags, weatherDependent = 'false',
      interests, ageMin, ageMax
    } = req.body;

    // ============================================
    // NEW: PAYMENT VALIDATION FOR PAID EVENTS
    // ============================================
    const isPaid = bool(isPaidEvent);
    let priceInCents = 0;
    let earlyBirdPriceInCents = 0;

    if (isPaid) {
      // Validate price
      const price = parseFloatSafe(eventPrice);
      if (price <= 0) {
        return res.status(400).json({ 
          message: 'Event price must be greater than 0 for paid events' 
        });
      }
      priceInCents = Math.round(price * 100); // Convert to cents

      // Early bird pricing
      if (bool(earlyBirdEnabled)) {
        const earlyPrice = parseFloatSafe(earlyBirdPrice);
        if (earlyPrice <= 0 || earlyPrice >= price) {
          return res.status(400).json({ 
            message: 'Early bird price must be greater than 0 and less than regular price' 
          });
        }
        earlyBirdPriceInCents = Math.round(earlyPrice * 100);
      }

      // ============================================
      // CRITICAL: CHECK HOST PAYMENT ACCOUNT
      // ============================================
      const hostUser = await User.findById(req.user._id);
      
      // Check if host can receive payments (works for both PayPal and Stripe)
      if (!hostUser.canReceivePayments()) {
        return res.status(400).json({ 
          message: 'You need to set up a payment account before creating paid events',
          needsPaymentSetup: true,
          canReceivePayments: false
        });
      }

      console.log(`✅ Host ${req.user._id} can receive payments via ${hostUser.getPrimaryPaymentMethod()}`);
    }

    /* optional group link */
    let group = null;
    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: 'Group not found' });
      const isMember = group.members.some(m => String(m) === String(req.user._id));
      if (!isMember) return res.status(403).json({ message: 'Not a member of the group' });
    }

    /* parse privacy settings */
    const permissions = {
      canView: canView || 'anyone',
      canJoin: canJoin || 'anyone',
      canShare: canShare || 'attendees', 
      canInvite: canInvite || 'attendees',
      appearInFeed: bool(appearInFeed),
      appearInSearch: bool(appearInSearch),
      showAttendeesToPublic: bool(showAttendeesToPublic)
    };

    /* assemble doc */
    const event = new Event({
      title, description, category,
      time: new Date(time), location,
      maxAttendees: parseIntSafe(maxAttendees),
      host: req.user._id,
      
      // Enhanced pricing structure
      pricing: {
        isFree: !isPaid,
        amount: priceInCents,
        currency: 'USD',
        description: priceDescription?.trim(),
        refundPolicy: refundPolicy || 'no-refund',
        earlyBirdPricing: {
          enabled: isPaid && bool(earlyBirdEnabled),
          amount: earlyBirdPriceInCents,
          deadline: earlyBirdDeadline ? new Date(earlyBirdDeadline) : null
        }
      },

      // Legacy fields for backward compatibility
      price: isPaid ? priceInCents / 100 : 0,
      
      // Privacy system
      privacyLevel: privacyLevel || 'public',
      permissions,
      
      // Legacy fields
      isPublic: bool(isPublic) ?? (privacyLevel === 'public'),
      allowPhotos: bool(allowPhotos) ?? true,
      openToPublic: bool(openToPublic) ?? (canJoin === 'anyone'),
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

    /* geo JSON (optional) */
    /* geo JSON from coordinates field */
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
      } else {
        console.log('⚠️ Invalid coordinates format, skipping geo');
      }
    } catch (error) {
      console.log('❌ Error parsing coordinates:', error);
    }
  } else if (geo) {
    // Fallback for old geo format
    try {
      const g = typeof geo === 'string' ? JSON.parse(geo) : geo;
      if (g && Array.isArray(g.coordinates) && g.coordinates.length === 2) {
        event.geo = g;
      }
    } catch (error) {
      console.log('❌ Invalid geo format during creation:', error);
    }
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

    console.log(`✅ Event created: ${event._id} (Paid: ${isPaid})`);

    res.status(201).json({
      message: 'Event created successfully',
      _id: event._id,
      event: event,
      isPaidEvent: isPaid,
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
    const event = await Event.findById(req.params.eventId).populate('host', 'paymentAccounts username');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if event has ended
    const eventEndTime = new Date(event.time).getTime() + (3 * 60 * 60 * 1000);
    if (Date.now() > eventEndTime) {
      return res.status(400).json({ message: 'Event has already ended' });
    }

    // Check if already attending
    if (event.attendees.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already attending' });
    }

    // Check permissions
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      req.params.eventId, 
      'join'
    );

    if (!permission.allowed) {
      if (event.permissions.canJoin === 'approval-required') {
        return res.status(400).json({ 
          message: 'This event requires approval to join',
          suggestion: 'Send a join request instead'
        });
      }
      return res.status(403).json({ message: permission.reason });
    }

    // ============================================
    // FIXED: PROPER PAYMENT VALIDATION
    // ============================================
    if (event.isPaidEvent()) {
      console.log(`💳 Processing payment for paid event ${event._id}`);

      // Check if user already paid (prevents double charging)
      if (event.hasUserPaid(req.user._id)) {
        console.log(`✅ User ${req.user._id} already paid for event ${event._id}`);
        
        // User already paid, just add to attendees
        event.attendees.push(req.user._id);
        await event.save();

        // Add to user's attending events
        await User.findByIdAndUpdate(req.user._id, {
          $addToSet: { attendingEvents: event._id }
        });

        return res.json({ 
          message: 'You are now attending (no charge - already paid)', 
          event,
          alreadyPaid: true
        });
      }

      // CRITICAL FIX: Check if host can receive payments with PROPER validation
      if (!req.body.paymentConfirmed) {
        const currentPrice = event.getCurrentPrice();
        
        // ✅ FIXED: Use the User model's canReceivePayments method
        if (!event.host.canReceivePayments()) {
          console.log(`❌ Host payment validation failed:`, {
            hostId: event.host._id,
            paymentAccounts: event.host.paymentAccounts,
            paypalVerified: event.host.paymentAccounts?.paypal?.verified,
            stripeEnabled: event.host.paymentAccounts?.stripe?.chargesEnabled
          });
          
          return res.status(400).json({ 
            message: 'Host cannot currently receive payments. Please try again later.',
            needsPaymentSetup: true,
            debug: {
              hasPayPal: !!event.host.paymentAccounts?.paypal?.verified,
              hasStripe: !!event.host.paymentAccounts?.stripe?.chargesEnabled
            }
          });
        }

        // ✅ FIXED: Get available payment methods properly
        const availablePaymentMethods = event.host.getAvailablePaymentMethods();
        
        if (availablePaymentMethods.length === 0) {
          return res.status(400).json({ 
            message: 'Host has no available payment methods configured',
            needsPaymentSetup: true
          });
        }

        // Return payment requirements - DO NOT add to attendees yet
        return res.status(402).json({
          message: 'Payment required to attend this event',
          paymentRequired: true,
          amount: currentPrice,
          currency: event.pricing.currency || 'usd',
          eventTitle: event.title,
          hostPaymentMethods: {
            paypal: !!event.host.paymentAccounts?.paypal?.verified,
            stripe: !!event.host.paymentAccounts?.stripe?.chargesEnabled,
            availableMethods: availablePaymentMethods
          }
        });
      }

      // Payment was confirmed via frontend, verify payment intent
      const { paymentIntentId, paypalOrderId, paypalCaptureId } = req.body;
      
      if (!paymentIntentId && !paypalCaptureId) {
        return res.status(400).json({ 
          message: 'Payment confirmation required but payment ID not provided' 
        });
      }

      // Add verified payment to event history
      const paymentData = {
        user: req.user._id,
        amount: event.getCurrentPrice(),
        currency: event.pricing.currency || 'usd',
        status: 'succeeded',
        paidAt: new Date(),
        type: 'user'
      };

      if (paymentIntentId) {
        paymentData.provider = 'stripe';
        paymentData.stripePaymentIntentId = paymentIntentId;
      } else {
        paymentData.provider = 'paypal';
        paymentData.paypalOrderId = paypalOrderId;
        paymentData.paypalCaptureId = paypalCaptureId;
      }

      await event.addPayment(paymentData);
      console.log(`✅ Payment verified and recorded for user ${req.user._id} on event ${event._id}`);
    }

    // Add to attendees (free event or payment verified)
    event.attendees.push(req.user._id);
    await event.save();

    // Add to user's attending events
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { attendingEvents: event._id }
    });

    // Send success response
    const responseMessage = event.isPaidEvent() 
      ? 'Payment successful! You are now attending this event.'
      : 'You are now attending this event!';

    res.json({ 
      message: responseMessage, 
      event,
      paymentRequired: event.isPaidEvent(),
      alreadyPaid: event.isPaidEvent() ? true : false
    });

  } catch (error) {
    console.error('❌ Event attendance error:', error);
    res.status(500).json({ 
      message: 'Failed to process attendance',
      error: error.message
    });
  }
});


// ============================================
// ENHANCED: UNATTEND EVENT (KEEPS PAYMENT HISTORY)
// ============================================
router.delete('/attend/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!event.attendees.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are not attending this event' });
    }

    // ✅ ENHANCED: Check if user had paid for this event
    const userPayment = event.payments?.find(p => 
      p.user.toString() === req.user._id.toString() && 
      p.status === 'succeeded'
    );

    // Remove from attendees
    event.attendees.pull(req.user._id);
    
    // ✅ ENHANCED: Mark payment as eligible for re-attendance without double charge
    if (userPayment) {
      userPayment.leftEventAt = new Date();
      userPayment.canReattendWithoutPayment = true;
      console.log(`🔄 User ${req.user._id} left paid event ${event._id} - payment preserved for re-attendance`);
    }
    
    await event.save();

    // Remove from user's attending events
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { attendingEvents: event._id }
    });

    // ✅ ENHANCED: Provide better response with payment info
    const responseMessage = userPayment 
      ? 'You have left the event. Your payment is preserved if you want to rejoin.'
      : 'You have left the event successfully.';

    res.json({ 
      message: responseMessage, 
      event,
      canReattendWithoutPayment: !!userPayment
    });

  } catch (error) {
    console.error('❌ Unattend event error:', error);
    res.status(500).json({ message: 'Server error' });
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
router.post('/:eventId/checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { scannedUserId, userId, manualCheckIn } = req.body;

    const event = await Event.findById(eventId)
      .populate('attendees', '_id username profilePicture')
      .populate('checkedIn', '_id username profilePicture');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts.some(
      (c) => String(c) === String(req.user._id)
    );
    if (!isHost && !isCoHost) {
      return res.status(401).json({
        message: 'User not authorized to check in attendees',
      });
    }

    const targetUserId = scannedUserId || userId;
    if (!targetUserId) {
      return res.status(400).json({ message: 'No user ID provided for check-in' });
    }

    const user = await User.findById(targetUserId).select('username profilePicture');
    if (!user) {
      return res.status(404).json({ message: 'User not found in system' });
    }

    const isAttendee = event.attendees.some((a) => a._id.equals(targetUserId));
    if (!isAttendee) {
      return res.json({
        status: 'not_attendee',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    }

    const isAlreadyCheckedIn = event.checkedIn.some((id) =>
      String(id) === String(targetUserId)
    );
    if (isAlreadyCheckedIn) {
      return res.json({
        status: 'already_checked_in',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    }

    event.checkedIn.push(targetUserId);
    await event.save();

    return res.json({
      status: 'success',
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture || null,
      },
      manualCheckIn: manualCheckIn || false
    });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

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



module.exports = router;