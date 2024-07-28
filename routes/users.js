// routes/users.js (create this file)

const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const protect = require('../middleware/auth');

const router = express.Router();

// Generate event recommendations for the user
router.get('/recommendations/events', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const attendedEvents = await Event.find({ attendees: user._id }).populate('host', 'username');
    const likedEvents = await Event.find({ likes: user._id }).populate('host', 'username');
    const commentedEvents = await Event.find({ 'comments.user': user._id }).populate('host', 'username');

    const allEvents = [...new Set([...attendedEvents, ...likedEvents, ...commentedEvents])];

    res.status(200).json(allEvents);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate user recommendations for the user
router.get('/recommendations/users', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const followedUsers = user.following;

    const recommendedUsers = await User.find({ _id: { $in: followedUsers } }).populate('followers');
    const filteredUsers = recommendedUsers.filter(u => u._id.toString() !== user._id.toString());

    res.status(200).json(filteredUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;