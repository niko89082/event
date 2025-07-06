// models/Event.js - Enhanced with Multi-Provider Payment Support + Phase 1 Form System
const mongoose = require('mongoose');

// Enhanced Payment History Schema with Multi-Provider Support
const PaymentHistorySchema = new mongoose.Schema({
  // User or guest information
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  guestPass: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GuestPass' 
  },
  guestName: String,                        // For guest payments
  guestEmail: String,                       // For guest payments
  
  // Payment details
  amount: { 
    type: Number, 
    required: true 
  },                    // Amount in cents
  currency: { 
    type: String, 
    default: 'USD' 
  },
  
  // Provider information
  provider: { 
    type: String, 
    enum: ['stripe', 'paypal', 'manual'], 
    default: 'stripe' 
  },
  
  // Stripe-specific fields
  stripePaymentIntentId: String,
  stripeChargeId: String,
  
  // PayPal-specific fields
  paypalOrderId: String,
  paypalCaptureId: String,
  paypalPayerId: String,
  
  // Manual payment fields
  manualPaymentMethod: String,              // 'venmo', 'cashapp', 'zelle', etc.
  manualTransactionId: String,
  manualNotes: String,
  
  // Payment status and timing
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'], 
    default: 'pending' 
  },
  paidAt: Date,
  processedAt: Date,
  
  // Refund information
  refundedAt: Date,
  refundAmount: Number,
  refundReason: String,
  refundId: String,                         // Provider-specific refund ID
  
  // Payment type and metadata
  type: { 
    type: String, 
    enum: ['user', 'guest'], 
    required: true 
  },
  metadata: {                               // Additional payment metadata
    ipAddress: String,
    userAgent: String,
    paymentMethodType: String,              // 'card', 'paypal_account', etc.
    last4: String,                          // Last 4 digits of card (if applicable)
    brand: String                           // Card brand or payment method brand
  }
}, {
  timestamps: true
});

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,  // Changed from true to false
    default: ''       // Added default empty string
  },
  time: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  coHosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  checkedIn: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  invitedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  maxAttendees: {
    type: Number,
    default: 50,
  },

  // ============================================
  // ENHANCED: MULTI-PROVIDER PRICING SYSTEM
  // ============================================
  pricing: {
    isFree: { 
      type: Boolean, 
      default: true 
    },
    amount: { 
      type: Number, 
      default: 0 
    },                    // Price in cents
    currency: { 
      type: String, 
      default: 'USD' 
    },
    description: String,                      // Price description (e.g., "Includes drinks and appetizers")
    
    // Refund policy
    refundPolicy: {
      type: String,
      enum: ['no-refund', 'partial-refund', 'full-refund', 'custom'],
      default: 'no-refund'
    },
    refundDeadline: Date,                     // Deadline for refunds
    customRefundPolicy: String,               // Custom refund policy text
    
    // Early bird pricing
    earlyBirdPricing: {
      enabled: { 
        type: Boolean, 
        default: false 
      },
      amount: { 
        type: Number, 
        default: 0 
      },           // Early bird price in cents
      deadline: Date,                         // Early bird deadline
      description: String                     // Early bird description
    },
    
    // Group pricing (future feature)
    groupPricing: {
      enabled: { 
        type: Boolean, 
        default: false 
      },
      minimumPeople: Number,
      discountPercentage: Number,
      discountAmount: Number
    }
  },

  // Legacy price field for backward compatibility
  price: {
    type: Number,
    default: 0,
  },

  // ============================================
  // ENHANCED: FINANCIAL TRACKING
  // ============================================
  financials: {
    totalRevenue: { 
      type: Number, 
      default: 0 
    },         // Total revenue in cents
    totalRefunded: { 
      type: Number, 
      default: 0 
    },        // Total refunded in cents
    netRevenue: { 
      type: Number, 
      default: 0 
    },           // Revenue minus refunds
    totalPayments: { 
      type: Number, 
      default: 0 
    },         // Number of successful payments
    
    // Provider-specific tracking
    providerBreakdown: {
      stripe: {
        revenue: { type: Number, default: 0 },
        payments: { type: Number, default: 0 },
        fees: { type: Number, default: 0 }
      },
      paypal: {
        revenue: { type: Number, default: 0 },
        payments: { type: Number, default: 0 },
        fees: { type: Number, default: 0 }
      },
      manual: {
        revenue: { type: Number, default: 0 },
        payments: { type: Number, default: 0 }
      }
    },
    
    // Fee tracking
    stripeFeesTotal: { 
      type: Number, 
      default: 0 
    },      // Legacy Stripe fees
    paypalFeesTotal: { 
      type: Number, 
      default: 0 
    },      // PayPal fees
    totalFees: { 
      type: Number, 
      default: 0 
    },           // All provider fees combined
    
    // Host earnings
    hostEarnings: { 
      type: Number, 
      default: 0 
    },         // Net amount host receives
    currency: { 
      type: String, 
      default: 'USD' 
    },
    
    // Financial timestamps
    lastPaymentAt: Date,
    lastRefundAt: Date,
    revenueUpdatedAt: { 
      type: Date, 
      default: Date.now 
    }
  },

  // ============================================
  // ENHANCED: PAYMENT HISTORY WITH MULTI-PROVIDER SUPPORT
  // ============================================
  paymentHistory: [PaymentHistorySchema],

  // ============================================
  // PHASE 1: CHECK-IN FORM INTEGRATION
  // ============================================
  checkInForm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form'
  },
  requiresFormForCheckIn: {
    type: Boolean,
    default: false
  },
  
  // Form submission tracking
  formSubmissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FormSubmission'
  }],
  
  // Check-in QR code settings
  checkInQR: {
    isActive: {
      type: Boolean,
      default: false
    },
    generatedAt: Date,
    expiresAt: Date,
    code: String, // Unique code for this event's check-in
    viewCount: {
      type: Number,
      default: 0
    }
  },

  // Privacy and permissions system
  privacyLevel: {
    type: String,
    enum: ['public', 'friends', 'private', 'secret'],
    default: 'public'
  },
  permissions: {
    canView: {
      type: String,
      enum: ['anyone', 'followers', 'friends', 'invited-only'],
      default: 'anyone'
    },
    canJoin: {
      type: String,
      enum: ['anyone', 'followers', 'friends', 'approval-required', 'invited-only'],
      default: 'anyone'
    },
    canShare: {
      type: String,
      enum: ['anyone', 'attendees', 'host-only'],
      default: 'attendees'
    },
    canInvite: {
      type: String,
      enum: ['anyone', 'attendees', 'host-only'],
      default: 'attendees'
    },
    appearInFeed: {
      type: Boolean,
      default: true
    },
    appearInSearch: {
      type: Boolean,
      default: true
    },
    showAttendeesToPublic: {
      type: Boolean,
      default: true
    }
  },

  // Join request system
  joinRequests: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: String,
    requestedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],

  // Event content and media
  coverImage: String,
  photos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo',
  }],
  allowPhotos: {
    type: Boolean,
    default: true,
  },
  allowUploads: {
    type: Boolean,
    default: true,
  },
  allowUploadsBeforeStart: {
    type: Boolean,
    default: false,
  },

  // Event metadata
  category: {
    type: String,
    default: 'General',
  },
  tags: [String],
  interests: [String],
  weatherDependent: {
    type: Boolean,
    default: false,
  },
  ageRestriction: {
    min: Number,
    max: Number
  },

  // Legacy fields for backward compatibility
  isPublic: {
    type: Boolean,
    default: true,
  },
  openToPublic: {
    type: Boolean,
    default: true,
  },

  // Group association
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  },

  // Geographic data
  geo: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },

  // User management
  bannedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// ENHANCED: PAYMENT-RELATED METHODS
// ============================================

/**
 * Check if this is a paid event
 * @returns {boolean} True if event requires payment
 */
EventSchema.methods.isPaidEvent = function() {
  return !this.pricing.isFree && this.pricing.amount > 0;
};

/**
 * Get current price (considering early bird pricing)
 * @returns {number} Current price in cents
 */
EventSchema.methods.getCurrentPrice = function() {
  if (this.pricing.isFree) return 0;
  
  // Check if early bird pricing is active
  if (this.pricing.earlyBirdPricing.enabled && 
      this.pricing.earlyBirdPricing.deadline && 
      new Date() < this.pricing.earlyBirdPricing.deadline) {
    return this.pricing.earlyBirdPricing.amount;
  }
  
  return this.pricing.amount;
};

/**
 * Get formatted price for display
 * @returns {string} Formatted price string
 */
EventSchema.methods.getFormattedPrice = function() {
  if (this.pricing.isFree) return 'Free';
  
  const currentPrice = this.getCurrentPrice();
  const dollarAmount = (currentPrice / 100).toFixed(2);
  
  return `${dollarAmount}`;
};

/**
 * Check if user already paid for this event
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user has successful payment
 */
EventSchema.methods.hasUserPaid = function(userId) {
  if (!userId) return false;
  
  return this.paymentHistory.some(payment => 
    payment.user && 
    String(payment.user) === String(userId) && 
    payment.status === 'succeeded'
  );
};

/**
 * Check if guest already paid
 * @param {string} guestPassId - Guest pass ID to check
 * @returns {boolean} True if guest has successful payment
 */
EventSchema.methods.hasGuestPaid = function(guestPassId) {
  if (!guestPassId) return false;
  
  return this.paymentHistory.some(payment => 
    payment.guestPass && 
    String(payment.guestPass) === String(guestPassId) && 
    payment.status === 'succeeded'
  );
};

/**
 * Add payment to history and update financials
 * @param {object} paymentData - Payment information
 * @returns {Promise} Save promise
 */
EventSchema.methods.addPayment = function(paymentData) {
  // Add to payment history
  this.paymentHistory.push({
    ...paymentData,
    processedAt: new Date()
  });
  
  // Update financial tracking
  if (paymentData.status === 'succeeded') {
    const amount = paymentData.amount;
    const provider = paymentData.provider || 'stripe';
    
    // Update totals
    this.financials.totalRevenue += amount;
    this.financials.totalPayments += 1;
    this.financials.netRevenue = this.financials.totalRevenue - this.financials.totalRefunded;
    this.financials.lastPaymentAt = new Date();
    this.financials.revenueUpdatedAt = new Date();
    
    // Update provider breakdown
    if (!this.financials.providerBreakdown) {
      this.financials.providerBreakdown = {
        stripe: { revenue: 0, payments: 0, fees: 0 },
        paypal: { revenue: 0, payments: 0, fees: 0 },
        manual: { revenue: 0, payments: 0 }
      };
    }
    
    if (this.financials.providerBreakdown[provider]) {
      this.financials.providerBreakdown[provider].revenue += amount;
      this.financials.providerBreakdown[provider].payments += 1;
    }
    
    // Calculate estimated fees
    let estimatedFee = 0;
    if (provider === 'stripe' || provider === 'paypal') {
      // Standard rate: 2.9% + 30¢
      estimatedFee = Math.round(amount * 0.029 + 30);
    }
    
    if (provider === 'stripe') {
      this.financials.stripeFeesTotal += estimatedFee;
    } else if (provider === 'paypal') {
      this.financials.paypalFeesTotal += estimatedFee;
    }
    
    this.financials.totalFees = this.financials.stripeFeesTotal + this.financials.paypalFeesTotal;
    this.financials.hostEarnings = this.financials.netRevenue - this.financials.totalFees;
  }
  
  return this.save();
};

/**
 * Process refund and update financials
 * @param {string} paymentId - Payment ID to refund
 * @param {number} refundAmount - Refund amount in cents
 * @param {string} reason - Refund reason
 * @param {string} refundId - Provider refund ID
 * @returns {Promise} Save promise
 */
EventSchema.methods.processRefund = function(paymentId, refundAmount, reason, refundId = null) {
  const payment = this.paymentHistory.id(paymentId);
  if (!payment) return Promise.reject(new Error('Payment not found'));
  
  const isPartialRefund = refundAmount < payment.amount;
  
  // Update payment record
  payment.status = isPartialRefund ? 'partially_refunded' : 'refunded';
  payment.refundedAt = new Date();
  payment.refundAmount = (payment.refundAmount || 0) + refundAmount;
  payment.refundReason = reason;
  if (refundId) payment.refundId = refundId;
  
  // Update financials
  this.financials.totalRefunded += refundAmount;
  this.financials.netRevenue = this.financials.totalRevenue - this.financials.totalRefunded;
  this.financials.hostEarnings = this.financials.netRevenue - this.financials.totalFees;
  this.financials.lastRefundAt = new Date();
  this.financials.revenueUpdatedAt = new Date();
  
  // Update provider breakdown
  const provider = payment.provider || 'stripe';
  if (this.financials.providerBreakdown?.[provider]) {
    this.financials.providerBreakdown[provider].revenue -= refundAmount;
  }
  
  return this.save();
};

/**
 * Get payment analytics for host dashboard
 * @returns {object} Payment analytics data
 */
EventSchema.methods.getPaymentAnalytics = function() {
  const analytics = {
    overview: {
      totalRevenue: this.financials.totalRevenue,
      totalRefunded: this.financials.totalRefunded,
      netRevenue: this.financials.netRevenue,
      hostEarnings: this.financials.hostEarnings,
      totalPayments: this.financials.totalPayments,
      currency: this.financials.currency
    },
    byProvider: this.financials.providerBreakdown || {},
    recentPayments: this.paymentHistory
      .filter(p => p.status === 'succeeded')
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
      .slice(0, 10),
    paymentMethods: {},
    timeline: []
  };
  
  // Calculate payment method breakdown
  this.paymentHistory.forEach(payment => {
    if (payment.status === 'succeeded') {
      const provider = payment.provider || 'stripe';
      if (!analytics.paymentMethods[provider]) {
        analytics.paymentMethods[provider] = { count: 0, revenue: 0 };
      }
      analytics.paymentMethods[provider].count++;
      analytics.paymentMethods[provider].revenue += payment.amount;
    }
  });
  
  return analytics;
};

/**
 * Check if user can get refund
 * @param {string} userId - User ID
 * @returns {object} Refund eligibility information
 */
EventSchema.methods.canUserGetRefund = function(userId) {
  const userPayment = this.paymentHistory.find(p => 
    p.user && String(p.user) === String(userId) && p.status === 'succeeded'
  );
  
  if (!userPayment) {
    return { eligible: false, reason: 'No payment found' };
  }
  
  if (userPayment.status === 'refunded') {
    return { eligible: false, reason: 'Already refunded' };
  }
  
  // Check refund policy
  switch (this.pricing.refundPolicy) {
    case 'no-refund':
      return { eligible: false, reason: 'No refund policy' };
    
    case 'full-refund':
      if (this.pricing.refundDeadline && new Date() > this.pricing.refundDeadline) {
        return { eligible: false, reason: 'Refund deadline passed' };
      }
      return { eligible: true, amount: userPayment.amount };
    
    case 'partial-refund':
      if (this.pricing.refundDeadline && new Date() > this.pricing.refundDeadline) {
        return { eligible: false, reason: 'Refund deadline passed' };
      }
      return { eligible: true, amount: Math.floor(userPayment.amount * 0.8) }; // 80% refund
    
    case 'custom':
      // Custom logic would go here
      return { eligible: true, amount: userPayment.amount, note: this.pricing.customRefundPolicy };
    
    default:
      return { eligible: false, reason: 'Unknown refund policy' };
  }
};

// ============================================
// PHASE 1: FORM AND CHECK-IN METHODS
// ============================================

/**
 * Check if event has a check-in form
 * @returns {boolean} True if event has a form
 */
EventSchema.methods.hasCheckInForm = function() {
  return !!(this.checkInForm && this.requiresFormForCheckIn);
};

/**
 * Get check-in form with questions
 * @returns {Promise} Form document or null
 */
EventSchema.methods.getCheckInForm = function() {
  if (!this.checkInForm) return Promise.resolve(null);
  
  return this.model('Form').findById(this.checkInForm);
};

/**
 * Check if user has submitted the check-in form
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user has submitted
 */
EventSchema.methods.hasUserSubmittedForm = async function(userId) {
  if (!this.checkInForm) return true; // No form = always considered submitted
  
  const FormSubmission = this.model('FormSubmission');
  return await FormSubmission.hasUserSubmitted(this.checkInForm, userId, this._id);
};

/**
 * Generate or refresh check-in QR code
 * @param {number} validityHours - How long the QR code should be valid (default 24 hours)
 * @returns {string} Generated QR code
 */
EventSchema.methods.generateCheckInQR = function(validityHours = 24) {
  const crypto = require('crypto');
  
  this.checkInQR = {
    isActive: true,
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + validityHours * 60 * 60 * 1000),
    code: crypto.randomBytes(16).toString('hex'),
    viewCount: 0
  };
  
  return this.save().then(() => this.checkInQR.code);
};

/**
 * Get check-in QR data for scanning
 * @returns {Object} QR data object
 */
EventSchema.methods.getCheckInQRData = function() {
  if (!this.checkInQR || !this.checkInQR.isActive) {
    return null;
  }
  
  // Check if QR code is expired
  if (this.checkInQR.expiresAt && new Date() > this.checkInQR.expiresAt) {
    return null;
  }
  
  return {
    type: 'event_checkin',
    eventId: this._id.toString(),
    qrCode: this.checkInQR.code,
    hasForm: this.hasCheckInForm(),
    formId: this.checkInForm ? this.checkInForm.toString() : null,
    generatedAt: this.checkInQR.generatedAt,
    expiresAt: this.checkInQR.expiresAt
  };
};

/**
 * Increment QR code view count
 */
EventSchema.methods.incrementQRViews = function() {
  if (this.checkInQR) {
    this.checkInQR.viewCount += 1;
    return this.save();
  }
  return Promise.resolve();
};

/**
 * Deactivate check-in QR code
 */
EventSchema.methods.deactivateCheckInQR = function() {
  if (this.checkInQR) {
    this.checkInQR.isActive = false;
    return this.save();
  }
  return Promise.resolve();
};

/**
 * Can user check in to this event?
 * @param {string} userId - User ID to check
 * @returns {Promise<Object>} Check-in eligibility info
 */
EventSchema.methods.canUserCheckIn = async function(userId) {
  const userIdStr = String(userId);
  
  // Check if user is already checked in
  const isCheckedIn = this.checkedIn.some(id => String(id) === userIdStr);
  if (isCheckedIn) {
    return {
      canCheckIn: false,
      reason: 'already_checked_in',
      message: 'User is already checked in'
    };
  }
  
  // Check if event has started (allow check-in 30 minutes before)
  const eventTime = new Date(this.time);
  const now = new Date();
  const thirtyMinutesBefore = new Date(eventTime.getTime() - 30 * 60 * 1000);
  
  if (now < thirtyMinutesBefore) {
    return {
      canCheckIn: false,
      reason: 'too_early',
      message: 'Check-in opens 30 minutes before event start'
    };
  }
  
  // Check if event has ended (allow check-in up to 2 hours after start)
  const twoHoursAfter = new Date(eventTime.getTime() + 2 * 60 * 60 * 1000);
  if (now > twoHoursAfter) {
    return {
      canCheckIn: false,
      reason: 'too_late',
      message: 'Check-in window has closed'
    };
  }
  
  // Check if form is required and not submitted
  if (this.requiresFormForCheckIn && this.checkInForm) {
    const hasSubmitted = await this.hasUserSubmittedForm(userId);
    if (!hasSubmitted) {
      return {
        canCheckIn: true,
        requiresForm: true,
        formId: this.checkInForm,
        message: 'User must complete form to check in'
      };
    }
  }
  
  return {
    canCheckIn: true,
    requiresForm: false,
    message: 'User can check in'
  };
};

/**
 * Check in a user (after form submission if required)
 * @param {string} userId - User ID to check in
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Check-in result
 */
EventSchema.methods.checkInUser = async function(userId, options = {}) {
  const { bypassFormCheck = false, checkedInBy } = options;
  
  // Verify user can check in
  if (!bypassFormCheck) {
    const eligibility = await this.canUserCheckIn(userId);
    if (!eligibility.canCheckIn) {
      throw new Error(eligibility.message);
    }
    
    if (eligibility.requiresForm) {
      throw new Error('User must complete form before checking in');
    }
  }
  
  // Add to checked in list if not already there
  const userIdStr = String(userId);
  const isAlreadyCheckedIn = this.checkedIn.some(id => String(id) === userIdStr);
  
  if (!isAlreadyCheckedIn) {
    this.checkedIn.push(userId);
    
    // Add to attendees if not already there
    const isAttendee = this.attendees.some(id => String(id) === userIdStr);
    if (!isAttendee) {
      this.attendees.push(userId);
    }
    
    await this.save();
  }
  
  return {
    success: true,
    wasAlreadyCheckedIn: isAlreadyCheckedIn,
    addedToAttendees: !isAlreadyCheckedIn && !this.attendees.some(id => String(id) === userIdStr),
    checkedInAt: new Date(),
    checkedInBy: checkedInBy || userId
  };
};

// ============================================
// PRIVACY AND PERMISSION METHODS
// ============================================

/**
 * Check if user can view this event
 * @param {string} userId - User ID to check
 * @param {Array} userFollowing - Array of user IDs that the user follows
 * @returns {boolean} True if user can view the event
 */
EventSchema.methods.canUserView = function(userId, userFollowing = []) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host);
  
  // Host can always view their own event
  if (userIdStr === hostIdStr) return true;
  
  // Co-hosts can view
  if (this.coHosts && this.coHosts.some(c => String(c) === userIdStr)) return true;
  
  // Check based on privacy level
  switch (this.privacyLevel) {
    case 'public':
      return this.permissions?.appearInSearch !== false;
    
    case 'friends':
      return userFollowing.includes(hostIdStr);
    
    case 'private':
      return this.invitedUsers?.includes(userId) || 
             this.attendees?.includes(userId);
    
    case 'secret':
      return this.invitedUsers?.includes(userId) || 
             this.attendees?.includes(userId);
    
    default:
      return false;
  }
};

/**
 * Check if user can join this event
 * @param {string} userId - User ID to check
 * @param {Array} userFollowing - Array of user IDs that the user follows
 * @returns {boolean} True if user can join the event
 */
EventSchema.methods.canUserJoin = function(userId, userFollowing = []) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host);
  
  // Host is already "attending" their own event
  if (userIdStr === hostIdStr) return false;
  
  // Can't join if already attending
  if (this.attendees && this.attendees.includes(userId)) return false;
  
  // Can't join if banned
  if (this.bannedUsers && this.bannedUsers.includes(userId)) return false;
  
  // Can't join if event has passed
  const eventEndTime = new Date(this.time).getTime() + (3 * 60 * 60 * 1000);
  if (Date.now() > eventEndTime) return false;
  
  // Check capacity
  if (this.attendees && this.maxAttendees && this.attendees.length >= this.maxAttendees) {
    return false;
  }
  
  // Check permissions based on privacy level and settings
  switch (this.permissions?.canJoin) {
    case 'anyone':
      return this.privacyLevel === 'public';
    
    case 'followers':
      return userFollowing.includes(hostIdStr);
    
    case 'friends':
      return userFollowing.includes(hostIdStr);
    
    case 'approval-required':
      return true; // Can request to join
    
    case 'invited-only':
      return this.invitedUsers?.includes(userId);
    
    default:
      return this.privacyLevel === 'public';
  }
};

/**
 * Check if user can invite others to this event
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user can invite others
 */
EventSchema.methods.canUserInvite = function(userId) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host);
  
  // Host can always invite
  if (userIdStr === hostIdStr) return true;
  
  // Co-hosts can invite
  if (this.coHosts && this.coHosts.some(c => String(c) === userIdStr)) return true;
  
  // Check permissions
  switch (this.permissions?.canInvite) {
    case 'anyone':
      return true;
    
    case 'attendees':
      return this.attendees?.includes(userId);
    
    case 'host-only':
      return false; // Already checked host above
    
    default:
      return this.attendees?.includes(userId);
  }
};

/**
 * Check if user can share this event
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user can share the event
 */
EventSchema.methods.canUserShare = function(userId) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host);
  
  // Host can always share
  if (userIdStr === hostIdStr) return true;
  
  // Co-hosts can share
  if (this.coHosts && this.coHosts.some(c => String(c) === userIdStr)) return true;
  
  // Secret events cannot be shared by non-hosts
  if (this.privacyLevel === 'secret') return false;
  
  // Check permissions
  switch (this.permissions?.canShare) {
    case 'anyone':
      return true;
    
    case 'attendees':
      return this.attendees?.includes(userId);
    
    case 'host-only':
      return false; // Already checked host above
    
    default:
      return this.attendees?.includes(userId);
  }
};

// ============================================
// LEGACY COMPATIBILITY METHODS
// ============================================

// Sync legacy price field with new pricing structure
EventSchema.pre('save', function(next) {
  // Sync legacy fields
  this.price = this.pricing.isFree ? 0 : (this.pricing.amount / 100);
  
  // Update financial timestamps
  if (this.isModified('paymentHistory') || this.isModified('financials')) {
    this.financials.revenueUpdatedAt = new Date();
  }
  
  next();
});

// Virtual for backward compatibility
EventSchema.virtual('isFree').get(function() {
  return this.pricing.isFree;
});

EventSchema.virtual('priceInDollars').get(function() {
  return this.pricing.amount / 100;
});

// ============================================
// PHASE 1: CHECK-IN STATS VIRTUAL
// ============================================
EventSchema.virtual('checkInStats').get(function() {
  return {
    totalAttendees: this.attendees ? this.attendees.length : 0,
    totalCheckedIn: this.checkedIn ? this.checkedIn.length : 0,
    checkInRate: this.attendees && this.attendees.length > 0 
      ? ((this.checkedIn ? this.checkedIn.length : 0) / this.attendees.length * 100).toFixed(1)
      : 0,
    hasForm: this.hasCheckInForm(),
    formSubmissions: this.formSubmissions ? this.formSubmissions.length : 0
  };
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
EventSchema.index({ time: 1 });
EventSchema.index({ host: 1 });
EventSchema.index({ 'pricing.amount': 1 });
EventSchema.index({ 'paymentHistory.user': 1 });
EventSchema.index({ 'paymentHistory.status': 1 });
EventSchema.index({ privacyLevel: 1 });
EventSchema.index({ geo: '2dsphere' });

// PHASE 1: New indexes for form system
EventSchema.index({ checkInForm: 1 });
EventSchema.index({ requiresFormForCheckIn: 1 });
EventSchema.index({ 'checkInQR.isActive': 1, 'checkInQR.expiresAt': 1 });

module.exports = mongoose.model('Event', EventSchema);