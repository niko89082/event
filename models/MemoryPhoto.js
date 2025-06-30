// models/MemoryPhoto.js - Separate schema for memory photos
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
  
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ✅ INDEX: For better query performance
memoryPhotoSchema.index({ memory: 1, uploadedAt: -1 });
memoryPhotoSchema.index({ uploadedBy: 1 });
memoryPhotoSchema.index({ isDeleted: 1 });

// ✅ VIRTUAL: Get full URL with domain
memoryPhotoSchema.virtual('fullUrl').get(function() {
  return process.env.BASE_URL ? `${process.env.BASE_URL}${this.url}` : this.url;
});

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
  const { memoryId, file, uploadedBy, caption } = photoData;
  
  const photo = new this({
    memory: memoryId,
    url: `/uploads/memory-photos/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    uploadedBy,
    caption: caption || '',
    fileSize: file.size,
    mimeType: file.mimetype
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