/******************************************************************
 * models/Event.js   – 1-file, ready to paste
 ******************************************************************/
const mongoose = require('mongoose');

/* ---------- sub-schemas --------------------------------------------------- */
const AnnouncementSchema = new mongoose.Schema({
  message   : { type:String, required:true },
  createdAt : { type:Date,   default:Date.now }
});

const CommentSchema = new mongoose.Schema({
  user      : { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  text      : { type:String, required:true },
  tags      : [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  createdAt : { type:Date, default:Date.now }
});

/* ---------- main schema --------------------------------------------------- */
const EventSchema = new mongoose.Schema({

  /* basic info */
  title        : { type:String,  required:true },
  description  : { type:String,  required:true },
  category     : { type:String,  required:true, default:'General' },
  time         : { type:Date,    required:true },

  /* location */
  location     : { type:String,  required:true },            // human text
  geo          : {                                           
    type        : { type:String, enum:['Point'] },           // GeoJSON Point
    coordinates : { type:[Number] }                          // [lng , lat]
  },

  /* limits & pricing */
  maxAttendees : { type:Number,  required:true },
  price        : { type:Number,  default:0 },                // legacy
  ticketPrice  : { type:Number,  default:0 },

  /* hosting & roles */
  host         : { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  coHosts      : [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  coHostRequests:[{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],

  /* visibility / behaviour */
  isPublic     : { type:Boolean, default:true },
  openToPublic : { type:Boolean, default:true },
  recurring    : { type:String,  enum:['daily','weekly','monthly'], default:null },

  /* media permissions */
  coverImage             : { type:String,  default:'' },
  allowPhotos            : { type:Boolean, default:true },
  allowUploads           : { type:Boolean, default:true },
  allowUploadsBeforeStart: { type:Boolean, default:true },

  /* relations */
  group        : { type:mongoose.Schema.Types.ObjectId, ref:'Group' },
  attendees    : [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  invitedUsers : [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  bannedUsers  : [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  checkedIn    : [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],

  /* content */
  photos       : [{ type:mongoose.Schema.Types.ObjectId, ref:'Photo', index:true }],
  removedPhotos:[{ type:mongoose.Schema.Types.ObjectId, ref:'Photo' }],
  comments     : [CommentSchema],
  announcements: [AnnouncementSchema],

  /* engagement */
  likes        : [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  shareCount   : { type:Number, default:0 }

}, { timestamps:true });

/* ---------- indexes ------------------------------------------------------- */

// full-text search  (title > category > description)
EventSchema.index(
  { title:'text', category:'text', description:'text' },
  { name:'EventFullText', weights:{ title:8, category:5, description:1 } }
);

// chronological queries
EventSchema.index({ time:1 });

// geo-spatial queries – **sparse** so documents without coords are ignored
EventSchema.index(
  { geo:'2dsphere' },
  { sparse:true, partialFilterExpression:{ 'geo.coordinates.1': { $exists:true } } }
);

module.exports = mongoose.model('Event', EventSchema);