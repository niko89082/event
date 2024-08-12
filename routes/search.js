// routes/search.js
const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const Photo = require('../models/Photo');
const protect = require('../middleware/auth');

const router = express.Router();

// Search and filter events
router.get('/events', async (req, res) => {
  const { title, location, startDate, endDate, minPrice, maxPrice, category } = req.query;
  let query = { isPublic: true }; // Only include public events by default

  if (title) {
    query.title = { $regex: title, $options: 'i' };
  }

  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }

  if (startDate || endDate) {
    query.time = {};
    if (startDate) {
      query.time.$gte = new Date(startDate);
    }
    if (endDate) {
      query.time.$lte = new Date(endDate);
    }
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) {
      query.price.$gte = parseFloat(minPrice);
    }
    if (maxPrice) {
      query.price.$lte = parseFloat(maxPrice);
    }
  }

  if (category) {
    query.category = category;
  }

  try {
    const events = await Event.find(query).populate('host', 'username').populate('coHosts', 'username');
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search and filter users by username
router.get('/users', protect, async (req, res) => {
  const { username } = req.query;

  let query = { isPublic: true }; // Only include public profiles

  if (username) {
    query.username = { $regex: username, $options: 'i' }; // Case-insensitive search
  }

  try {
    const users = await User.find(query);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending events
router.get('/trending/events', async (req, res) => {
  try {
    const events = await Event.find().sort({ attendees: -1 }).limit(10).populate('host', 'username');
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending photos
router.get('/trending/photos', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ likes: -1 }).limit(10).populate('user', 'username');
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate event recommendations for the user
router.get('/recommendations/events', protect, async (req, res) => {
  try {
    // Get the current user
    const user = await User.findById(req.user._id);

    // Get events that the user attended, liked, or commented on
    const attendedEvents = await Event.find({ attendees: user._id }).populate('host', 'username');
    const likedEvents = await Event.find({ likes: user._id }).populate('host', 'username');
    const commentedEvents = await Event.find({ 'comments.user': user._id }).populate('host', 'username');

    // Merge all events and remove duplicates
    const allEvents = [...new Set([...attendedEvents, ...likedEvents, ...commentedEvents])];

    res.status(200).json(allEvents);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate user recommendations for the user
router.get('/recommendations/users', protect, async (req, res) => {
  try {
    // Get the current user
    const user = await User.findById(req.user._id);

    // Get users that the current user follows
    const followedUsers = user.following;

    // Find other users followed by the followed users
    const recommendedUsers = await User.find({ _id: { $in: followedUsers } }).populate('followers');

    // Remove the current user from the recommendations
    const filteredUsers = recommendedUsers.filter(u => u._id.toString() !== user._id.toString());

    res.status(200).json(filteredUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;