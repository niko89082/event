const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  ],
  isGroup: {
    type: Boolean,
    default: false,
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
  ],
});

module.exports = mongoose.model('Conversation', ConversationSchema);