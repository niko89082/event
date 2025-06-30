// models/MemoryPhoto.js - Updated with likes and comments functionality
const mongoose = require('mongoose');

// Comment schema for memory photos
const MemoryCommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxLength: [500, 'Comment cannot exceed 500 characters'],
    trim: true
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  editedAt: {
    type: Date
  },
  isEdited: {
    type: Boolean,
    default: false
  }
});

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
  
  // ✅ NEW: Likes functionality
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // ✅ NEW: Comments functionality
  comments: [MemoryCommentSchema],
  
  // ✅ NEW: Tags for people in the photo
  taggedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
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
        return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
      },
      message: 'Only JPEG, PNG, GIF, and WebP images are allowed'
    }
  },
  
  dimensions: {
    width: Number,
    height: Number
  },
  
  // ✅ NEW: Engagement metrics
  viewCount: {
    type: Number,
    default: 0
  },
  
  shareCount: {
    type: Number,
    default: 0
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // ✅ NEW: Moderation flags
  reportCount: {
    type: Number,
    default: 0
  },
  
  isReported: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ✅ INDEXES for better query performance
memoryPhotoSchema.index({ memory: 1, uploadedAt: -1 });
memoryPhotoSchema.index({ uploadedBy: 1 });
memoryPhotoSchema.index({ isDeleted: 1 });
memoryPhotoSchema.index({ likes: 1 });
memoryPhotoSchema.index({ 'comments.user': 1 });

// ✅ VIRTUAL: Get full URL with domain
memoryPhotoSchema.virtual('fullUrl').get(function() {
  return process.env.BASE_URL ? 
    `${process.env.BASE_URL}${this.url}` : this.url;
});

// ✅ VIRTUAL: Get like count
memoryPhotoSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// ✅ VIRTUAL: Get comment count
memoryPhotoSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// ✅ VIRTUAL: Check if photo is liked by a specific user
memoryPhotoSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.equals(userId));
};

// ✅ INSTANCE METHOD: Toggle like
memoryPhotoSchema.methods.toggleLike = function(userId) {
  const index = this.likes.indexOf(userId);
  if (index > -1) {
    this.likes.splice(index, 1);
    return { liked: false, likeCount: this.likes.length };
  } else {
    this.likes.push(userId);
    return { liked: true, likeCount: this.likes.length };
  }
};

// ✅ INSTANCE METHOD: Add comment
memoryPhotoSchema.methods.addComment = function(userId, text, tags = []) {
  const comment = {
    user: userId,
    text: text.trim(),
    tags,
    createdAt: new Date()
  };
  
  this.comments.push(comment);
  return comment;
};

// ✅ INSTANCE METHOD: Edit comment
memoryPhotoSchema.methods.editComment = function(commentId, newText, userId) {
  const comment = this.comments.id(commentId);
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  if (!comment.user.equals(userId)) {
    throw new Error('Unauthorized to edit this comment');
  }
  
  comment.text = newText.trim();
  comment.editedAt = new Date();
  comment.isEdited = true;
  
  return comment;
};

// ✅ INSTANCE METHOD: Delete comment
memoryPhotoSchema.methods.deleteComment = function(commentId, userId) {
  const comment = this.comments.id(commentId);
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  if (!comment.user.equals(userId)) {
    throw new Error('Unauthorized to delete this comment');
  }
  
  comment.remove();
  return this.save();
};

// ✅ INSTANCE METHOD: Increment view count
memoryPhotoSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// ✅ PRE-DELETE: Clean up file when photo is deleted
memoryPhotoSchema.pre('deleteOne', { document: true, query: false }, function(next) {
  const fs = require('fs');
  const path = require('path');
  
  // Delete physical file
  const filePath = path.join(__dirname, '..', this.url);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log('✅ Deleted photo file:', filePath);
    } catch (error) {
      console.error('❌ Error deleting photo file:', error);
    }
  }
  
  next();
});

// ✅ STATIC METHOD: Create photo with file info
memoryPhotoSchema.statics.createPhoto = async function(photoData) {
  const { memoryId, file, uploadedBy, caption, taggedUsers = [] } = photoData;
  
  const photo = new this({
    memory: memoryId,
    url: `/uploads/memory-photos/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    uploadedBy,
    caption: caption || '',
    taggedUsers,
    fileSize: file.size,
    mimeType: file.mimetype,
    likes: [],
    comments: []
  });
  
  return photo.save();
};

// ✅ INSTANCE METHOD: Soft delete
memoryPhotoSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// ✅ JSON transform
memoryPhotoSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.isDeleted;
    return ret;
  }
});

module.exports = mongoose.model('MemoryPhoto', memoryPhotoSchema);