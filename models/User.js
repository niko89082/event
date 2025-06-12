// models/User.js - Remove QR code storage, add unique identifier
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
  // Replace qrCode with a unique share code
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
});

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
    this.shareCode = await this.generateUniqueShareCode();
  }
  
  next();
});

// Generate unique share code
UserSchema.methods.generateUniqueShareCode = async function() {
  let shareCode;
  let isUnique = false;
  
  while (!isUnique) {
    // Generate a random 8-character alphanumeric code
    shareCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Check if this code already exists
    const existingUser = await mongoose.model('User').findOne({ shareCode });
    if (!existingUser) {
      isUnique = true;
    }
  }
  
  return shareCode;
};

// Regenerate share code method
UserSchema.methods.regenerateShareCode = async function() {
  this.shareCode = await this.generateUniqueShareCode();
  return this.save();
};

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; 
  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);