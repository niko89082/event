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
  path: {
    type: String,
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
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

module.exports = mongoose.model('Photo', PhotoSchema);