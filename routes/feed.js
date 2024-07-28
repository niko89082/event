const express = require('express');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

// Get User Feed
router.get('/feed', protect, async (req, res) => {
  try {
    // Get the logged-in user's following list and interests
    const user = await User.findById(req.user._id).populate('following', 'username');

    // Get posts from followed users
    const followedUsersPosts = await Photo.find({
      user: { $in: user.following }
    }).populate('user', 'username').sort({ uploadDate: -1 });

    // Get events from followed users
    const followedUsersEvents = await Event.find({
      host: { $in: user.following }
    }).populate('host', 'username').sort({ time: -1 });

    // Get posts based on user's interests
    const interestsPosts = await Photo.find({
      tags: { $in: user.interests }
    }).populate('user', 'username').sort({ uploadDate: -1 });

    // Get events based on user's interests
    const interestsEvents = await Event.find({
      categories: { $in: user.interests }
    }).populate('host', 'username').sort({ time: -1 });

    // Combine and sort feed items
    const feedItems = [
      ...followedUsersPosts,
      ...followedUsersEvents,
      ...interestsPosts,
      ...interestsEvents
    ].sort((a, b) => b.uploadDate - a.uploadDate || b.time - a.time);

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedFeed = feedItems.slice(startIndex, endIndex);

    res.status(200).json({
      feed: paginatedFeed,
      page,
      totalPages: Math.ceil(feedItems.length / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;