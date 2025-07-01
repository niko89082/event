// models/GuestPass.js - Enhanced with Multi-Provider Payment Support
const mongoose = require('mongoose');
const crypto = require('crypto');

const GuestPassSchema = new mongoose.Schema({
  // Core identification
  token: { 
    type: String, 
    unique: true, 
    required: true 
  }, // JWT token hash for security
  nonce: { 
    type: String, 
    required: true 
  }, // Prevents replay attacks
  
  // Event and guest information
  event: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Guest details
  guestName: { 
    type: String, 
    required: true 
  },
  guestEmail: { 
    type: String 
  },
  guestPhone: { 
    type: String 
  },
  
  // Status tracking
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'used', 'expired', 'cancelled'], 
    default: 'pending' 
  },
  
  // ============================================
  // ENHANCED: MULTI-PROVIDER PAYMENT INFORMATION
  // ============================================
  payment: {
    required: { 
      type: Boolean, 
      default: false 
    },
    amount: { 
      type: Number, 
      default: 0 
    },                    // Amount in cents
    currency: { 
      type: String, 
      default: 'USD' 
    },
    
    // Payment provider and method
    provider: { 
      type: String, 
      enum: ['stripe', 'paypal', 'manual'], 
      default: 'stripe' 
    },
    
    // Stripe payment fields
    stripePaymentIntentId: String,
    stripeClientSecret: String,
    stripeChargeId: String,
    
    // PayPal payment fields
    paypalOrderId: String,
    paypalCaptureId: String,
    paypalPayerId: String,
    paypalApprovalUrl: String,
    
    // Manual payment fields
    manualPaymentMethod: String,              // 'venmo', 'cashapp', 'zelle', etc.
    manualTransactionId: String,
    manualInstructions: String,
    manualConfirmed: { 
      type: Boolean, 
      default: false 
    },
    
    // Payment status and timing
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'expired'], 
      default: 'pending' 
    },
    attemptedAt: Date,                        // When payment was first attempted
    paidAt: Date,                             // When payment was completed
    expiresAt: Date,                          // When payment opportunity expires
    
    // Payment metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      paymentMethodType: String,              // 'card', 'paypal_account', etc.
      last4: String,                          // Last 4 digits of card
      brand: String,                          // Card brand or payment method
      country: String                         // Payment method country
    },
    
    // Refund information
    refunded: {
      amount: { type: Number, default: 0 },
      reason: String,
      refundId: String,                       // Provider-specific refund ID
      refundedAt: Date,
      refundedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
      }
    }
  },
  
  // Timing and expiry
  expiresAt: { 
    type: Date, 
    required: true 
  },
  confirmedAt: Date,
  usedAt: Date,
  scannedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
  // QR code data
  qrData: {
    code: String,                             // Rotating QR code for security
    generatedAt: Date,
    viewCount: { 
      type: Number, 
      default: 0 
    },
    lastViewedAt: Date
  },
  
  // Communication tracking
  invitationSent: {
    sentAt: Date,
    sentTo: String,                           // Email or phone number
    method: { 
      type: String, 
      enum: ['email', 'sms', 'link'], 
      default: 'link' 
    }
  },
  
  // Metadata and tracking
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String,
    source: String,                           // How the guest pass was created
    utm: {                                    // UTM tracking parameters
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String
    }
  },
  
  // Access control
  accessAttempts: [{
    attemptedAt: { 
      type: Date, 
      default: Date.now 
    },
    success: Boolean,
    ipAddress: String,
    userAgent: String,
    failureReason: String
  }],
  
  // Event-specific permissions
  permissions: {
    canUploadPhotos: { 
      type: Boolean, 
      default: true 
    },
    canViewAttendees: { 
      type: Boolean, 
      default: false 
    },
    canInviteOthers: { 
      type: Boolean, 
      default: false 
    }
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
GuestPassSchema.index({ token: 1 });
GuestPassSchema.index({ event: 1, status: 1 });
GuestPassSchema.index({ expiresAt: 1 });
GuestPassSchema.index({ 'qrData.code': 1 });
GuestPassSchema.index({ 'payment.paypalOrderId': 1 });
GuestPassSchema.index({ 'payment.stripePaymentIntentId': 1 });
GuestPassSchema.index({ 'payment.status': 1 });

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================
GuestPassSchema.pre('save', function(next) {
  // Generate nonce for new guest passes
  if (this.isNew && !this.nonce) {
    this.nonce = crypto.randomBytes(16).toString('hex');
  }
  
  // Auto-expire if past expiry date
  if (new Date() > this.expiresAt && this.status === 'pending') {
    this.status = 'expired';
  }
  
  // Set payment expiry if not set
  if (this.payment.required && !this.payment.expiresAt) {
    // Payment expires 1 hour before event or 24 hours from now, whichever is sooner
    const eventTime = this.event?.time || new Date();
    const oneHourBeforeEvent = new Date(eventTime.getTime() - (60 * 60 * 1000));
    const twentyFourHoursFromNow = new Date(Date.now() + (24 * 60 * 60 * 1000));
    
    this.payment.expiresAt = oneHourBeforeEvent < twentyFourHoursFromNow ? 
      oneHourBeforeEvent : twentyFourHoursFromNow;
  }
  
  // Update payment attempted timestamp
  if (this.isModified('payment.status') && 
      this.payment.status === 'processing' && 
      !this.payment.attemptedAt) {
    this.payment.attemptedAt = new Date();
  }
  
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Generate a new QR code for this guest pass
 * @returns {string} Generated QR code
 */
GuestPassSchema.methods.generateQRCode = function() {
  this.qrData.code = crypto.randomBytes(32).toString('hex');
  this.qrData.generatedAt = new Date();
  this.qrData.viewCount = 0;
  return this.qrData.code;
};

/**
 * Check if this guest pass is valid for entry
 * @returns {boolean} True if guest pass can be used for entry
 */
GuestPassSchema.methods.isValid = function() {
  return this.status === 'confirmed' && 
         new Date() < this.expiresAt && 
         !this.usedAt;
};

/**
 * Check if this guest pass has expired
 * @returns {boolean} True if guest pass has expired
 */
GuestPassSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt || this.status === 'expired';
};

/**
 * Mark guest pass as used at event
 * @param {string} scannedBy - User ID of person who scanned the pass
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.markAsUsed = function(scannedBy) {
  this.status = 'used';
  this.usedAt = new Date();
  this.scannedBy = scannedBy;
  return this.save();
};

/**
 * Record access attempt
 * @param {object} attemptData - Access attempt information
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.recordAccessAttempt = function(attemptData) {
  this.accessAttempts.push({
    success: attemptData.success || false,
    ipAddress: attemptData.ipAddress,
    userAgent: attemptData.userAgent,
    failureReason: attemptData.failureReason,
    attemptedAt: new Date()
  });
  
  // Update QR view count if successful
  if (attemptData.success && this.qrData.code) {
    this.qrData.viewCount += 1;
    this.qrData.lastViewedAt = new Date();
  }
  
  return this.save();
};

// ============================================
// PAYMENT-RELATED METHODS
// ============================================

/**
 * Check if payment is required for this guest pass
 * @returns {boolean} True if payment is required
 */
GuestPassSchema.methods.requiresPayment = function() {
  return this.payment.required && this.payment.amount > 0;
};

/**
 * Check if payment has been completed
 * @returns {boolean} True if payment is successful
 */
GuestPassSchema.methods.isPaymentComplete = function() {
  return this.payment.status === 'succeeded' && this.payment.paidAt;
};

/**
 * Check if payment has failed
 * @returns {boolean} True if payment has failed
 */
GuestPassSchema.methods.isPaymentFailed = function() {
  return ['failed', 'expired'].includes(this.payment.status);
};

/**
 * Get payment status summary
 * @returns {object} Payment status information
 */
GuestPassSchema.methods.getPaymentStatus = function() {
  if (!this.requiresPayment()) {
    return {
      required: false,
      status: 'not_required',
      message: 'No payment required'
    };
  }
  
  const status = {
    required: true,
    status: this.payment.status,
    amount: this.payment.amount,
    currency: this.payment.currency,
    provider: this.payment.provider,
    paidAt: this.payment.paidAt,
    expiresAt: this.payment.expiresAt
  };
  
  // Add status-specific information
  switch (this.payment.status) {
    case 'pending':
      status.message = 'Payment required to confirm attendance';
      status.canPay = new Date() < this.payment.expiresAt;
      break;
    case 'processing':
      status.message = 'Payment is being processed';
      status.canPay = false;
      break;
    case 'succeeded':
      status.message = 'Payment completed successfully';
      status.canPay = false;
      break;
    case 'failed':
      status.message = 'Payment failed - please try again';
      status.canPay = new Date() < this.payment.expiresAt;
      break;
    case 'expired':
      status.message = 'Payment deadline has passed';
      status.canPay = false;
      break;
    case 'refunded':
      status.message = 'Payment has been refunded';
      status.canPay = false;
      status.refundAmount = this.payment.refunded.amount;
      status.refundedAt = this.payment.refunded.refundedAt;
      break;
    default:
      status.message = 'Unknown payment status';
      status.canPay = false;
  }
  
  return status;
};

/**
 * Start PayPal payment process
 * @param {string} orderId - PayPal order ID
 * @param {string} approvalUrl - PayPal approval URL
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.startPayPalPayment = function(orderId, approvalUrl) {
  this.payment.provider = 'paypal';
  this.payment.paypalOrderId = orderId;
  this.payment.paypalApprovalUrl = approvalUrl;
  this.payment.status = 'processing';
  this.payment.attemptedAt = new Date();
  
  return this.save();
};

/**
 * Complete PayPal payment
 * @param {string} captureId - PayPal capture ID
 * @param {string} payerId - PayPal payer ID
 * @param {object} metadata - Additional payment metadata
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.completePayPalPayment = function(captureId, payerId, metadata = {}) {
  this.payment.paypalCaptureId = captureId;
  this.payment.paypalPayerId = payerId;
  this.payment.status = 'succeeded';
  this.payment.paidAt = new Date();
  this.payment.metadata = { ...this.payment.metadata, ...metadata };
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  
  return this.save();
};

/**
 * Start Stripe payment process
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {string} clientSecret - Stripe client secret
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.startStripePayment = function(paymentIntentId, clientSecret) {
  this.payment.provider = 'stripe';
  this.payment.stripePaymentIntentId = paymentIntentId;
  this.payment.stripeClientSecret = clientSecret;
  this.payment.status = 'processing';
  this.payment.attemptedAt = new Date();
  
  return this.save();
};

/**
 * Complete Stripe payment
 * @param {string} chargeId - Stripe charge ID
 * @param {object} metadata - Additional payment metadata
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.completeStripePayment = function(chargeId, metadata = {}) {
  this.payment.stripeChargeId = chargeId;
  this.payment.status = 'succeeded';
  this.payment.paidAt = new Date();
  this.payment.metadata = { ...this.payment.metadata, ...metadata };
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  
  return this.save();
};

/**
 * Mark payment as failed
 * @param {string} reason - Failure reason
 * @param {object} metadata - Additional failure metadata
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.failPayment = function(reason, metadata = {}) {
  this.payment.status = 'failed';
  this.payment.metadata = { 
    ...this.payment.metadata, 
    ...metadata,
    failureReason: reason,
    failedAt: new Date()
  };
  
  return this.save();
};

/**
 * Process refund for this guest pass
 * @param {number} refundAmount - Amount to refund in cents
 * @param {string} reason - Refund reason
 * @param {string} refundId - Provider refund ID
 * @param {string} refundedBy - User ID who processed the refund
 * @returns {Promise} Save promise
 */
GuestPassSchema.methods.processRefund = function(refundAmount, reason, refundId, refundedBy) {
  const isFullRefund = refundAmount >= this.payment.amount;
  
  this.payment.status = isFullRefund ? 'refunded' : 'succeeded';
  this.payment.refunded = {
    amount: refundAmount,
    reason: reason,
    refundId: refundId,
    refundedAt: new Date(),
    refundedBy: refundedBy
  };
  
  // If fully refunded, guest pass is no longer confirmed
  if (isFullRefund) {
    this.status = 'cancelled';
  }
  
  return this.save();
};

/**
 * Get formatted payment amount for display
 * @returns {string} Formatted amount
 */
GuestPassSchema.methods.getFormattedAmount = function() {
  if (!this.requiresPayment()) return 'Free';
  
  const dollarAmount = (this.payment.amount / 100).toFixed(2);
  return `${dollarAmount} ${this.payment.currency}`;
};

/**
 * Check if payment is about to expire
 * @param {number} warningMinutes - Minutes before expiry to warn (default 60)
 * @returns {boolean} True if payment expires soon
 */
GuestPassSchema.methods.isPaymentExpiringSoon = function(warningMinutes = 60) {
  if (!this.payment.expiresAt) return false;
  
  const warningTime = new Date(Date.now() + (warningMinutes * 60 * 1000));
  return this.payment.expiresAt <= warningTime;
};

/**
 * Get guest pass summary for notifications
 * @returns {object} Summary object
 */
GuestPassSchema.methods.getSummary = function() {
  return {
    id: this._id,
    guestName: this.guestName,
    guestEmail: this.guestEmail,
    status: this.status,
    requiresPayment: this.requiresPayment(),
    paymentStatus: this.payment.status,
    paymentAmount: this.getFormattedAmount(),
    isValid: this.isValid(),
    isExpired: this.isExpired(),
    expiresAt: this.expiresAt,
    qrCode: this.qrData.code,
    usedAt: this.usedAt
  };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find guest pass by token with validation
 * @param {string} token - JWT token
 * @param {string} nonce - Security nonce
 * @returns {Promise<GuestPass|null>} Guest pass or null
 */
GuestPassSchema.statics.findByToken = function(token, nonce) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({
    token: tokenHash,
    nonce: nonce,
    status: { $nin: ['expired', 'cancelled'] }
  }).populate('event');
};

/**
 * Find all guest passes for an event
 * @param {string} eventId - Event ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} Array of guest passes
 */
GuestPassSchema.statics.findByEvent = function(eventId, options = {}) {
  const query = { event: eventId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.paymentStatus) {
    query['payment.status'] = options.paymentStatus;
  }
  
  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 100);
};

/**
 * Get payment statistics for an event
 * @param {string} eventId - Event ID
 * @returns {Promise<object>} Payment statistics
 */
GuestPassSchema.statics.getPaymentStats = function(eventId) {
  return this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$payment.status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$payment.amount' }
      }
    }
  ]);
};

/**
 * Clean up expired guest passes
 * @param {number} daysOld - Remove passes older than this many days
 * @returns {Promise<object>} Cleanup result
 */
GuestPassSchema.statics.cleanupExpired = function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
  
  return this.deleteMany({
    status: 'expired',
    expiresAt: { $lt: cutoffDate }
  });
};

// ============================================
// VIRTUAL FIELDS
// ============================================

/**
 * Virtual field for payment deadline countdown
 */
GuestPassSchema.virtual('paymentTimeRemaining').get(function() {
  if (!this.payment.expiresAt) return null;
  
  const now = new Date();
  const expiry = this.payment.expiresAt;
  
  if (now > expiry) return 'Expired';
  
  const diff = expiry.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
});

/**
 * Virtual field for overall status
 */
GuestPassSchema.virtual('overallStatus').get(function() {
  if (this.isExpired()) return 'expired';
  if (this.status === 'used') return 'used';
  if (this.requiresPayment() && !this.isPaymentComplete()) return 'payment_pending';
  if (this.status === 'confirmed') return 'confirmed';
  return this.status;
});

module.exports = mongoose.model('GuestPass', GuestPassSchema);