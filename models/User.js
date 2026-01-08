// models/User.js - Follower-Following System + Payment Accounts
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

  // Follower-Following System (one-way relationships)
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Privacy Settings
  privacy: {
    posts: {
      type: String,
      enum: ['public', 'followers', 'only-me'],
      default: 'public'
    },
    eventAttendance: {
      type: String,
      enum: ['public', 'followers', 'only-me'],
      default: 'public'
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

  // ============================================
  // FRIENDS SYSTEM (Phase 1)
  // ============================================
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
    requestMessage: {
      type: String,
      default: ''
    },
    acceptedAt: {
      type: Date
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  migratedToFriendsAt: {
    type: Date
  },

  // ============================================
  // ABOUT SECTION
  // ============================================
  // Basic Identity
  school: {
    type: String,
    required: false,
  },
  classYear: {
    type: String,
    required: false,
  },
  major: {
    type: String,
    required: false,
  },
  minor: {
    type: String,
    required: false,
  },
  hometown: {
    type: String,
    required: false,
  },

  // Social Context
  relationshipStatus: {
    type: String,
    enum: ['single', 'in-relationship', 'complicated', 'prefer-not-say'],
    required: false,
  },
  lookingFor: {
    type: String,
    enum: ['roommates', 'study-group', 'parties', 'nothing'],
    required: false,
  },

  // Interests (constrained to 1 each)
  favoriteMovie: {
    type: String,
    required: false,
  },
  favoriteArtist: {
    type: String,
    required: false,
  },
  favoriteTVShow: {
    type: String,
    required: false,
  },
  favoriteCampusSpot: {
    type: String,
    required: false,
  },

  // Activity-driven (auto-populated)
  recentlyWatched: [{
    type: String,
  }],
  recentlyListened: [{
    type: String,
  }],
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

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return this.firstName && this.lastName ? `${this.firstName} ${this.lastName}` : this.username;
});

// ============================================
// FRIENDS SYSTEM METHODS
// ============================================

/**
 * Get list of accepted friend user IDs
 * @returns {Array<string>} Array of friend user IDs as strings
 */
UserSchema.methods.getAcceptedFriends = function() {
  if (!this.friends || !Array.isArray(this.friends)) {
    return [];
  }
  
  return this.friends
    .filter(f => f.status === 'accepted')
    .map(f => String(f.user));
};

/**
 * Get friendship status with another user
 * @param {string|ObjectId} targetUserId - The target user ID
 * @returns {Object} Friendship status object
 */
UserSchema.methods.getFriendshipStatus = function(targetUserId) {
  const targetIdStr = String(targetUserId);
  const currentIdStr = String(this._id);
  
  if (!this.friends || !Array.isArray(this.friends)) {
    return {
      status: 'none',
      exists: false
    };
  }
  
  const friendship = this.friends.find(f => String(f.user) === targetIdStr);
  
  if (!friendship) {
    return {
      status: 'none',
      exists: false
    };
  }
  
  if (friendship.status === 'accepted') {
    return {
      status: 'friends',
      exists: true,
      friendship: friendship
    };
  }
  
  if (friendship.status === 'pending') {
    const initiatedByMe = String(friendship.initiatedBy) === currentIdStr;
    return {
      status: initiatedByMe ? 'request-sent' : 'request-received',
      exists: true,
      friendship: friendship,
      initiatedByMe: initiatedByMe
    };
  }
  
  if (friendship.status === 'blocked') {
    return {
      status: 'blocked',
      exists: true,
      friendship: friendship
    };
  }
  
  return {
    status: 'none',
    exists: false
  };
};

/**
 * Send a friend request to another user
 * @param {string|ObjectId} targetUserId - The target user ID
 * @param {string} message - Optional request message
 * @returns {Promise} Save promise
 */
UserSchema.methods.sendFriendRequest = async function(targetUserId, message = '') {
  const targetIdStr = String(targetUserId);
  const currentIdStr = String(this._id);
  
  if (targetIdStr === currentIdStr) {
    throw new Error('Cannot send friend request to yourself');
  }
  
  if (!this.friends) {
    this.friends = [];
  }
  
  // Check if friendship already exists
  const existingFriendship = this.friends.find(f => String(f.user) === targetIdStr);
  
  if (existingFriendship) {
    if (existingFriendship.status === 'accepted') {
      throw new Error('Already friends with this user');
    }
    if (existingFriendship.status === 'pending') {
      throw new Error('Friend request already sent');
    }
    // If blocked, remove and create new request
    this.friends = this.friends.filter(f => String(f.user) !== targetIdStr);
  }
  
  // Add friend request
  this.friends.push({
    user: targetUserId,
    status: 'pending',
    initiatedBy: this._id,
    requestMessage: message,
    createdAt: new Date()
  });
  
  // Also add to target user's friends list (bidirectional)
  const targetUser = await mongoose.model('User').findById(targetUserId);
  if (targetUser) {
    if (!targetUser.friends) {
      targetUser.friends = [];
    }
    
    const targetExisting = targetUser.friends.find(f => String(f.user) === currentIdStr);
    if (!targetExisting) {
      targetUser.friends.push({
        user: this._id,
        status: 'pending',
        initiatedBy: this._id,
        requestMessage: message,
        createdAt: new Date()
      });
      await targetUser.save();
    }
  }
  
  return this.save();
};

/**
 * Accept a friend request from another user
 * @param {string|ObjectId} requesterUserId - The requester user ID
 * @returns {Promise} Save promise
 */
UserSchema.methods.acceptFriendRequest = async function(requesterUserId) {
  const requesterIdStr = String(requesterUserId);
  const currentIdStr = String(this._id);
  
  if (!this.friends || !Array.isArray(this.friends)) {
    this.friends = [];
  }
  
  // Find the friend request
  const friendship = this.friends.find(f => String(f.user) === requesterIdStr);
  
  if (!friendship) {
    throw new Error('No friend request found from this user');
  }
  
  if (friendship.status === 'accepted') {
    throw new Error('Already friends with this user');
  }
  
  if (friendship.status !== 'pending') {
    throw new Error('Cannot accept this friend request');
  }
  
  // Update status to accepted
  friendship.status = 'accepted';
  friendship.acceptedAt = new Date();
  
  // Also update the requester's side (bidirectional)
  const requesterUser = await mongoose.model('User').findById(requesterUserId);
  if (requesterUser) {
    if (!requesterUser.friends) {
      requesterUser.friends = [];
    }
    
    const requesterFriendship = requesterUser.friends.find(f => String(f.user) === currentIdStr);
    if (requesterFriendship) {
      requesterFriendship.status = 'accepted';
      requesterFriendship.acceptedAt = new Date();
      await requesterUser.save();
    } else {
      // If not found, create it
      requesterUser.friends.push({
        user: this._id,
        status: 'accepted',
        initiatedBy: requesterUserId,
        acceptedAt: new Date(),
        createdAt: new Date()
      });
      await requesterUser.save();
    }
  }
  
  return this.save();
};

/**
 * Get pending friend requests received by this user
 * @returns {Array} Array of pending friend request objects
 */
UserSchema.methods.getPendingRequests = function() {
  if (!this.friends || !Array.isArray(this.friends)) {
    return [];
  }
  
  const currentIdStr = String(this._id);
  return this.friends.filter(f => 
    f.status === 'pending' && String(f.initiatedBy) !== currentIdStr
  );
};

/**
 * Get sent friend requests (pending) by this user
 * @returns {Array} Array of sent friend request objects
 */
UserSchema.methods.getSentRequests = function() {
  if (!this.friends || !Array.isArray(this.friends)) {
    return [];
  }
  
  const currentIdStr = String(this._id);
  return this.friends.filter(f => 
    f.status === 'pending' && String(f.initiatedBy) === currentIdStr
  );
};

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
UserSchema.index({ 'paymentAccounts.paypal.email': 1 });
UserSchema.index({ 'paymentAccounts.stripe.accountId': 1 });
UserSchema.index({ 'friends.user': 1 });
UserSchema.index({ 'friends.status': 1 });

// Text search index for search functionality
UserSchema.index({ 
  username: 'text', 
  displayName: 'text', 
  fullName: 'text', 
  bio: 'text' 
});

module.exports = mongoose.model('User', UserSchema);