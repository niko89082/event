const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  }],
  memories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Group', GroupSchema);