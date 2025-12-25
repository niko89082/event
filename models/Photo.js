const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PhotoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // ✅ PHASE 1: Primary event field (keep as main)
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  },
  // ✅ PHASE 1: Add missing taggedEvent field for compatibility
  taggedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  },
  paths: [{
    type: String,
    required: true,
  }],
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  likes: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: [],
    required: true,
  },
  comments: [CommentSchema],
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  visibleInEvent: {
    type: Boolean,
    default: true,
  },
  shareCount: {
    type: Number,
    default: 0,
  },
  // ✅ PHASE 2: Enhanced privacy fields
  visibility: {
    level: {
      type: String,
      enum: ['public', 'friends', 'attendees', 'private'],
      default: 'public'
    },
    // Custom privacy rules
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Inherit privacy from uploader's account settings
    inheritFromUser: {
      type: Boolean,
      default: true
    }
  },
  // ✅ PHASE 2: Moderation status for host management
  // ✅ PHASE 1: Soft delete flag
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // ✅ PHASE 2: Enhanced metadata
  caption: String,
  location: {
    name: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  // ✅ TWITTER FEATURES: Post type and content
  postType: {
    type: String,
    enum: ['photo', 'text', 'video', 'link'],
    default: 'photo'
  },
  textContent: {
    type: String,
    maxlength: 5000
  },
  // ✅ TWITTER FEATURES: Repost functionality
  isRepost: {
    type: Boolean,
    default: false
  },
  originalPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo'
  },
  repostComment: String,
  repostCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  // ✅ TWITTER FEATURES: Review functionality (Movies & Songs)
  review: {
    type: {
      type: String,
      enum: ['movie', 'song', null],
      default: null
    },
    mediaId: String,  // External API ID (TMDB, Spotify, etc.)
    title: String,
    artist: String,  // For songs: artist name, for movies: director/studio
    year: Number,
    poster: String,  // Album art or movie poster URL
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null
    },
    ratingType: {
      type: String,
      enum: ['stars', 'thumbs', 'numerical'],
      default: 'stars'
    },
    genre: [String],
    duration: Number,  // For songs: track length, for movies: runtime
    externalUrl: String  // Link to Spotify, IMDB, etc.
  },
  // Privacy context for efficient querying
  privacyContext: {
    isFromPrivateAccount: {
      type: Boolean,
      default: false
    },
    requiresFollowToView: {
      type: Boolean,
      default: false
    },
    isInPrivateEvent: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ PHASE 1: Indexes for performance
PhotoSchema.index({ user: 1, visibleInEvent: 1 });
PhotoSchema.index({ event: 1, isDeleted: 1 });
PhotoSchema.index({ taggedEvent: 1, isDeleted: 1 });

// ✅ PHASE 2: Privacy-optimized indexes
PhotoSchema.index({ 
  'privacyContext.isFromPrivateAccount': 1, 
  'privacyContext.requiresFollowToView': 1 
});
PhotoSchema.index({ 
  event: 1, 
  'visibility.level': 1, 
  isDeleted: 1 
});
// ✅ TWITTER FEATURES: New indexes for performance
PhotoSchema.index({ postType: 1, createdAt: -1 });
PhotoSchema.index({ isRepost: 1, originalPost: 1 });
PhotoSchema.index({ user: 1, 'visibility.level': 1, createdAt: -1 });
PhotoSchema.index({ 'review.type': 1, 'review.mediaId': 1 });
PhotoSchema.index({ 'review.type': 1, createdAt: -1 });

// ✅ PHASE 1: Pre-save middleware to sync fields and set privacy context
PhotoSchema.pre('save', async function(next) {
  try {
    // Sync event fields - use 'event' as source of truth
    if (this.event && !this.taggedEvent) {
      this.taggedEvent = this.event;
    } else if (this.taggedEvent && !this.event) {
      this.event = this.taggedEvent;
    }
    
    // Set privacy context
    if (this.user && this.isModified('user')) {
      const User = mongoose.model('User');
      const user = await User.findById(this.user).select('isPublic');
      if (user) {
        this.privacyContext.isFromPrivateAccount = !user.isPublic;
        this.privacyContext.requiresFollowToView = !user.isPublic;
      }
    }
    
    // Set event privacy context
    if (this.event && this.isModified('event')) {
      const Event = mongoose.model('Event');
      const event = await Event.findById(this.event).select('privacyLevel');
      if (event) {
        this.privacyContext.isInPrivateEvent = ['private', 'secret'].includes(event.privacyLevel);
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// ✅ PHASE 1: Method to get primary event ID (prefers 'event' field)
PhotoSchema.methods.getEventId = function() {
  return this.event || this.taggedEvent || null;
};

// ✅ PHASE 2: Method to check if user can view this photo
PhotoSchema.methods.canUserView = async function(userId) {
  try {
    const PrivacyMiddleware = require('../middleware/privacy');
    const { hasAccess } = await PrivacyMiddleware.PrivacyMiddleware.checkPhotoAccess(userId, this._id);
    return hasAccess;
  } catch (error) {
    console.error('Error checking photo access:', error);
    return false;
  }
};

// ✅ PHASE 2: Method to check if user can moderate this photo
PhotoSchema.methods.canUserRemove = function(userId) {
  const userIdStr = String(userId);
  
  // Photo owner can remove
  if (String(this.user) === userIdStr) {
    return true;
  }
  
  // Event host/co-host can remove (if photo is tagged to an event)
  if (this.event && this.event.host) {
    if (String(this.event.host) === userIdStr) {
      return true;
    }
    if (this.event.coHosts && this.event.coHosts.some(c => String(c) === userIdStr)) {
      return true;
    }
  }
  
  return false;
};

// ✅ PHASE 1: Static method for cleanup operations
PhotoSchema.statics.cleanupEventReferences = async function(eventId) {
  const result = await this.updateMany(
    {
      $or: [
        { event: eventId },
        { taggedEvent: eventId }
      ]
    },
    {
      $unset: { 
        event: 1,
        taggedEvent: 1 
      },
      $set: {
        visibleInEvent: false
      }
    }
  );
  
  return result;
};

// ✅ PHASE 2: Static method for privacy-aware photo queries
PhotoSchema.statics.findWithPrivacyCheck = async function(query, userId, options = {}) {
  const photos = await this.find(query)
    .populate('user', 'username profilePicture isPublic followers')
    .populate('event', 'host attendees privacyLevel permissions')
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
  
  // Filter photos based on privacy
  const PrivacyMiddleware = require('../middleware/privacy');
  const accessiblePhotos = [];
  
  for (const photo of photos) {
    const { hasAccess } = await PrivacyMiddleware.PrivacyMiddleware.checkPhotoAccess(userId, photo._id);
    if (hasAccess) {
      accessiblePhotos.push(photo);
    }
  }
  
  return accessiblePhotos;
};

module.exports = mongoose.model('Photo', PhotoSchema);