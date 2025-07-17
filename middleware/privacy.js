// middleware/privacy.js - Core privacy checking middleware
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Photo = require('../models/Photo');

/**
 * Privacy checking middleware for different content types
 */
class PrivacyMiddleware {
  
  /**
   * Check if user can view specific content
   * @param {string} contentType - Type of content ('photo', 'event', 'user')
   * @param {Object} options - Additional options
   */
  static checkContentAccess(contentType, options = {}) {
    return async (req, res, next) => {
      try {
        const userId = req.user._id;
        const targetId = req.params.id || req.params.eventId || req.params.photoId || req.params.userId;
        
        if (!targetId) {
          return res.status(400).json({ message: 'Content ID required' });
        }

        let hasAccess = false;
        let content = null;

        switch (contentType) {
          case 'photo':
            ({ hasAccess, content } = await this.checkPhotoAccess(userId, targetId, options));
            break;
          case 'event':
            ({ hasAccess, content } = await this.checkEventAccess(userId, targetId, options));
            break;
          case 'user':
            ({ hasAccess, content } = await this.checkUserProfileAccess(userId, targetId, options));
            break;
          default:
            return res.status(400).json({ message: 'Invalid content type' });
        }

        if (!hasAccess) {
          return res.status(403).json({ 
            message: 'Access denied',
            contentType,
            reason: 'Privacy restrictions'
          });
        }

        // Attach content and privacy context to request
        req.targetContent = content;
        req.privacyContext = {
          contentType,
          hasAccess: true,
          userId,
          targetId
        };

        next();
      } catch (error) {
        console.error('Privacy middleware error:', error);
        res.status(500).json({ message: 'Privacy check failed' });
      }
    };
  }

  /**
   * Check photo access permissions
   */
  static async checkPhotoAccess(userId, photoId, options = {}) {
    try {
      const photo = await Photo.findById(photoId)
        .populate('user', '_id username isPrivate followers following')
        .populate('event', '_id host attendees privacyLevel permissions');

      if (!photo) {
        return { hasAccess: false, content: null, reason: 'Photo not found' };
      }

      // Check if photo is deleted
      if (photo.isDeleted) {
        return { hasAccess: false, content: photo, reason: 'Photo deleted' };
      }

      // Owner can always access
      if (String(photo.user._id) === String(userId)) {
        return { hasAccess: true, content: photo, reason: 'Owner access' };
      }

      // Check moderation status
      if (photo.moderation?.status === 'rejected') {
        return { hasAccess: false, content: photo, reason: 'Content moderated' };
      }

      // Get user relationship context
      const viewerUser = await User.findById(userId).select('following');
      const isFollowingOwner = viewerUser.following.some(f => String(f) === String(photo.user._id));
      const ownerFollowsViewer = photo.user.followers.some(f => String(f) === String(userId));
      const areFriends = isFollowingOwner && ownerFollowsViewer;

      // Check event-based permissions
      let eventAccess = false;
      if (photo.event) {
        const isEventHost = String(photo.event.host) === String(userId);
        const isEventAttendee = photo.event.attendees.some(a => String(a) === String(userId));
        eventAccess = isEventHost || isEventAttendee;
      }

      // Check photo visibility level
      switch (photo.visibility?.level || 'public') {
        case 'private':
          return { hasAccess: false, content: photo, reason: 'Private photo' };
        
        case 'friends':
          if (!areFriends) {
            return { hasAccess: false, content: photo, reason: 'Friends only' };
          }
          break;
        
        case 'attendees':
          if (!eventAccess) {
            return { hasAccess: false, content: photo, reason: 'Event attendees only' };
          }
          break;
        
        case 'public':
        default:
          // Continue to owner privacy check
          break;
      }

      // Check photo owner's privacy settings
      if (photo.user.isPrivate && !areFriends && !eventAccess) {
        return { hasAccess: false, content: photo, reason: 'Private account' };
      }

      // Check event privacy if photo is tagged to an event
      if (photo.event) {
        const { hasAccess: eventAccess } = await this.checkEventAccess(userId, photo.event._id);
        if (!eventAccess) {
          return { hasAccess: false, content: photo, reason: 'Event privacy restriction' };
        }
      }

      return { hasAccess: true, content: photo, reason: 'Public access' };

    } catch (error) {
      console.error('Photo access check error:', error);
      return { hasAccess: false, content: null, reason: 'Check failed' };
    }
  }

  /**
   * Check event access permissions
   */
  static async checkEventAccess(userId, eventId, options = {}) {
    try {
      const event = await Event.findById(eventId)
        .populate('host', '_id username followers')
        .populate('attendees', '_id')
        .populate('invitedUsers', '_id');

      if (!event) {
        return { hasAccess: false, content: null, reason: 'Event not found' };
      }

      // Host can always access
      if (String(event.host._id) === String(userId)) {
        return { hasAccess: true, content: event, reason: 'Host access' };
      }

      // Co-hosts can access
      if (event.coHosts && event.coHosts.some(c => String(c) === String(userId))) {
        return { hasAccess: true, content: event, reason: 'Co-host access' };
      }

      // Attendees can access
      if (event.attendees.some(a => String(a) === String(userId))) {
        return { hasAccess: true, content: event, reason: 'Attendee access' };
      }

      // Check based on privacy level
      const viewerUser = await User.findById(userId).select('following');
      const isFollowingHost = viewerUser.following.some(f => String(f) === String(event.host._id));

      switch (event.privacyLevel) {
        case 'public':
          // Check view permissions for public events
          switch (event.permissions?.canView) {
            case 'anyone':
              return { hasAccess: true, content: event, reason: 'Public event' };
            case 'followers':
            case 'friends':
              if (isFollowingHost) {
                return { hasAccess: true, content: event, reason: 'Follower access' };
              }
              break;
            case 'invited-only':
              if (event.invitedUsers.some(i => String(i) === String(userId))) {
                return { hasAccess: true, content: event, reason: 'Invited access' };
              }
              break;
            default:
              return { hasAccess: true, content: event, reason: 'Public event' };
          }
          break;

        case 'friends':
          if (isFollowingHost) {
            return { hasAccess: true, content: event, reason: 'Friend access' };
          }
          break;

        case 'private':
        case 'secret':
          // Only invited users can access
          if (event.invitedUsers.some(i => String(i) === String(userId))) {
            return { hasAccess: true, content: event, reason: 'Invited access' };
          }
          break;

        default:
          return { hasAccess: true, content: event, reason: 'Default access' };
      }

      return { hasAccess: false, content: event, reason: 'Privacy restriction' };

    } catch (error) {
      console.error('Event access check error:', error);
      return { hasAccess: false, content: null, reason: 'Check failed' };
    }
  }

  /**
   * Check user profile access permissions
   */
  static async checkUserProfileAccess(userId, targetUserId, options = {}) {
    try {
      // Users can always view their own profile
      if (String(userId) === String(targetUserId)) {
        const user = await User.findById(userId);
        return { hasAccess: true, content: user, reason: 'Own profile' };
      }

      const targetUser = await User.findById(targetUserId)
        .select('username isPrivate followers following photos');

      if (!targetUser) {
        return { hasAccess: false, content: null, reason: 'User not found' };
      }

      // Check if target user is private
      if (targetUser.isPrivate) {
        // Check if viewer follows target user
        const viewerUser = await User.findById(userId).select('following');
        const isFollowing = viewerUser.following.some(f => String(f) === String(targetUserId));
        
        if (!isFollowing) {
          return { hasAccess: false, content: targetUser, reason: 'Private account' };
        }
      }

      return { hasAccess: true, content: targetUser, reason: 'Public profile' };

    } catch (error) {
      console.error('User profile access check error:', error);
      return { hasAccess: false, content: null, reason: 'Check failed' };
    }
  }

  /**
   * Filter content list based on privacy settings
   */
  static async filterContentList(userId, contentList, contentType) {
    const filteredContent = [];
    
    for (const content of contentList) {
      let hasAccess = false;
      
      switch (contentType) {
        case 'photo':
          ({ hasAccess } = await this.checkPhotoAccess(userId, content._id));
          break;
        case 'event':
          ({ hasAccess } = await this.checkEventAccess(userId, content._id));
          break;
        default:
          hasAccess = true;
      }
      
      if (hasAccess) {
        filteredContent.push(content);
      }
    }
    
    return filteredContent;
  }

  /**
   * Batch check permissions for multiple items
   */
  static async batchCheckAccess(userId, items, contentType) {
    const results = await Promise.all(
      items.map(async (item) => {
        const itemId = item._id || item.id || item;
        let result;
        
        switch (contentType) {
          case 'photo':
            result = await this.checkPhotoAccess(userId, itemId);
            break;
          case 'event':
            result = await this.checkEventAccess(userId, itemId);
            break;
          case 'user':
            result = await this.checkUserProfileAccess(userId, itemId);
            break;
          default:
            result = { hasAccess: true, content: item };
        }
        
        return {
          id: itemId,
          hasAccess: result.hasAccess,
          content: result.content,
          reason: result.reason
        };
      })
    );
    
    return results;
  }

  /**
   * Add privacy context to photos in a list
   */
  static async addPhotoPrivacyContext(userId, photos) {
    const photosWithContext = await Promise.all(
      photos.map(async (photo) => {
        const photoObj = photo.toObject ? photo.toObject() : photo;
        
        // Add like status
        photoObj.userLiked = photo.likes ? photo.likes.some(like => 
          String(like) === String(userId)
        ) : false;
        photoObj.likeCount = photo.likes ? photo.likes.length : 0;
        
        // Add privacy context
        const { hasAccess, reason } = await this.checkPhotoAccess(userId, photo._id);
        photoObj.canView = hasAccess;
        photoObj.accessReason = reason;
        
        // Add edit permissions
        photoObj.canEdit = String(photo.user._id || photo.user) === String(userId);
        
        return photoObj;
      })
    );
    
    return photosWithContext;
  }

  /**
   * Check if user can perform specific action on content
   */
  static async checkActionPermission(userId, contentType, contentId, action) {
    try {
      let content;
      let hasPermission = false;
      
      switch (contentType) {
        case 'photo':
          content = await Photo.findById(contentId).populate('user event');
          if (!content) return { hasPermission: false, reason: 'Content not found' };
          
          switch (action) {
            case 'edit':
            case 'delete':
              hasPermission = String(content.user._id) === String(userId);
              break;
            case 'like':
            case 'comment':
              ({ hasAccess: hasPermission } = await this.checkPhotoAccess(userId, contentId));
              break;
            case 'moderate':
              // Event hosts can moderate photos in their events
              if (content.event) {
                hasPermission = String(content.event.host) === String(userId);
              }
              break;
          }
          break;
          
        case 'event':
          content = await Event.findById(contentId);
          if (!content) return { hasPermission: false, reason: 'Content not found' };
          
          switch (action) {
            case 'edit':
            case 'delete':
              hasPermission = String(content.host) === String(userId) ||
                             (content.coHosts && content.coHosts.some(c => String(c) === String(userId)));
              break;
            case 'join':
              ({ hasAccess: hasPermission } = await this.checkEventAccess(userId, contentId));
              break;
          }
          break;
      }
      
      return { hasPermission, content, reason: hasPermission ? 'Authorized' : 'Access denied' };
      
    } catch (error) {
      console.error('Action permission check error:', error);
      return { hasPermission: false, reason: 'Check failed' };
    }
  }
}

/**
 * Convenience middleware functions
 */

// Photo access middleware
const requirePhotoAccess = (options = {}) => {
  return PrivacyMiddleware.checkContentAccess('photo', options);
};

// Event access middleware
const requireEventAccess = (options = {}) => {
  return PrivacyMiddleware.checkContentAccess('event', options);
};

// User profile access middleware
const requireProfileAccess = (options = {}) => {
  return PrivacyMiddleware.checkContentAccess('user', options);
};

// Action permission middleware
const requireActionPermission = (contentType, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const contentId = req.params.id || req.params.eventId || req.params.photoId;
      
      const { hasPermission, reason } = await PrivacyMiddleware.checkActionPermission(
        userId, contentType, contentId, action
      );
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: 'Action not permitted',
          action,
          reason 
        });
      }
      
      next();
    } catch (error) {
      console.error('Action permission middleware error:', error);
      res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

module.exports = {
  PrivacyMiddleware,
  requirePhotoAccess,
  requireEventAccess,
  requireProfileAccess,
  requireActionPermission
};