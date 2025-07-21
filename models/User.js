// models/User.js - PHASE 1: Enhanced with Friends System + Payment Accounts
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
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
    maxlength: 200,
  },
  socialMediaLinks: {
    type: Map,
    of: String,
    required: false,
  },

  // ✅ NEW: Friends System (replaces followers/following)
  friends: [{
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'blocked'], 
      default: 'pending' 
    },
    initiatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    acceptedAt: Date,
    requestMessage: String,
    mutualFriends: Number
  }],

  // ✅ DEPRECATED: Keep temporarily for migration - will be removed in Phase 5
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  followRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // ✅ NEW: Enhanced Privacy Settings for Friends System
  privacy: {
    friendRequests: {
      type: String,
      enum: ['everyone', 'friends-of-friends', 'no-one'],
      default: 'everyone'
    },
    friendsList: {
      type: String,
      enum: ['everyone', 'friends', 'only-me'],
      default: 'friends'
    },
    posts: {
      type: String,
      enum: ['public', 'friends', 'only-me'],
      default: 'public'
    },
    eventAttendance: {
      type: String,
      enum: ['public', 'friends', 'only-me'],
      default: 'friends'
    },
    allowSuggestions: {
      type: Boolean,
      default: true
    }
  },

  // ============================================
  // ENHANCED: PAYMENT ACCOUNTS FOR HOST EARNINGS
  // ============================================
  paymentAccounts: {
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

    stripe: {
      accountId: String,
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
      accountLink: String,
      accountLinkExpiresAt: Date,
      requirements: {
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

    paypal: {
      email: String,
      verified: { 
        type: Boolean, 
        default: false 
      },
      merchantId: String,
      connectedAt: Date,
      lastUsed: Date,
      country: {
        type: String,
        default: 'US'
      }
    },

    manual: {
      venmoHandle: String,
      cashappHandle: String,
      zelleInfo: String,
      paypalMe: String,
      instructions: String,
      enabled: {
        type: Boolean,
        default: false
      }
    }
  },

  earnings: {
    totalEarned: { 
      type: Number, 
      default: 0 
    },
    availableBalance: { 
      type: Number, 
      default: 0 
    },
    pendingBalance: { 
      type: Number, 
      default: 0 
    },
    lastPayoutAt: Date,
    currency: { 
      type: String, 
      default: 'USD' 
    },
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
  photos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo',
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
  sharedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
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
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  // ✅ NEW: Migration tracking
  migratedToFriendsAt: Date,
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// ✅ NEW: FRIENDS SYSTEM METHODS
// ============================================

/**
 * Get all accepted friends for this user
 * @returns {Array} Array of friend user IDs
 */
UserSchema.methods.getAcceptedFriends = function() {
  return this.friends
    .filter(f => f.status === 'accepted')
    .map(f => f.user);
};

/**
 * Get pending friend requests sent TO this user
 * @returns {Array} Array of friend request objects
 */
UserSchema.methods.getPendingRequests = function() {
  return this.friends.filter(f => 
    f.status === 'pending' && 
    String(f.initiatedBy) !== String(this._id)
  );
};

/**
 * Get pending friend requests sent BY this user
 * @returns {Array} Array of friend request objects  
 */
UserSchema.methods.getSentRequests = function() {
  return this.friends.filter(f => 
    f.status === 'pending' && 
    String(f.initiatedBy) === String(this._id)
  );
};

/**
 * Check if two users are friends
 * @param {string} userId - User ID to check friendship with
 * @returns {Object} Friendship status and details
 */
UserSchema.methods.getFriendshipStatus = function(userId) {
  const userIdStr = String(userId);
  const friendship = this.friends.find(f => 
    String(f.user) === userIdStr
  );
  
  if (!friendship) {
    return { status: 'not-friends', friendship: null };
  }
  
  if (friendship.status === 'accepted') {
    return { status: 'friends', friendship };
  }
  
  if (friendship.status === 'pending') {
    const initiatedByMe = String(friendship.initiatedBy) === String(this._id);
    return { 
      status: initiatedByMe ? 'request-sent' : 'request-received', 
      friendship 
    };
  }
  
  if (friendship.status === 'blocked') {
    return { status: 'blocked', friendship };
  }
  
  return { status: 'not-friends', friendship: null };
};

/**
 * Send friend request to another user
 * @param {string} userId - User ID to send request to
 * @param {string} message - Optional message with request
 * @returns {Promise<Object>} Result of friend request
 */
UserSchema.methods.sendFriendRequest = async function(userId, message = '') {
  const userIdStr = String(userId);
  const currentIdStr = String(this._id);
  
  if (userIdStr === currentIdStr) {
    throw new Error('Cannot send friend request to yourself');
  }
  
  const existingFriendship = this.getFriendshipStatus(userId);
  if (existingFriendship.status !== 'not-friends') {
    throw new Error(`Friendship already exists with status: ${existingFriendship.status}`);
  }
  
  const targetUser = await this.constructor.findById(userId);
  if (!targetUser) {
    throw new Error('User not found');
  }
  
  if (targetUser.privacy?.friendRequests === 'no-one') {
    throw new Error('This user is not accepting friend requests');
  }
  
  const friendshipData = {
    user: mongoose.Types.ObjectId(userId),
    status: 'pending',
    initiatedBy: this._id,
    createdAt: new Date(),
    requestMessage: message
  };
  
  this.friends.push(friendshipData);
  targetUser.friends.push({
    ...friendshipData,
    user: this._id
  });
  
  await Promise.all([this.save(), targetUser.save()]);
  
  return { success: true, message: 'Friend request sent' };
};

/**
 * Accept friend request
 * @param {string} userId - User ID who sent the request
 * @returns {Promise<Object>} Result of accepting request
 */
UserSchema.methods.acceptFriendRequest = async function(userId) {
  const friendship = this.friends.find(f => 
    String(f.user) === String(userId) && 
    f.status === 'pending' &&
    String(f.initiatedBy) !== String(this._id)
  );
  
  if (!friendship) {
    throw new Error('Friend request not found');
  }
  
  const otherUser = await this.constructor.findById(userId);
  if (!otherUser) {
    throw new Error('User not found');
  }
  
  const otherFriendship = otherUser.friends.find(f => 
    String(f.user) === String(this._id)
  );
  
  const acceptedAt = new Date();
  friendship.status = 'accepted';
  friendship.acceptedAt = acceptedAt;
  
  if (otherFriendship) {
    otherFriendship.status = 'accepted';
    otherFriendship.acceptedAt = acceptedAt;
  }
  
  await Promise.all([this.save(), otherUser.save()]);
  
  return { success: true, message: 'Friend request accepted' };
};

/**
 * Remove friendship or reject/cancel request
 * @param {string} userId - User ID to remove friendship with
 * @returns {Promise<Object>} Result of removal
 */
UserSchema.methods.removeFriendship = async function(userId) {
  const friendshipIndex = this.friends.findIndex(f => 
    String(f.user) === String(userId)
  );
  
  if (friendshipIndex === -1) {
    throw new Error('Friendship not found');
  }
  
  const otherUser = await this.constructor.findById(userId);
  if (otherUser) {
    const otherFriendshipIndex = otherUser.friends.findIndex(f => 
      String(f.user) === String(this._id)
    );
    
    if (otherFriendshipIndex !== -1) {
      otherUser.friends.splice(otherFriendshipIndex, 1);
      await otherUser.save();
    }
  }
  
  this.friends.splice(friendshipIndex, 1);
  await this.save();
  
  return { success: true, message: 'Friendship removed' };
};

// ============================================
// ENHANCED: PAYMENT ACCOUNT METHODS
// ============================================

/**
 * Check if user can receive payments from any provider
 * @returns {boolean} True if user can receive payments
 */
UserSchema.methods.canReceivePayments = function() {
  const accounts = this.paymentAccounts || {};
  
  console.log(`🔍 Checking payment capabilities for user ${this._id}:`, {
    hasPayPal: !!(accounts.paypal?.verified && accounts.paypal?.email),
    hasStripe: !!(accounts.stripe?.chargesEnabled && accounts.stripe?.onboardingComplete),
    hasManual: !!(accounts.manual?.enabled),
    paypalEmail: accounts.paypal?.email,
    paypalVerified: accounts.paypal?.verified,
    stripeChargesEnabled: accounts.stripe?.chargesEnabled
  });
  
  if (accounts.paypal?.verified && accounts.paypal?.email) {
    console.log(`✅ PayPal payments enabled for ${accounts.paypal.email}`);
    return true;
  }
  
  if (accounts.stripe?.chargesEnabled && accounts.stripe?.onboardingComplete) {
    console.log(`✅ Stripe payments enabled for account ${accounts.stripe.accountId}`);
    return true;
  }
  
  if (accounts.manual?.enabled && (
    accounts.manual?.venmoHandle || 
    accounts.manual?.cashappHandle || 
    accounts.manual?.instructions
  )) {
    console.log(`✅ Manual payments enabled`);
    return true;
  }
  
  console.log(`❌ No payment methods enabled for user ${this._id}`);
  return false;
};

/**
 * Get the primary payment method for this user
 * @returns {string|null} Primary payment method type
 */
UserSchema.methods.getPrimaryPaymentMethod = function() {
  const accounts = this.paymentAccounts || {};
  
  if (accounts.primary?.type && accounts.primary?.canReceivePayments) {
    return accounts.primary.type;
  }
  
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
 * Get available payment methods for this user
 * @returns {Array<string>} Array of available payment method types
 */
UserSchema.methods.getAvailablePaymentMethods = function() {
  const accounts = this.paymentAccounts || {};
  const methods = [];
  
  if (accounts.paypal?.verified && accounts.paypal?.email) {
    methods.push('paypal');
  }
  
  if (accounts.stripe?.chargesEnabled && accounts.stripe?.onboardingComplete) {
    methods.push('stripe');
  }
  
  if (accounts.manual?.enabled) {
    methods.push('manual');
  }
  
  return methods;
};

/**
 * Setup PayPal payment account
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
  
  console.log(`💰 Setting up PayPal account for user ${this._id} with email: ${email}`);
  
  this.paymentAccounts.paypal = {
    email: email.toLowerCase().trim(),
    verified: true,
    connectedAt: new Date(),
    country: 'US'
  };
  
  if (!this.paymentAccounts.primary?.type) {
    console.log(`🎯 Setting PayPal as primary payment method`);
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
 * Setup Stripe Connect account
 * @param {string} accountId - Stripe account ID
 * @param {object} accountData - Account configuration
 * @returns {Promise<boolean>} Success status
 */
UserSchema.methods.setupStripeAccount = function(accountId, accountData = {}) {
  if (!this.paymentAccounts) {
    this.paymentAccounts = {};
  }
  
  console.log(`💳 Setting up Stripe account for user ${this._id} with ID: ${accountId}`);
  
  this.paymentAccounts.stripe = {
    accountId: accountId,
    onboardingComplete: accountData.onboardingComplete || false,
    detailsSubmitted: accountData.detailsSubmitted || false,
    chargesEnabled: accountData.chargesEnabled || false,
    payoutsEnabled: accountData.payoutsEnabled || false,
    createdAt: new Date(),
    lastUpdated: new Date(),
    country: accountData.country || 'US'
  };
  
  if (!this.paymentAccounts.primary?.type && accountData.chargesEnabled) {
    console.log(`🎯 Setting Stripe as primary payment method`);
    this.paymentAccounts.primary = {
      type: 'stripe',
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
  
  this.earnings.totalEarned += amount;
  this.earnings.pendingBalance += amount;
  
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
  
  console.log(`💰 Added $${(amount/100).toFixed(2)} earnings via ${provider} for user ${this._id}`);
  
  return this.save();
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

UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  if (this.isModified('paymentAccounts') && this.paymentAccounts?.primary) {
    this.paymentAccounts.primary.lastUpdated = new Date();
  }

  next();
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for friends count
UserSchema.virtual('friendsCount').get(function() {
  return this.friends ? this.friends.filter(f => f.status === 'accepted').length : 0;
});

// Virtual for pending requests count
UserSchema.virtual('pendingRequestsCount').get(function() {
  return this.friends ? this.getPendingRequests().length : 0;
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return this.firstName && this.lastName ? `${this.firstName} ${this.lastName}` : this.username;
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
// ✅ FIXED: Remove individual indexes to avoid duplicates (handled in server.js)
UserSchema.index({ 'friends.user': 1, 'friends.status': 1 });
UserSchema.index({ 'friends.initiatedBy': 1 });
UserSchema.index({ 'paymentAccounts.paypal.email': 1 });
UserSchema.index({ 'paymentAccounts.stripe.accountId': 1 });

module.exports = mongoose.model('User', UserSchema);