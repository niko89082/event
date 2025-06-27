// models/Memory.js - Enhanced Memory model (verify your existing model has these features)
const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 50,
  },
  description: {
    type: String,
    maxlength: 250,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: function(v) {
        return v.length <= 15; // Max 15 participants
      },
      message: 'Memory cannot have more than 15 participants'
    }
  }],
  photos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemoryPhoto',
  }],
  isPrivate: {
    type: Boolean,
    default: false,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// IMPORTANT: Add these indexes for performance
MemorySchema.index({ createdBy: 1, createdAt: -1 });
MemorySchema.index({ participants: 1, createdAt: -1 });
MemorySchema.index({ createdAt: -1 });
MemorySchema.index({ updatedAt: -1 }); // For sorting by recent activity

// Update timestamp on save
MemorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// IMPORTANT: Add this method for checking participants
MemorySchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.toString() === userId.toString()) || 
         this.createdBy.toString() === userId.toString();
};

module.exports = mongoose.model('Memory', MemorySchema);