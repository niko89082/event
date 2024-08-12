// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

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
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  qrCode: {
    type: String,
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
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  attendedEvents: [{
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
  featuredEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  }],
  followRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.pre('save', async function (next) {
  if (!this.qrCode) {
    this.qrCode = await generateQRCode(this._id.toString());
  }
  next();
});

async function generateQRCode(data) {
  try {
    const qrCodeData = await QRCode.toDataURL(data);
    return qrCodeData;
  } catch (err) {
    console.error('Error generating QR code:', err);
    return null;
  }
}

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);