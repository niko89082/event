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
  event: {
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
    default: [], // ✅ Always start with empty array
    required: true, // ✅ Make it required
  },
  comments: [CommentSchema],
  tags: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  visibleInEvent: {
    type: Boolean,
    default: true,
  },
  shareCount: {
    type: Number,
    default: 0,
  },
});
PhotoSchema.index({ user: 1, visibleInEvent: 1 });
module.exports = mongoose.model('Photo', PhotoSchema);