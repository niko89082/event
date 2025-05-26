const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    created: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MemoryPhotoSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  memory: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', required: true },
  path:   { type: String, required: true },           // exactly one file per doc
  likes:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [CommentSchema],
  created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MemoryPhoto', MemoryPhotoSchema);