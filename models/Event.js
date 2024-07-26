const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  time: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  maxAttendees: {
    type: Number,
    required: true,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  coHosts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  price: {
    type: Number,
    required: false,
  },
  attendees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  isPublic: {
    type: Boolean,
    default: true,
  },
  recurring: {
    type: String, // e.g., "weekly", "monthly", etc.
    required: false,
  },
  documents: [
    {
      type: String, // URLs of uploaded documents
      required: false,
    },
  ],
  announcements: [
    {
      message: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
});

module.exports = mongoose.model('Event', EventSchema);