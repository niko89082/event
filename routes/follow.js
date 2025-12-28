const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// routes/follow.js - Follower-Following System (instant follows, no requests)

/**
 * POST /api/follow/follow/:id
 * Follow a user (instant follow, no acceptance required)
 */
router.post('/follow/:id', protect, async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user._id;
  
  try {
    console.log('🔔 Follow request:', { targetUserId, currentUserId });

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const userToFollow = await User.findById(targetUserId);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure arrays are initialized
    if (!userToFollow.followers) {
      userToFollow.followers = [];
    }

    // Get current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }

    // Ensure arrays are initialized
    if (!currentUser.following) {
      currentUser.following = [];
    }

    // Check if already following (check both arrays)
    // Convert to strings for comparison
    const currentUserIdStr = currentUserId.toString();
    const targetUserIdStr = targetUserId.toString();
    
    const alreadyInFollowers = (userToFollow.followers || []).some(id => 
      id.toString() === currentUserIdStr
    );
    const alreadyInFollowing = (currentUser.following || []).some(id => 
      id.toString() === targetUserIdStr
    );

    if (alreadyInFollowers || alreadyInFollowing) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Instant follow - add to both arrays
    // Ensure arrays exist
    if (!Array.isArray(userToFollow.followers)) {
      userToFollow.followers = [];
    }
    if (!Array.isArray(currentUser.following)) {
      currentUser.following = [];
    }
    
    userToFollow.followers.push(currentUserId);
    currentUser.following.push(targetUserId);

    // Fix invalid privacy values (migrate 'friends' to 'followers' or 'public')
    // This handles users who still have old 'friends' privacy settings
    if (userToFollow.privacy) {
      if (userToFollow.privacy.eventAttendance === 'friends') {
        userToFollow.privacy.eventAttendance = 'followers';
        userToFollow.markModified('privacy');
      }
      if (userToFollow.privacy.posts === 'friends') {
        userToFollow.privacy.posts = 'followers';
        userToFollow.markModified('privacy');
      }
    }
    if (currentUser.privacy) {
      if (currentUser.privacy.eventAttendance === 'friends') {
        currentUser.privacy.eventAttendance = 'followers';
        currentUser.markModified('privacy');
      }
      if (currentUser.privacy.posts === 'friends') {
        currentUser.privacy.posts = 'followers';
        currentUser.markModified('privacy');
      }
    }

    // Mark arrays as modified to ensure Mongoose saves them
    userToFollow.markModified('followers');
    currentUser.markModified('following');

    await Promise.all([userToFollow.save(), currentUser.save()]);

    console.log('✅ Successfully followed user:', {
      targetUser: userToFollow.username,
      currentUser: currentUser.username,
      targetFollowersCount: userToFollow.followers.length,
      currentFollowingCount: currentUser.following.length
    });

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
    console.error('❌ POST /follow/:id error =>', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      targetUserId,
      currentUserId
    });
    return res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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