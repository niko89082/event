// services/notificationService.js - Basic service without Redis
const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  
  // Create in-app notification
  async createNotification(data) {
    try {
      const notification = await Notification.create({
        user: data.userId,
        sender: data.senderId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
        actionType: data.actionType || 'NONE',
        actionData: data.actionData || {}
      });

      // Try to send push notification (basic)
      try {
        await this.sendPushNotification(notification);
      } catch (pushError) {
        console.error('Push notification failed:', pushError);
        // Don't fail the whole operation if push fails
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Send friend request notification
  async sendFriendRequest(fromUserId, toUserId) {
    const fromUser = await User.findById(fromUserId).select('username');
    
    return this.createNotification({
      userId: toUserId,
      senderId: fromUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${fromUser.username} sent you a friend request`,
      actionType: 'VIEW_PROFILE',
      actionData: { userId: fromUserId }
    });
  }

  // Send event invitation notification
  async sendEventInvitation(hostId, guestId, event) {
    const host = await User.findById(hostId).select('username');
    
    return this.createNotification({
      userId: guestId,
      senderId: hostId,
      type: 'event_invitation',
      title: 'Event Invitation',
      message: `${host.username} invited you to ${event.title}`,
      actionType: 'VIEW_EVENT',
      actionData: { eventId: event._id }
    });
  }

  // Send memory invitation notification
  async sendMemoryInvitation(creatorId, participantId, memory) {
    const creator = await User.findById(creatorId).select('username');
    
    return this.createNotification({
      userId: participantId,
      senderId: creatorId,
      type: 'memory_invitation',
      title: 'Memory Invitation',
      message: `${creator.username} added you to "${memory.title}"`,
      actionType: 'VIEW_MEMORY',
      actionData: { memoryId: memory._id }
    });
  }

  // Send event reminder
  async sendEventReminder(userId, event) {
    return this.createNotification({
      userId: userId,
      type: 'event_reminder',
      title: 'Event Reminder',
      message: `${event.title} starts in 1 hour`,
      actionType: 'VIEW_EVENT',
      actionData: { eventId: event._id }
    });
  }

  // Basic push notification (you can enhance this later)
  async sendPushNotification(notification) {
    // This is a placeholder - implement with your push service
    console.log(`[PUSH] Sending to user ${notification.user}: ${notification.message}`);
    
    // Update notification as sent
    notification.pushSent = true;
    notification.pushSentAt = new Date();
    await notification.save();
    
    return true;
  }

  // Get user notifications
  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find({ user: userId })
      .populate('sender', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      isRead: false 
    });

    return {
      notifications,
      unreadCount,
      hasMore: notifications.length === limit
    };
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId, isRead: false },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    return notification;
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return true;
  }
}

module.exports = new NotificationService();