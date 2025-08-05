// utils/activityHooks.js - UPDATED: Activity Feed Creation Hooks with NEW FUNCTIONS
const notificationService = require('../services/notificationService');

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY FEED CREATION HOOKS - UPDATED WITH NEW HOOKS
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

/* ═══════════════════════════════════════════════════════════════════
   ✅ NEW ACTIVITY HOOKS - PHASE 1
══════════════════════════════════════════════════════════════════ */

/**
 * ✅ NEW: Hook for when someone uploads a photo to a memory
 * Usage: Add to memory photo upload route in routes/memories.js
 */
const onMemoryPhotoUpload = async (photoId, uploaderId, memoryId) => {
  try {
    const MemoryPhoto = require('../models/MemoryPhoto');
    const Memory = require('../models/Memory');
    const User = require('../models/User');
    
    console.log(`📸 onMemoryPhotoUpload called:`, {
      photoId,
      uploaderId,
      memoryId
    });
    
    // Get photo, memory, and uploader info
    const photo = await MemoryPhoto.findById(photoId);
    const memory = await Memory.findById(memoryId).select('title creator participants');
    const uploader = await User.findById(uploaderId).select('username');
    
    if (!photo || !memory || !uploader) {
      console.log('❌ Missing required data for memory photo upload activity:', {
        hasPhoto: !!photo,
        hasMemory: !!memory,
        hasUploader: !!uploader
      });
      return;
    }
    
    console.log(`📸 Creating memory_photo_upload activity for ${uploader.username} uploading to memory "${memory.title}"`);
    
    // Activities are created through the feed system, not notifications
    // This will be picked up by fetchMemoryPhotoUploads() in routes/feed.js
    // The activity will be visible to:
    // 1. Memory participants
    // 2. Friends of the uploader who can see the memory
    
    console.log(`✅ Memory photo upload activity registered for photoId: ${photoId}`);
    
  } catch (error) {
    console.error('❌ Error in onMemoryPhotoUpload hook:', error);
  }
};

/**
 * ✅ NEW: Hook for when someone comments on a regular photo
 * Usage: Add to regular photo comment routes
 */
const onPhotoComment = async (photoId, commenterId, photoOwnerId, isMemoryPhoto = false) => {
  try {
    const User = require('../models/User');
    
    console.log(`💬 onPhotoComment called:`, {
      photoId,
      commenterId,
      photoOwnerId,
      isMemoryPhoto
    });
    
    // Don't create activity if user is commenting on their own photo
    if (String(commenterId) === String(photoOwnerId)) {
      console.log('📝 User commenting on own photo, no activity needed');
      return;
    }
    
    const commenter = await User.findById(commenterId).select('username');
    const photoOwner = await User.findById(photoOwnerId).select('username');
    
    if (!commenter || !photoOwner) {
      console.log('❌ Missing user data for photo comment activity');
      return;
    }
    
    const activityType = isMemoryPhoto ? 'memory_photo_comment' : 'photo_comment';
    
    console.log(`💬 Creating ${activityType} activity for ${commenter.username} commenting on ${photoOwner.username}'s photo`);
    
    // Activities are created through the feed system, not notifications
    // This will be picked up by fetchPhotoComments() or fetchMemoryPhotoComments() in routes/feed.js
    
    console.log(`✅ Photo comment activity registered for photoId: ${photoId}`);
    
  } catch (error) {
    console.error('❌ Error in onPhotoComment hook:', error);
  }
};

/**
 * ✅ NEW: Convenience wrapper for memory photo comments
 * Usage: Add to memory photo comment route in routes/memories.js
 */
const onMemoryPhotoComment = async (photoId, commenterId, memoryId) => {
  try {
    const MemoryPhoto = require('../models/MemoryPhoto');
    
    console.log(`💬 onMemoryPhotoComment called:`, {
      photoId,
      commenterId,
      memoryId
    });
    
    // Get the photo to find the owner
    const photo = await MemoryPhoto.findById(photoId).select('uploadedBy');
    
    if (!photo) {
      console.log('❌ Memory photo not found for comment activity');
      return;
    }
    
    // Call the main photo comment hook with memory flag
    await onPhotoComment(photoId, commenterId, photo.uploadedBy, true);
    
  } catch (error) {
    console.error('❌ Error in onMemoryPhotoComment hook:', error);
  }
};

module.exports = {
  onEventJoin,
  onEventPhotoUpload, 
  onGeneralPhotoUpload,
  onEventCreated,
  // ✅ NEW EXPORTS - PHASE 1
  onMemoryPhotoUpload,
  onPhotoComment,
  onMemoryPhotoComment
};