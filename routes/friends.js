// routes/friends.js - PHASE 1: New Friends System Routes
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const mongoose = require('mongoose');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const FriendRecommendationService = require('../services/friendRecommendationService');
const Event = require('../models/Event');
/**

// ============================================
// FRIEND REQUEST MANAGEMENT
// ============================================

/**
 * POST /friends/request/:userId
 * Send a friend request to another user
 */

router.post('/quick-accept/:requesterId', protect, async (req, res) => {
  try {
    const requesterUserId = req.params.requesterId;
    const currentUserId = req.user._id;

    console.log(`🤝 Quick accept friend request: ${requesterUserId} -> ${currentUserId}`);

    const currentUser = await User.findById(currentUserId);
    const requesterUser = await User.findById(requesterUserId);
    
    if (!requesterUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if there's a pending request from this user
    const friendshipStatus = currentUser.getFriendshipStatus(requesterUserId);
    
    if (friendshipStatus.status !== 'request-received') {
      return res.status(400).json({ 
        success: false,
        message: 'No pending friend request from this user',
        currentStatus: friendshipStatus.status
      });
    }

    try {
      // Accept the friend request using your existing model method
      await currentUser.acceptFriendRequest(requesterUserId);
      
      // ✅ ENHANCED: Mark ALL related notifications as handled
      const updatedNotifications = await Notification.updateMany(
        { 
          $or: [
            {
              user: currentUserId, 
              sender: requesterUserId, 
              type: 'friend_request'
            },
            {
              user: requesterUserId,
              sender: currentUserId,
              type: 'friend_request'
            }
          ]
        },
        { 
          isRead: true, 
          readAt: new Date(),
          $set: { 'data.actionTaken': 'accepted' }
        }
      );

      console.log(`✅ Marked ${updatedNotifications.modifiedCount} notifications as accepted`);

      // Send notification to requester (non-blocking)
      setImmediate(async () => {
        try {
          await notificationService.sendFriendRequestAccepted(currentUserId, requesterUserId);
          console.log('🔔 Friend request accepted notification sent');
        } catch (notifError) {
          console.error('Failed to send friend request accepted notification:', notifError);
        }
      });

      res.status(200).json({ 
        success: true,
        message: `You and ${requesterUser.username} are now friends!`,
        status: 'friends',
        data: {
          friendUsername: requesterUser.username,
          friendId: requesterUserId,
          actionTaken: 'accepted',
          notificationState: 'friendship_established' // ✅ NEW: Signal for UI
        }
      });

    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Failed to accept friend request'
      });
    }

  } catch (error) {
    console.error('Quick accept friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

router.post('/request/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;
    const { message } = req.body; // Optional request message

    if (targetUserId === String(currentUserId)) {
      return res.status(400).json({ 
        success: false,
        message: 'You cannot send a friend request to yourself' 
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if already friends or request exists
    const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);
    
    if (friendshipStatus.status === 'friends') {
      return res.status(400).json({ 
        success: false,
        message: 'You are already friends with this user' 
      });
    }
    
    if (friendshipStatus.status === 'request-sent') {
      return res.status(400).json({ 
        success: false,
        message: 'Friend request already sent' 
      });
    }
    
    if (friendshipStatus.status === 'request-received') {
      return res.status(400).json({ 
        success: false,
        message: 'This user has already sent you a friend request. Accept it instead.' 
      });
    }

    // Check target user's privacy settings
    if (targetUser.privacy?.friendRequests === 'no-one') {
      return res.status(403).json({ 
        success: false,
        message: 'This user is not accepting friend requests' 
      });
    }

    // TODO: Implement friends-of-friends check
    if (targetUser.privacy?.friendRequests === 'friends-of-friends') {
      // For now, allow all requests - implement mutual friends check later
    }

    // 🔧 PHASE 1 FIX: Clean up any existing friend request notifications BEFORE sending new request
    console.log(`🧹 Cleaning up existing friend request notifications between ${currentUserId} and ${targetUserId}`);
    
    const cleanupResult = await Notification.deleteMany({
      $or: [
        {
          user: targetUserId,
          sender: currentUserId,
          type: 'friend_request'
        },
        {
          user: currentUserId,
          sender: targetUserId,
          type: 'friend_request'
        }
      ]
    });

    console.log(`🧹 Cleaned up ${cleanupResult.deletedCount} existing friend request notifications`);

    // Send friend request using model method
    try {
      await currentUser.sendFriendRequest(targetUserId, message || '');
      
      // Send notification (non-blocking)
      setImmediate(async () => {
        try {
          await notificationService.sendFriendRequest(currentUserId, targetUserId);
          console.log('🔔 Friend request notification sent (no duplicates)');
        } catch (notifError) {
          console.error('Failed to send friend request notification:', notifError);
        }
      });

      res.status(200).json({ 
        success: true,
        message: 'Friend request sent successfully',
        status: 'request-sent'
      });

    } catch (error) {
      res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }

  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

router.get('/request-status/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);

    res.json({
      success: true,
      status: friendshipStatus.status,
      data: friendshipStatus
    });

  } catch (error) {
    console.error('Error getting request status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});
/**
 * POST /friends/accept/:userId
 * Accept a friend request from another user
 */
router.post('/accept/:userId', protect, async (req, res) => {
  try {
    const requesterUserId = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`🤝 Accept friend request: ${requesterUserId} -> ${currentUserId}`);

    const currentUser = await User.findById(currentUserId);
    const requesterUser = await User.findById(requesterUserId);
    
    if (!requesterUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if there's a pending request from this user
    const friendshipStatus = currentUser.getFriendshipStatus(requesterUserId);
    
    if (friendshipStatus.status !== 'request-received') {
      return res.status(400).json({ 
        success: false,
        message: 'No pending friend request from this user',
        currentStatus: friendshipStatus.status
      });
    }

    try {
      await currentUser.acceptFriendRequest(requesterUserId);
      
      // ✅ ENHANCED: Mark the friend request notification as read and handled
      const updatedNotification = await Notification.findOneAndUpdate(
        { 
          user: currentUserId, 
          sender: requesterUserId, 
          type: 'friend_request',
          isRead: false 
        },
        { 
          isRead: true, 
          readAt: new Date(),
          $set: { 'data.actionTaken': 'accepted' }
        },
        { new: true }
      );

      console.log(`✅ Marked notification as accepted:`, updatedNotification?._id);

      // Send notification (non-blocking)
      setImmediate(async () => {
        try {
          await notificationService.sendFriendRequestAccepted(currentUserId, requesterUserId);
          console.log('🔔 Friend request accepted notification sent');
        } catch (notifError) {
          console.error('Failed to send friend acceptance notification:', notifError);
        }
      });

      // ✅ ENHANCED: Return more data for frontend UI updates
      res.status(200).json({ 
        success: true,
        message: `You are now friends with ${requesterUser.username}!`,
        status: 'friends',
        data: {
          friendUsername: requesterUser.username,
          friendId: requesterUserId,
          actionTaken: 'accepted'
        }
      });

    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Failed to accept friend request'
      });
    }

  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * DELETE /friends/reject/:userId
 * Reject a friend request from another user
 */
router.delete('/reject/:userId', protect, async (req, res) => {
  try {
    const requesterUserId = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`❌ Reject friend request: ${requesterUserId} -> ${currentUserId}`);

    const currentUser = await User.findById(currentUserId);
    const requesterUser = await User.findById(requesterUserId);
    
    if (!requesterUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if there's a pending request from this user
    const friendshipStatus = currentUser.getFriendshipStatus(requesterUserId);
    
    if (friendshipStatus.status !== 'request-received') {
      return res.status(400).json({ 
        success: false,
        message: 'No pending friend request from this user',
        currentStatus: friendshipStatus.status
      });
    }

    try {
      await currentUser.removeFriendship(requesterUserId);

      // ✅ ENHANCED: Mark the friend request notification as read and handled
      const updatedNotification = await Notification.findOneAndUpdate(
        { 
          user: currentUserId, 
          sender: requesterUserId, 
          type: 'friend_request',
          isRead: false 
        },
        { 
          isRead: true, 
          readAt: new Date(),
          $set: { 'data.actionTaken': 'rejected' }
        },
        { new: true }
      );

      console.log(`❌ Marked notification as rejected:`, updatedNotification?._id);

      // ✅ ENHANCED: Return more data for frontend UI updates
      res.status(200).json({ 
        success: true,
        message: 'Friend request rejected',
        status: 'rejected',
        data: {
          friendUsername: requesterUser.username,
          friendId: requesterUserId,
          actionTaken: 'rejected'
        }
      });

    } catch (error) {
      console.error('Error rejecting friend request:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Failed to reject friend request'
      });
    }

  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * DELETE /friends/cancel/:userId
 * Cancel a friend request you sent to another user
 */
router.delete('/cancel/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`🚫 Cancel friend request: ${currentUserId} -> ${targetUserId}`);

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if you sent a request to this user
    const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);
    
    if (friendshipStatus.status !== 'request-sent') {
      return res.status(400).json({ 
        success: false,
        message: 'No pending friend request to this user',
        currentStatus: friendshipStatus.status
      });
    }

    try {
      await currentUser.removeFriendship(targetUserId);

      // 🔧 PHASE 1 FIX: More thorough notification cleanup
      const deletedNotifications = await Notification.deleteMany({
        $or: [
          {
            user: targetUserId,
            sender: currentUserId,
            type: 'friend_request'
          },
          {
            user: currentUserId,
            sender: targetUserId,
            type: 'friend_request'
          }
        ]
      });

      console.log(`🧹 Cleaned up ${deletedNotifications.deletedCount} friend request notifications`);

      // ✅ ENHANCED: Return more data for frontend UI updates
      res.status(200).json({ 
        success: true,
        message: 'Friend request cancelled',
        status: 'not-friends',
        data: {
          targetUsername: targetUser.username,
          targetId: targetUserId,
          actionTaken: 'cancelled',
          notificationsCleanedUp: deletedNotifications.deletedCount
        }
      });

    } catch (error) {
      console.error('Error cancelling friend request:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Failed to cancel friend request'
      });
    }

  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});



router.delete('/request/:targetUserId', protect, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user._id;

    console.log(`❌ Canceling friend request (legacy route): ${currentUserId} -> ${targetUserId}`);

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if there's a pending request
    const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);
    
    if (friendshipStatus.status !== 'request-sent') {
      return res.status(400).json({ 
        success: false,
        message: 'No pending friend request to cancel' 
      });
    }

    // Remove from both users' friends arrays
    currentUser.friends = currentUser.friends.filter(f => 
      String(f.user) !== String(targetUserId)
    );
    
    targetUser.friends = targetUser.friends.filter(f => 
      String(f.user) !== String(currentUserId)
    );

    await Promise.all([
      currentUser.save(),
      targetUser.save()
    ]);

    // 🔧 PHASE 1 FIX: Enhanced cleanup - remove ALL related friend request notifications
    const deletedNotifications = await Notification.deleteMany({
      $or: [
        {
          user: targetUserId,
          sender: currentUserId,
          type: 'friend_request'
        },
        {
          user: currentUserId,
          sender: targetUserId,
          type: 'friend_request'
        }
      ]
    });

    console.log(`✅ Friend request canceled and ${deletedNotifications.deletedCount} notifications cleaned up`);

    res.json({
      success: true,
      message: 'Friend request canceled successfully',
      notificationsCleanedUp: deletedNotifications.deletedCount
    });

  } catch (error) {
    console.error('❌ Cancel friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});


/**
 * DELETE /friends/remove/:userId
 * Remove an existing friend
 */
router.delete('/remove/:userId', protect, async (req, res) => {
  try {
    const friendUserId = req.params.userId;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    
    // Check if you're actually friends with this user
    const friendshipStatus = currentUser.getFriendshipStatus(friendUserId);
    
    if (friendshipStatus.status !== 'friends') {
      return res.status(400).json({ 
        success: false,
        message: 'You are not friends with this user' 
      });
    }

    try {
      await currentUser.removeFriendship(friendUserId);

      res.status(200).json({ 
        success: true,
        message: 'Friend removed successfully',
        status: 'not-friends'
      });

    } catch (error) {
      res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }

  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// ============================================
// FRIENDS LIST MANAGEMENT
// ============================================

/**
 * GET /friends/list
 * Get current user's friends list
 */
router.get('/list', protect, async (req, res) => {
  try {
    const { status = 'accepted', limit = 50, offset = 0 } = req.query;
    
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (!user.friends || !Array.isArray(user.friends)) {
      return res.status(200).json({
        success: true,
        friends: [],
        total: 0,
        hasMore: false
      });
    }

    let friends = user.friends.filter(f => f.status === status);
    
    // Sort by acceptance date (most recent first) for accepted friends
    if (status === 'accepted') {
      friends = friends.sort((a, b) => 
        new Date(b.acceptedAt || b.createdAt) - new Date(a.acceptedAt || a.createdAt)
      );
    } else {
      // Sort by request date for pending requests
      friends = friends.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // Apply pagination
    const paginatedFriends = friends.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Populate user details for each friend
    const populatedFriends = await Promise.all(
      paginatedFriends.map(async (f) => {
        const friendUser = await User.findById(f.user).select('username displayName profilePicture bio isPublic');
        if (!friendUser) {
          return null;
        }
        return {
          _id: friendUser._id,
          username: friendUser.username,
          displayName: friendUser.displayName || friendUser.username,
          profilePicture: friendUser.profilePicture,
          bio: friendUser.bio,
          isPublic: friendUser.isPublic,
          friendshipDate: f.acceptedAt || f.createdAt,
          requestMessage: f.requestMessage,
          initiatedByMe: String(f.initiatedBy) === String(req.user._id)
        };
      })
    );

    // Filter out null values (deleted users)
    const validFriends = populatedFriends.filter(f => f !== null);

    res.status(200).json({
      success: true,
      friends: validFriends,
      total: friends.length,
      hasMore: friends.length > parseInt(offset) + parseInt(limit)
    });

  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * GET /friends/requests
 * Get pending friend requests (both sent and received)
 */
router.get('/requests', protect, async (req, res) => {
  try {
    const { type = 'received' } = req.query; // 'received', 'sent', or 'all'
    
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    let requests = [];
    
    if (type === 'received' || type === 'all') {
      const pendingRequests = user.getPendingRequests();
      const receivedRequests = await Promise.all(
        pendingRequests.map(async (f) => {
          const friendUser = await User.findById(f.user).select('username displayName profilePicture bio');
          if (!friendUser) return null;
          return {
            _id: friendUser._id,
            username: friendUser.username,
            displayName: friendUser.displayName || friendUser.username,
            profilePicture: friendUser.profilePicture,
            bio: friendUser.bio,
            requestDate: f.createdAt,
            requestMessage: f.requestMessage,
            type: 'received'
          };
        })
      );
      requests = [...requests, ...receivedRequests.filter(r => r !== null)];
    }
    
    if (type === 'sent' || type === 'all') {
      const sentRequestsList = user.getSentRequests();
      const sentRequests = await Promise.all(
        sentRequestsList.map(async (f) => {
          const friendUser = await User.findById(f.user).select('username displayName profilePicture bio');
          if (!friendUser) return null;
          return {
            _id: friendUser._id,
            username: friendUser.username,
            displayName: friendUser.displayName || friendUser.username,
            profilePicture: friendUser.profilePicture,
            bio: friendUser.bio,
            requestDate: f.createdAt,
            requestMessage: f.requestMessage,
            type: 'sent'
          };
        })
      );
      requests = [...requests, ...sentRequests.filter(r => r !== null)];
    }

    // Sort by request date (most recent first)
    requests = requests.sort((a, b) => 
      new Date(b.requestDate) - new Date(a.requestDate)
    );

    res.status(200).json({
      success: true,
      requests,
      total: requests.length
    });

  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * GET /friends/status/:userId
 * Get friendship status with a specific user
 */
router.get('/status/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (targetUserId === String(currentUserId)) {
      return res.status(200).json({ 
        success: true,
        status: 'self' 
      });
    }

    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);

    res.status(200).json({
      success: true,
      status: friendshipStatus.status,
      friendship: friendshipStatus.friendship ? {
        createdAt: friendshipStatus.friendship.createdAt,
        acceptedAt: friendshipStatus.friendship.acceptedAt,
        requestMessage: friendshipStatus.friendship.requestMessage,
        initiatedByMe: String(friendshipStatus.friendship.initiatedBy) === String(currentUserId)
      } : null
    });

  } catch (error) {
    console.error('Get friendship status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * GET /friends/suggestions
 * Get friend suggestions for current user
 * TODO: Implement advanced suggestion algorithm
 */
/**
 * GET /friends/recommendations
 * Get friend recommendations for current user (alias for suggestions)
 */
router.get('/recommendations', protect, async (req, res) => {
  try {
    // Use the same logic as suggestions endpoint
    const requestedLimit = parseInt(req.query.limit) || 10;
    const limit = Math.min(requestedLimit, 15);
    const offset = parseInt(req.query.offset) || 0;
    const includeEventData = req.query.includeEventData === 'true';
    
    const currentUserId = req.user._id;

    console.log(`🎯 Getting friend recommendations for user ${currentUserId} (limit: ${limit})`);

    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser || !currentUser.privacy?.allowSuggestions) {
      return res.status(200).json({
        success: true,
        suggestions: [],
        message: 'Friend recommendations are disabled',
        total: 0
      });
    }

    // Get current following and users to exclude (using follow system)
    const currentFollowing = (currentUser.following || []).map(id => String(id));
    const currentFollowers = (currentUser.followers || []).map(id => String(id));
    // For mutual connections, use intersection of following and followers
    const mutualConnections = currentFollowing.filter(id => currentFollowers.includes(id));
    // Use following as the primary list for recommendations
    const currentFriends = currentFollowing;
    const blockedUsers = (currentUser.blockedUsers || []).map(id => String(id));
    const pendingUsers = []; // No pending in follow system
    
    // No sent requests in follow system (instant follows)
    const sentRequests = [];

    // Get user's event attendance history
    const userAttendedEvents = await Event.find({
      attendees: currentUserId
    }).select('_id attendees category tags time').lean();

    const attendedEventIds = userAttendedEvents.map(e => e._id);

    // Build co-attendance map
    const eventCoAttendanceMap = new Map();
    const eventAttendees = new Set();

    userAttendedEvents.forEach(event => {
      if (event.attendees && Array.isArray(event.attendees)) {
        event.attendees.forEach(attendee => {
          const attendeeStr = String(attendee);
          if (attendeeStr !== String(currentUserId)) {
            eventAttendees.add(attendeeStr);
            const currentCount = eventCoAttendanceMap.get(attendeeStr) || 0;
            eventCoAttendanceMap.set(attendeeStr, currentCount + 1);
          }
        });
      }
    });

    // Convert to ObjectIds for MongoDB aggregation
    const currentFriendsObjectIds = currentFriends.map(id => new mongoose.Types.ObjectId(id));
    const excludeIds = [
      currentUserId, 
      ...currentFriends.map(id => new mongoose.Types.ObjectId(id)),
      ...blockedUsers.map(id => new mongoose.Types.ObjectId(id)),
      ...pendingUsers.map(id => new mongoose.Types.ObjectId(id))
    ];

    // MongoDB aggregation pipeline (updated for follow system)
    const aggregationPipeline = [
      {
        $match: {
          _id: { $nin: excludeIds },
          isPublic: true,
          $or: [
            { following: { $in: currentFriendsObjectIds } }, // Users who follow me
            { followers: { $in: currentFriendsObjectIds } }, // Users I follow
            { _id: { $in: Array.from(eventAttendees).map(id => new mongoose.Types.ObjectId(id)) } }
          ]
        }
      },
      {
        $lookup: {
          from: 'events',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$userId', '$attendees'] },
                _id: { $in: attendedEventIds }
              }
            },
            { $project: { _id: 1, category: 1, time: 1 } }
          ],
          as: 'sharedEvents'
        }
      },
      {
        $addFields: {
          // Get mutual connections: users who follow me and I follow back
          mutualConnections: {
            $setIntersection: [
              { $ifNull: ['$following', []] },
              { $ifNull: ['$followers', []] }
            ]
          },
          // Get users I follow (for mutual friend calculation)
          myFollowing: { $ifNull: ['$following', []] },
          // Get users who follow me
          myFollowers: { $ifNull: ['$followers', []] }
        }
      },
      {
        $addFields: {
          // Count mutual connections (users we both follow)
          mutualFriendsCount: {
            $size: {
              $setIntersection: [
                { $ifNull: ['$following', []] },
                currentFriendsObjectIds
              ]
            }
          },
          mutualEventsCount: { $size: '$sharedEvents' },
          mutualFriendIds: {
            $setIntersection: [
              { $ifNull: ['$following', []] },
              currentFriendsObjectIds
            ]
          }
        }
      },
      {
        $match: {
          $or: [
            { mutualFriendsCount: { $gte: 1 } },
            { mutualEventsCount: { $gte: 1 } }
          ]
        }
      },
      {
        $addFields: {
          mutualFriendsScore: { $multiply: ['$mutualFriendsCount', 10] },
          mutualEventsScore: { $multiply: ['$mutualEventsCount', 5] },
          strongMutualFriendsBonus: { $cond: [{ $gte: ['$mutualFriendsCount', 3] }, 15, 0] },
          highEventOverlapBonus: { $cond: [{ $gte: ['$mutualEventsCount', 3] }, 10, 0] },
          hybridBonus: {
            $cond: [
              { $and: [
                { $gte: ['$mutualFriendsCount', 1] },
                { $gte: ['$mutualEventsCount', 1] }
              ]},
              20, 0
            ]
          }
        }
      },
      {
        $addFields: {
          suggestionScore: {
            $add: [
              '$mutualFriendsScore',
              '$mutualEventsScore',
              '$strongMutualFriendsBonus', 
              '$highEventOverlapBonus',
              '$hybridBonus'
            ]
          },
          primaryReason: {
            $cond: [
              { $gt: ['$mutualFriendsCount', 0] },
              'mutual_friends',
              'mutual_events'
            ]
          }
        }
      },
      { 
        $sort: { 
          suggestionScore: -1, 
          mutualFriendsCount: -1,
          mutualEventsCount: -1,
          createdAt: -1
        }
      },
      { $skip: offset },
      { $limit: limit }
    ];

    // Execute the aggregation
    const suggestions = await User.aggregate(aggregationPipeline);

    // If we don't have enough suggestions, add users I've sent requests to
    let fallbackSuggestions = [];
    if (suggestions.length < limit && sentRequests.length > 0) {
      console.log(`🔄 Adding ${sentRequests.length} sent requests as fallback suggestions`);
      
      const sentRequestUsers = await User.find({
        _id: { $in: sentRequests.map(id => new mongoose.Types.ObjectId(id)) }
      }).select('username displayName profilePicture bio').lean();

      fallbackSuggestions = sentRequestUsers.map(user => ({
        _id: user._id,
        username: user.username,
        firstName: user.displayName?.split(' ')[0] || user.username,
        lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        bio: user.bio,
        mutualFriends: 0,
        mutualEvents: 0,
        eventCoAttendance: 0,
        mutualFriendsDetails: [],
        reason: 'Friend request sent',
        reasonType: 'sent_request',
        score: 1,
        suggestionType: 'sent_request_fallback'
      }));
    }

    // Enhance suggestions with detailed frontend-friendly data
    const enhancedSuggestions = await Promise.all(
      suggestions.map(async (user) => {
        const mutualFriendsDetails = user.mutualFriendsCount > 0 
          ? await User.find({
              _id: { $in: user.mutualFriendIds.slice(0, 3) }
            }).select('username displayName profilePicture').lean()
          : [];

        const eventCoAttendanceCount = eventCoAttendanceMap.get(String(user._id)) || 0;

        let reason = '';
        let reasonType = '';
        
        if (user.mutualFriendsCount > 0 && user.mutualEventsCount > 0) {
          reasonType = 'hybrid';
          const friendNames = mutualFriendsDetails.slice(0, 2).map(f => f.displayName || f.username);
          if (friendNames.length === 1) {
            reason = `Friends with ${friendNames[0]} • ${user.mutualEventsCount} event${user.mutualEventsCount > 1 ? 's' : ''} together`;
          } else {
            reason = `Friends with ${friendNames.join(', ')} • ${user.mutualEventsCount} event${user.mutualEventsCount > 1 ? 's' : ''} together`;
          }
        } else if (user.mutualFriendsCount > 0) {
          reasonType = 'mutual_friends';
          const friendNames = mutualFriendsDetails.map(f => f.displayName || f.username);
          if (friendNames.length === 1) {
            reason = `Friends with ${friendNames[0]}`;
          } else if (friendNames.length === 2) {
            reason = `Friends with ${friendNames[0]} and ${friendNames[1]}`;
          } else {
            reason = `Friends with ${friendNames[0]}, ${friendNames[1]} and ${user.mutualFriendsCount - 2} other${user.mutualFriendsCount - 2 > 1 ? 's' : ''}`;
          }
        } else if (user.mutualEventsCount > 0) {
          reasonType = 'mutual_events';
          reason = user.mutualEventsCount === 1 
            ? `Attended an event together`
            : `Attended ${user.mutualEventsCount} events together`;
        }

        return {
          _id: user._id,
          username: user.username,
          firstName: user.displayName?.split(' ')[0] || user.username,
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          displayName: user.displayName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          mutualFriends: user.mutualFriendsCount,
          mutualEvents: user.mutualEventsCount,
          eventCoAttendance: eventCoAttendanceCount,
          mutualFriendsDetails: mutualFriendsDetails,
          reason: reason,
          reasonType: reasonType,
          score: user.suggestionScore,
          suggestionType: 'enhanced_algorithm_v2'
        };
      })
    );

    const allSuggestions = [...enhancedSuggestions, ...fallbackSuggestions];

    res.status(200).json({
      success: true,
      suggestions: allSuggestions,
      total: allSuggestions.length,
      metadata: {
        algorithmVersion: '2.0',
        maxLimit: 15,
        actualLimit: limit,
        enhancedSuggestions: enhancedSuggestions.length,
        fallbackSuggestions: fallbackSuggestions.length,
        userEventProfile: {
          attendedEvents: attendedEventIds.length,
          uniqueCategories: [...new Set(userAttendedEvents.map(e => e.category).filter(Boolean))],
          coAttendees: eventAttendees.size
        }
      }
    });

  } catch (error) {
    console.error('❌ Friend recommendations error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      suggestions: [],
      total: 0,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/suggestions', protect, async (req, res) => {
  try {
    // Enforce 15-user maximum limit for college rollout
    const requestedLimit = parseInt(req.query.limit) || 10;
    const limit = Math.min(requestedLimit, 15); // Cap at 15 users max
    const offset = parseInt(req.query.offset) || 0;
    const includeEventData = req.query.includeEventData === 'true';
    
    const currentUserId = req.user._id;

    console.log(`🎯 PHASE 2: Getting enhanced friend suggestions for user ${currentUserId} (limit: ${limit})`);

    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser || !currentUser.privacy?.allowSuggestions) {
      return res.status(200).json({
        success: true,
        suggestions: [],
        message: 'Friend suggestions are disabled',
        total: 0
      });
    }

    // Get current following and users to exclude (using follow system)
    const currentFriends = (currentUser.following || []).map(id => String(id));
    const blockedUsers = (currentUser.blockedUsers || []).map(id => String(id));
    const pendingUsers = []; // No pending in follow system

    console.log(`📊 Current user has ${currentFriends.length} friends`);

    // PHASE 2: Get user's event attendance history
    const userAttendedEvents = await Event.find({
      attendees: currentUserId
    }).select('_id attendees category tags time').lean();

    const attendedEventIds = userAttendedEvents.map(e => e._id);
    console.log(`🎪 User attended ${attendedEventIds.length} events`);

    // Build co-attendance map for enhanced scoring
    const eventCoAttendanceMap = new Map();
    const eventAttendees = new Set();

    userAttendedEvents.forEach(event => {
      if (event.attendees && Array.isArray(event.attendees)) {
        event.attendees.forEach(attendee => {
          const attendeeStr = String(attendee);
          if (attendeeStr !== String(currentUserId)) {
            eventAttendees.add(attendeeStr);
            const currentCount = eventCoAttendanceMap.get(attendeeStr) || 0;
            eventCoAttendanceMap.set(attendeeStr, currentCount + 1);
          }
        });
      }
    });

    console.log(`👥 Found ${eventAttendees.size} unique event co-attendees`);

    // Convert to ObjectIds for MongoDB aggregation
    const currentFriendsObjectIds = currentFriends.map(id => new mongoose.Types.ObjectId(id));
    const excludeIds = [
      currentUserId, 
      ...currentFriends.map(id => new mongoose.Types.ObjectId(id)),
      ...blockedUsers.map(id => new mongoose.Types.ObjectId(id)),
      ...pendingUsers.map(id => new mongoose.Types.ObjectId(id))
    ];

    // PHASE 2: FIXED MongoDB aggregation pipeline (updated for follow system)
    const aggregationPipeline = [
      // Stage 1: Find potential friends (using follow system)
      {
        $match: {
          _id: { $nin: excludeIds },
          isPublic: true,
          $or: [
            { following: { $in: currentFriendsObjectIds } }, // Users who follow me
            { followers: { $in: currentFriendsObjectIds } }, // Users I follow
            { _id: { $in: Array.from(eventAttendees).map(id => new mongoose.Types.ObjectId(id)) } }
          ]
        }
      },
      
      // Stage 2: Add shared events data
      {
        $lookup: {
          from: 'events',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$userId', '$attendees'] },
                _id: { $in: attendedEventIds }
              }
            },
            { $project: { _id: 1, category: 1, time: 1 } }
          ],
          as: 'sharedEvents'
        }
      },
      
      // Stage 3: Calculate mutual connections (using follow system)
      {
        $addFields: {
          // Get users this person follows (for mutual friend calculation)
          theirFollowing: { $ifNull: ['$following', []] },
          // Get users who follow this person
          theirFollowers: { $ifNull: ['$followers', []] }
        }
      },
      
      // Stage 4: Calculate scoring metrics
      {
        $addFields: {
          mutualFriendsCount: {
            $size: {
              $setIntersection: [
                { $ifNull: ['$following', []] },
                currentFriendsObjectIds
              ]
            }
          },
          mutualEventsCount: { $size: '$sharedEvents' },
          mutualFriendIds: {
            $setIntersection: [
              { $ifNull: ['$following', []] },
              currentFriendsObjectIds
            ]
          }
        }
      },
      
      // Stage 5: Filter - must have at least 1 mutual friend OR 1 mutual event
      {
        $match: {
          $or: [
            { mutualFriendsCount: { $gte: 1 } },
            { mutualEventsCount: { $gte: 1 } }
          ]
        }
      },
      
      // Stage 6: Calculate enhanced suggestion scoring
      {
        $addFields: {
          mutualFriendsScore: { $multiply: ['$mutualFriendsCount', 10] },
          mutualEventsScore: { $multiply: ['$mutualEventsCount', 5] },
          strongMutualFriendsBonus: { $cond: [{ $gte: ['$mutualFriendsCount', 3] }, 15, 0] },
          highEventOverlapBonus: { $cond: [{ $gte: ['$mutualEventsCount', 3] }, 10, 0] },
          hybridBonus: {
            $cond: [
              { $and: [
                { $gte: ['$mutualFriendsCount', 1] },
                { $gte: ['$mutualEventsCount', 1] }
              ]},
              20, 0
            ]
          }
        }
      },
      
      // Stage 7: Calculate total score
      {
        $addFields: {
          suggestionScore: {
            $add: [
              '$mutualFriendsScore',
              '$mutualEventsScore',
              '$strongMutualFriendsBonus', 
              '$highEventOverlapBonus',
              '$hybridBonus'
            ]
          },
          primaryReason: {
            $cond: [
              { $gt: ['$mutualFriendsCount', 0] },
              'mutual_friends',
              'mutual_events'
            ]
          }
        }
      },
      
      // Stage 8: Sort by score
      { 
        $sort: { 
          suggestionScore: -1, 
          mutualFriendsCount: -1,
          mutualEventsCount: -1,
          createdAt: -1
        }
      },
      
      // Stage 9: Apply pagination
      { $skip: offset },
      { $limit: limit }
    ];

    // Stage 10: FIXED Project stage - separate for includeEventData
    if (includeEventData) {
      aggregationPipeline.push({
        $project: {
          username: 1,
          displayName: 1,
          profilePicture: 1,
          bio: 1,
          mutualFriendsCount: 1,
          mutualEventsCount: 1,
          mutualFriendIds: 1,
          sharedEvents: 1,
          suggestionScore: 1,
          primaryReason: 1,
          createdAt: 1
        }
      });
    } else {
      aggregationPipeline.push({
        $project: {
          username: 1,
          displayName: 1,
          profilePicture: 1,
          bio: 1,
          mutualFriendsCount: 1,
          mutualEventsCount: 1,
          mutualFriendIds: 1,
          suggestionScore: 1,
          primaryReason: 1,
          createdAt: 1
        }
      });
    }

    // Execute the aggregation
    const suggestions = await User.aggregate(aggregationPipeline);

    console.log(`✅ PHASE 2: Found ${suggestions.length} enhanced suggestions`);

    // PHASE 2: Enhance suggestions with detailed frontend-friendly data
    const enhancedSuggestions = await Promise.all(
      suggestions.map(async (user) => {
        // Get mutual friends details (limit to 3 for performance)
        const mutualFriendsDetails = user.mutualFriendsCount > 0 
          ? await User.find({
              _id: { $in: user.mutualFriendIds.slice(0, 3) }
            }).select('username displayName profilePicture').lean()
          : [];

        // Get event co-attendance count from our pre-calculated map
        const eventCoAttendanceCount = eventCoAttendanceMap.get(String(user._id)) || 0;

        // Generate user-friendly suggestion reason
        let reason = '';
        let reasonType = '';
        
        if (user.mutualFriendsCount > 0 && user.mutualEventsCount > 0) {
          // Hybrid - strongest signal
          reasonType = 'hybrid';
          const friendNames = mutualFriendsDetails.slice(0, 2).map(f => f.displayName || f.username);
          if (friendNames.length === 1) {
            reason = `Friends with ${friendNames[0]} • ${user.mutualEventsCount} event${user.mutualEventsCount > 1 ? 's' : ''} together`;
          } else {
            reason = `Friends with ${friendNames.join(', ')} • ${user.mutualEventsCount} event${user.mutualEventsCount > 1 ? 's' : ''} together`;
          }
        } else if (user.mutualFriendsCount > 0) {
          // Mutual friends only
          reasonType = 'mutual_friends';
          const friendNames = mutualFriendsDetails.map(f => f.displayName || f.username);
          if (friendNames.length === 1) {
            reason = `Friends with ${friendNames[0]}`;
          } else if (friendNames.length === 2) {
            reason = `Friends with ${friendNames[0]} and ${friendNames[1]}`;
          } else {
            reason = `Friends with ${friendNames[0]}, ${friendNames[1]} and ${user.mutualFriendsCount - 2} other${user.mutualFriendsCount - 2 > 1 ? 's' : ''}`;
          }
        } else if (user.mutualEventsCount > 0) {
          // Events only
          reasonType = 'mutual_events';
          reason = user.mutualEventsCount === 1 
            ? `Attended an event together`
            : `Attended ${user.mutualEventsCount} events together`;
        }

        return {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          mutualFriends: user.mutualFriendsCount,
          mutualEvents: user.mutualEventsCount,
          eventCoAttendance: eventCoAttendanceCount,
          mutualFriendsDetails: mutualFriendsDetails,
          reason: reason,
          reasonType: reasonType,
          score: user.suggestionScore,
          suggestionType: 'enhanced_algorithm_v2'
        };
      })
    );

    // PHASE 2: Enhanced fallback for when we don't have enough suggestions
    let fallbackSuggestions = [];
    if (enhancedSuggestions.length < limit) {
      const remaining = limit - enhancedSuggestions.length;
      
      console.log(`🔄 PHASE 2: Need ${remaining} more suggestions, using enhanced fallback`);
      
      // Strategy 1: Users from similar event categories
      const userEventCategories = [...new Set(userAttendedEvents.map(e => e.category).filter(Boolean))];
      
      if (userEventCategories.length > 0 && remaining > 0) {
        try {
          const categoryUsers = await Event.aggregate([
            {
              $match: {
                category: { $in: userEventCategories },
                _id: { $nin: attendedEventIds }
              }
            },
            { $unwind: '$attendees' },
            {
              $match: {
                attendees: { $nin: excludeIds }
              }
            },
            {
              $group: {
                _id: '$attendees',
                eventCount: { $sum: 1 },
                categories: { $addToSet: '$category' }
              }
            },
            { $sort: { eventCount: -1 } },
            { $limit: remaining }
          ]);

          if (categoryUsers.length > 0) {
            const userIds = categoryUsers.map(u => u._id);
            const users = await User.find({
              _id: { $in: userIds },
              isPublic: true
            }).select('username displayName profilePicture bio').lean();

            fallbackSuggestions = users.map(user => {
              const userData = categoryUsers.find(u => String(u._id) === String(user._id));
              const sharedCategories = userData.categories.filter(cat => userEventCategories.includes(cat));
              
              return {
                _id: user._id,
                username: user.username,
                displayName: user.displayName,
                profilePicture: user.profilePicture,
                bio: user.bio,
                mutualFriends: 0,
                mutualEvents: 0,
                eventCoAttendance: 0,
                mutualFriendsDetails: [],
                reason: `Attends ${sharedCategories.slice(0, 2).join(', ')} events`,
                reasonType: 'similar_events',
                score: 3 + (userData.eventCount || 0),
                suggestionType: 'event_category_fallback'
              };
            });
          }
        } catch (categoryError) {
          console.error('❌ Error in category fallback:', categoryError);
        }
      }

      // Strategy 2: Recent users (if still need more)
      if (fallbackSuggestions.length < remaining) {
        const stillNeeded = remaining - fallbackSuggestions.length;
        const excludeMoreIds = [
          ...excludeIds,
          ...fallbackSuggestions.map(s => new mongoose.Types.ObjectId(s._id))
        ];

        try {
          const recentUsers = await User.find({
            _id: { $nin: excludeMoreIds },
            isPublic: true
          })
          .select('username displayName profilePicture bio')
          .sort({ createdAt: -1 })
          .limit(stillNeeded)
          .lean();

          const recentSuggestions = recentUsers.map(user => ({
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            profilePicture: user.profilePicture,
            bio: user.bio,
            mutualFriends: 0,
            mutualEvents: 0,
            eventCoAttendance: 0,
            mutualFriendsDetails: [],
            reason: 'Recently joined',
            reasonType: 'recent_user',
            score: 1,
            suggestionType: 'recent_user_fallback'
          }));

          fallbackSuggestions = [...fallbackSuggestions, ...recentSuggestions];
        } catch (recentError) {
          console.error('❌ Error in recent users fallback:', recentError);
        }
      }
    }

    const allSuggestions = [...enhancedSuggestions, ...fallbackSuggestions];

    // Frontend-compatible response format
    res.status(200).json({
      success: true,
      suggestions: allSuggestions,
      total: allSuggestions.length,
      metadata: {
        algorithmVersion: '2.0',
        maxLimit: 15,
        actualLimit: limit,
        enhancedSuggestions: enhancedSuggestions.length,
        fallbackSuggestions: fallbackSuggestions.length,
        userEventProfile: {
          attendedEvents: attendedEventIds.length,
          uniqueCategories: [...new Set(userAttendedEvents.map(e => e.category).filter(Boolean))],
          coAttendees: eventAttendees.size
        },
        hasMore: allSuggestions.length === limit && limit < 15,
        scoring: {
          mutualFriendsWeight: 10,
          mutualEventsWeight: 5,
          hybridBonus: 20,
          strongConnectionBonuses: 'enabled'
        }
      }
    });

  } catch (error) {
    console.error('❌ PHASE 2: Enhanced friend suggestions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      suggestions: [],
      total: 0,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/mutual/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    const currentUserId = req.user._id;

    console.log(`🔍 Getting mutual friends between ${currentUserId} and ${userId}`);

    if (String(currentUserId) === String(userId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot get mutual friends with yourself' 
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);
    
    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Get following lists (using follow system)
    const currentFriends = (currentUser.following || []).map(id => String(id));
    const targetFriends = (targetUser.following || []).map(id => String(id));
    
    console.log(`📊 Current user follows ${currentFriends.length} users, target user follows ${targetFriends.length} users`);

    // Find intersection (mutual connections - users we both follow)
    const mutualFriendIds = currentFriends.filter(friendId => 
      targetFriends.includes(friendId)
    );

    console.log(`🤝 Found ${mutualFriendIds.length} mutual friends`);

    // Get mutual friends details with pagination
    const mutualFriends = await User.find({
      _id: { $in: mutualFriendIds }
    })
    .select('username displayName profilePicture bio')
    .limit(parseInt(limit))
    .sort({ username: 1 }); // Alphabetical order

    res.json({
      success: true,
      mutualFriends: mutualFriends,
      count: mutualFriends.length,
      totalMutualFriends: mutualFriendIds.length,
      hasMore: mutualFriends.length < mutualFriendIds.length,
      users: {
        current: {
          _id: currentUser._id,
          username: currentUser.username,
          totalFriends: currentFriends.length
        },
        target: {
          _id: targetUser._id,
          username: targetUser.username,
          totalFriends: targetFriends.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Mutual friends error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/quick-reject/:requesterId', protect, async (req, res) => {
  try {
    const requesterUserId = req.params.requesterId;
    const currentUserId = req.user._id;

    console.log(`❌ Quick reject friend request: ${requesterUserId} -> ${currentUserId}`);

    const currentUser = await User.findById(currentUserId);
    const requesterUser = await User.findById(requesterUserId);
    
    if (!requesterUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if there's a pending request from this user
    const friendshipStatus = currentUser.getFriendshipStatus(requesterUserId);
    
    if (friendshipStatus.status !== 'request-received') {
      return res.status(400).json({ 
        success: false,
        message: 'No pending friend request from this user',
        currentStatus: friendshipStatus.status
      });
    }

    try {
      // Reject the friend request - use removeFriendship instead of rejectFriendRequest
      await currentUser.removeFriendship(requesterUserId);
      
      // ✅ ENHANCED: Mark ALL related notifications as handled
      const updatedNotifications = await Notification.updateMany(
        { 
          $or: [
            {
              user: currentUserId, 
              sender: requesterUserId, 
              type: 'friend_request'
            },
            {
              user: requesterUserId,
              sender: currentUserId,
              type: 'friend_request'
            }
          ]
        },
        { 
          isRead: true, 
          readAt: new Date(),
          $set: { 'data.actionTaken': 'rejected' }
        }
      );

      console.log(`❌ Marked ${updatedNotifications.modifiedCount} notifications as rejected`);

      res.status(200).json({ 
        success: true,
        message: 'Friend request rejected',
        status: 'rejected',
        data: {
          friendUsername: requesterUser.username,
          friendId: requesterUserId,
          actionTaken: 'rejected',
          notificationState: 'request_rejected' // ✅ NEW: Signal for UI to remove
        }
      });

    } catch (error) {
      console.error('Error rejecting friend request:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Failed to reject friend request'
      });
    }

  } catch (error) {
    console.error('Quick reject friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});


// ============================================
// PRIVACY SETTINGS
// ============================================

/**
 * PUT /friends/privacy
 * Update friends-related privacy settings
 */
router.put('/privacy', protect, async (req, res) => {
  try {
    const {
      friendRequests,
      friendsList,
      posts,
      eventAttendance,
      allowSuggestions
    } = req.body;

    const validFriendRequestSettings = ['everyone', 'friends-of-friends', 'no-one'];
    const validVisibilitySettings = ['everyone', 'friends', 'only-me'];
    const validPostSettings = ['public', 'friends', 'only-me'];

    const updateData = {};

    if (friendRequests && validFriendRequestSettings.includes(friendRequests)) {
      updateData['privacy.friendRequests'] = friendRequests;
    }

    if (friendsList && validVisibilitySettings.includes(friendsList)) {
      updateData['privacy.friendsList'] = friendsList;
    }

    if (posts && validPostSettings.includes(posts)) {
      updateData['privacy.posts'] = posts;
    }

    if (eventAttendance && validVisibilitySettings.includes(eventAttendance)) {
      updateData['privacy.eventAttendance'] = eventAttendance;
    }

    if (typeof allowSuggestions === 'boolean') {
      updateData['privacy.allowSuggestions'] = allowSuggestions;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('privacy');

    res.status(200).json({
      success: true,
      message: 'Privacy settings updated',
      privacy: updatedUser.privacy
    });

  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});
router.get('/suggestions/debug/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (String(currentUserId) === String(userId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot debug suggestions for yourself' 
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);
    
    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Calculate all the metrics (using follow system)
    const currentFriends = (currentUser.following || []).map(id => String(id));
    const targetFriends = (targetUser.following || []).map(id => String(id));
    
    const mutualFriends = currentFriends.filter(friendId => 
      targetFriends.includes(friendId)
    );

    // Get shared events
    const currentUserEvents = await Event.find({ attendees: currentUserId }).select('_id title category time');
    const targetUserEvents = await Event.find({ attendees: userId }).select('_id title category time');
    
    const currentEventIds = currentUserEvents.map(e => String(e._id));
    const sharedEvents = targetUserEvents.filter(e => currentEventIds.includes(String(e._id)));

    // Calculate scoring
    const mutualFriendsScore = mutualFriends.length * 10;
    const mutualEventsScore = sharedEvents.length * 5;
    const hybridBonus = (mutualFriends.length > 0 && sharedEvents.length > 0) ? 20 : 0;
    const strongFriendsBonus = mutualFriends.length >= 3 ? 15 : 0;
    const eventOverlapBonus = sharedEvents.length >= 3 ? 10 : 0;
    
    const totalScore = mutualFriendsScore + mutualEventsScore + hybridBonus + strongFriendsBonus + eventOverlapBonus;

    // Check why they might not be suggested (using follow system)
    const isFollowing = currentFriends.includes(String(userId));
    const isFollowedBy = (targetUser.followers || []).map(id => String(id)).includes(String(currentUserId));
    const friendshipStatus = {
      status: isFollowing ? 'following' : (isFollowedBy ? 'followed-by' : 'not-friends')
    };
    const isBlocked = (currentUser.blockedUsers || []).map(id => String(id)).includes(String(userId));
    const isPrivate = !targetUser.isPublic;

    res.json({
      success: true,
      debug: {
        targetUser: {
          _id: targetUser._id,
          username: targetUser.username,
          isPublic: targetUser.isPublic
        },
        relationships: {
          friendshipStatus: friendshipStatus.status,
          isBlocked: isBlocked,
          mutualFriendsCount: mutualFriends.length,
          mutualEventsCount: sharedEvents.length
        },
        scoring: {
          mutualFriendsScore,
          mutualEventsScore,
          hybridBonus,
          strongFriendsBonus,
          eventOverlapBonus,
          totalScore,
          wouldBeSuggested: totalScore >= 5 && friendshipStatus.status === 'not-friends' && !isBlocked && !isPrivate
        },
        details: {
          mutualFriends: mutualFriends.slice(0, 5), // First 5 for brevity
          sharedEvents: sharedEvents.map(e => ({
            _id: e._id,
            title: e.title,
            category: e.category
          })).slice(0, 5),
          exclusionReasons: [
            ...(friendshipStatus.status !== 'not-friends' ? [`Already ${friendshipStatus.status}`] : []),
            ...(isBlocked ? ['User is blocked'] : []),
            ...(isPrivate ? ['User profile is private'] : []),
            ...(totalScore < 5 ? ['Score too low (minimum 5)'] : [])
          ]
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug suggestions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /friends/:userId
 * Get friends list for a specific user (respects privacy settings)
 */
router.get('/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;
    const { limit = 50, offset = 0 } = req.query;

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const isSelf = targetUserId === String(currentUserId);
    
    // Check privacy permissions
    const friendsListPrivacy = targetUser.privacy?.friendsList || 'friends';
    let canViewFriends = false;

    if (isSelf) {
      canViewFriends = true;
    } else if (friendsListPrivacy === 'everyone') {
      canViewFriends = true;
    } else if (friendsListPrivacy === 'friends') {
      const currentUser = await User.findById(currentUserId);
      const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);
      canViewFriends = friendshipStatus.status === 'friends';
    }
    // 'only-me' case: canViewFriends remains false

    if (!canViewFriends) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this user\'s friends list',
        friendsCount: targetUser.friendsCount // Still show count
      });
    }

    if (!targetUser.friends || !Array.isArray(targetUser.friends)) {
      return res.status(200).json({
        success: true,
        friends: [],
        total: 0,
        friendsCount: 0,
        hasMore: false
      });
    }

    const friends = targetUser.friends
      .filter(f => f.status === 'accepted')
      .sort((a, b) => new Date(b.acceptedAt || b.createdAt) - new Date(a.acceptedAt || a.createdAt));

    // Apply pagination
    const paginatedFriends = friends.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Populate user details
    const populatedFriends = await Promise.all(
      paginatedFriends.map(async (f) => {
        const friendUser = await User.findById(f.user).select('username displayName profilePicture');
        if (!friendUser) return null;
        return {
          _id: friendUser._id,
          username: friendUser.username,
          displayName: friendUser.displayName || friendUser.username,
          profilePicture: friendUser.profilePicture,
          friendshipDate: f.acceptedAt
        };
      })
    );

    const validFriends = populatedFriends.filter(f => f !== null);

    res.status(200).json({
      success: true,
      friends: validFriends,
      total: friends.length,
      friendsCount: friends.length,
      hasMore: friends.length > parseInt(offset) + parseInt(limit)
    });

  } catch (error) {
    console.error('Get user friends error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

router.delete('/remove/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`🗑️ Removing friendship: ${currentUserId} <-> ${targetUserId}`);

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if they are actually friends
    const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);
    
    if (friendshipStatus.status !== 'friends') {
      return res.status(400).json({ 
        success: false,
        message: 'You are not friends with this user',
        currentStatus: friendshipStatus.status
      });
    }

    try {
      // Remove friendship using your existing model method
      await currentUser.removeFriendship(targetUserId);

      // ✅ COMPREHENSIVE CLEANUP: Delete ALL related notifications
      const deletedNotifications = await Notification.deleteMany({
        $or: [
          {
            user: currentUserId,
            sender: targetUserId,
            type: { $in: ['friend_request', 'friend_request_accepted'] }
          },
          {
            user: targetUserId,
            sender: currentUserId,
            type: { $in: ['friend_request', 'friend_request_accepted'] }
          }
        ]
      });

      console.log(`🧹 Deleted ${deletedNotifications.deletedCount} notifications`);

      // ✅ CLEANUP: Delete ALL friend request activities (if you have Activity model)
      let deletedActivities = 0;
      try {
        const Activity = require('../models/Activity'); // Adjust path as needed
        const activityCleanup = await Activity.deleteMany({
          $or: [
            {
              activityType: { $in: ['friend_request', 'friend_request_accepted'] },
              'data.requester._id': { $in: [currentUserId, targetUserId] },
              userId: { $in: [currentUserId, targetUserId] }
            },
            {
              activityType: { $in: ['friend_request', 'friend_request_accepted'] },
              'data.accepter._id': { $in: [currentUserId, targetUserId] },
              userId: { $in: [currentUserId, targetUserId] }
            }
          ]
        });
        deletedActivities = activityCleanup.deletedCount;
        console.log(`🧹 Deleted ${deletedActivities} activities`);
      } catch (activityError) {
        console.log('⚠️ No Activity model found or error cleaning activities:', activityError.message);
      }

      // ✅ SAFETY CLEANUP: Remove any stale friend request states in user documents
      await User.updateMany(
        { _id: { $in: [currentUserId, targetUserId] } },
        {
          $pull: {
            friendRequests: { $in: [currentUserId, targetUserId] },
            sentFriendRequests: { $in: [currentUserId, targetUserId] }
          }
        }
      );

      console.log(`✅ Friendship removed and all related data cleaned up`);

      res.status(200).json({ 
        success: true,
        message: 'Friend removed and all related data cleaned up',
        status: 'not-friends',
        data: {
          removedUser: {
            _id: targetUser._id,
            username: targetUser.username
          },
          cleanupStats: {
            notificationsDeleted: deletedNotifications.deletedCount,
            activitiesDeleted: deletedActivities
          }
        }
      });

    } catch (error) {
      console.error('Error removing friend:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Failed to remove friend'
      });
    }

  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// ✅ ALSO ADD: Cleanup endpoint for frontend to call
router.post('/cleanup-after-unfriend', protect, async (req, res) => {
  try {
    const { removedUserId } = req.body;
    const currentUserId = req.user._id;

    console.log(`🧹 Post-unfriend cleanup: ${currentUserId} <-> ${removedUserId}`);

    // Delete any remaining friend-related notifications
    const cleanupResult = await Notification.deleteMany({
      $or: [
        {
          user: currentUserId,
          sender: removedUserId,
          type: { $in: ['friend_request', 'friend_request_accepted'] }
        },
        {
          user: removedUserId,
          sender: currentUserId,
          type: { $in: ['friend_request', 'friend_request_accepted'] }
        }
      ]
    });

    // Delete any remaining friend-related activities
    let activityCleanup = { deletedCount: 0 };
    try {
      const Activity = require('../models/Activity');
      activityCleanup = await Activity.deleteMany({
        $or: [
          {
            activityType: { $in: ['friend_request', 'friend_request_accepted'] },
            $or: [
              { 'data.requester._id': removedUserId, userId: currentUserId },
              { 'data.requester._id': currentUserId, userId: removedUserId }
            ]
          }
        ]
      });
    } catch (activityError) {
      console.log('⚠️ No Activity model found for cleanup');
    }

    res.json({ 
      success: true, 
      message: 'Post-unfriend cleanup completed',
      cleaned: {
        notifications: cleanupResult.deletedCount,
        activities: activityCleanup.deletedCount
      }
    });

  } catch (error) {
    console.error('Error in post-unfriend cleanup:', error);
    res.status(500).json({ success: false, message: 'Cleanup failed' });
  }
});


module.exports = router;