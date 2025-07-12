// models/MemoryPhoto.js - FIXED: Consistent likes array schema

const mongoose = require('mongoose');

const memoryPhotoSchema = new mongoose.Schema({
  memory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Memory',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  url: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    default: '',
    maxlength: 500
  },
  // ✅ CRITICAL FIX: Simplified likes array - just store ObjectIds
  likes: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: [],
    required: true
  },
  // ✅ ENHANCED: Comments with proper structure
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    tags: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ VIRTUAL: Like count
memoryPhotoSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// ✅ VIRTUAL: Comment count
memoryPhotoSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// ✅ VIRTUAL: Get full URL with domain
memoryPhotoSchema.virtual('fullUrl').get(function() {
  return process.env.BASE_URL ? `${process.env.BASE_URL}${this.url}` : this.url;
});

// ✅ INSTANCE METHOD: Check if user liked this photo
memoryPhotoSchema.methods.isLikedBy = function(userId) {
  if (!this.likes || !Array.isArray(this.likes)) {
    return false;
  }
  return this.likes.some(likeId => likeId.toString() === userId.toString());
};

// ✅ INSTANCE METHOD: Toggle like (Instagram-style)
memoryPhotoSchema.methods.toggleLike = function(userId) {
  // Ensure likes array exists
  if (!this.likes || !Array.isArray(this.likes)) {
    this.likes = [];
  }

  const userLikedIndex = this.likes.findIndex(likeId => 
    likeId.toString() === userId.toString()
  );
  
  if (userLikedIndex !== -1) {
    // Unlike: Remove user from likes array
    this.likes.splice(userLikedIndex, 1);
    return { liked: false, likeCount: this.likes.length };
  } else {
    // Like: Add user to likes array
    this.likes.push(userId);
    return { liked: true, likeCount: this.likes.length };
  }
};

// ✅ INSTANCE METHOD: Add comment
memoryPhotoSchema.methods.addComment = function(userId, text, tags = []) {
  if (!this.comments) {
    this.comments = [];
  }
  
  const comment = {
    user: userId,
    text: text.trim(),
    tags: tags,
    createdAt: new Date()
  };
  
  this.comments.push(comment);
  return comment;
};

// ✅ INSTANCE METHOD: Remove comment
memoryPhotoSchema.methods.removeComment = function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  // Only comment author can delete their comment
  if (!comment.user.equals(userId)) {
    throw new Error('Not authorized to delete this comment');
  }
  
  comment.remove();
  return this.comments.length;
};

// ✅ INSTANCE METHOD: Soft delete
memoryPhotoSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// ✅ PRE-SAVE MIDDLEWARE: Ensure likes array is always initialized properly
memoryPhotoSchema.pre('save', function(next) {
  // ✅ CRITICAL: Always ensure likes is an array of ObjectIds
  if (!this.likes || !Array.isArray(this.likes)) {
    this.likes = [];
  } else {
    // Clean up likes array - ensure all entries are ObjectIds
    this.likes = this.likes
      .map(like => {
        if (typeof like === 'object' && like.user) {
          // Convert old object format to ObjectId
          return like.user;
        } else if (mongoose.Types.ObjectId.isValid(like)) {
          // Keep valid ObjectIds
          return like;
        } else {
          // Remove invalid entries
          return null;
        }
      })
      .filter(like => like !== null);
  }
  
  // ✅ CRITICAL: Always ensure comments is an array
  if (!this.comments || !Array.isArray(this.comments)) {
    this.comments = [];
  }
  
  next();
});

// ✅ INDEXES: For better query performance
memoryPhotoSchema.index({ memory: 1, uploadedAt: -1 });
memoryPhotoSchema.index({ uploadedBy: 1 });
memoryPhotoSchema.index({ isDeleted: 1 });
memoryPhotoSchema.index({ 'likes': 1 }); // ✅ Index for like queries
memoryPhotoSchema.index({ 'comments.user': 1 });

// ✅ STATIC METHOD: Find photos with like status for user
memoryPhotoSchema.statics.findWithLikeStatus = function(query, userId) {
  return this.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'users',
        localField: 'uploadedBy',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $lookup: {
        from: 'memories',
        localField: 'memory',
        foreignField: '_id',
        as: 'memory'
      }
    },
    {
      $unwind: { path: '$user', preserveNullAndEmptyArrays: false }
    },
    {
      $unwind: { path: '$memory', preserveNullAndEmptyArrays: false }
    },
    {
      $addFields: {
        userLiked: {
          $cond: {
            if: { $isArray: '$likes' },
            then: { $in: [userId, '$likes'] },
            else: false
          }
        },
        likeCount: {
          $cond: {
            if: { $isArray: '$likes' },
            then: { $size: '$likes' },
            else: 0
          }
        },
        commentCount: {
          $cond: {
            if: { $isArray: '$comments' },
            then: { $size: '$comments' },
            else: 0
          }
        }
      }
    },
    {
      $sort: { uploadedAt: -1 }
    }
  ]);
};

module.exports = mongoose.model('MemoryPhoto', memoryPhotoSchema);