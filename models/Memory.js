// models/Memory.js
const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
  },
  photos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo',
  }],
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Memory', MemorySchema);