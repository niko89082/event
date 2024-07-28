const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  time: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
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
  maxAttendees: {
    type: Number,
    required: true,
  },
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
  openToPublic: {
    type: Boolean,
    default: false,
  },
  allowUploads: {
    type: Boolean,
    default: true,
  },
  recurring: {
    type: String,
    required: false,
  },
  announcements: [AnnouncementSchema],
  documents: [
    {
      type: String,
      required: false,
    },
  ],
  categories: [
    {
      type: String,
      required: false,
    },
  ],
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  comments: [
    {
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
    }
  ],
  ticketsSold: {
    type: Number,
    default: 0,
  },
  ticketPrice: {
    type: Number,
    required: false,
  },
  allowPhotos: {
    type: Boolean,
    default: true,
  },
  photos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
    },
  ],
  checkedIn: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
});

module.exports = mongoose.model('Event', EventSchema);