// models/Memory.js - Updated with virtual cover photo field
const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Memory title is required'],
    trim: true,
    maxLength: [100, 'Title cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Memory creator is required']
  },
  
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    validate: {
      validator: function(participants) {
        const totalParticipants = participants.length + 1;
        return totalParticipants <= 15;
      },
      message: 'Memory cannot have more than 15 total participants (including creator)'
    }
  },
  
  photos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemoryPhoto'
  }],
  
  isPrivate: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ VIRTUAL: Get cover photo from first photo in memory
memorySchema.virtual('coverPhoto').get(function() {
  if (this.photos && this.photos.length > 0) {
    const firstPhoto = this.photos[0];
    // Handle both populated and unpopulated photos
    if (typeof firstPhoto === 'object' && firstPhoto.url) {
      return firstPhoto.url;
    }
  }
  return null;
});

// ✅ VIRTUAL: Get photo count
memorySchema.virtual('photoCount').get(function() {
  return this.photos ? this.photos.length : 0;
});

// ✅ VIRTUAL: Get all participants including creator
memorySchema.virtual('allParticipants').get(function() {
  return [this.creator, ...this.participants];
});

// ✅ VIRTUAL: Get total participant count
memorySchema.virtual('participantCount').get(function() {
  return this.participants.length + 1; // +1 for creator
});

// ✅ INSTANCE METHOD: Add participant with validation
memorySchema.methods.addParticipant = function(userId) {
  // Check if user is already a participant or creator
  if (this.creator.equals(userId) || this.participants.some(p => p.equals(userId))) {
    throw new Error('User is already a participant in this memory');
  }
  
  // Check participant limit
  if (this.participants.length >= 14) { // 14 + creator = 15 total
    throw new Error('Memory already has the maximum number of participants (15)');
  }
  
  this.participants.push(userId);
  return this.save();
};

// ✅ INSTANCE METHOD: Remove participant
memorySchema.methods.removeParticipant = function(userId) {
  // Cannot remove creator
  if (this.creator.equals(userId)) {
    throw new Error('Cannot remove creator from memory');
  }
  
  this.participants = this.participants.filter(p => !p.equals(userId));
  return this.save();
};

// ✅ STATIC METHOD: Create memory with proper validation
memorySchema.statics.createMemory = async function(memoryData) {
  const { title, description, creatorId, participantIds = [] } = memoryData;
  
  // Validate total participants before creation
  const totalParticipants = participantIds.length + 1; // +1 for creator
  if (totalParticipants > 15) {
    throw new Error(`Cannot create memory with ${totalParticipants} participants. Maximum is 15.`);
  }
  
  // Remove creator from participants if accidentally included
  const cleanParticipantIds = participantIds.filter(id => id !== creatorId);
  
  const memory = new this({
    title,
    description,
    creator: creatorId,
    participants: cleanParticipantIds
  });
  
  return memory.save();
};

// ✅ PRE-SAVE: Additional validation
memorySchema.pre('save', function(next) {
  // Ensure creator is not in participants array (avoid duplicates)
  if (this.creator && this.participants.includes(this.creator)) {
    this.participants = this.participants.filter(p => !p.equals(this.creator));
  }
  
  // Final validation for total participants
  const totalParticipants = this.participants.length + 1; // +1 for creator
  if (totalParticipants > 15) {
    const error = new Error(`Memory cannot have more than 15 total participants. Current: ${totalParticipants}`);
    error.name = 'ValidationError';
    return next(error);
  }
  
  next();
});
// ✅ INSTANCE METHOD: Remove participant (FIXED)
memorySchema.methods.removeParticipant = function(userId) {
  // Cannot remove creator
  if (this.creator.equals(userId)) {
    throw new Error('Cannot remove creator from memory');
  }
  
  // ✅ FIXED: Added null/undefined checks to prevent the error
  this.participants = this.participants.filter(p => {
    // Check if p exists and has the equals method
    if (!p || typeof p.equals !== 'function') {
      return false; // Remove null/undefined entries
    }
    return !p.equals(userId);
  });
  
  return this.save();
};

// ✅ INDEXES for better performance
memorySchema.index({ creator: 1, createdAt: -1 });
memorySchema.index({ participants: 1 });
memorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Memory', memorySchema);