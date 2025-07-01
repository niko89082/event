// models/User.js - Enhanced with Payment Accounts
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: false,
  },
  dateOfBirth: {
    type: Date,
    required: false,
  },
  shareCode: {
    type: String,
    unique: true,
    required: true,
  },
  isPublic: {
    type: Boolean,
    default: true,
  },
  profilePicture: {
    type: String,
    required: false,
  },
  backgroundImage: {
    type: String,
    required: false,
  },
  theme: {
    type: String,
    required: false,
  },
  colorScheme: {
    type: String,
    required: false,
  },
  bio: {
    type: String,
    required: false,
  },
  socialMediaLinks: {
    type: Map,
    of: String,
    required: false,
  },

  // ============================================
  // ENHANCED: PAYMENT ACCOUNTS FOR HOST EARNINGS
  // ============================================
  paymentAccounts: {
    // Primary payment method configuration
    primary: {
      type: { 
        type: String, 
        enum: ['stripe', 'paypal', 'manual'], 
        default: null 
      },
      isVerified: { 
        type: Boolean, 
        default: false 
      },
      canReceivePayments: { 
        type: Boolean, 
        default: false 
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },

    // Stripe Connect configuration
    stripe: {
      accountId: String,                    // Stripe Connect Express account ID
      onboardingComplete: { 
        type: Boolean, 
        default: false 
      },
      detailsSubmitted: { 
        type: Boolean, 
        default: false 
      },
      chargesEnabled: { 
        type: Boolean, 
        default: false 
      },
      payoutsEnabled: { 
        type: Boolean, 
        default: false 
      },
      accountLink: String,                  // Temporary onboarding link
      accountLinkExpiresAt: Date,
      requirements: {                       // Stripe requirements for completion
        currentlyDue: [String],
        eventuallyDue: [String],
        pastDue: [String],
        pendingVerification: [String]
      },
      createdAt: Date,
      lastUpdated: Date,
      country: { 
        type: String, 
        default: 'US' 
      }
    },

    // PayPal configuration (simplified)
    paypal: {
      email: String,                        // PayPal email for payments
      verified: { 
        type: Boolean, 
        default: false 
      },
      merchantId: String,                   // PayPal merchant ID (optional)
      connectedAt: Date,
      lastUsed: Date,
      country: {
        type: String,
        default: 'US'
      }
    },

    // Manual payment methods (Venmo, CashApp, etc.)
    manual: {
      venmoHandle: String,
      cashappHandle: String,
      zelleInfo: String,
      paypalMe: String,
      instructions: String,                 // Custom payment instructions
      enabled: {
        type: Boolean,
        default: false
      }
    }
  },

  // Payment history and earnings tracking
  earnings: {
    totalEarned: { 
      type: Number, 
      default: 0 
    },        // Lifetime earnings across all providers
    availableBalance: { 
      type: Number, 
      default: 0 
    },    // Available for payout
    pendingBalance: { 
      type: Number, 
      default: 0 
    },      // Pending settlements
    lastPayoutAt: Date,
    currency: { 
      type: String, 
      default: 'USD' 
    },
    
    // Provider-specific earnings breakdown
    byProvider: {
      stripe: {
        totalEarned: { type: Number, default: 0 },
        lastPayment: Date
      },
      paypal: {
        totalEarned: { type: Number, default: 0 },
        lastPayment: Date
      }
    }
  },

  // Social connections
  photos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
    },
  ],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  attendingEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  }],
  likedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  }],
  commentedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  }],
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  }],

  // Security and preferences
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorCode: {
    type: String,
    required: false,
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  interests: [{
    type: String,
    required: false,
  }],
  sharedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  }],
  followRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// ENHANCED: PAYMENT ACCOUNT METHODS
// ============================================

/**
 * Check if user can receive payments from any provider
 * @returns {boolean} True if user can receive payments
 */
UserSchema.methods.canReceivePayments = function() {
  const accounts = this.paymentAccounts || {};
  
  // Check PayPal
  if (accounts.paypal?.verified && accounts.paypal?.email) {
    return true;
  }
  
  // Check Stripe
  if (accounts.stripe?.chargesEnabled && accounts.stripe?.onboardingComplete) {
    return true;
  }
  
  // Check manual methods
  if (accounts.manual?.enabled && (
    accounts.manual?.venmoHandle || 
    accounts.manual?.cashappHandle || 
    accounts.manual?.instructions
  )) {
    return true;
  }
  
  return false;
};

/**
 * Get the primary payment method for this user
 * @returns {string|null} Primary payment method type
 */
UserSchema.methods.getPrimaryPaymentMethod = function() {
  const accounts = this.paymentAccounts || {};
  
  // Return explicitly set primary method if valid
  if (accounts.primary?.type && accounts.primary?.canReceivePayments) {
    return accounts.primary.type;
  }
  
  // Auto-detect primary method based on what's available
  if (accounts.paypal?.verified && accounts.paypal?.email) {
    return 'paypal';
  }
  
  if (accounts.stripe?.chargesEnabled && accounts.stripe?.onboardingComplete) {
    return 'stripe';
  }
  
  if (accounts.manual?.enabled) {
    return 'manual';
  }
  
  return null;
};

/**
 * Get payment account details for a specific provider
 * @param {string} provider - Provider type ('paypal', 'stripe', 'manual')
 * @returns {object|null} Account details or null if not configured
 */
UserSchema.methods.getPaymentAccount = function(provider) {
  const accounts = this.paymentAccounts || {};
  
  switch (provider) {
    case 'paypal':
      if (accounts.paypal?.verified && accounts.paypal?.email) {
        return {
          type: 'paypal',
          email: accounts.paypal.email,
          verified: accounts.paypal.verified,
          connectedAt: accounts.paypal.connectedAt
        };
      }
      break;
      
    case 'stripe':
      if (accounts.stripe?.chargesEnabled) {
        return {
          type: 'stripe',
          accountId: accounts.stripe.accountId,
          chargesEnabled: accounts.stripe.chargesEnabled,
          payoutsEnabled: accounts.stripe.payoutsEnabled,
          onboardingComplete: accounts.stripe.onboardingComplete
        };
      }
      break;
      
    case 'manual':
      if (accounts.manual?.enabled) {
        return {
          type: 'manual',
          venmoHandle: accounts.manual.venmoHandle,
          cashappHandle: accounts.manual.cashappHandle,
          instructions: accounts.manual.instructions
        };
      }
      break;
  }
  
  return null;
};

/**
 * Set up PayPal payment account
 * @param {string} email - PayPal email address
 * @returns {Promise<boolean>} Success status
 */
UserSchema.methods.setupPayPalAccount = function(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Valid PayPal email required');
  }
  
  if (!this.paymentAccounts) {
    this.paymentAccounts = {};
  }
  
  this.paymentAccounts.paypal = {
    email: email.toLowerCase().trim(),
    verified: true, // Simplified verification for now
    connectedAt: new Date(),
    country: 'US'
  };
  
  // Set as primary if no primary method exists
  if (!this.paymentAccounts.primary?.type) {
    this.paymentAccounts.primary = {
      type: 'paypal',
      isVerified: true,
      canReceivePayments: true,
      lastUpdated: new Date()
    };
  }
  
  return this.save();
};

/**
 * Update earnings after successful payment
 * @param {number} amount - Amount in cents
 * @param {string} provider - Payment provider ('paypal', 'stripe')
 * @param {string} currency - Currency code
 * @returns {Promise} Save promise
 */
UserSchema.methods.addEarnings = function(amount, provider = 'stripe', currency = 'USD') {
  if (!this.earnings) {
    this.earnings = {
      totalEarned: 0,
      availableBalance: 0,
      pendingBalance: 0,
      currency: currency,
      byProvider: {
        stripe: { totalEarned: 0 },
        paypal: { totalEarned: 0 }
      }
    };
  }
  
  // Update total earnings
  this.earnings.totalEarned += amount;
  this.earnings.pendingBalance += amount; // Will move to available after settlement
  
  // Update provider-specific earnings
  if (!this.earnings.byProvider) {
    this.earnings.byProvider = {
      stripe: { totalEarned: 0 },
      paypal: { totalEarned: 0 }
    };
  }
  
  if (this.earnings.byProvider[provider]) {
    this.earnings.byProvider[provider].totalEarned += amount;
    this.earnings.byProvider[provider].lastPayment = new Date();
  }
  
  return this.save();
};

/**
 * Get payment status summary
 * @returns {object} Payment status information
 */
UserSchema.methods.getPaymentStatus = function() {
  const accounts = this.paymentAccounts || {};
  
  return {
    canReceivePayments: this.canReceivePayments(),
    primaryMethod: this.getPrimaryPaymentMethod(),
    availableMethods: {
      paypal: !!(accounts.paypal?.verified && accounts.paypal?.email),
      stripe: !!(accounts.stripe?.chargesEnabled && accounts.stripe?.onboardingComplete),
      manual: !!(accounts.manual?.enabled)
    },
    earnings: {
      total: this.earnings?.totalEarned || 0,
      available: this.earnings?.availableBalance || 0,
      pending: this.earnings?.pendingBalance || 0,
      currency: this.earnings?.currency || 'USD'
    }
  };
};

/**
 * Check if user needs to complete payment setup
 * @returns {boolean} True if setup is needed
 */
UserSchema.methods.needsPaymentSetup = function() {
  return !this.canReceivePayments();
};

/**
 * Get payment setup recommendations for user
 * @returns {Array} Array of recommended setup options
 */
UserSchema.methods.getPaymentSetupRecommendations = function() {
  const recommendations = [];
  
  const accounts = this.paymentAccounts || {};
  
  // Recommend PayPal if not set up
  if (!accounts.paypal?.verified) {
    recommendations.push({
      type: 'paypal',
      priority: 1,
      title: 'Quick PayPal Setup',
      description: 'Connect your PayPal email to start accepting payments in 1 minute',
      estimatedTime: '1 minute',
      difficulty: 'Easy'
    });
  }
  
  // Recommend Stripe for advanced users
  if (!accounts.stripe?.chargesEnabled) {
    recommendations.push({
      type: 'stripe',
      priority: 2,
      title: 'Professional Stripe Setup',
      description: 'Advanced payment processing with detailed analytics',
      estimatedTime: '5-10 minutes',
      difficulty: 'Moderate'
    });
  }
  
  return recommendations.sort((a, b) => a.priority - b.priority);
};

// ============================================
// SCHEMA MIDDLEWARE AND VALIDATION
// ============================================

// Generate unique share code before saving
UserSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  // Generate share code if new user
  if (this.isNew && !this.shareCode) {
    let shareCode;
    let isUnique = false;
    
    while (!isUnique) {
      shareCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const existingUser = await this.constructor.findOne({ shareCode });
      if (!existingUser) {
        isUnique = true;
      }
    }
    
    this.shareCode = shareCode;
  }
  
  // Update payment accounts timestamp
  if (this.isModified('paymentAccounts') && this.paymentAccounts?.primary) {
    this.paymentAccounts.primary.lastUpdated = new Date();
  }

  next();
});

// Password comparison method
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for full name (if you add firstName/lastName later)
UserSchema.virtual('fullName').get(function() {
  return this.firstName && this.lastName ? `${this.firstName} ${this.lastName}` : this.username;
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ shareCode: 1 });
UserSchema.index({ 'paymentAccounts.paypal.email': 1 });
UserSchema.index({ 'paymentAccounts.stripe.accountId': 1 });

module.exports = mongoose.model('User', UserSchema);