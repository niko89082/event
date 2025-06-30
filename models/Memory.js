// models/Memory.js - Fixed Memory model without ObjectId constructor errors
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
    maxLength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Memory creator is required']
  },
  
  // ✅ Participants array with proper validation
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: [],
    validate: {
      validator: function(participants) {
        // Include creator in total count (creator + participants)
        const totalParticipants = participants.length + 1;
        return totalParticipants <= 15;
      },
      message: 'Memory cannot have more than 15 total participants (including creator)'
    }
  },
  
  // ✅ Optional: Link to event if memory was created from an event
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  
  // ✅ Location where the memory took place
  location: {
    type: String,
    trim: true,
    maxLength: [100, 'Location cannot exceed 100 characters'],
    default: ''
  },
  
  isPrivate: {
    type: Boolean,
    default: true
  },
  
  // ✅ Analytics fields
  viewCount: {
    type: Number,
    default: 0
  },
  
  shareCount: {
    type: Number,
    default: 0
  },
  
  // ✅ Moderation fields
  reportCount: {
    type: Number,
    default: 0
  },
  
  isReported: {
    type: Boolean,
    default: false
  },
  
  isDeleted: {
    type: Boolean,
    default: false
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
  timestamps: true // Automatically manage createdAt and updatedAt
});

// ✅ INDEXES for better query performance
memorySchema.index({ creator: 1, createdAt: -1 });
memorySchema.index({ participants: 1, createdAt: -1 });
memorySchema.index({ isPrivate: 1 });
memorySchema.index({ isDeleted: 1 });
memorySchema.index({ eventId: 1 });

// ✅ COMPOUND INDEX for user access queries
memorySchema.index({ 
  creator: 1,
  isDeleted: 1
});
memorySchema.index({ 
  participants: 1,
  isDeleted: 1
});

// ✅ PRE-SAVE HOOK: Validation and cleanup
memorySchema.pre('save', function(next) {
  // Ensure creator is not in participants array (avoid duplicates)
  if (this.creator && this.participants) {
    this.participants = this.participants.filter(p => !p.equals(this.creator));
  }
  
  // Final validation for total participants
  const totalParticipants = (this.participants ? this.participants.length : 0) + 1; // +1 for creator
  if (totalParticipants > 15) {
    const error = new Error(`Memory cannot have more than 15 total participants. Currently has ${totalParticipants}.`);
    error.name = 'ValidationError';
    return next(error);
  }
  
  // Update the updatedAt timestamp
  this.updatedAt = new Date();
  
  next();
});

// ✅ VIRTUAL: Get participant count (SAFE VERSION)
memorySchema.virtual('participantCount').get(function() {
  return (this.participants ? this.participants.length : 0) + 1; // +1 for creator
});

// ✅ INSTANCE METHOD: Check if user has access to this memory
memorySchema.methods.hasAccess = function(userId) {
  if (!userId) return false;
  
  const userIdStr = userId.toString();
  const creatorIdStr = this.creator.toString();
  
  // Check if user is creator
  if (userIdStr === creatorIdStr) return true;
  
  // Check if user is in participants
  if (!this.participants) return false;
  
  return this.participants.some(participantId => 
    participantId.toString() === userIdStr
  );
};

// ✅ INSTANCE METHOD: Add participant
memorySchema.methods.addParticipant = function(userId) {
  if (!userId) return false;
  
  const userIdStr = userId.toString();
  const creatorIdStr = this.creator.toString();
  
  // Don't add creator as participant
  if (userIdStr === creatorIdStr) return false;
  
  // Initialize participants array if it doesn't exist
  if (!this.participants) {
    this.participants = [];
  }
  
  // Don't add if already participant
  const isAlreadyParticipant = this.participants.some(p => 
    p.toString() === userIdStr
  );
  if (isAlreadyParticipant) return false;
  
  // Check total limit
  if (this.participants.length >= 14) return false; // 14 + 1 creator = 15 max
  
  this.participants.push(userId);
  return true;
};

// ✅ INSTANCE METHOD: Remove participant
memorySchema.methods.removeParticipant = function(userId) {
  if (!userId || !this.participants) return false;
  
  const userIdStr = userId.toString();
  this.participants = this.participants.filter(p => 
    p.toString() !== userIdStr
  );
  
  return true;
};

// ✅ STATIC METHOD: Find memories for user
memorySchema.statics.findForUser = function(userId, options = {}) {
  const {
    page = 1,
    limit = 10,
    sort = 'recent',
    includePrivate = true
  } = options;
  
  const skip = (page - 1) * limit;
  
  // Build query
  let query = {
    $or: [
      { creator: userId },
      { participants: userId }
    ],
    isDeleted: false
  };
  
  if (!includePrivate) {
    query.isPrivate = false;
  }
  
  // Build sort
  let sortQuery = { createdAt: -1 }; // Default: most recent
  if (sort === 'popular') {
    sortQuery = { viewCount: -1, createdAt: -1 };
  }
  
  return this.find(query)
    .populate('creator', 'username profilePicture fullName')
    .populate('participants', 'username profilePicture fullName')
    .sort(sortQuery)
    .skip(skip)
    .limit(parseInt(limit));
};

// ✅ JSON transform to clean output (REMOVED PROBLEMATIC VIRTUAL)
memorySchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.isDeleted;
    delete ret.reportCount;
    // ✅ REMOVED: allParticipants virtual that was causing ObjectId errors
    return ret;
  }
});

module.exports = mongoose.model('Memory', memorySchema);