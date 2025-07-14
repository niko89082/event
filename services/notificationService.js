// services/notificationService.js - PHASE 3: Enhanced with batching and categories
const Notification = require('../models/Notification');
const User = require('../models/User');
const Event = require('../models/Event');
const Memory = require('../models/Memory');

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
    const socialTypes = ['friend_request', 'friend_request_accepted', 'new_follower', 'memory_photo_added', 'memory_invitation', 'memory_photo_batch', 'post_liked', 'post_commented', 'memory_photo_liked'];
    const eventTypes = ['event_invitation', 'event_reminder', 'event_reminder_1_hour', 'event_update', 'event_cancelled', 'event_announcement', 'event_rsvp_batch'];
    
    if (socialTypes.includes(type)) return 'social';
    if (eventTypes.includes(type)) return 'events';
    return 'social'; // default
  }

  /* ═══════════════════════════════════════════════════════════════════
     SOCIAL NOTIFICATIONS
  ═══════════════════════════════════════════════════════════════════ */

  async sendFriendRequest(requesterId, targetId) {
  const requester = await User.findById(requesterId).select('username');
  return this.createNotification({
    userId: targetId,
    senderId: requesterId,
    category: 'social',
    type: 'friend_request',
    title: 'Follow Request',
    message: `${requester.username} sent you a follow request`,
    data: { userId: requesterId },
    actionType: 'ACCEPT_REQUEST',
    actionData: { requesterId }
  });
}

  async sendFriendRequestAccepted(fromUserId, toUserId) {
    const fromUser = await User.findById(fromUserId).select('username fullName');
    
    return this.createNotification({
      userId: toUserId,
      senderId: fromUserId,
      category: 'social',
      type: 'friend_request_accepted',
      title: 'Friend Request Accepted',
      message: `${fromUser.username} accepted your friend request`,
      actionType: 'VIEW_PROFILE',
      actionData: { userId: fromUserId }
    });
  }

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
     🆕 MEMORY INVITATION NOTIFICATION (NEW)
  ═══════════════════════════════════════════════════════════════════ */

  async sendMemoryInvitation(inviterId, memoryId, invitedUserIds) {
    const inviter = await User.findById(inviterId).select('username fullName');
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

  async sendMemoryPhotoAdded(uploaderId, memoryId, participantIds) {
    const uploader = await User.findById(uploaderId).select('username fullName');
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

  /* ═══════════════════════════════════════════════════════════════════
     🆕 BATCHED MEMORY PHOTO UPLOADS (NEW - When multiple friends upload)
  ═══════════════════════════════════════════════════════════════════ */

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
        senderId: uploaderIds[0], // Use first uploader as sender
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

  async sendEventInvitation(hostId, eventId, invitedUserIds) {
    const host = await User.findById(hostId).select('username fullName');
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
          data: { eventId },
          priority: 'high'
        })
      )
    );
    
    return notifications;
  }

  /* ═══════════════════════════════════════════════════════════════════
     🔧 ENHANCED EVENT REMINDER (Updated with 1-hour support)
  ═══════════════════════════════════════════════════════════════════ */

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

  async sendEventAnnouncement(hostId, eventId, announcement) {
    const host = await User.findById(hostId).select('username fullName');
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

  // 🔔 PHASE 3: Batched RSVP notifications (prevents spam)
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
      await existingNotif.updateBatchCount(newCount);
      
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
     ENGAGEMENT NOTIFICATIONS (simplified)
  ═══════════════════════════════════════════════════════════════════ */

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

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICATION RETRIEVAL & MANAGEMENT
  ═══════════════════════════════════════════════════════════════════ */

  async getUserNotifications(userId, page = 1, limit = 20, category = null) {
    const skip = (page - 1) * limit;
    
    const query = { user: userId };
    if (category) {
      query.category = category;
    }
    
    const [notifications, unreadCounts] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      
      Notification.getUnreadCountByCategory(userId)
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

  async getUnreadCount(userId, category = null) {
    const query = { user: userId, isRead: false };
    if (category) {
      query.category = category;
    }
    
    return await Notification.countDocuments(query);
  }

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true },
      { new: true }
    );
    
    return notification;
  }

  async markAllAsRead(userId, category = null) {
    const query = { user: userId, isRead: false };
    if (category) {
      query.category = category;
    }
    
    const result = await Notification.updateMany(query, { isRead: true });
    return result;
  }

  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId
    });
    
    return notification;
  }
}

module.exports = new NotificationService();