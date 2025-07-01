// models/Event.js - Enhanced with Payment History and Better Pricing
const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  message   : { type: String, required: true },
  createdAt : { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  user      : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text      : { type: String, required: true },
  tags      : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt : { type: Date, default: Date.now }
});

// ============================================
// NEW: PAYMENT HISTORY SCHEMA
// ============================================
const PaymentHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },           // null for guest users
  guestPass: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestPass' }, // null for registered users
  guestName: String,                                                      // For guest payments
  amount: { type: Number, required: true },                              // Amount in cents
  currency: { type: String, default: 'USD' },
  stripePaymentIntentId: String,                                          // Stripe payment ID
  paymentMethod: { type: String, enum: ['stripe', 'paypal'], default: 'stripe' },
  status: { 
    type: String, 
    enum: ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'], 
    default: 'pending' 
  },
  paidAt: Date,
  refundedAt: Date,
  refundAmount: Number,                                                   // For partial refunds
  refundReason: String,
  type: { type: String, enum: ['user', 'guest'], required: true },      // Payment source
  metadata: {
    userAgent: String,
    ipAddress: String,
    platform: String // 'web', 'mobile', 'guest-link'
  }
}, { timestamps: true });

const EventSchema = new mongoose.Schema({
  /* basic info */
  title        : { type: String, required: true },
  description  : { type: String, required: true },
  category     : { type: String, required: true, default: 'General' },
  time         : { type: Date, required: true },

  /* location */
  location     : { type: String, required: true },
  geo          : {
    type        : { type: String, enum: ['Point'] },
    coordinates : { type: [Number] }
  },

  /* limits & pricing */
  maxAttendees : { type: Number, required: true },
  
  // ============================================
  // ENHANCED: PAYMENT CONFIGURATION
  // ============================================
  pricing: {
    isFree: { type: Boolean, default: true },                    // Toggle for paid/free
    amount: { type: Number, default: 0 },                        // Price in cents (e.g., 2500 = $25.00)
    currency: { type: String, default: 'USD' },
    description: String,                                          // e.g., "Includes drinks and appetizers"
    refundPolicy: { 
      type: String, 
      enum: ['no-refund', 'full-refund-24h', 'full-refund-7d', 'partial-refund'], 
      default: 'no-refund' 
    },
    refundDeadline: Date,                                         // Calculated based on policy
    earlyBirdPricing: {
      enabled: { type: Boolean, default: false },
      amount: Number,                                             // Early bird price in cents
      deadline: Date                                              // Early bird deadline
    }
  },

  // Legacy fields (keep for backward compatibility)
  price        : { type: Number, default: 0 },
  ticketPrice  : { type: Number, default: 0 },

  /* hosting & roles */
  host         : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coHosts      : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  coHostRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  /* ENHANCED PRIVACY SYSTEM */
  privacyLevel : {
    type: String,
    enum: ['public', 'friends', 'private', 'secret'],
    default: 'public'
  },
  
  permissions: {
    canView: {
      type: String,
      enum: ['anyone', 'followers', 'invitees', 'host-only'],
      default: 'anyone'
    },
    canJoin: {
      type: String,
      enum: ['anyone', 'followers', 'invited', 'approval-required'],
      default: 'anyone'
    },
    canShare: {
      type: String,
      enum: ['anyone', 'attendees', 'co-hosts', 'host-only'],
      default: 'attendees'
    },
    canInvite: {
      type: String,
      enum: ['anyone', 'attendees', 'co-hosts', 'host-only'],
      default: 'attendees'
    },
    appearInFeed: { type: Boolean, default: true },
    appearInSearch: { type: Boolean, default: true },
    showAttendeesToPublic: { type: Boolean, default: true }
  },

  /* visibility & behaviour - DEPRECATED but kept for backward compatibility */
  isPublic     : { type: Boolean, default: true },
  openToPublic : { type: Boolean, default: true },
  recurring    : { type: String, enum: ['daily', 'weekly', 'monthly'], default: null },

  /* media permissions */
  coverImage             : { type: String, default: '' },
  allowPhotos            : { type: Boolean, default: true },
  allowUploads           : { type: Boolean, default: true },
  allowUploadsBeforeStart: { type: Boolean, default: true },

  /* relations */
  group        : { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  attendees    : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  invitedUsers : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bannedUsers  : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  checkedIn    : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  /* join requests for approval-required events */
  joinRequests : [{ 
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now },
    message: String
  }],

  // ============================================
  // NEW: PAYMENT HISTORY AND FINANCIAL TRACKING
  // ============================================
  paymentHistory: [PaymentHistorySchema],

  financials: {
    totalRevenue: { type: Number, default: 0 },        // Total money collected
    totalRefunded: { type: Number, default: 0 },       // Total refunds issued
    netRevenue: { type: Number, default: 0 },          // Revenue - refunds
    totalPayments: { type: Number, default: 0 },       // Number of successful payments
    stripeFeesTotal: { type: Number, default: 0 },     // Total Stripe processing fees
    hostEarnings: { type: Number, default: 0 },        // What the host actually receives
    currency: { type: String, default: 'USD' }
  },

  /* content */
  photos       : [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo', index: true }],
  removedPhotos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo' }],
  comments     : [CommentSchema],
  announcements: [AnnouncementSchema],

  /* engagement */
  likes        : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shareCount   : { type: Number, default: 0 },
  
  /* recommendations & discovery */
  tags         : [String],
  weatherDependent: { type: Boolean, default: false },
  ageRestriction: { min: Number, max: Number },
  interests    : [String],

}, { timestamps: true });

/* ---------- indexes ------------------------------------------------------- */
EventSchema.index(
  { title: 'text', category: 'text', description: 'text', tags: 'text' },
  { name: 'EventFullText', weights: { title: 8, category: 5, description: 1, tags: 3 } }
);
EventSchema.index({ time: 1 });
EventSchema.index({ privacyLevel: 1, time: 1 });
EventSchema.index({ 'geo': '2dsphere' }, { sparse: true });
EventSchema.index({ category: 1, time: 1 });
EventSchema.index({ host: 1, time: 1 });
EventSchema.index({ 'pricing.isFree': 1, time: 1 });
EventSchema.index({ 'paymentHistory.user': 1 });
EventSchema.index({ 'paymentHistory.status': 1 });

/* ---------- helper methods ------------------------------------------------ */

// Check if event is paid
EventSchema.methods.isPaidEvent = function() {
  return !this.pricing.isFree && this.pricing.amount > 0;
};

// Get current price (considering early bird)
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

// Check if user already paid for this event
EventSchema.methods.hasUserPaid = function(userId) {
  if (!userId) return false;
  
  return this.paymentHistory.some(payment => 
    payment.user && 
    String(payment.user) === String(userId) && 
    payment.status === 'succeeded'
  );
};

// Check if guest already paid
EventSchema.methods.hasGuestPaid = function(guestPassId) {
  if (!guestPassId) return false;
  
  return this.paymentHistory.some(payment => 
    payment.guestPass && 
    String(payment.guestPass) === String(guestPassId) && 
    payment.status === 'succeeded'
  );
};

// Add payment to history
EventSchema.methods.addPayment = function(paymentData) {
  this.paymentHistory.push(paymentData);
  
  // Update financial tracking
  if (paymentData.status === 'succeeded') {
    this.financials.totalRevenue += paymentData.amount;
    this.financials.totalPayments += 1;
    this.financials.netRevenue = this.financials.totalRevenue - this.financials.totalRefunded;
    
    // Calculate estimated Stripe fees (2.9% + 30¢)
    const stripeFee = Math.round(paymentData.amount * 0.029 + 30);
    this.financials.stripeFeesTotal += stripeFee;
    this.financials.hostEarnings = this.financials.netRevenue - this.financials.stripeFeesTotal;
  }
  
  return this.save();
};

// Process refund
EventSchema.methods.processRefund = function(paymentId, refundAmount, reason) {
  const payment = this.paymentHistory.id(paymentId);
  if (!payment) return false;
  
  payment.status = refundAmount === payment.amount ? 'refunded' : 'partially_refunded';
  payment.refundedAt = new Date();
  payment.refundAmount = refundAmount;
  payment.refundReason = reason;
  
  // Update financials
  this.financials.totalRefunded += refundAmount;
  this.financials.netRevenue = this.financials.totalRevenue - this.financials.totalRefunded;
  this.financials.hostEarnings = this.financials.netRevenue - this.financials.stripeFeesTotal;
  
  return this.save();
};

// Legacy compatibility - sync old price field with new pricing structure
EventSchema.pre('save', function(next) {
  // Sync legacy fields
  this.price = this.pricing.isFree ? 0 : this.pricing.amount / 100; // Convert cents to dollars
  this.isPublic = this.privacyLevel === 'public' && this.permissions.appearInSearch;
  
  // Set refund deadline based on policy
  if (this.pricing.refundPolicy === 'full-refund-24h') {
    this.pricing.refundDeadline = new Date(this.time.getTime() - 24 * 60 * 60 * 1000);
  } else if (this.pricing.refundPolicy === 'full-refund-7d') {
    this.pricing.refundDeadline = new Date(this.time.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Existing methods for permissions...
EventSchema.methods.canUserView = function(userId, userFollowers = []) {
  const userIdStr = String(userId);
  const hostStr = String(this.host);
  
  if (userIdStr === hostStr) return true;
  if (this.coHosts.some(c => String(c) === userIdStr)) return true;
  
  switch (this.privacyLevel) {
    case 'public':
      return this.permissions.canView === 'anyone' || 
             (this.permissions.canView === 'followers' && userFollowers.includes(hostStr));
    case 'friends':
      return userFollowers.includes(hostStr);
    case 'private':
      return this.invitedUsers.some(u => String(u) === userIdStr) ||
             this.attendees.some(u => String(u) === userIdStr);
    case 'secret':
      return this.invitedUsers.some(u => String(u) === userIdStr) ||
             this.attendees.some(u => String(u) === userIdStr);
    default:
      return false;
  }
};

EventSchema.methods.canUserJoin = function(userId, userFollowers = []) {
  if (!this.canUserView(userId, userFollowers)) return false;
  
  const userIdStr = String(userId);
  const hostStr = String(this.host);
  
  if (this.attendees.some(u => String(u) === userIdStr)) return false;
  if (this.bannedUsers.some(u => String(u) === userIdStr)) return false;
  
  switch (this.permissions.canJoin) {
    case 'anyone':
      return this.privacyLevel === 'public';
    case 'followers':
      return userFollowers.includes(hostStr);
    case 'invited':
      return this.invitedUsers.some(u => String(u) === userIdStr);
    case 'approval-required':
      return true;
    default:
      return false;
  }
};

module.exports = mongoose.model('Event', EventSchema);