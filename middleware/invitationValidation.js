// middleware/invitationValidation.js - Middleware for validating invitation permissions

const Event = require('../models/Event');
const User = require('../models/User');
const { canUserInviteByPrivacy, getInvitationRulesExplanation } = require('../constants/privacyConstants');

/**
 * Middleware to validate if user can invite others to an event
 */
const validateInvitationPermission = async (req, res, next) => {
  try {
    const eventId = req.params.eventId;
    const currentUserId = req.user._id;

    // Find the event
    const event = await Event.findById(eventId)
      .select('host coHosts privacyLevel title attendees permissions');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check user roles
    const userIdStr = String(currentUserId);
    const hostIdStr = String(event.host);
    const isHost = userIdStr === hostIdStr;
    const isCoHost = event.coHosts && event.coHosts.some(c => String(c) === userIdStr);
    const isAttendee = event.attendees && event.attendees.some(a => String(a) === userIdStr);

    // Use the privacy-based invitation rules
    const canInvite = canUserInviteByPrivacy(event.privacyLevel, isHost, isCoHost, isAttendee);

    if (!canInvite) {
      const rulesExplanation = getInvitationRulesExplanation(event.privacyLevel);
      
      return res.status(403).json({
        message: 'You do not have permission to invite users to this event',
        privacyLevel: event.privacyLevel,
        rules: rulesExplanation,
        userRole: {
          isHost,
          isCoHost,
          isAttendee
        },
        explanation: getDetailedPermissionExplanation(event.privacyLevel, isHost, isCoHost, isAttendee)
      });
    }

    // Add event info to request for use in next middleware/route
    req.eventInfo = {
      event,
      isHost,
      isCoHost,
      isAttendee,
      canInvite: true
    };

    next();

  } catch (error) {
    console.error('❌ Invitation validation middleware error:', error);
    res.status(500).json({ 
      message: 'Failed to validate invitation permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware to validate friend relationships for friends-only events
 */
const validateFriendsOnlyInvitation = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    const currentUserId = req.user._id;
    const eventInfo = req.eventInfo;

    // Skip if not a friends-only event
    if (!eventInfo || eventInfo.event.privacyLevel !== 'friends') {
      return next();
    }

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ message: 'Invalid user IDs provided' });
    }

    // Get current user's friends (mutual followers)
    const currentUser = await User.findById(currentUserId)
      .populate('following', '_id username displayName')
      .populate('followers', '_id username displayName');

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get mutual friends (users who both follow and are followed by current user)
    const followingIds = new Set(currentUser.following.map(u => u._id.toString()));
    const followerIds = new Set(currentUser.followers.map(u => u._id.toString()));
    const mutualFriendIds = new Set([...followingIds].filter(id => followerIds.has(id)));

    // Validate that all invited users are friends
    const invalidUsers = [];
    const validUsers = [];

    for (const userId of userIds) {
      const userIdStr = userId.toString();
      if (mutualFriendIds.has(userIdStr)) {
        validUsers.push(userId);
      } else {
        invalidUsers.push(userId);
      }
    }

    // If some users are not friends, return error with details
    if (invalidUsers.length > 0) {
      // Get user details for better error message
      const invalidUserDetails = await User.find({
        _id: { $in: invalidUsers }
      }).select('username displayName');

      return res.status(400).json({
        message: 'You can only invite friends to this friends-only event',
        privacyLevel: 'friends',
        invalidUsers: invalidUserDetails.map(u => ({
          id: u._id,
          username: u.username,
          displayName: u.displayName,
          reason: 'Not in your friends list'
        })),
        validUserCount: validUsers.length,
        suggestion: 'Try sending them a friend request first, or change the event to public if you want to invite non-friends'
      });
    }

    // Add validated user info to request
    req.validatedInvitation = {
      userIds: validUsers,
      friendsValidated: true,
      mutualFriendIds: Array.from(mutualFriendIds)
    };

    next();

  } catch (error) {
    console.error('❌ Friends validation middleware error:', error);
    res.status(500).json({ 
      message: 'Failed to validate friend relationships',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed explanation of why user can/cannot invite
 */
function getDetailedPermissionExplanation(privacyLevel, isHost, isCoHost, isAttendee) {
  if (isHost) {
    return 'As the event host, you have full invitation permissions regardless of privacy level.';
  }

  if (isCoHost) {
    return 'As a co-host, you can invite others to this event.';
  }

  switch (privacyLevel) {
    case 'public':
      return 'This is a public event - anyone can invite others, even if they\'re not attending.';
    
    case 'friends':
      return 'This is a friends-only event. Only the host and co-hosts can invite friends. Regular attendees cannot invite others.';
    
    case 'private':
      return 'This is a private event. Only the host and co-hosts can send invitations. Regular attendees cannot invite others.';
    
    default:
      return 'Invitation permissions depend on your role and the event\'s privacy settings.';
  }
}

/**
 * Middleware to check general sharing permissions
 */
const validateSharingPermission = async (req, res, next) => {
  try {
    const eventId = req.params.eventId;
    const currentUserId = req.user._id;

    const event = await Event.findById(eventId)
      .select('host coHosts privacyLevel title attendees');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const canShare = event.canUserShare(currentUserId);

    if (!canShare) {
      const userIdStr = String(currentUserId);
      const isAttendee = event.attendees && event.attendees.some(a => String(a) === userIdStr);
      
      let message = 'You do not have permission to share this event';
      let suggestion = '';

      if (!isAttendee && event.privacyLevel !== 'public') {
        message = 'You need to be attending this event to share it';
        suggestion = 'Join the event first to unlock sharing';
      }

      return res.status(403).json({
        message,
        suggestion,
        privacyLevel: event.privacyLevel,
        canJoinToShare: event.privacyLevel !== 'private'
      });
    }

    req.eventInfo = {
      ...req.eventInfo,
      event,
      canShare: true
    };

    next();

  } catch (error) {
    console.error('❌ Sharing validation middleware error:', error);
    res.status(500).json({ 
      message: 'Failed to validate sharing permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Combined middleware for invitation routes
 */
const validateEventInvitation = [
  validateInvitationPermission,
  validateFriendsOnlyInvitation
];

module.exports = {
  validateInvitationPermission,
  validateFriendsOnlyInvitation,
  validateSharingPermission,
  validateEventInvitation,
  getDetailedPermissionExplanation
};