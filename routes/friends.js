// routes/friends.js - PHASE 1: New Friends System Routes
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');

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
      
      // Mark the friend request notification as read and handled
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

    // Send friend request using model method
    try {
      await currentUser.sendFriendRequest(targetUserId, message || '');
      
      // Send notification (non-blocking)
      setImmediate(async () => {
        try {
          await notificationService.sendFriendRequest(currentUserId, targetUserId);
          console.log('🔔 Friend request notification sent');
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

      // ✅ ENHANCED: Remove/mark the friend request notification for the target user
      const updatedNotification = await Notification.findOneAndUpdate(
        { 
          user: targetUserId, 
          sender: currentUserId, 
          type: 'friend_request',
          isRead: false 
        },
        { 
          isRead: true, 
          readAt: new Date(),
          $set: { 'data.actionTaken': 'cancelled' }
        },
        { new: true }
      );

      console.log(`🚫 Marked notification as cancelled:`, updatedNotification?._id);

      // ✅ ENHANCED: Return more data for frontend UI updates
      res.status(200).json({ 
        success: true,
        message: 'Friend request cancelled',
        status: 'not-friends',
        data: {
          targetUsername: targetUser.username,
          targetId: targetUserId,
          actionTaken: 'cancelled'
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
    
    const user = await User.findById(req.user._id)
      .populate({
        path: 'friends.user',
        select: 'username displayName profilePicture bio isPublic',
        options: { limit: parseInt(limit), skip: parseInt(offset) }
      });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
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

    res.status(200).json({
      success: true,
      friends: friends.map(f => ({
        _id: f.user._id,
        username: f.user.username,
        displayName: f.user.displayName,
        profilePicture: f.user.profilePicture,
        bio: f.user.bio,
        isPublic: f.user.isPublic,
        friendshipDate: f.acceptedAt || f.createdAt,
        requestMessage: f.requestMessage,
        initiatedByMe: String(f.initiatedBy) === String(req.user._id)
      })),
      total: friends.length,
      hasMore: friends.length === parseInt(limit)
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
    
    const user = await User.findById(req.user._id)
      .populate({
        path: 'friends.user',
        select: 'username displayName profilePicture bio'
      });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    let requests = [];
    
    if (type === 'received' || type === 'all') {
      const receivedRequests = user.getPendingRequests().map(f => ({
        _id: f.user._id,
        username: f.user.username,
        displayName: f.user.displayName,
        profilePicture: f.user.profilePicture,
        bio: f.user.bio,
        requestDate: f.createdAt,
        requestMessage: f.requestMessage,
        type: 'received'
      }));
      requests = [...requests, ...receivedRequests];
    }
    
    if (type === 'sent' || type === 'all') {
      const sentRequests = user.getSentRequests().map(f => ({
        _id: f.user._id,
        username: f.user.username,
        displayName: f.user.displayName,
        profilePicture: f.user.profilePicture,
        bio: f.user.bio,
        requestDate: f.createdAt,
        requestMessage: f.requestMessage,
        type: 'sent'
      }));
      requests = [...requests, ...sentRequests];
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
router.get('/suggestions', protect, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser || !currentUser.privacy?.allowSuggestions) {
      return res.status(200).json({
        success: true,
        suggestions: [],
        message: 'Friend suggestions are disabled'
      });
    }

    // Get current friends and blocked users
    const currentFriends = currentUser.getAcceptedFriends();
    const blockedUsers = currentUser.blockedUsers || [];
    const pendingUsers = currentUser.friends.map(f => f.user);

    // Simple suggestion algorithm - users who:
    // 1. Are not already friends
    // 2. Are not blocked
    // 3. Have public profiles
    // 4. Are recently active
    // TODO: Add mutual friends, common interests, event attendance overlap

    const suggestions = await User.find({
      _id: { 
        $nin: [
          currentUserId, 
          ...currentFriends, 
          ...blockedUsers, 
          ...pendingUsers
        ] 
      },
      isPublic: true,
      // Add more sophisticated filters here
    })
    .select('username displayName profilePicture bio')
    .limit(parseInt(limit))
    .sort({ createdAt: -1 }); // Most recent users first

    res.status(200).json({
      success: true,
      suggestions: suggestions.map(user => ({
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        bio: user.bio,
        mutualFriends: 0, // TODO: Calculate mutual friends
        reason: 'Recently joined' // TODO: Add suggestion reasons
      })),
      total: suggestions.length
    });

  } catch (error) {
    console.error('Get friend suggestions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
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
      // Reject the friend request using your existing model method
      await currentUser.rejectFriendRequest(requesterUserId);
      
      // Mark the friend request notification as read and handled
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

/**
 * GET /friends/:userId
 * Get friends list for a specific user (respects privacy settings)
 */
router.get('/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;
    const { limit = 50, offset = 0 } = req.query;

    const targetUser = await User.findById(targetUserId)
      .populate({
        path: 'friends.user',
        select: 'username displayName profilePicture',
        options: { limit: parseInt(limit), skip: parseInt(offset) }
      });

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

    const friends = targetUser.friends
      .filter(f => f.status === 'accepted')
      .sort((a, b) => new Date(b.acceptedAt || b.createdAt) - new Date(a.acceptedAt || a.createdAt));

    res.status(200).json({
      success: true,
      friends: friends.map(f => ({
        _id: f.user._id,
        username: f.user.username,
        displayName: f.user.displayName,
        profilePicture: f.user.profilePicture,
        friendshipDate: f.acceptedAt
      })),
      total: friends.length,
      friendsCount: targetUser.friendsCount,
      hasMore: friends.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get user friends error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;