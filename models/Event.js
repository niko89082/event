// models/Event.js
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

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  time: { type: Date, required: true },
  location: { type: String, required: true },
  maxAttendees: { type: Number, required: true },
  price: { type: Number, default: 0 },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coHosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPublic: { type: Boolean, default: true },
  recurring: { type: String, enum: ['daily', 'weekly', 'monthly'], default: null },
  allowPhotos: { type: Boolean, default: true },
  openToPublic: { type: Boolean, default: true },
  allowUploads: { type: Boolean, default: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [CommentSchema],
  announcements: [AnnouncementSchema],
  documents: [{ type: String }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  photos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo' }],
  ticketPrice: { type: Number, required: true, default: 0 },
  checkedIn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shareCount: { type: Number, default: 0 },
  category: { type: String, required: true },
});

module.exports = mongoose.model('Event', EventSchema);