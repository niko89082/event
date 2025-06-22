// models/GuestPass.js - New schema for guest passes
const mongoose = require('mongoose');
const crypto = require('crypto');

const GuestPassSchema = new mongoose.Schema({
  // Core identification
  token: { type: String, unique: true, required: true }, // JWT token hash for security
  nonce: { type: String, required: true }, // Prevents replay attacks
  
  // Event and guest information
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Guest details
  guestName: { type: String, required: true },
  guestEmail: { type: String },
  guestPhone: { type: String },
  
  // Status tracking
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'used', 'expired', 'cancelled'], 
    default: 'pending' 
  },
  
  // Payment information
  payment: {
    required: { type: Boolean, default: false },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    stripePaymentIntentId: String,
    status: { 
      type: String, 
      enum: ['pending', 'succeeded', 'failed', 'refunded'], 
      default: 'pending' 
    },
    paidAt: Date
  },
  
  // Timing and expiry
  expiresAt: { type: Date, required: true },
  confirmedAt: Date,
  usedAt: Date,
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // QR code data
  qrData: {
    code: String, // Rotating QR code for security
    generatedAt: Date,
    viewCount: { type: Number, default: 0 }
  },
  
  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for performance
GuestPassSchema.index({ token: 1 });
GuestPassSchema.index({ event: 1, status: 1 });
GuestPassSchema.index({ expiresAt: 1 });
GuestPassSchema.index({ 'qrData.code': 1 });

// Pre-save middleware to generate nonce and check expiry
GuestPassSchema.pre('save', function(next) {
  if (this.isNew) {
    this.nonce = crypto.randomBytes(16).toString('hex');
  }
  
  // Auto-expire if past expiry date
  if (new Date() > this.expiresAt && this.status === 'pending') {
    this.status = 'expired';
  }
  
  this.updatedAt = new Date();
  next();
});

// Instance methods
GuestPassSchema.methods.generateQRCode = function() {
  this.qrData.code = crypto.randomBytes(32).toString('hex');
  this.qrData.generatedAt = new Date();
  return this.qrData.code;
};

GuestPassSchema.methods.isValid = function() {
  return this.status === 'confirmed' && 
         new Date() < this.expiresAt && 
         !this.usedAt;
};

GuestPassSchema.methods.markAsUsed = function(scannedBy) {
  this.status = 'used';
  this.usedAt = new Date();
  this.scannedBy = scannedBy;
  return this.save();
};

module.exports = mongoose.model('GuestPass', GuestPassSchema);