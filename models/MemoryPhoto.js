// models/MemoryPhoto.js - Enhanced with likes, comments, and proper validation
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

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
    trim: true,
    default: ''
  },
  
  location: {
    type: String,
    maxLength: [100, 'Location cannot exceed 100 characters'],
    trim: true,
    default: ''
  },
  
  // ✅ Likes functionality
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // ✅ Comments functionality
  comments: [MemoryCommentSchema],
  
  // ✅ Tags for people in the photo
  taggedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  
  size: {
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
  
  // ✅ Privacy settings
  isPrivate: {
    type: Boolean,
    default: false
  },
  
  // ✅ Engagement metrics
  viewCount: {
    type: Number,
    default: 0
  },
  
  shareCount: {
    type: Number,
    default: 0
  },
  
  downloadCount: {
    type: Number,
    default: 0
  },
  
  // ✅ Status flags
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  isProcessing: {
    type: Boolean,
    default: false
  },
  
  // ✅ Moderation flags
  reportCount: {
    type: Number,
    default: 0
  },
  
  isReported: {
    type: Boolean,
    default: false
  },
  
  isFlagged: {
    type: Boolean,
    default: false
  },
  
  // ✅ Quality/processing info
  quality: {
    type: String,
    enum: ['original', 'high', 'medium', 'low'],
    default: 'original'
  },
  
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// ✅ INDEXES for better query performance
memoryPhotoSchema.index({ memory: 1, uploadedAt: -1 });
memoryPhotoSchema.index({ uploadedBy: 1, uploadedAt: -1 });
memoryPhotoSchema.index({ isDeleted: 1 });
memoryPhotoSchema.index({ likes: 1 });
memoryPhotoSchema.index({ 'comments.user': 1 });
memoryPhotoSchema.index({ taggedUsers: 1 });
memoryPhotoSchema.index({ memory: 1, isDeleted: 1, uploadedAt: -1 });

// ✅ VIRTUAL: Get full URL with domain
memoryPhotoSchema.virtual('fullUrl').get(function() {
  if (process.env.BASE_URL) {
    return `${process.env.BASE_URL}${this.url}`;
  }
  return this.url;
});

// ✅ VIRTUAL: Get like count
memoryPhotoSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// ✅ VIRTUAL: Get comment count
memoryPhotoSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// ✅ VIRTUAL: Check if user liked this photo
memoryPhotoSchema.virtual('isLikedByUser').get(function() {
  if (!this._userId || !this.likes) return false;
  return this.likes.some(like => like.toString() === this._userId.toString());
});

// ✅ METHOD: Set user context for virtuals
memoryPhotoSchema.methods.setUserContext = function(userId) {
  this._userId = userId;
  return this;
};

// ✅ PRE-REMOVE HOOK: Clean up file when document is deleted
memoryPhotoSchema.pre('remove', async function(next) {
  try {
    const filePath = path.join(__dirname, '..', 'uploads', 'memory-photos', this.filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('✅ Deleted photo file:', filePath);
    }
  } catch (error) {
    console.error('❌ Error deleting photo file:', error);
  }
  
  next();
});

// ✅ STATIC METHOD: Create photo with file info
memoryPhotoSchema.statics.createPhoto = async function(photoData) {
  const { 
    memoryId, 
    file, 
    uploadedBy, 
    caption = '', 
    location = '',
    taggedUsers = [],
    isPrivate = false
  } = photoData;
  
  const photo = new this({
    memory: memoryId,
    url: `/uploads/memory-photos/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    uploadedBy,
    caption,
    location,
    taggedUsers,
    isPrivate,
    size: file.size,
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

// ✅ INSTANCE METHOD: Toggle like
memoryPhotoSchema.methods.toggleLike = function(userId) {
  if (!userId) return false;
  
  const userIdStr = userId.toString();
  const likeIndex = this.likes.findIndex(like => like.toString() === userIdStr);
  
  if (likeIndex > -1) {
    // Unlike
    this.likes.splice(likeIndex, 1);
    return { isLiked: false, likeCount: this.likes.length };
  } else {
    // Like
    this.likes.push(userId);
    return { isLiked: true, likeCount: this.likes.length };
  }
};

// ✅ INSTANCE METHOD: Add comment
memoryPhotoSchema.methods.addComment = function(userId, text, taggedUsers = []) {
  if (!userId || !text || text.trim().length === 0) {
    throw new Error('User ID and comment text are required');
  }
  
  const comment = {
    user: userId,
    text: text.trim(),
    tags: taggedUsers,
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
  
  // Check if user owns the comment or is the photo uploader
  const canDelete = comment.user.toString() === userId.toString() || 
                   this.uploadedBy.toString() === userId.toString();
  
  if (!canDelete) {
    throw new Error('Not authorized to delete this comment');
  }
  
  this.comments.pull(commentId);
  return true;
};

// ✅ STATIC METHOD: Find photos for memory with user context
memoryPhotoSchema.statics.findForMemory = function(memoryId, userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    sort = 'recent'
  } = options;
  
  const skip = (page - 1) * limit;
  
  let sortQuery = { uploadedAt: -1 }; // Default: most recent
  if (sort === 'popular') {
    sortQuery = { 'likes.length': -1, uploadedAt: -1 };
  }
  
  return this.find({
    memory: memoryId,
    isDeleted: false
  })
  .populate('uploadedBy', 'username profilePicture fullName')
  .populate('likes', 'username profilePicture fullName')
  .populate('comments.user', 'username profilePicture fullName')
  .populate('taggedUsers', 'username profilePicture fullName')
  .sort(sortQuery)
  .skip(skip)
  .limit(parseInt(limit))
  .then(photos => {
    // Set user context for virtuals
    return photos.map(photo => photo.setUserContext(userId));
  });
};

// ✅ JSON transform to clean output and include virtuals
memoryPhotoSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.isDeleted;
    delete ret.reportCount;
    delete ret.processingStatus;
    delete ret._userId; // Remove internal user context
    return ret;
  }
});

module.exports = mongoose.model('MemoryPhoto', memoryPhotoSchema);