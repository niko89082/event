// services/notificationService.js - PHASE 1: Enhanced with Friends System + Existing Features
const Notification = require('../models/Notification');
const User = require('../models/User');
const Event = require('../models/Event');
const Memory = require('../models/Memory');
const mongoose = require('mongoose');

class NotificationService {
  
  /* ═══════════════════════════════════════════════════════════════════
     CORE NOTIFICATION CREATION
  ═══════════════════════════════════════════════════════════════════ */
  
  async createNotification(data) {
    try {
      // Set category based on type if not provided
      if (!data.category) {
        data.category = this.getCategoryFromType(data.type);
      }
      
      const notification = await Notification.create({
        user: data.userId,
        sender: data.senderId,
        category: data.category,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
        actionType: data.actionType || 'NONE',
        actionData: data.actionData || {},
        priority: data.priority || 'normal'
      });

      console.log(`🔔 Created ${data.category} notification:`, {
        type: data.type,
        user: data.userId,
        title: data.title
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  getCategoryFromType(type) {
    const socialTypes = [
      'friend_request', 'friend_request_accepted', 'new_follower', // ✅ Keep new_follower for migration
      'memory_photo_added', 'memory_invitation', 'memory_photo_batch', 
      'post_liked', 'post_commented', 'memory_photo_liked'
    ];
    
    const eventTypes = [
      'event_invitation', 'event_reminder', 'event_reminder_1_hour', 
      'event_update', 'event_cancelled', 'event_announcement', 'event_rsvp_batch',
      'cohost_added', 'cohost_left', 'cohost_permission_denied'
    ];
    
    if (socialTypes.includes(type)) return 'social';
    if (eventTypes.includes(type)) return 'events';
    return 'social'; // default
  }

  /* ═══════════════════════════════════════════════════════════════════
     ✅ NEW: FRIENDS SYSTEM NOTIFICATIONS
  ═══════════════════════════════════════════════════════════════════ */

  /**
   * Send friend request notification
   * @param {string} requesterId - User who sent the friend request
   * @param {string} targetId - User who received the friend request
   */
  async sendFriendRequest(requesterId, targetId) {
    const requester = await User.findById(requesterId).select('username');
    
    return this.createNotification({
      userId: targetId,
      senderId: requesterId,
      category: 'social',
      type: 'friend_request',
      title: 'Friend Request',
      message: `${requester.username} sent you a friend request`,
      data: { 
        userId: requesterId,
        requesterUsername: requester.username
      },
      actionType: 'ACCEPT_REQUEST',
      actionData: { requesterId },
      priority: 'high'
    });
  }

  /**
   * Send friend request accepted notification
   * @param {string} accepterId - User who accepted the request
   * @param {string} requesterId - User who originally sent the request
   */
  async sendFriendRequestAccepted(accepterId, requesterId) {
    const accepter = await User.findById(accepterId).select('username');
    
    return this.createNotification({
      userId: requesterId,
      senderId: accepterId,
      category: 'social',
      type: 'friend_request_accepted',
      title: 'Friend Request Accepted',
      message: `${accepter.username} accepted your friend request`,
      data: { 
        userId: accepterId,
        accepterUsername: accepter.username
      },
      actionType: 'VIEW_PROFILE',
      actionData: { userId: accepterId },
      priority: 'high'
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     🔄 LEGACY: FOLLOWER SYSTEM NOTIFICATIONS (Keep for migration period)
  ═══════════════════════════════════════════════════════════════════ */

  /**
   * Send new follower notification (LEGACY - for migration period)
   * @param {string} followerId - User who followed
   * @param {string} targetId - User who was followed
   */
  async sendNewFollower(followerId, targetId) {
    const follower = await User.findById(followerId).select('username');
    
    return this.createNotification({
      userId: targetId,
      senderId: followerId,
      category: 'social',
      type: 'new_follower',
      title: 'New Follower',
      message: `${follower.username} started following you`,
      data: { userId: followerId },
      actionType: 'VIEW_PROFILE',
      actionData: { userId: followerId }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     EVENT CO-HOST NOTIFICATIONS
  ═══════════════════════════════════════════════════════════════════ */

  /**
   * Send notification when user is added as co-host
   * @param {string} hostId - Event host ID
   * @param {string} coHostId - New co-host user ID
   * @param {Object} event - Event object
   */
  async sendCoHostAdded(hostId, coHostId, event) {
    try {
      console.log('🔔 ===== SENDING COHOST NOTIFICATION =====');
      console.log('🔔 Host ID:', hostId);
      console.log('🔔 Co-host ID:', coHostId);
      console.log('🔔 Event ID:', event._id);
      console.log('🔔 Event title:', event.title);

      const host = await User.findById(hostId).select('username');
      if (!host) {
        console.error('❌ Host not found:', hostId);
        return null;
      }

      console.log('🔔 Host found:', host.username);

      const notification = await this.createNotification({
        userId: coHostId,
        senderId: hostId,
        category: 'events',
        type: 'cohost_added',
        title: 'You\'re now a co-host!',
        message: `${host.username} added you as a co-host for "${event.title}"`,
        data: { 
          eventId: event._id,
          eventTitle: event.title,
          hostId: hostId,
          hostUsername: host.username
        },
        actionType: 'VIEW_EVENT',
        actionData: { eventId: event._id }
      });

      console.log('✅ Co-host notification created:', notification);
      return notification;
    } catch (error) {
      console.error('❌ Error sending co-host notification:', error);
      throw error;
    }
  }

  /**
   * Send notification when co-host leaves the event
   * @param {string} coHostId - Co-host user ID
   * @param {string} hostId - Event host ID
   * @param {Object} event - Event object
   */
  async sendCoHostLeft(coHostId, hostId, event) {
    try {
      const coHost = await User.findById(coHostId).select('username');
      
      return this.createNotification({
        userId: hostId,
        senderId: coHostId,
        category: 'events',
        type: 'cohost_left',
        title: 'Co-host left event',
        message: `${coHost.username} is no longer co-hosting "${event.title}"`,
        data: { 
          eventId: event._id,
          eventTitle: event.title,
          coHostId: coHostId,
          coHostUsername: coHost.username
        },
        actionType: 'VIEW_EVENT',
        actionData: { eventId: event._id }
      });
    } catch (error) {
      console.error('❌ Error sending co-host left notification:', error);
      throw error;
    }
  }

  /**
   * Send notification when co-host tries to perform restricted action
   * @param {string} coHostId - Co-host user ID
   * @param {string} eventId - Event ID
   * @param {string} action - Restricted action attempted
   */
  async sendCoHostPermissionDenied(coHostId, eventId, action) {
    return this.createNotification({
      userId: coHostId,
      senderId: null,
      category: 'events',
      type: 'cohost_permission_denied',
      title: 'Action not allowed',
      message: `As a co-host, you cannot ${action}. Contact the event host for these changes.`,
      data: { 
        eventId: eventId,
        restrictedAction: action
      },
      actionType: 'VIEW_EVENT',
      actionData: { eventId }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEMORY NOTIFICATIONS
  ═══════════════════════════════════════════════════════════════════ */

  /**
   * Send memory invitation notification
   * @param {string} inviterId - User who sent the invitation
   * @param {string} memoryId - Memory ID
   * @param {Array} invitedUserIds - Array of invited user IDs
   */
  async sendMemoryInvitation(inviterId, memoryId, invitedUserIds) {
    const inviter = await User.findById(inviterId).select('username');
    const memory = await Memory.findById(memoryId).select('title');
    
    const notifications = await Promise.all(
      invitedUserIds.map(userId => 
        this.createNotification({
          userId,
          senderId: inviterId,
          category: 'social',
          type: 'memory_invitation',
          title: 'Memory Invitation',
          message: `${inviter.username} invited you to contribute to "${memory.title}"`,
          actionType: 'VIEW_MEMORY',
          actionData: { memoryId },
          data: { memoryId },
          priority: 'high'
        })
      )
    );
    
    return notifications;
  }

  /**
   * Send memory photo added notification
   * @param {string} uploaderId - User who uploaded the photo
   * @param {string} memoryId - Memory ID
   * @param {Array} participantIds - Array of memory participant IDs
   */
  async sendMemoryPhotoAdded(uploaderId, memoryId, participantIds) {
    const uploader = await User.findById(uploaderId).select('username');
    const memory = await Memory.findById(memoryId).select('title');
    
    // Don't notify the uploader
    const notifyIds = participantIds.filter(id => String(id) !== String(uploaderId));
    
    const notifications = await Promise.all(
      notifyIds.map(participantId => 
        this.createNotification({
          userId: participantId,
          senderId: uploaderId,
          category: 'social',
          type: 'memory_photo_added',
          title: 'New Memory Photo',
          message: `${uploader.username} added a photo to "${memory.title}"`,
          actionType: 'VIEW_MEMORY',
          actionData: { memoryId },
          data: { memoryId }
        })
      )
    );
    
    return notifications;
  }

  /**
   * Send batched memory photo uploads notification
   * @param {string} memoryId - Memory ID
   * @param {Array} uploaderIds - Array of uploader user IDs
   * @param {string} notifyUserId - User to notify
   */
  async sendMemoryPhotoBatch(memoryId, uploaderIds, notifyUserId) {
    const memory = await Memory.findById(memoryId).select('title');
    const uploaders = await User.find({ _id: { $in: uploaderIds } }).select('username');
    
    // Don't notify if user is one of the uploaders
    if (uploaderIds.includes(notifyUserId)) return null;
    
    // Check for existing batch notification in last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const existingNotif = await Notification.findOne({
      user: notifyUserId,
      type: 'memory_photo_batch',
      'data.memoryId': memoryId,
      createdAt: { $gte: twoHoursAgo }
    });
    
    if (existingNotif) {
      // Update existing notification with new count
      const currentUploaders = existingNotif.data.uploaderIds || [];
      const uniqueUploaders = [...new Set([...currentUploaders, ...uploaderIds])];
      
      existingNotif.data.uploaderIds = uniqueUploaders;
      existingNotif.data.count = uniqueUploaders.length;
      
      if (uniqueUploaders.length === 2) {
        existingNotif.message = `2 friends added photos to "${memory.title}"`;
      } else {
        existingNotif.message = `${uniqueUploaders.length} friends added photos to "${memory.title}"`;
      }
      
      existingNotif.updatedAt = new Date();
      await existingNotif.save();
      
      return existingNotif;
    } else {
      // Create new batch notification
      const uploaderNames = uploaders.map(u => u.username);
      let message;
      
      if (uploaderNames.length === 1) {
        message = `${uploaderNames[0]} added photos to "${memory.title}"`;
      } else if (uploaderNames.length === 2) {
        message = `${uploaderNames[0]} and ${uploaderNames[1]} added photos to "${memory.title}"`;
      } else {
        message = `${uploaderNames.length} friends added photos to "${memory.title}"`;
      }
      
      return this.createNotification({
        userId: notifyUserId,
        senderId: uploaderIds[0],
        category: 'social',
        type: 'memory_photo_batch',
        title: 'New Memory Photos',
        message,
        actionType: 'VIEW_MEMORY',
        actionData: { memoryId },
        data: { 
          memoryId, 
          uploaderIds,
          count: uploaderIds.length 
        }
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     EVENT NOTIFICATIONS
  ═══════════════════════════════════════════════════════════════════ */

  /**
   * Send event invitation notification
   * @param {string} hostId - Event host ID
   * @param {string} eventId - Event ID
   * @param {Array} invitedUserIds - Array of invited user IDs
   */
  async sendEventInvitation(hostId, eventId, invitedUserIds) {
    const host = await User.findById(hostId).select('username');
    const event = await Event.findById(eventId).select('title time');
    
    const notifications = await Promise.all(
      invitedUserIds.map(userId => 
        this.createNotification({
          userId,
          senderId: hostId,
          category: 'events',
          type: 'event_invitation',
          title: 'Event Invitation',
          message: `${host.username} invited you to "${event.title}"`,
          actionType: 'VIEW_EVENT',
          actionData: { eventId },
          data: { 
            eventId,
            eventTitle: event.title,
            eventTime: event.time 
          },
          priority: 'high'
        })
      )
    );
    
    return notifications;
  }

  /**
   * Send event reminder notification
   * @param {string} eventId - Event ID
   * @param {string} reminderType - Type of reminder ('1_day', '1_hour', etc.)
   */
  async sendEventReminder(eventId, reminderType = '1_day') {
    const event = await Event.findById(eventId)
      .populate('attendees', 'username')
      .select('title time attendees location');
    
    if (!event || event.attendees.length === 0) {
      return [];
    }
    
    let timeText, title, message;
    
    switch (reminderType) {
      case '1_hour':
        timeText = 'in 1 hour';
        title = 'Event Starting Soon! ⏰';
        message = `"${event.title}" starts in 1 hour at ${event.location}`;
        break;
      case '1_day':
        timeText = 'tomorrow';
        title = 'Event Tomorrow';
        message = `Don't forget: "${event.title}" is tomorrow`;
        break;
      case '2_hours':
        timeText = 'in 2 hours';
        title = 'Event Soon';
        message = `"${event.title}" starts in 2 hours`;
        break;
      default:
        timeText = reminderType;
        title = `Event ${timeText}`;
        message = `Don't forget: "${event.title}" is ${timeText}`;
    }
    
    const notifications = await Promise.all(
      event.attendees.map(attendee => 
        this.createNotification({
          userId: attendee._id,
          senderId: null, // System notification
          category: 'events',
          type: reminderType === '1_hour' ? 'event_reminder_1_hour' : 'event_reminder',
          title,
          message,
          actionType: 'VIEW_EVENT',
          actionData: { eventId },
          data: { eventId, reminderType },
          priority: reminderType === '1_hour' ? 'high' : 'normal'
        })
      )
    );
    
    return notifications;
  }

  /**
   * Send event announcement notification
   * @param {string} hostId - Event host ID
   * @param {string} eventId - Event ID
   * @param {string} announcement - Announcement message
   */
  async sendEventAnnouncement(hostId, eventId, announcement) {
    const host = await User.findById(hostId).select('username');
    const event = await Event.findById(eventId)
      .populate('attendees', 'username')
      .select('title attendees');
    
    if (!event || event.attendees.length === 0) {
      return [];
    }
    
    // Don't notify the host
    const notifyIds = event.attendees
      .filter(attendee => String(attendee._id) !== String(hostId))
      .map(attendee => attendee._id);
    
    const notifications = await Promise.all(
      notifyIds.map(userId => 
        this.createNotification({
          userId,
          senderId: hostId,
          category: 'events',
          type: 'event_announcement',
          title: `Update: ${event.title}`,
          message: announcement.length > 100 ? 
            announcement.substring(0, 97) + '...' : 
            announcement,
          actionType: 'VIEW_EVENT',
          actionData: { eventId },
          data: { eventId, announcement }
        })
      )
    );
    
    return notifications;
  }

  /**
   * Send batched RSVP notifications (prevents spam)
   * @param {string} eventId - Event ID
   * @param {string} hostId - Event host ID
   */
  async sendEventRSVPBatch(eventId, hostId) {
    const host = await User.findById(hostId);
    const event = await Event.findById(eventId).select('title attendees');
    
    if (!host || !event) return null;
    
    // Check for existing RSVP batch notification in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existingNotif = await Notification.findOne({
      user: hostId,
      type: 'event_rsvp_batch',
      'data.eventId': eventId,
      createdAt: { $gte: oneHourAgo }
    });
    
    if (existingNotif) {
      // Update existing notification
      const newCount = (existingNotif.data.count || 1) + 1;
      existingNotif.data.count = newCount;
      
      existingNotif.message = newCount === 2 ?
        `2 people RSVPed to "${event.title}"` :
        `${newCount} people RSVPed to "${event.title}"`;
      await existingNotif.save();
      
      return existingNotif;
    } else {
      // Create new batch notification
      return this.createNotification({
        userId: hostId,
        senderId: null,
        category: 'events',
        type: 'event_rsvp_batch',
        title: 'New RSVPs',
        message: `Someone RSVPed to "${event.title}"`,
        actionType: 'VIEW_EVENT',
        actionData: { eventId },
        data: { eventId, count: 1 }
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     ENGAGEMENT NOTIFICATIONS
  ═══════════════════════════════════════════════════════════════════ */

  /**
   * Send post liked notification
   * @param {string} likerId - User who liked the post
   * @param {string} photoId - Photo/post ID
   * @param {string} photoOwnerId - Owner of the photo
   */
  async sendPostLiked(likerId, photoId, photoOwnerId) {
    const liker = await User.findById(likerId).select('username');
    
    return this.createNotification({
      userId: photoOwnerId,
      senderId: likerId,
      category: 'social',
      type: 'post_liked',
      title: 'Photo Liked',
      message: `${liker.username} liked your photo`,
      data: { postId: photoId, userId: likerId },
      actionType: 'VIEW_POST',
      actionData: { photoId }
    });
  }

  /**
   * Send post commented notification
   * @param {string} commenterId - User who commented
   * @param {string} photoId - Photo/post ID
   * @param {string} photoOwnerId - Owner of the photo
   * @param {string} commentText - Comment text
   */
  async sendPostCommented(commenterId, photoId, photoOwnerId, commentText) {
    const commenter = await User.findById(commenterId).select('username');
    
    return this.createNotification({
      userId: photoOwnerId,
      senderId: commenterId,
      category: 'social',
      type: 'post_commented',
      title: 'New Comment',
      message: `${commenter.username} commented: "${commentText.substring(0, 50)}..."`,
      data: { postId: photoId, userId: commenterId },
      actionType: 'VIEW_POST',
      actionData: { photoId }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICATION RETRIEVAL & MANAGEMENT
  ═══════════════════════════════════════════════════════════════════ */

  /**
   * Get user notifications with pagination
   * @param {string} userId - User ID
   * @param {number} page - Page number
   * @param {number} limit - Results per page
   * @param {string} category - Optional category filter
   */
  async getUserNotifications(userId, page = 1, limit = 20, category = null) {
    const skip = (page - 1) * limit;
    
    const query = { user: userId };
    if (category) {
      query.category = category;
    }
    
    const [notifications, unreadCounts] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'username profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      
      this.getUnreadCountsByCategory(userId)
    ]);
    
    const totalUnread = unreadCounts.reduce((sum, cat) => sum + cat.count, 0);
    const socialUnread = unreadCounts.find(cat => cat.category === 'social')?.count || 0;
    const eventsUnread = unreadCounts.find(cat => cat.category === 'events')?.count || 0;
    
    return {
      notifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(notifications.length / limit),
        hasMore: notifications.length === limit
      },
      unreadCounts: {
        total: totalUnread,
        social: socialUnread,
        events: eventsUnread
      }
    };
  }

  /**
   * Get unread counts by category
   * @param {string} userId - User ID
   */
  async getUnreadCountsByCategory(userId) {
    return await Notification.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), isRead: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } }
    ]);
  }

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @param {string} category - Optional category filter
   */
  async getUnreadCount(userId, category = null) {
    const query = { user: userId, read: false };
    if (category) {
      query.category = category;
    }
    
    return await Notification.countDocuments(query);
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID for security
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    
    return notification;
  }

  /**
   * Mark all notifications as read
   * @param {string} userId - User ID
   * @param {string} category - Optional category filter
   */
  async markAllAsRead(userId, category = null) {
    const query = { user: userId, read: false };
    if (category) {
      query.category = category;
    }
    
    const result = await Notification.updateMany(
      query,
      { $set: { read: true, readAt: new Date() } }
    );
    
    return result;
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID for security
   */
  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId
    });
    
    return notification;
  }
}

module.exports = new NotificationService();