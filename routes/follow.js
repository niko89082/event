const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');

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

    // Check if you're already in their 'followers'
    if (userToFollow.followers.includes(currentUserId)) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Check if you already have a pending request
    if (userToFollow.followRequests.includes(currentUserId)) {
      return res.status(400).json({ message: 'Follow request already sent' });
    }

    if (userToFollow.isPublic) {
      // Public account - instant follow
      userToFollow.followers.push(currentUserId);
      req.user.following.push(targetUserId);

      await userToFollow.save();
      await req.user.save();

      // ✅ NEW: Send immediate follow notification (non-blocking)
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: targetUserId,
            senderId: currentUserId,
            category: 'social',
            type: 'new_follower',
            title: 'New Follower',
            message: `${req.user.username} started following you`,
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

      return res.status(200).json({ message: 'User followed', isFollowing: true });
    } else {
      // Private account - send follow request
      userToFollow.followRequests.push(currentUserId);
      await userToFollow.save();

      // ✅ NEW: Send friend request notification (non-blocking)
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: targetUserId,
            senderId: currentUserId,
            category: 'social',
            type: 'friend_request',
            title: 'Follow Request',
            message: `${req.user.username} sent you a follow request`,
            data: {
              userId: currentUserId
            },
            actionType: 'ACCEPT_REQUEST',
            actionData: { requesterId: currentUserId }
          });
          console.log('🔔 Friend request notification sent');
        } catch (notifError) {
          console.error('Failed to create friend request notification:', notifError);
        }
      });

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
    const requesterId = req.params.requesterId;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const requester = await User.findById(requesterId);

    if (!req.params.requesterId || req.params.requesterId === 'undefined') {
      return res.status(400).json({ message: 'Invalid requesterId parameter' });
    }

    if (!currentUser || !requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if they are in your followRequests
    if (!currentUser.followRequests.includes(requester._id)) {
      return res.status(400).json({ message: 'Follow request not found' });
    }

    // Remove from pending
    currentUser.followRequests.pull(requester._id);
    // Add them to your followers
    if (!currentUser.followers.includes(requester._id)) {
      currentUser.followers.push(requester._id);
    }
    // Add you to their following
    if (!requester.following.includes(currentUser._id)) {
      requester.following.push(currentUser._id);
    }

    await currentUser.save();
    await requester.save();

    // ✅ NEW: Send acceptance notification (non-blocking)
    setImmediate(async () => {
      try {
        await notificationService.createNotification({
          userId: requesterId,
          senderId: currentUserId,
          category: 'social',
          type: 'friend_request_accepted',
          title: 'Follow Request Accepted',
          message: `${req.user.username} accepted your follow request`,
          data: {
            userId: currentUserId
          },
          actionType: 'VIEW_PROFILE',
          actionData: { userId: currentUserId }
        });
        console.log('🔔 Friend request accepted notification sent');
      } catch (notifError) {
        console.error('Failed to create acceptance notification:', notifError);
      }
    });

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