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
router.get('/:userId/followers', protect, async (req, res) => {
  console.log("getting followers");
  try{
  const user = await User.findById(req.params.userId).populate('followers', 'username');
  res.json(user.followers);
  }catch(e){
    console.log(e);
  }
});

router.get('/:userId/following', protect, async (req, res) => {
  try{
  const user = await User.findById(req.params.userId).populate('following', 'username');
  res.json(user.following);
  }catch(e){
    console.log(e);
  }
});
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.status(400).json({ message: 'Search query too short' });
    }

    const searchQuery = q.trim();
    
    // Search by username, fullName, or email (case insensitive)
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } }, // Exclude current user
        {
          $or: [
            { username: { $regex: searchQuery, $options: 'i' } },
            { fullName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    })
    .select('username fullName email profilePicture')
    .limit(50)
    .sort({ username: 1 });

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /users/following - Get users that current user follows
router.get('/following', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
      .populate('following', 'username fullName email profilePicture')
      .select('following');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(currentUser.following || []);
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /users/followers - Get users that follow current user
router.get('/followers', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
      .populate('followers', 'username fullName email profilePicture')
      .select('followers');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(currentUser.followers || []);
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;