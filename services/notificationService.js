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
    const socialTypes = ['friend_request', 'friend_request_accepted', 'new_follower', 'memory_photo_added', 'memory_invitation', 'post_liked', 'post_commented', 'memory_photo_liked'];
    const eventTypes = ['event_invitation', 'event_reminder', 'event_update', 'event_cancelled', 'event_announcement', 'event_rsvp_batch'];
    
    if (socialTypes.includes(type)) return 'social';
    if (eventTypes.includes(type)) return 'events';
    return 'social'; // default
  }

  /* ═══════════════════════════════════════════════════════════════════
     SOCIAL NOTIFICATIONS
  ═══════════════════════════════════════════════════════════════════ */

  async sendFriendRequest(fromUserId, toUserId) {
    const fromUser = await User.findById(fromUserId).select('username fullName');
    
    return this.createNotification({
      userId: toUserId,
      senderId: fromUserId,
      category: 'social',
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${fromUser.username} sent you a friend request`,
      actionType: 'VIEW_PROFILE',
      actionData: { userId: fromUserId },
      priority: 'high'
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

  async sendNewFollower(followerId, followedUserId) {
    const follower = await User.findById(followerId).select('username fullName');
    
    return this.createNotification({
      userId: followedUserId,
      senderId: followerId,
      category: 'social',
      type: 'new_follower',
      title: 'New Follower',
      message: `${follower.username} started following you`,
      actionType: 'VIEW_PROFILE',
      actionData: { userId: followerId }
    });
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

  async sendEventReminder(eventId, reminderType = '1_day') {
    const event = await Event.findById(eventId)
      .populate('attendees', 'username')
      .select('title time attendees');
    
    if (!event || event.attendees.length === 0) {
      return [];
    }
    
    const timeText = reminderType === '1_day' ? 'tomorrow' : 'in 2 hours';
    
    const notifications = await Promise.all(
      event.attendees.map(attendee => 
        this.createNotification({
          userId: attendee._id,
          senderId: null, // System notification
          category: 'events',
          type: 'event_reminder',
          title: `Event ${timeText}`,
          message: `Don't forget: "${event.title}" is ${timeText}`,
          actionType: 'VIEW_EVENT',
          actionData: { eventId },
          data: { eventId, reminderType }
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

  async sendPostLiked(likerId, postId, postOwnerId) {
    if (String(likerId) === String(postOwnerId)) return null; // Don't notify self
    
    const liker = await User.findById(likerId).select('username');
    
    return this.createNotification({
      userId: postOwnerId,
      senderId: likerId,
      category: 'social',
      type: 'post_liked',
      title: 'Post Liked',
      message: `${liker.username} liked your post`,
      actionType: 'VIEW_POST',
      actionData: { postId },
      data: { postId }
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
        page,
        limit,
        hasMore: notifications.length === limit
      },
      unreadCounts: {
        total: totalUnread,
        social: socialUnread,
        events: eventsUnread
      }
    };
  }

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId
    });
    
    if (!notification) {
      throw new Error('Notification not found');
    }
    
    return notification.markAsRead();
  }

  async markAllAsRead(userId, category = null) {
    return Notification.markAllAsReadForUser(userId, category);
  }

  async deleteNotification(notificationId, userId) {
    return Notification.findOneAndDelete({
      _id: notificationId,
      user: userId
    });
  }

  async getUnreadCount(userId, category = null) {
    const query = { user: userId, isRead: false };
    if (category) {
      query.category = category;
    }
    
    return Notification.countDocuments(query);
  }
}

module.exports = new NotificationService();