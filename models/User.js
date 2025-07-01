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
  // NEW: PAYMENT ACCOUNTS FOR HOST EARNINGS
  // ============================================
  paymentAccounts: {
    stripe: {
      accountId: String,                    // Stripe Connect Express account ID
      onboardingComplete: { type: Boolean, default: false },
      detailsSubmitted: { type: Boolean, default: false },
      chargesEnabled: { type: Boolean, default: false },
      payoutsEnabled: { type: Boolean, default: false },
      accountLink: String,                  // Temporary onboarding link
      accountLinkExpiresAt: Date,
      createdAt: Date,
      lastUpdated: Date
    },
    paypal: {
      email: String,                        // PayPal email for simple transfers
      verified: { type: Boolean, default: false },
      connectedAt: Date
    }
  },

  // Payment history and earnings
  earnings: {
    totalEarned: { type: Number, default: 0 },        // Lifetime earnings
    availableBalance: { type: Number, default: 0 },    // Available for payout
    pendingBalance: { type: Number, default: 0 },      // Pending settlements
    lastPayoutAt: Date,
    currency: { type: String, default: 'USD' }
  },

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
}, { timestamps: true });

// ============================================
// NEW: PAYMENT ACCOUNT METHODS
// ============================================

// Check if user can receive payments
UserSchema.methods.canReceivePayments = function() {
  return this.paymentAccounts?.stripe?.chargesEnabled || 
         this.paymentAccounts?.paypal?.verified;
};

// Get primary payment method
UserSchema.methods.getPrimaryPaymentMethod = function() {
  if (this.paymentAccounts?.stripe?.chargesEnabled) {
    return 'stripe';
  }
  if (this.paymentAccounts?.paypal?.verified) {
    return 'paypal';
  }
  return null;
};

// Update earnings after successful payment
UserSchema.methods.addEarnings = function(amount, currency = 'USD') {
  if (!this.earnings) {
    this.earnings = {
      totalEarned: 0,
      availableBalance: 0,
      pendingBalance: 0,
      currency: currency
    };
  }
  
  this.earnings.totalEarned += amount;
  this.earnings.pendingBalance += amount; // Will move to available after settlement
  return this.save();
};

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

  next();
});

// Password comparison method
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);