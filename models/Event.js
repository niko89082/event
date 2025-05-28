// models/Event.js - Enhanced with Privacy System
const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  message   : { type: String, required: true },
  createdAt : { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  user      : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text      : { type: String, required: true },
  tags      : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt : { type: Date, default: Date.now }
});

const EventSchema = new mongoose.Schema({
  /* basic info */
  title        : { type: String, required: true },
  description  : { type: String, required: true },
  category     : { type: String, required: true, default: 'General' },
  time         : { type: Date, required: true },

  /* location */
  location     : { type: String, required: true },
  geo          : {
    type        : { type: String, enum: ['Point'] },
    coordinates : { type: [Number] }
  },

  /* limits & pricing */
  maxAttendees : { type: Number, required: true },
  price        : { type: Number, default: 0 },
  ticketPrice  : { type: Number, default: 0 },

  /* hosting & roles */
  host         : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coHosts      : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  coHostRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  /* ENHANCED PRIVACY SYSTEM */
  privacyLevel : {
    type: String,
    enum: ['public', 'friends', 'private', 'secret'],
    default: 'public'
  },
  
  permissions: {
    canView: {
      type: String,
      enum: ['anyone', 'followers', 'invitees', 'host-only'],
      default: 'anyone'
    },
    canJoin: {
      type: String,
      enum: ['anyone', 'followers', 'invited', 'approval-required'],
      default: 'anyone'
    },
    canShare: {
      type: String,
      enum: ['anyone', 'attendees', 'co-hosts', 'host-only'],
      default: 'attendees'
    },
    canInvite: {
      type: String,
      enum: ['anyone', 'attendees', 'co-hosts', 'host-only'],
      default: 'attendees'
    },
    appearInFeed: { type: Boolean, default: true },
    appearInSearch: { type: Boolean, default: true },
    showAttendeesToPublic: { type: Boolean, default: true }
  },

  /* visibility & behaviour - DEPRECATED but kept for backward compatibility */
  isPublic     : { type: Boolean, default: true },
  openToPublic : { type: Boolean, default: true },
  recurring    : { type: String, enum: ['daily', 'weekly', 'monthly'], default: null },

  /* media permissions */
  coverImage             : { type: String, default: '' },
  allowPhotos            : { type: Boolean, default: true },
  allowUploads           : { type: Boolean, default: true },
  allowUploadsBeforeStart: { type: Boolean, default: true },

  /* relations */
  group        : { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  attendees    : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  invitedUsers : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bannedUsers  : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  checkedIn    : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  /* join requests for approval-required events */
  joinRequests : [{ 
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now },
    message: String
  }],

  /* content */
  photos       : [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo', index: true }],
  removedPhotos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo' }],
  comments     : [CommentSchema],
  announcements: [AnnouncementSchema],

  /* engagement */
  likes        : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shareCount   : { type: Number, default: 0 },
  
  /* recommendations & discovery */
  tags         : [String], // for interest matching
  weatherDependent: { type: Boolean, default: false },
  ageRestriction: { min: Number, max: Number },
  interests    : [String], // categories for matching

}, { timestamps: true });

/* ---------- indexes ------------------------------------------------------- */
// full-text search
EventSchema.index(
  { title: 'text', category: 'text', description: 'text', tags: 'text' },
  { name: 'EventFullText', weights: { title: 8, category: 5, description: 1, tags: 3 } }
);

// chronological queries
EventSchema.index({ time: 1 });
EventSchema.index({ privacyLevel: 1, time: 1 });

// geo-spatial queries
EventSchema.index(
  { geo: '2dsphere' },
  { sparse: true, partialFilterExpression: { 'geo.coordinates.1': { $exists: true } } }
);

// discovery indexes
EventSchema.index({ category: 1, time: 1 });
EventSchema.index({ tags: 1, time: 1 });
EventSchema.index({ host: 1, time: 1 });

/* ---------- helper methods ------------------------------------------------ */

// Check if user can view this event
EventSchema.methods.canUserView = function(userId, userFollowers = []) {
  const userIdStr = String(userId);
  const hostStr = String(this.host);
  
  // Host can always view
  if (userIdStr === hostStr) return true;
  
  // Co-hosts can always view
  if (this.coHosts.some(c => String(c) === userIdStr)) return true;
  
  // Check privacy level and permissions
  switch (this.privacyLevel) {
    case 'public':
      return this.permissions.canView === 'anyone' || 
             (this.permissions.canView === 'followers' && userFollowers.includes(hostStr));
    
    case 'friends':
      return userFollowers.includes(hostStr);
    
    case 'private':
      return this.invitedUsers.some(u => String(u) === userIdStr) ||
             this.attendees.some(u => String(u) === userIdStr);
    
    case 'secret':
      return this.invitedUsers.some(u => String(u) === userIdStr) ||
             this.attendees.some(u => String(u) === userIdStr);
    
    default:
      return false;
  }
};

// Check if user can join this event
EventSchema.methods.canUserJoin = function(userId, userFollowers = []) {
  if (!this.canUserView(userId, userFollowers)) return false;
  
  const userIdStr = String(userId);
  const hostStr = String(this.host);
  
  // Already attending
  if (this.attendees.some(u => String(u) === userIdStr)) return false;
  
  // Banned
  if (this.bannedUsers.some(u => String(u) === userIdStr)) return false;
  
  // Check join permissions
  switch (this.permissions.canJoin) {
    case 'anyone':
      return this.privacyLevel === 'public';
    
    case 'followers':
      return userFollowers.includes(hostStr);
    
    case 'invited':
      return this.invitedUsers.some(u => String(u) === userIdStr);
    
    case 'approval-required':
      return true; // They can request to join
    
    default:
      return false;
  }
};

// Check if user can invite others
EventSchema.methods.canUserInvite = function(userId) {
  const userIdStr = String(userId);
  const hostStr = String(this.host);
  
  // Host can always invite
  if (userIdStr === hostStr) return true;
  
  // Co-hosts can always invite
  if (this.coHosts.some(c => String(c) === userIdStr)) return true;
  
  // Check invite permissions
  switch (this.permissions.canInvite) {
    case 'anyone':
      return true;
    
    case 'attendees':
      return this.attendees.some(u => String(u) === userIdStr);
    
    case 'co-hosts':
      return false; // Already checked above
    
    case 'host-only':
      return false; // Already checked above
    
    default:
      return false;
  }
};

// Sync legacy isPublic field with new privacy system
EventSchema.pre('save', function(next) {
  // Update legacy field based on new privacy system
  this.isPublic = this.privacyLevel === 'public' && this.permissions.appearInSearch;
  next();
});

module.exports = mongoose.model('Event', EventSchema);