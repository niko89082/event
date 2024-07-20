// routes/search.js
const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

// Search and filter events
router.get('/events', async (req, res) => {
  const { title, location, startDate, endDate, minPrice, maxPrice } = req.query;

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

module.exports = router;