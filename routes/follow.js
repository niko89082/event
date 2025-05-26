const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/auth');

const { createNotification } = require('../utils/notifications');

// routes/follow.js

router.post('/follow/:id', protect, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const userToFollow = await User.findById(targetUserId);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if you’re already in their 'followers' (means you’re already following)
    if (userToFollow.followers.includes(currentUserId)) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Check if you already have a pending request
    if (userToFollow.followRequests.includes(currentUserId)) {
      return res.status(400).json({ message: 'Follow request already sent' });
    }

    // Distinguish between public and private accounts
    if (userToFollow.isPublic) {
      userToFollow.followers.push(currentUserId);
      req.user.following.push(targetUserId);

      await userToFollow.save();
      await req.user.save();

      // Possibly create a “follow” notification:
      // createNotification(userToFollow._id, 'follow', `${req.user.username} followed you`);

      return res.status(200).json({ message: 'User followed', isFollowing: true });
    } else {
      // PRIVATE => push to followRequests
      userToFollow.followRequests.push(currentUserId);
      await userToFollow.save();

      // Possibly notify them of the request:
      // createNotification(userToFollow._id, 'follow-request', 
      //   `${req.user.username} sent you a follow request`);

      return res.status(200).json({ message: 'Follow request sent', isFollowing: false });
    }
  } catch (error) {
    console.error('POST /follow/:id error =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /follow/accept/:requesterId
 * Accept a follow request from a given user (requesterId).
 */
router.post('/accept/:requesterId', protect, async (req, res) => {
    try {
      const currentUser = await User.findById(req.user._id);
      const requestUser = await User.findById(req.params.requesterId);
      if (!req.params.requesterId || req.params.requesterId === 'undefined') {
        return res.status(400).json({ message: 'Invalid requesterId parameter' });
      }

      if (!currentUser || !requestUser) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Check if they are in your followRequests
      if (!currentUser.followRequests.includes(requestUser._id)) {
        return res.status(400).json({ message: 'Follow request not found' });
      }
  
      // Remove from pending
      currentUser.followRequests.pull(requestUser._id);
      // Add them to your followers
      if (!currentUser.followers.includes(requestUser._id)) {
        currentUser.followers.push(requestUser._id);
      }
      // Add you to their following
      if (!requestUser.following.includes(currentUser._id)) {
        requestUser.following.push(currentUser._id);
      }
  
      await currentUser.save();
      await requestUser.save();
  
      return res.status(200).json({ message: 'Follow request accepted' });
    } catch (error) {
      console.error('Accept request error =>', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });

/**
 * DELETE /follow/decline/:requesterId
 * Decline a follow request from user (requesterId).
 */
router.delete('/decline/:requesterId', protect, async (req, res) => {
    try {
      const currentUser = await User.findById(req.user._id);
      if (!currentUser) {
        return res.status(404).json({ message: 'Current user not found' });
      }
  
      // If we can’t find them in currentUser.followRequests => 400
      if (!currentUser.followRequests.includes(req.params.requesterId)) {
        return res.status(400).json({ message: 'Follow request not found' });
      }
  
      // remove them from your followRequests
      currentUser.followRequests.pull(req.params.requesterId);
      await currentUser.save();
  
      return res.status(200).json({ message: 'Follow request declined' });
    } catch (error) {
      console.error('Decline request error =>', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });

/**
 * DELETE /follow/cancel/:id
 * Cancel the follow request you sent to user (id).
 */
router.delete('/cancel/:id', protect, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.id);
    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If you are not in their followRequests, no request found
    if (!userToUnfollow.followRequests.includes(req.user._id)) {
      return res.status(400).json({ message: 'No follow request found' });
    }

    userToUnfollow.followRequests.pull(req.user._id);
    await userToUnfollow.save();

    return res.status(200).json({ message: 'Follow request canceled' });
  } catch (error) {
    console.error('DELETE /follow/cancel/:id =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /follow/unfollow/:id
 * Unfollow user (id) if you are currently following them.
 */
router.delete('/unfollow/:id', protect, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = req.user; // from protect

    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If not in your following => can't unfollow
    if (!currentUser.following.includes(userToUnfollow._id)) {
      return res.status(400).json({ message: 'You are not following this user' });
    }

    // Remove them from your following
    currentUser.following.pull(userToUnfollow._id);

    // Remove you from their followers
    userToUnfollow.followers.pull(currentUser._id);

    await userToUnfollow.save();
    await currentUser.save();

    return res.status(200).json({ message: 'User unfollowed' });
  } catch (error) {
    console.error('DELETE /follow/unfollow/:id =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /follow/my-requests
router.get('/my-requests', protect, async (req, res) => {
    try {
      // The current user
      const currentUser = await User.findById(req.user._id)
        .populate('followRequests', '_id username profilePicture');
  
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Return the array of users who requested to follow you
      // e.g. [ { _id, username, profilePicture }, ... ]
      return res.json({ followRequests: currentUser.followRequests });
    } catch (error) {
      console.error('GET /follow/my-requests =>', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });

module.exports = router;