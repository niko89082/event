// utils/notificationHooks.js - PHASE 3: Integration hooks for triggering notifications
const notificationService = require('../services/notificationService');

/* ═══════════════════════════════════════════════════════════════════
   SOCIAL NOTIFICATION HOOKS
═══════════════════════════════════════════════════════════════════ */

/**
 * Hook for when a user follows another user
 * Usage: Add to follow route in routes/follow.js
 */
const onUserFollowed = async (followerId, followedUserId) => {
  try {
    await notificationService.sendNewFollower(followerId, followedUserId);
    console.log(`🔔 Sent new follower notification: ${followerId} -> ${followedUserId}`);
  } catch (error) {
    console.error('Error sending follower notification:', error);
  }
};

/**
 * Hook for when a friend request is sent
 * Usage: Add to friend request route
 */
const onFriendRequestSent = async (fromUserId, toUserId) => {
  try {
    await notificationService.sendFriendRequest(fromUserId, toUserId);
    console.log(`🔔 Sent friend request notification: ${fromUserId} -> ${toUserId}`);
  } catch (error) {
    console.error('Error sending friend request notification:', error);
  }
};

/**
 * Hook for when a friend request is accepted
 * Usage: Add to accept friend request route
 */
const onFriendRequestAccepted = async (accepterId, requesterId) => {
  try {
    await notificationService.sendFriendRequestAccepted(accepterId, requesterId);
    console.log(`🔔 Sent friend request accepted notification: ${accepterId} -> ${requesterId}`);
  } catch (error) {
    console.error('Error sending friend request accepted notification:', error);
  }
};

/**
 * Hook for when a photo is added to a memory
 * Usage: Add to memory photo upload route in routes/memories.js
 */
const onMemoryPhotoAdded = async (uploaderId, memoryId, memory) => {
  try {
    // Get all participants (creator + participants)
    const allParticipants = [memory.creator, ...memory.participants];
    const participantIds = allParticipants.map(id => String(id));
    
    await notificationService.sendMemoryPhotoAdded(uploaderId, memoryId, participantIds);
    console.log(`🔔 Sent memory photo notifications for memory: ${memoryId}`);
  } catch (error) {
    console.error('Error sending memory photo notification:', error);
  }
};

/**
 * Hook for when a post is liked
 * Usage: Add to photo like route in routes/photos.js
 */
const onPostLiked = async (likerId, postId, postOwnerId) => {
  try {
    await notificationService.sendPostLiked(likerId, postId, postOwnerId);
    console.log(`🔔 Sent post liked notification: ${likerId} liked ${postId}`);
  } catch (error) {
    console.error('Error sending post liked notification:', error);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   EVENT NOTIFICATION HOOKS
═══════════════════════════════════════════════════════════════════ */

/**
 * Hook for when users are invited to an event
 * Usage: Add to event invitation route in routes/events.js
 */
const onEventInvitation = async (hostId, eventId, invitedUserIds) => {
  try {
    await notificationService.sendEventInvitation(hostId, eventId, invitedUserIds);
    console.log(`🔔 Sent event invitations for event: ${eventId} to ${invitedUserIds.length} users`);
  } catch (error) {
    console.error('Error sending event invitation notifications:', error);
  }
};

/**
 * Hook for when someone RSVPs to an event (batched)
 * Usage: Add to RSVP route in routes/events.js
 */
const onEventRSVP = async (eventId, hostId, attendeeId) => {
  try {
    // Only notify if attendee is not the host
    if (String(attendeeId) !== String(hostId)) {
      await notificationService.sendEventRSVPBatch(eventId, hostId);
      console.log(`🔔 Sent batched RSVP notification for event: ${eventId}`);
    }
  } catch (error) {
    console.error('Error sending RSVP notification:', error);
  }
};

/**
 * Hook for event announcements
 * Usage: Add to new event announcement route
 */
const onEventAnnouncement = async (hostId, eventId, announcementText) => {
  try {
    await notificationService.sendEventAnnouncement(hostId, eventId, announcementText);
    console.log(`🔔 Sent event announcement for event: ${eventId}`);
  } catch (error) {
    console.error('Error sending event announcement notification:', error);
  }
};

/**
 * Hook for event reminders (called by cron job)
 * Usage: Add to scheduled reminder system
 */
const onEventReminder = async (eventId, reminderType = '1_day') => {
  try {
    const notifications = await notificationService.sendEventReminder(eventId, reminderType);
    console.log(`🔔 Sent ${notifications.length} event reminders for: ${eventId} (${reminderType})`);
    return notifications;
  } catch (error) {
    console.error('Error sending event reminder notifications:', error);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   INTEGRATION HELPER FUNCTIONS
═══════════════════════════════════════════════════════════════════ */

/**
 * Safe notification wrapper - won't crash app if notification fails
 */
const safeNotify = async (notificationFn, ...args) => {
  try {
    await notificationFn(...args);
  } catch (error) {
    console.error('🔔 Notification failed safely:', error.message);
    // Don't rethrow - notifications should never crash the main operation
  }
};

/**
 * Batch notification helper for multiple users
 */
const batchNotify = async (userIds, notificationFn, ...commonArgs) => {
  const promises = userIds.map(userId => 
    safeNotify(notificationFn, userId, ...commonArgs)
  );
  
  await Promise.allSettled(promises);
};

/* ═══════════════════════════════════════════════════════════════════
   SCHEDULED NOTIFICATION FUNCTIONS
═══════════════════════════════════════════════════════════════════ */

/**
 * Send daily event reminders (24 hours before)
 * Usage: Call from cron job in server.js
 */
const sendDailyEventReminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    const Event = require('../models/Event');
    const eventsToRemind = await Event.find({
      time: { $gte: tomorrow, $lte: tomorrowEnd },
      $expr: { $gt: [{ $size: "$attendees" }, 0] } // Has attendees
    }).select('_id title');
    
    console.log(`🔔 Sending daily reminders for ${eventsToRemind.length} events`);
    
    const reminderPromises = eventsToRemind.map(event => 
      onEventReminder(event._id, '1_day')
    );
    
    await Promise.allSettled(reminderPromises);
    console.log(`🔔 Daily event reminders completed`);
  } catch (error) {
    console.error('Error sending daily event reminders:', error);
  }
};

/**
 * Send hourly event reminders (2 hours before)
 * Usage: Call from cron job in server.js
 */
const sendHourlyEventReminders = async () => {
  try {
    const twoHoursFromNow = new Date();
    twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);
    
    const startTime = new Date(twoHoursFromNow);
    startTime.setMinutes(0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(59, 59, 999);
    
    const Event = require('../models/Event');
    const eventsToRemind = await Event.find({
      time: { $gte: startTime, $lte: endTime },
      $expr: { $gt: [{ $size: "$attendees" }, 0] }
    }).select('_id title');
    
    console.log(`🔔 Sending hourly reminders for ${eventsToRemind.length} events`);
    
    const reminderPromises = eventsToRemind.map(event => 
      onEventReminder(event._id, '2_hours')
    );
    
    await Promise.allSettled(reminderPromises);
    console.log(`🔔 Hourly event reminders completed`);
  } catch (error) {
    console.error('Error sending hourly event reminders:', error);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════════════════════════════ */

module.exports = {
  // Social hooks
  onUserFollowed,
  onFriendRequestSent,
  onFriendRequestAccepted,
  onMemoryPhotoAdded,
  onPostLiked,
  
  // Event hooks
  onEventInvitation,
  onEventRSVP,
  onEventAnnouncement,
  onEventReminder,
  
  // Helpers
  safeNotify,
  batchNotify,
  
  // Scheduled functions
  sendDailyEventReminders,
  sendHourlyEventReminders
};