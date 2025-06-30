// models/Memory.js - FIXED: Proper participants validation
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
  
  // ✅ FIXED: Proper validation for participants array
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    validate: {
      validator: function(participants) {
        // Include creator in total count (creator + participants)
        const totalParticipants = participants.length + 1;
        return totalParticipants <= 15;
      },
      message: 'Memory cannot have more than 15 total participants (including creator)'
    }
  },
  
  // ✅ REFERENCE: Use MemoryPhoto schema instead of embedded objects
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
  timestamps: true // Automatically manage createdAt and updatedAt
});

// ✅ ADDITIONAL VALIDATION: Pre-save hook for extra safety
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

// ✅ INDEXES for better performance
memorySchema.index({ creator: 1, createdAt: -1 });
memorySchema.index({ participants: 1 });
memorySchema.index({ createdAt: -1 });

// ✅ JSON transform to include virtuals
memorySchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Memory', memorySchema);