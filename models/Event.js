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
  endTime: {
    type: Date,
    required: false,  // Optional field
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
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  permissions: {
    canView: {
      type: String,
      enum: ['anyone', 'followers', 'invited-only'],
      default: 'anyone'
    },
    canJoin: {
      type: String,
      enum: ['anyone', 'followers', 'approval-required', 'invited-only'],
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
 * Get event status considering end time
 * @returns {string} 'upcoming', 'live', or 'ended'
 */
EventSchema.methods.getEventStatus = function() {
  const now = new Date();
  const startTime = new Date(this.time);
  
  if (now < startTime) return 'upcoming';
  
  // Use endTime if available, otherwise default to 2 hours
  const endTime = this.endTime 
    ? new Date(this.endTime) 
    : new Date(startTime.getTime() + (2 * 60 * 60 * 1000));
  
  if (now >= startTime && now < endTime) return 'live';
  return 'ended';
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
  
  // Check if event has ended (allow check-in until end time + 30 min buffer)
  const endTime = this.endTime 
    ? new Date(this.endTime) 
    : new Date(eventTime.getTime() + 2 * 60 * 60 * 1000);
  
  const thirtyMinutesAfterEnd = new Date(endTime.getTime() + 30 * 60 * 1000);
  if (now > thirtyMinutesAfterEnd) {
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
EventSchema.methods.checkInUser = function(userId, options = {}) {
  const {
    bypassTimeCheck = false,
    bypassFormCheck = false
  } = options;

  // Basic validation
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Check if user is attending
  const isAttending = this.attendees.some(attendee => 
    String(attendee._id || attendee) === String(userId)
  );
  
  if (!isAttending) {
    throw new Error('User is not registered for this event');
  }

  // Check if already checked in
  const isAlreadyCheckedIn = this.checkedIn.some(checkedUser => 
    String(checkedUser._id || checkedUser) === String(userId)
  );
  
  if (isAlreadyCheckedIn) {
    throw new Error('User is already checked in');
  }

  // Time-based check-in validation (can be bypassed by hosts)
  if (!bypassTimeCheck && this.checkInWindow) {
    const now = new Date();
    const eventTime = new Date(this.time);
    
    // Check if check-in window is defined
    if (this.checkInWindow.openMinutesBefore) {
      const checkInOpenTime = new Date(eventTime.getTime() - (this.checkInWindow.openMinutesBefore * 60 * 1000));
      if (now < checkInOpenTime) {
        throw new Error(`Check-in opens ${this.checkInWindow.openMinutesBefore} minutes before event start`);
      }
    }
    
    if (this.checkInWindow.closeMinutesAfter) {
      const checkInCloseTime = new Date(eventTime.getTime() + (this.checkInWindow.closeMinutesAfter * 60 * 1000));
      if (now > checkInCloseTime) {
        throw new Error(`Check-in closed ${this.checkInWindow.closeMinutesAfter} minutes after event start`);
      }
    }
  }

  // Form requirement check (can be bypassed)
  if (!bypassFormCheck && this.requiresFormForCheckIn && this.checkInForm) {
    // Note: Form validation should be handled at route level for async operations
    // This is just a reminder that form validation is needed
  }

  // Perform check-in
  this.checkedIn.push(userId);
  
  // Record check-in details
  const checkInResult = {
    userId: userId,
    checkedInAt: new Date(),
    bypassedTimeCheck: bypassTimeCheck,
    bypassedFormCheck: bypassFormCheck
  };

  console.log(`✅ User ${userId} checked in to event ${this._id}`, checkInResult);
  
  return checkInResult;
};
/**
 * Check if user can join this event
 * @param {string} userId - User ID to check
 * @param {Array} userFollowing - Array of user IDs that the user follows
 * @returns {Promise<boolean>} True if user can join the event
 */
EventSchema.methods.canUserJoin = function(userId, userFollowing = []) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  
  // Host doesn't need to join their own event
  if (userIdStr === hostIdStr) return false;
  
  // Already attending
  if (this.attendees && this.attendees.some(a => String(a._id || a) === userIdStr)) return false;
  
  // Event capacity check
  if (this.attendees && this.maxAttendees && this.attendees.length >= this.maxAttendees) {
    return false;
  }
  
  // Past events can't be joined
  if (new Date(this.time) <= new Date()) {
    return false;
  }

  const isInvited = this.invitedUsers && this.invitedUsers.some(u => 
    String(u._id || u) === userIdStr
  );
  const isFollowingHost = userFollowing.includes(hostIdStr);

  // ✅ PHASE 1: Fixed privacy level checks (removed secret)
  switch (this.privacyLevel) {
    case 'public':
      // Check canJoin permission for public events
      switch (this.permissions?.canJoin) {
        case 'anyone':
          return true;
        case 'followers':
          return isFollowingHost;
        case 'approval-required':
          return true; // Can request approval
        case 'invited-only':
          return isInvited;
        default:
          return true;
      }
    
    case 'friends':
      // Friends-only events require following the host
      return isFollowingHost;
    
    case 'private':
      // Private events visible to:
      // 1. Invited users (even if they haven't responded)
      // 2. Attendees (users who accepted)
      // 3. Host and co-hosts (already handled above)
      
      console.log(`🔍 Private event access check for user ${userIdStr}:`);
      console.log(`- Is invited: ${isInvited}`);
      console.log(`- Is attending: ${this.attendees && this.attendees.some(a => String(a._id || a) === userIdStr)}`);
      
      // Allow access if user is invited OR attending
      const hasAccess = isInvited || (this.attendees && this.attendees.some(a => String(a._id || a) === userIdStr));
      
      if (hasAccess) {
        console.log(`✅ ALLOWED: Private event access granted`);
      } else {
        console.log(`❌ DENIED: Private event access denied`);
      }
      
      return hasAccess;
    default:
      return false;
  }
};

EventSchema.methods.canUserViewEventPhotos = function(userId, userFriends = [], userEventAttendance = []) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  const eventIdStr = String(this._id);
  
  // Host can always see photos from their events
  if (userIdStr === hostIdStr) return true;
  
  // ✅ CRITICAL: If user attended this event, they can see ALL photos from this event
  if (userEventAttendance.includes(eventIdStr)) {
    return true;
  }
  
  // Check based on event privacy level
  switch (this.privacyLevel) {
    case 'public':
      return true; // Public event photos are visible to everyone
    
    case 'friends':
      // Friends-only event photos visible to friends only
      return userFriends.includes(hostIdStr);
    
    case 'private':
      // Private event photos only visible to attendees (covered above)
      return false;
    
    default:
      return false;
  }
};


/**
 * FIXED: Check if user can view this event (remove duplicate)
 * @param {string} userId - User ID to check
 * @param {Array} userFollowing - Array of user IDs that the user follows
 * @returns {boolean} True if user can view the event
 */
EventSchema.methods.canUserView = function(userId, userFollowing = [], guestPassCode = null) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  
  // Host can always view their own events
  if (userIdStr === hostIdStr) return true;
  
  // Co-hosts can view
  if (this.coHosts && this.coHosts.some(c => String(c._id || c) === userIdStr)) return true;
  
  // Attendees can always view
  if (this.attendees && this.attendees.some(a => String(a._id || a) === userIdStr)) return true;
  
  // Guest pass access
  if (guestPassCode) {
    // TODO: Validate guest pass code
    return true;
  }
  
  // Check if user is invited (for private events)
  const isInvited = this.invitedUsers && this.invitedUsers.some(u => 
    String(u._id || u) === userIdStr
  );
  const isFollowingHost = userFollowing.includes(hostIdStr);

  // ✅ PHASE 1: Fixed privacy level checks (removed secret)
  switch (this.privacyLevel) {
    case 'public':
      // Public events visible to everyone (respecting canView permission)
      switch (this.permissions?.canView) {
        case 'anyone':
          return true;
        case 'followers':
          return isFollowingHost;
        case 'invited-only':
          return isInvited;
        default:
          return true;
      }
    
    case 'friends':
      // Friends-only events visible to followers
      return isFollowingHost;
    
    case 'private':
      // Private events visible only to invited users
      return isInvited;
    
    default:
      return false;
  }
};


/**
 * Check if user can manage this event (edit, delete, etc.)
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user can manage the event
 */
EventSchema.methods.canUserManage = function(userId) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  
  // Host can always manage
  if (userIdStr === hostIdStr) return true;
  
  // Co-hosts can manage
  if (this.coHosts && this.coHosts.some(c => String(c._id || c) === userIdStr)) return true;
  
  return false;
};
EventSchema.methods.canAppearInUserFeed = function(userId, userFriends = []) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  
  // Host can always see their own events in feed
  if (userIdStr === hostIdStr) return true;
  
  // Co-hosts can see in feed
  if (this.coHosts && this.coHosts.some(c => String(c._id || c) === userIdStr)) return true;
  
  // ✅ PHASE 3: Updated for friends system
  switch (this.privacyLevel) {
    case 'public':
      return this.permissions?.appearInFeed !== false;
    
    case 'friends':
      // ✅ FIXED: Only appears in FRIENDS' feeds (not followers)
      return userFriends.includes(hostIdStr) && this.permissions?.appearInFeed !== false;
    
    case 'private':
      // Private events don't appear in general feeds
      return false;
    
    default:
      return false;
  }
};

EventSchema.methods.getUserPermissions = function(userId, userFriends = [], userEventAttendance = []) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  const eventIdStr = String(this._id);
  
  const isHost = userIdStr === hostIdStr;
  const isCoHost = this.coHosts && this.coHosts.some(c => String(c._id || c) === userIdStr);
  const isAttendee = this.attendees && this.attendees.some(a => String(a._id || a) === userIdStr);
  const isFriend = userFriends.includes(hostIdStr);
  const hasAttendedEvent = userEventAttendance.includes(eventIdStr);
  
  return {
    canView: this.canUserView(userId, userFriends),
    canJoin: this.canUserJoin(userId, userFriends),
    canManage: isHost || isCoHost,
    canInvite: this.canUserInvite(userId),
    canViewPhotos: this.canUserViewEventPhotos(userId, userFriends, userEventAttendance),
    canSeeAttendees: isHost || isAttendee || (this.permissions?.showAttendeesToPublic && this.privacyLevel === 'public'),
    context: {
      isHost,
      isCoHost, 
      isAttendee,
      isFriend,
      hasAttendedEvent,
      privacyLevel: this.privacyLevel
    }
  };
};

EventSchema.methods.canAppearInSearch = function(userId, userFriends = []) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  
  // Host can always find their own events
  if (userIdStr === hostIdStr) return true;
  
  // ✅ PHASE 3: Updated for friends system
  switch (this.privacyLevel) {
    case 'public':
      return this.permissions?.appearInSearch !== false;
    
    case 'friends':
      // ✅ FIXED: Only searchable by FRIENDS (not followers)
      return userFriends.includes(hostIdStr) && this.permissions?.appearInSearch !== false;
    
    case 'private':
      // Private events don't appear in search
      return false;
    
    default:
      return false;
  }
};
/**
 * Get join requirement type for user
 * @param {string} userId - User ID to check
 * @param {Array} userFollowing - Array of user IDs that the user follows
 * @returns {Promise<string>} 'direct', 'approval-required', 'payment-required', 'not-allowed'
 */
EventSchema.methods.getJoinRequirementForUser = async function(userId, userFollowing = []) {
  const canJoin = await this.canUserJoin(userId, userFollowing);
  
  if (!canJoin) {
    return 'not-allowed';
  }
  
  // Check if approval is required
  if (this.permissions?.canJoin === 'approval-required') {
    return 'approval-required';
  }
  
  // Check if payment is required
  if (this.isPaidEvent() && !this.hasUserPaid(userId)) {
    return 'payment-required';
  }
  
  return 'direct';
};

/**
 * Check if user has pending join request
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user has pending request
 */
EventSchema.methods.hasUserPendingJoinRequest = function(userId) {
  return this.joinRequests && this.joinRequests.some(request => 
    String(request.user) === String(userId) && request.status === 'pending'
  );
};

/**
 * Check if user can invite others to this event
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user can invite others
 */
EventSchema.methods.canUserInvite = function(userId) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  
  console.log(`🔍 canUserInvite check:`, {
    userId: userIdStr,
    hostId: hostIdStr,
    isHost: userIdStr === hostIdStr,
    privacyLevel: this.privacyLevel,
    coHosts: this.coHosts
  });
  
  // Host can always invite
  if (userIdStr === hostIdStr) {
    console.log(`✅ Host can invite`);
    return true;
  }
  
  // Co-hosts can always invite
  if (this.coHosts && this.coHosts.some(c => String(c._id || c) === userIdStr)) {
    console.log(`✅ Co-host can invite`);
    return true;
  }
  
  // Check privacy level rules
  switch (this.privacyLevel) {
    case 'public':
      // Public events: Anyone can invite (even if not attending)
      console.log(`✅ Public event - anyone can invite`);
      return true;
    
    case 'friends':
      // Friends events: Only host and co-hosts can invite
      console.log(`❌ Friends event - only host/co-hosts can invite`);
      return false;
    
    case 'private':
      // Private events: Only host and co-hosts can invite
      console.log(`❌ Private event - only host/co-hosts can invite`);
      return false;
    
    default:
      // Default to public behavior for backward compatibility
      console.log(`✅ Default - allowing invite`);
      return true;
  }
};

/**
 * Check if user can share this event
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user can share the event
 */
EventSchema.methods.canUserShare = function(userId) {
  const userIdStr = String(userId);
  const hostIdStr = String(this.host._id || this.host);
  
  // Host can always share
  if (userIdStr === hostIdStr) return true;
  
  // Co-hosts can always share
  if (this.coHosts && this.coHosts.some(c => String(c._id || c) === userIdStr)) return true;
  
  // Attendees can share
  if (this.attendees && this.attendees.some(a => String(a._id || a) === userIdStr)) return true;
  
  // For public events, anyone can share
  if (this.privacyLevel === 'public') return true;
  
  // For private/friends events, only involved users can share
  return false;
};

EventSchema.methods.declineInvitation = function(userId) {
  const userIdStr = String(userId);
  
  // Remove from attendees if they were attending
  if (this.attendees) {
    this.attendees = this.attendees.filter(a => String(a._id || a) !== userIdStr);
  }
  
  // Keep in invitedUsers but mark as declined in a separate field
  if (!this.declinedUsers) {
    this.declinedUsers = [];
  }
  
  if (!this.declinedUsers.includes(userId)) {
    this.declinedUsers.push(userId);
  }
  
  // Note: We DON'T remove from invitedUsers so they can still view the event
  console.log(`📝 User ${userIdStr} declined invitation but retains view access`);
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



EventSchema.methods.getCheckInStatus = function() {
  const now = new Date();
  const eventTime = new Date(this.time);
  
  if (!this.checkInWindow) {
    return {
      isOpen: true,
      message: 'Check-in is always available',
      canCheckIn: true
    };
  }

  // Calculate window times
  const openTime = this.checkInWindow.openMinutesBefore 
    ? new Date(eventTime.getTime() - (this.checkInWindow.openMinutesBefore * 60 * 1000))
    : null;
    
  const closeTime = this.checkInWindow.closeMinutesAfter
    ? new Date(eventTime.getTime() + (this.checkInWindow.closeMinutesAfter * 60 * 1000))
    : null;

  // Check current status
  if (openTime && now < openTime) {
    const minutesUntilOpen = Math.ceil((openTime - now) / (1000 * 60));
    return {
      isOpen: false,
      message: `Check-in opens in ${minutesUntilOpen} minutes`,
      canCheckIn: false,
      opensAt: openTime
    };
  }

  if (closeTime && now > closeTime) {
    const minutesSinceClosed = Math.ceil((now - closeTime) / (1000 * 60));
    return {
      isOpen: false,
      message: `Check-in closed ${minutesSinceClosed} minutes ago`,
      canCheckIn: false,
      closedAt: closeTime
    };
  }

  return {
    isOpen: true,
    message: 'Check-in is currently open',
    canCheckIn: true,
    opensAt: openTime,
    closesAt: closeTime
  };
};
EventSchema.methods.getShareButtonText = function(userId) {
  const canShare = this.canUserShare(userId);
  
  if (!canShare) {
    return 'Join to Share';
  }
  
  switch (this.privacyLevel) {
    case 'public':
      return 'Share Event';
    case 'friends':
      return 'Share to Friends';
    case 'private':
      return 'Share Privately';
    default:
      return 'Share';
  }
};
EventSchema.methods.getInvitationInfo = function(userId) {
  const canInvite = this.canUserInvite(userId);
  const canShare = this.canUserShare(userId);
  const userIdStr = String(userId);
  const hostIdStr = String(this.host);
  const isHost = userIdStr === hostIdStr;
  const isCoHost = this.coHosts && this.coHosts.some(c => String(c) === userIdStr);
  const isAttendee = this.attendees?.includes(userId) || false;

  let inviteReason = '';
  let shareReason = '';
  
  // Determine why user can/cannot invite
  if (!canInvite) {
    switch (this.privacyLevel) {
      case 'friends':
        inviteReason = 'Only the host and co-hosts can invite friends to this event';
        break;
      case 'private':
        inviteReason = 'Only the host and co-hosts can send private invitations';
        break;
      default:
        inviteReason = 'You do not have permission to invite others';
    }
  } else {
    if (isHost) {
      inviteReason = 'You can invite anyone as the event host';
    } else if (isCoHost) {
      inviteReason = 'You can invite others as a co-host';
    } else if (this.privacyLevel === 'public') {
      inviteReason = 'Anyone can invite friends to public events';
    }
  }

  // Determine why user can/cannot share
  if (!canShare) {
    shareReason = 'You need to be attending this event to share it';
  } else {
    if (isHost || isCoHost) {
      shareReason = 'You can share this event';
    } else if (this.privacyLevel === 'public') {
      shareReason = 'Anyone can share public events';
    } else if (isAttendee) {
      shareReason = 'You can share this event as an attendee';
    }
  }

  return {
    canInvite,
    canShare,
    isHost,
    isCoHost,
    isAttendee,
    privacyLevel: this.privacyLevel,
    inviteReason,
    shareReason,
    inviteButtonText: this.getInviteButtonText(userId),
    shareButtonText: this.getShareButtonText(userId)
  };
};


EventSchema.methods.getInviteButtonText = function(userId) {
  const canInvite = this.canUserInvite(userId);
  
  if (!canInvite) {
    return 'Share Event';
  }
  
  switch (this.privacyLevel) {
    case 'public':
      return 'Invite & Share';
    case 'friends':
      return 'Invite Friends';
    case 'private':
      return 'Send Invitations';
    default:
      return 'Invite';
  }
};

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

// Text search index for search functionality
EventSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text', 
  category: 'text' 
});

module.exports = mongoose.model('Event', EventSchema);