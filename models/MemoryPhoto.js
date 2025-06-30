// models/MemoryPhoto.js - Enhanced with likes and comments
const mongoose = require('mongoose');

const memoryPhotoSchema = new mongoose.Schema({
  memory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Memory',
    required: [true, 'Memory reference is required']
  },
  
  url: {
    type: String,
    required: [true, 'Photo URL is required']
  },
  
  filename: {
    type: String,
    required: [true, 'Filename is required']
  },
  
  originalName: {
    type: String,
    required: true
  },
  
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader reference is required']
  },
  
  caption: {
    type: String,
    maxLength: [200, 'Caption cannot exceed 200 characters'],
    trim: true
  },
  
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  
  fileSize: {
    type: Number,
    required: true
  },
  
  mimeType: {
    type: String,
    required: true,
    validate: {
      validator: function(mimeType) {
        return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(mimeType);
      },
      message: 'Only JPEG, PNG, and GIF images are allowed'
    }
  },
  
  dimensions: {
    width: Number,
    height: Number
  },
  
  // ✅ NEW: Like functionality
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ NEW: Comment functionality
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxLength: [500, 'Comment cannot exceed 500 characters'],
      trim: true
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
  
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
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

// ✅ INSTANCE METHOD: Toggle like
memoryPhotoSchema.methods.toggleLike = function(userId) {
  const existingLike = this.likes.find(like => like.user.equals(userId));
  
  if (existingLike) {
    // Remove like
    this.likes = this.likes.filter(like => !like.user.equals(userId));
    return { liked: false, likeCount: this.likes.length };
  } else {
    // Add like
    this.likes.push({ user: userId });
    return { liked: true, likeCount: this.likes.length };
  }
};

// ✅ INSTANCE METHOD: Add comment
memoryPhotoSchema.methods.addComment = function(userId, text, tags = []) {
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

// ✅ INDEX: For better query performance
memoryPhotoSchema.index({ memory: 1, uploadedAt: -1 });
memoryPhotoSchema.index({ uploadedBy: 1 });
memoryPhotoSchema.index({ isDeleted: 1 });
memoryPhotoSchema.index({ 'likes.user': 1 });
memoryPhotoSchema.index({ 'comments.user': 1 });

// ✅ JSON transform to include virtuals
memoryPhotoSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('MemoryPhoto', memoryPhotoSchema);