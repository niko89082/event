const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// routes/follow.js - Follower-Following System (instant follows, no requests)

/**
 * POST /follow/:id
 * Follow a user (instant follow, no acceptance required)
 */
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

    // Check if already following
    if (userToFollow.followers.some(id => id.toString() === currentUserId.toString())) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Instant follow - add to both arrays
    if (!userToFollow.followers.some(id => id.toString() === currentUserId.toString())) {
      userToFollow.followers.push(currentUserId);
    }
    
    const currentUser = await User.findById(currentUserId);
    if (!currentUser.following.some(id => id.toString() === targetUserId.toString())) {
      currentUser.following.push(targetUserId);
    }

    await Promise.all([userToFollow.save(), currentUser.save()]);

    // Send new follower notification (non-blocking)
    setImmediate(async () => {
      try {
        await notificationService.createNotification({
          userId: targetUserId,
          senderId: currentUserId,
          category: 'social',
          type: 'new_follower',
          title: 'New Follower',
          message: `${currentUser.username} started following you`,
          data: {
            userId: currentUserId
          },
          actionType: 'VIEW_PROFILE',
          actionData: { userId: currentUserId }
        });
        console.log('🔔 New follower notification sent');
      } catch (notifError) {
        console.error('Failed to create follower notification:', notifError);
      }
    });

    return res.status(200).json({ 
      message: 'User followed', 
      isFollowing: true 
    });
  } catch (error) {
    console.error('POST /follow/:id error =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /follow/unfollow/:id
 * Unfollow user (id) if you are currently following them.
 */
router.delete('/unfollow/:id', protect, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    const userToUnfollow = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!userToUnfollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if currently following
    const isFollowing = currentUser.following.some(id => id.toString() === targetUserId.toString());
    if (!isFollowing) {
      return res.status(400).json({ message: 'You are not following this user' });
    }

    // Remove from both arrays
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== targetUserId.toString()
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== currentUserId.toString()
    );

    await Promise.all([currentUser.save(), userToUnfollow.save()]);

    return res.status(200).json({ message: 'User unfollowed' });
  } catch (error) {
    console.error('DELETE /follow/unfollow/:id =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;