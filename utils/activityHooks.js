// utils/activityHooks.js - ACTIVITY FEED CREATION HOOKS (NEW FILE)
const notificationService = require('../services/notificationService');

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY FEED CREATION HOOKS
══════════════════════════════════════════════════════════════════ */

/**
 * Hook for when someone joins an event - creates friend_event_join activity
 * Usage: Add to event join route in routes/events.js
 */
const onEventJoin = async (eventId, attendeeId) => {
  try {
    const Event = require('../models/Event');
    const User = require('../models/User');
    
    // Get event and attendee info
    const event = await Event.findById(eventId).select('title host time privacyLevel');
    const attendee = await User.findById(attendeeId).select('username');
    
    if (!event || !attendee) return;
    
    // Find friends of the attendee to notify them
    const attendeeUser = await User.findById(attendeeId).populate('friends');
    const friendIds = attendeeUser.getAcceptedFriends();
    
    // Only create activity for public or friends-only events
    if (event.privacyLevel === 'private') return;
    
    console.log(`🎯 Creating friend_event_join activity for ${attendee.username} joining ${event.title}`);
    
    // Activities are created through the feed system, not notifications
    // This will be picked up by fetchFriendEventJoins() in routes/feed.js
    
  } catch (error) {
    console.error('Error in onEventJoin hook:', error);
  }
};

/**
 * Hook for when someone uploads a photo to an event
 * Usage: Add to event photo upload route in routes/photos.js
 */
const onEventPhotoUpload = async (photoId, uploaderId, eventId) => {
  try {
    const Photo = require('../models/Photo');
    const Event = require('../models/Event');
    const User = require('../models/User');
    
    // Get photo, event, and uploader info
    const photo = await Photo.findById(photoId);
    const event = await Event.findById(eventId).select('title host privacyLevel');
    const uploader = await User.findById(uploaderId).select('username');
    
    if (!photo || !event || !uploader) return;
    
    // Only create activity for public or friends-only events
    if (event.privacyLevel === 'private') return;
    
    console.log(`📸 Creating event_photo_upload activity for ${uploader.username} uploading to ${event.title}`);
    
    // Activities are created through the feed system, not notifications
    // This will be picked up by fetchEventPhotoUploads() in routes/feed.js
    
  } catch (error) {
    console.error('Error in onEventPhotoUpload hook:', error);
  }
};

/**
 * Hook for when a general photo is posted (not to an event)
 * Usage: Add to general photo upload route in routes/photos.js
 */
const onGeneralPhotoUpload = async (photoId, uploaderId) => {
  try {
    const Photo = require('../models/Photo');
    const User = require('../models/User');
    
    // Get photo and uploader info
    const photo = await Photo.findById(photoId);
    const uploader = await User.findById(uploaderId).select('username isPublic');
    
    if (!photo || !uploader) return;
    
    // Only create activity for public users or friends
    console.log(`📸 Creating regular_post activity for ${uploader.username}`);
    
    // Activities are created through the feed system, not notifications
    // This will be picked up by fetchRegularPosts() in routes/feed.js
    
  } catch (error) {
    console.error('Error in onGeneralPhotoUpload hook:', error);
  }
};

/**
 * Hook for when an event is created
 * Usage: Add to event creation route in routes/events.js
 */
const onEventCreated = async (eventId, hostId) => {
  try {
    const Event = require('../models/Event');
    const User = require('../models/User');
    
    const event = await Event.findById(eventId).select('title privacyLevel');
    const host = await User.findById(hostId).select('username');
    
    if (!event || !host) return;
    
    console.log(`🎉 Event created: ${event.title} by ${host.username}`);
    
    // Events become activities when friends join them or when they're invited
    // No immediate activity creation needed here
    
  } catch (error) {
    console.error('Error in onEventCreated hook:', error);
  }
};

module.exports = {
  onEventJoin,
  onEventPhotoUpload, 
  onGeneralPhotoUpload,
  onEventCreated
};