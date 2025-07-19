// models/GuestPass.js - SIMPLIFIED VERSION (like Partiful)

const mongoose = require('mongoose');
const crypto = require('crypto');

const GuestPassSchema = new mongoose.Schema({
  // Basic info - that's it!
  event: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  
  // Guest details - keep it simple
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true
  },
  phoneNumber: { 
    type: String, 
    required: true,
    trim: true
  },
  
  // Status - just 3 states
  status: { 
    type: String, 
    enum: ['confirmed', 'used', 'expired'], 
    default: 'confirmed' 
  },
  
  // QR code for entry
  qrCode: {
    type: String,
    unique: true,
    required: true
  },
  
  // Timestamps
  confirmedAt: { 
    type: Date, 
    default: Date.now 
  },
  usedAt: Date,
  
  // Who checked them in
  checkedInBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
  
}, {
  timestamps: true
});

// Index for performance
GuestPassSchema.index({ event: 1 });
GuestPassSchema.index({ qrCode: 1 });
GuestPassSchema.index({ phoneNumber: 1, event: 1 }); // Prevent duplicates

// Generate QR code before saving
GuestPassSchema.pre('save', function(next) {
  if (this.isNew && !this.qrCode) {
    // Simple QR code - just random string
    this.qrCode = crypto.randomBytes(16).toString('hex');
  }
  next();
});

// Simple methods
GuestPassSchema.methods.isValid = function() {
  return this.status === 'confirmed' && !this.usedAt;
};

GuestPassSchema.methods.checkIn = function(hostUserId) {
  this.status = 'used';
  this.usedAt = new Date();
  this.checkedInBy = hostUserId;
  return this.save();
};

GuestPassSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Virtual for display
GuestPassSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('GuestPass', GuestPassSchema);