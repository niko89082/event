const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const User = require('../models/User');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const router = express.Router();
const { onPhotoComment } = require('../utils/activityHooks');


// Configure Multer for multiple photo uploads with a cap of 10
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/photos/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { files: 10 }
});

// ============================================
// HELPER FUNCTIONS FOR PRIVACY CHECKS
// ============================================

/**
 * Check if user can access an event
 */
async function checkEventAccess(userId, event) {
  try {
    let eventObj;
    
    // Handle different input types
    if (event._id) {
      eventObj = event; // Already an event object
    } else if (typeof event === 'string' || event.toString) {
      // It's an event ID, fetch the event
      eventObj = await Event.findById(event).populate('host coHosts attendees invitedUsers');
    } else {
      return { hasAccess: false, reason: 'Invalid event reference' };
    }

    if (!eventObj) {
      return { hasAccess: false, reason: 'Event not found' };
    }

    const userIdStr = String(userId);
    const hostIdStr = String(eventObj.host._id || eventObj.host);

    // Host can always access
    if (hostIdStr === userIdStr) {
      return { hasAccess: true, reason: 'Host access' };
    }

    // Co-hosts can access
    if (eventObj.coHosts && eventObj.coHosts.some(c => String(c._id || c) === userIdStr)) {
      return { hasAccess: true, reason: 'Co-host access' };
    }

    // Attendees can access
    if (eventObj.attendees && eventObj.attendees.some(a => String(a._id || a) === userIdStr)) {
      return { hasAccess: true, reason: 'Attendee access' };
    }

    // Check based on privacy level
    const viewerUser = await User.findById(userId).select('following');
    if (!viewerUser) {
      return { hasAccess: false, reason: 'User not found' };
    }

    const isFollowingHost = viewerUser.following.some(f => String(f) === hostIdStr);

    switch (eventObj.privacyLevel) {
      case 'public':
        return { hasAccess: true, reason: 'Public event' };
      case 'friends':
        if (isFollowingHost) {
          return { hasAccess: true, reason: 'Friend access' };
        }
        break;
      case 'private':
      case 'secret':
        // Only invited users can access
        if (eventObj.invitedUsers && eventObj.invitedUsers.some(i => String(i._id || i) === userIdStr)) {
          return { hasAccess: true, reason: 'Invited access' };
        }
        break;
    }

    return { hasAccess: false, reason: 'Privacy restriction' };

  } catch (error) {
    console.error('Event access check error:', error);
    return { hasAccess: false, reason: 'Check failed' };
  }
}

/**
 * Check if user can view a photo based on privacy settings
 */
async function checkPhotoAccess(userId, photo) {
  try {
    const userIdStr = String(userId);
    const photoOwnerIdStr = String(photo.user._id || photo.user);

    // Owner can always access
    if (photoOwnerIdStr === userIdStr) {
      return { hasAccess: true, reason: 'Owner access' };
    }

    // Check if photo is deleted
    if (photo.isDeleted) {
      return { hasAccess: false, reason: 'Photo deleted' };
    }

    // Check if photo is moderated/rejected
    if (photo.moderation && photo.moderation.status === 'rejected') {
      return { hasAccess: false, reason: 'Photo moderated' };
    }

    // Get photo owner's privacy settings if not already populated
    let photoUser = photo.user;
    if (typeof photoUser === 'string' || !photoUser.hasOwnProperty('isPublic')) {
      photoUser = await User.findById(photoOwnerIdStr).select('isPublic followers');
      if (!photoUser) {
        return { hasAccess: false, reason: 'Photo owner not found' };
      }
    }

    // Get viewer's following list
    const viewerUser = await User.findById(userId).select('following');
    if (!viewerUser) {
      return { hasAccess: false, reason: 'Viewer not found' };
    }

    const isFollowingOwner = viewerUser.following.some(f => String(f) === photoOwnerIdStr);

    // If photo is from a private account and viewer doesn't follow them
    if (photoUser.isPublic === false && !isFollowingOwner) {
      // Check if they have access through the event
      if (photo.event || photo.taggedEvent) {
        const eventId = photo.event || photo.taggedEvent;
        const eventAccess = await checkEventAccess(userId, eventId);
        if (!eventAccess.hasAccess) {
          return { hasAccess: false, reason: 'Private account - not following and no event access' };
        }
        // If they have event access, continue to event privacy check
      } else {
        return { hasAccess: false, reason: 'Private account - not following' };
      }
    }

    // Check event privacy if photo is tagged to an event
    if (photo.event || photo.taggedEvent) {
      const eventId = photo.event || photo.taggedEvent;
      const eventAccess = await checkEventAccess(userId, eventId);
      if (!eventAccess.hasAccess) {
        return { hasAccess: false, reason: `Event privacy restriction: ${eventAccess.reason}` };
      }
    }

    return { hasAccess: true, reason: 'Access granted' };

  } catch (error) {
    console.error('Photo access check error:', error);
    return { hasAccess: false, reason: 'Check failed' };
  }
}

// ============================================
// UPLOAD ENDPOINTS
// ============================================

// Upload Photos to an Event
router.post('/upload/:eventId', protect, upload.array('photos'), async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId).populate('host');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log(`📸 Photo upload attempt - User: ${req.user._id}, Event: ${event.title}`);

    // Permission checks
    if (!event.allowPhotos) {
      console.log('❌ Photo uploads disabled for this event');
      return res.status(403).json({ message: 'Photo uploads are disabled' });
    }

    const isHost = String(event.host._id) === String(req.user._id);
    const isAttendee = event.attendees.some(id => String(id) === String(req.user._id));
    
    console.log(`🔍 Permission check - isHost: ${isHost}, isAttendee: ${isAttendee}`);

    if (!isHost && !isAttendee) {
      console.log('❌ User not authorized - not host or attendee');
      return res.status(403).json({ message: 'Only attendees may upload' });
    }

    if (req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    console.log(`✅ Permission granted - uploading ${req.files.length} photos`);

    // Save photos
    const savedPhotos = [];
    for (const file of req.files) {
      const p = new Photo({
        user: req.user._id,
        event: eventId,           // ✅ Primary field
        taggedEvent: eventId,     // ✅ Compatibility field
        paths: [`/uploads/photos/${file.filename}`],
        visibleInEvent: true,
      });
      await p.save();

      // Add to event if not removed
      if (!event.removedPhotos || !event.removedPhotos.includes(p._id)) {
        if (!event.photos) {
          event.photos = [];
        }
        event.photos.push(p._id);
      }
      savedPhotos.push(p);
    }
    await event.save();

    // Add to user's photos
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { photos: { $each: savedPhotos.map(p => p._id) } } }
    );

    // ✅ NEW: Create activity for event photo upload (non-blocking)
    savedPhotos.forEach(photo => {
      setImmediate(async () => {
        try {
          await onEventPhotoUpload(photo._id, req.user._id, eventId);
          console.log(`📸 Activity hook executed for event photo: ${photo._id} -> ${eventId}`);
        } catch (activityError) {
          console.error('Failed to create event photo activity:', activityError);
        }
      });
    });

    console.log(`✅ Successfully uploaded ${savedPhotos.length} photos to event`);
    
    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${savedPhotos.length} photos`,
      photos: savedPhotos
    });

  } catch (error) {
    console.error('❌ Event photo upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Share Photo
router.get('/share/:photoId', protect, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check access
    const { hasAccess } = await checkPhotoAccess(req.user._id, photo);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this photo' });
    }

    // Increment share count
    photo.shareCount += 1;
    await photo.save();

    const shareLink = `${req.protocol}://${req.get('host')}/photos/${photo._id}`;
    const socialLinks = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareLink}`,
      twitter: `https://twitter.com/intent/tweet?text=Check%20this%20out!%20${shareLink}`,
      whatsapp: `https://api.whatsapp.com/send?text=Check%20this%20out!%20${shareLink}`,
      email: `mailto:?subject=Check%20this%20out!&body=Here%20is%20something%20interesting:%20${shareLink}`
    };

    res.status(200).json({ shareLink, socialLinks });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get trending photos
router.get('/trending', protect, async (req, res) => {
  try {
    const photos = await Photo.find({
      isDeleted: { $ne: true }
    })
    .populate('user', 'username profilePicture isPublic')
    .sort({ likes: -1 })
    .limit(10);

    // Filter for accessible photos
    const accessiblePhotos = [];
    for (const photo of photos) {
      const { hasAccess } = await checkPhotoAccess(req.user._id, photo);
      if (hasAccess) {
        accessiblePhotos.push(photo);
      }
    }

    res.status(200).json(accessiblePhotos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// HOST MODERATION ENDPOINTS
// ============================================

// Host/Co-host moderate photo
router.delete('/moderate/:photoId', protect, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { reason } = req.body;
    
    const photo = await Photo.findById(photoId).populate('event');
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user can moderate (host/co-host)
    let canModerate = false;
    if (photo.event) {
      const isHost = String(photo.event.host) === String(req.user._id);
      const isCoHost = photo.event.coHosts && photo.event.coHosts.some(c => 
        String(c) === String(req.user._id)
      );
      canModerate = isHost || isCoHost;
    }

    if (!canModerate) {
      return res.status(403).json({ message: 'Not authorized to moderate this photo' });
    }

    // Update moderation status
    if (!photo.moderation) {
      photo.moderation = {};
    }
    photo.moderation.status = 'rejected';
    photo.moderation.moderatedBy = req.user._id;
    photo.moderation.moderatedAt = new Date();
    photo.moderation.moderationNote = reason || 'Removed by event host';
    photo.visibleInEvent = false;
    
    await photo.save();

    // Remove from event photos array
    if (photo.event) {
      await Event.findByIdAndUpdate(
        photo.event._id,
        { 
          $pull: { photos: photo._id },
          $addToSet: { removedPhotos: photo._id }
        }
      );
    }

    res.json({ 
      success: true, 
      message: 'Photo moderated successfully',
      action: 'rejected'
    });
    
  } catch (error) {
    console.error('Photo moderation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Flag photo for review
router.post('/flag/:photoId', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    const photoId = req.params.photoId;
    
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check access to photo
    const { hasAccess } = await checkPhotoAccess(req.user._id, photo);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this photo' });
    }
    
    // Initialize moderation if it doesn't exist
    if (!photo.moderation) {
      photo.moderation = {
        status: 'approved',
        flaggedBy: []
      };
    }

    // Check if already flagged by this user
    const alreadyFlagged = photo.moderation.flaggedBy && photo.moderation.flaggedBy.some(
      flag => String(flag.user) === String(req.user._id)
    );
    
    if (alreadyFlagged) {
      return res.status(400).json({ message: 'You have already flagged this photo' });
    }

    // Add flag
    if (!photo.moderation.flaggedBy) {
      photo.moderation.flaggedBy = [];
    }
    
    photo.moderation.flaggedBy.push({
      user: req.user._id,
      reason: reason || 'Inappropriate content',
      flaggedAt: new Date()
    });
    
    // Update status if enough flags
    if (photo.moderation.flaggedBy.length >= 3) {
      photo.moderation.status = 'flagged';
    }
    
    await photo.save();

    res.json({ 
      success: true, 
      message: 'Photo flagged for review',
      flagCount: photo.moderation.flaggedBy.length
    });
    
  } catch (error) {
    console.error('Photo flag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Single photo upload
router.post('/upload', protect, upload.single('photo'), async (req, res) => {
  try {
    const { eventId, caption } = req.body;
    
    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    const event = await Event.findById(eventId).populate('host');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    console.log(`📸 Single photo upload - User: ${req.user._id}, Event: ${event.title}`);

    // Permission checks
    if (!event.allowPhotos) {
      console.log('❌ Photo uploads disabled for this event');
      return res.status(403).json({ message: 'Photo uploads are disabled' });
    }

    const isHost = String(event.host._id) === String(req.user._id);
    const isAttendee = event.attendees.some(id => String(id) === String(req.user._id));
    
    if (!isHost && !isAttendee) {
      console.log('❌ User not authorized - not host or attendee');
      return res.status(403).json({ message: 'Only attendees may upload' });
    }

    // Create photo document
    const photo = new Photo({
      user: req.user._id,
      event: eventId,           // ✅ Primary field
      taggedEvent: eventId,     // ✅ Compatibility field
      paths: [`/uploads/photos/${req.file.filename}`],
      visibleInEvent: true,
      caption: caption || ''
    });
    await photo.save();

    // Add to event's photos array
    if (!event.removedPhotos || !event.removedPhotos.includes(photo._id)) {
      if (!event.photos) {
        event.photos = [];
      }
      event.photos.push(photo._id);
    }
    await event.save();

    // Add to user's photos
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { photos: photo._id } }
    );

    console.log(`✅ Successfully uploaded single photo to event ${eventId}`);
    
    res.status(201).json({
      success: true,
      photo: photo,
      _id: photo._id,
      message: 'Photo uploaded successfully',
      eventId: eventId
    });

  } catch (error) {
    console.error('❌ Single photo upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// PHOTO RETRIEVAL WITH PRIVACY
// ============================================

// Get all photos
router.get('/', protect, async (req, res) => {
  try {
    const { eventId, limit = 50, offset = 0 } = req.query;
    const userId = req.user._id;
    
    let query = {
      isDeleted: { $ne: true }
    };
    
    // If eventId is provided, filter by event
    if (eventId) {
      query.$or = [
        { event: eventId },
        { taggedEvent: eventId }
      ];
    }
    
    const photos = await Photo.find(query)
      .populate('user', 'username profilePicture isPublic followers')
      .populate('event', 'title time host attendees privacyLevel')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    // Filter photos based on privacy
    const accessiblePhotos = [];
    for (const photo of photos) {
      const { hasAccess } = await checkPhotoAccess(userId, photo);
      if (hasAccess) {
        // Add like status
        const photoObj = photo.toObject();
        if (!photoObj.likes) {
          photoObj.likes = [];
        }
        photoObj.userLiked = photoObj.likes.some(likeId => 
          likeId.toString() === userId.toString()
        );
        photoObj.likeCount = photoObj.likes.length;
        photoObj.commentCount = photoObj.comments ? photoObj.comments.length : 0;
        
        accessiblePhotos.push(photoObj);
      }
    }
    
    res.status(200).json(accessiblePhotos);
  } catch (error) {
    console.error('❌ Get photos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get photos for a specific event
router.get('/event/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    
    console.log(`🔍 Getting photos for event: ${eventId}`);

    // Check event access first
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const eventAccess = await checkEventAccess(userId, event);
    if (!eventAccess.hasAccess) {
      return res.status(403).json({ message: 'Access denied to event photos' });
    }

    // Query photos using both possible field names for compatibility
    const photos = await Photo.find({ 
      $or: [
        { event: eventId },
        { taggedEvent: eventId }
      ],
      $and: [
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false }
          ]
        }
      ]
    })
    .populate('user', 'username profilePicture isPublic followers')
    .populate('event', 'title time')
    .sort({ createdAt: -1 });

    // Filter and add context to photos
    const accessiblePhotos = [];
    for (const photo of photos) {
      const { hasAccess } = await checkPhotoAccess(userId, photo);
      if (hasAccess) {
        const photoObj = photo.toObject();
        
        // Initialize likes array if it doesn't exist
        if (!photoObj.likes) {
          photoObj.likes = [];
        }
        
        // Calculate user liked status
        const userLiked = photoObj.likes.some(likeId => 
          likeId.toString() === userId.toString()
        );
        const likeCount = photoObj.likes.length;
        
        accessiblePhotos.push({
          ...photoObj,
          userLiked,
          likeCount,
          commentCount: photoObj.comments ? photoObj.comments.length : 0
        });
      }
    }

    console.log(`✅ Found ${accessiblePhotos.length} accessible photos for event ${eventId}`);
    res.json(accessiblePhotos);

  } catch (error) {
    console.error('❌ Get event photos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single photo
router.get('/:photoId', protect, async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const userId = req.user._id;

    console.log('📸 GET photo request:', {
      photoId,
      userId: userId.toString()
    });

    const photo = await Photo.findById(photoId)
      .populate('user', 'username profilePicture isPublic followers')
      .populate('event', 'title time location host attendees privacyLevel coHosts invitedUsers')
      .populate('comments.user', 'username profilePicture');

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    console.log('📸 Photo found, checking access:', {
      photoId,
      photoUser: photo.user?.username || 'No user data',
      eventId: photo.event?._id || photo.taggedEvent || 'No event',
      eventHost: photo.event?.host?.username || photo.event?.host || 'No host data'
    });

    // Check access
    const { hasAccess, reason } = await checkPhotoAccess(userId, photo);
    if (!hasAccess) {
      console.log('❌ Access denied:', {
        photoId,
        userId: userId.toString(),
        reason,
        photoOwner: photo.user?.username,
        eventHost: photo.event?.host?.username || photo.event?.host
      });
      return res.status(403).json({ 
        message: 'Access denied to this photo',
        reason: reason
      });
    }

    console.log('✅ Access granted:', {
      photoId,
      userId: userId.toString(),
      reason
    });

    // Initialize likes array if it doesn't exist
    if (!photo.likes) {
      photo.likes = [];
    }

    // Calculate user liked status
    const userLiked = photo.likes.some(likeId => 
      likeId.toString() === userId.toString()
    );
    const likeCount = photo.likes.length;

    console.log('📸 Photo like status calculated:', {
      photoId,
      userId: userId.toString(),
      userLiked,
      likeCount
    });

    const response = {
      ...photo.toObject(),
      userLiked,
      likeCount,
      commentCount: photo.comments ? photo.comments.length : 0
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Get photo error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// ============================================
// PHOTO INTERACTIONS
// ============================================

// Like Photo
router.post('/like/:photoId', protect, async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const userId = req.user._id;
    
    console.log('📸 Like request received:', {
      photoId,
      userId: userId.toString(),
      method: req.method
    });

    // Find the photo and populate owner
    const photo = await Photo.findById(photoId).populate('user', '_id username');
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check access
    const { hasAccess } = await checkPhotoAccess(userId, photo);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this photo' });
    }

    // Initialize likes array if it doesn't exist
    if (!photo.likes) {
      photo.likes = [];
      await photo.save();
    }

    // Check if user already liked this photo
    const userLikedIndex = photo.likes.findIndex(likeId => 
      likeId.toString() === userId.toString()
    );
    const wasLiked = userLikedIndex !== -1;

    console.log('📸 Current like status:', {
      wasLiked,
      userLikedIndex,
      currentLikes: photo.likes.map(id => id.toString()),
      likesCount: photo.likes.length,
      userId: userId.toString()
    });

    let newLikedStatus;
    let newLikesArray;

    if (wasLiked) {
      // Unlike: Remove user from likes array
      newLikesArray = photo.likes.filter(likeId => 
        likeId.toString() !== userId.toString()
      );
      newLikedStatus = false;
      console.log('📸 Unliking photo');
    } else {
      // Like: Add user to likes array
      newLikesArray = [...photo.likes, userId];
      newLikedStatus = true;
      console.log('📸 Liking photo');
    }

    // Update the photo with new likes array
    photo.likes = newLikesArray;
    await photo.save();

    // Create notification when someone likes a photo (non-blocking)
    if (newLikedStatus && photo.user._id.toString() !== userId.toString()) {
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: photo.user._id,
            senderId: userId,
            category: 'social',
            type: 'post_liked',
            title: 'Photo Liked',
            message: `${req.user.username} liked your photo`,
            data: {
              postId: photoId,
              userId: userId
            },
            actionType: 'VIEW_POST',
            actionData: { photoId }
          });
          console.log('🔔 Like notification sent');
        } catch (notifError) {
          console.error('Failed to create like notification:', notifError);
        }
      });
    }

    const finalResponse = {
      success: true,
      liked: newLikedStatus,
      userLiked: newLikedStatus,
      likeCount: newLikesArray.length,
      likes: newLikesArray,
      message: newLikedStatus ? 'Photo liked' : 'Photo unliked'
    };

    console.log('📸 Sending like response:', finalResponse);
    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('❌ Like endpoint error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Add comment
router.post('/comment/:photoId', protect, async (req, res) => {
  const { text, tags } = req.body;
  try {
    console.log('💬 === REGULAR PHOTO COMMENT START ===');
    console.log('📋 Comment details:', {
      photoId: req.params.photoId,
      userId: req.user._id.toString(),
      commentText: text?.substring(0, 50) + '...'
    });

    // Find photo and populate owner
    const photo = await Photo.findById(req.params.photoId).populate('user', '_id username');
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check access
    const { hasAccess } = await checkPhotoAccess(req.user._id, photo);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this photo' });
    }

    // Validate comment text
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    
    if (text.trim().length > 500) {
      return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
    }

    // Add the comment
    await Photo.findByIdAndUpdate(
      req.params.photoId,
      { $push: { comments: { user: req.user._id, text: text.trim(), tags } } },
      { new: true, runValidators: true }
    );

    // ✅ NEW: Create activity feed entry for regular photo comment
    console.log('🎯 Creating regular photo comment activity...');
    try {
      await onPhotoComment(req.params.photoId, req.user._id, photo.user._id, false);
      console.log(`✅ Regular photo comment activity created for photo: ${req.params.photoId}`);
    } catch (activityError) {
      console.error('⚠️ Failed to create regular photo comment activity:', activityError);
      // Don't fail the comment if activity creation fails
    }

    // Send notification to photo owner (non-blocking)
    if (photo.user._id.toString() !== req.user._id.toString()) {
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: photo.user._id,
            senderId: req.user._id,
            category: 'social',
            type: 'post_commented',
            title: 'New Comment',
            message: `${req.user.username} commented on your photo: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
            data: {
              postId: req.params.photoId,
              userId: req.user._id,
              commentText: text.substring(0, 100)
            },
            actionType: 'VIEW_POST',
            actionData: { photoId: req.params.photoId }
          });
          console.log('🔔 Comment notification sent');
        } catch (notifError) {
          console.error('Failed to create comment notification:', notifError);
        }
      });
    }

    // Re-query with full population
    const updatedPhoto = await Photo.findById(req.params.photoId)
      .populate('user', 'username')
      .populate('event', 'title')
      .populate({
        path: 'comments.user',
        select: 'username profilePicture',
      });

    console.log('✅ === REGULAR PHOTO COMMENT SUCCESS ===');

    res.status(200).json({
      ...updatedPhoto.toObject(),
      activityCreated: true // ✅ NEW: Indicates activity was created
    });

  } catch (error) {
    console.error('🚨 === REGULAR PHOTO COMMENT ERROR ===');
    console.error('❌ Regular photo comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// PHOTO MANAGEMENT
// ============================================

// Delete Photo
router.delete('/:photoId', protect, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Only the owner can delete
    if (photo.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // Delete each file in photo.paths
    photo.paths.forEach((photoPath) => {
      const absolutePath = path.join(__dirname, '..', photoPath);
      fs.unlink(absolutePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    });

    await Photo.findByIdAndDelete(req.params.photoId);

    // If it was an event photo, remove from event
    const event = await Event.findById(photo.event);
    if (event) {
      event.photos.pull(photo._id);
      await event.save();
    }

    // Also remove from the user's photos
    const user = await User.findById(photo.user);
    if (user) {
      user.photos.pull(photo._id);
      await user.save();
    }

    res.status(200).json({ message: 'Photo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update photo
router.put('/:photoId', protect, async (req, res) => {
  const { caption, eventId } = req.body;
  const photo = await Photo.findById(req.params.photoId).populate('event');

  if (!photo) return res.status(404).json({ message: 'Photo not found' });
  if (String(photo.user) !== String(req.user._id))
    return res.status(401).json({ message: 'Not authorised' });

  if (caption !== undefined) photo.caption = caption;

  // Handle event re-linking
  const oldEvId = photo.event ? String(photo.event._id) : null;
  const newEvId = eventId || null;

  if (oldEvId !== newEvId) {
    if (oldEvId) await Event.findByIdAndUpdate(oldEvId, { $pull: { photos: photo._id } });

    if (newEvId) {
      const ev = await Event.findById(newEvId);
      if (!ev) return res.status(404).json({ message: 'Event not found' });

      const banned = ev.removedPhotos?.some(id => String(id) === String(photo._id));
      if (!banned) await Event.findByIdAndUpdate(newEvId, { $addToSet: { photos: photo._id } });

      photo.event = newEvId;
      photo.taggedEvent = newEvId; // Keep both fields in sync
    } else {
      photo.event = undefined;
      photo.taggedEvent = undefined;
    }
  }

  await photo.save();

  const updated = await Photo.findById(photo._id)
    .populate('user', 'username')
    .populate('event', 'title');

  res.json(updated);
});

// Update Photo Visibility
router.put('/visibility/:photoId', protect, async (req, res) => {
  const { visibleInEvent } = req.body;

  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized to update this photo' });
    }

    photo.visibleInEvent = visibleInEvent;
    await photo.save();

    res.status(200).json(photo);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get photo likes
router.get('/likes/:photoId', protect, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user._id;
    
    const photo = await Photo.findById(photoId)
      .populate('likes', 'username fullName profilePicture');
    
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check access
    const { hasAccess } = await checkPhotoAccess(userId, photo);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this photo' });
    }
    
    // Initialize likes array if it doesn't exist
    if (!photo.likes) {
      photo.likes = [];
    }

    // Calculate user liked status
    const userLiked = photo.likes.some(likeId => 
      likeId.toString() === userId.toString()
    );
    
    res.json({
      likes: photo.likes,
      likeCount: photo.likes.length,
      userLiked: userLiked
    });
    
  } catch (error) {
    console.error('Error fetching photo likes:', error);
    res.status(500).json({ message: 'Failed to fetch likes' });
  }
});

// Delete comment
router.delete('/comment/:photoId/:commentId', protect, async (req, res) => {
  try {
    const { photoId, commentId } = req.params;
    const photo = await Photo.findById(photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check access
    const { hasAccess } = await checkPhotoAccess(req.user._id, photo);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this photo' });
    }

    // Find the comment
    const comment = photo.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user can delete this comment
    const isCommentOwner = String(comment.user) === String(req.user._id);
    const isPostOwner = String(photo.user) === String(req.user._id);
    
    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Remove the comment
    photo.comments.pull(commentId);
    await photo.save();

    // Return updated photo with populated comments
    const updatedPhoto = await Photo.findById(photoId)
      .populate('user', 'username')
      .populate('event', 'title')
      .populate({
        path: 'comments.user',
        select: 'username profilePicture',
      });

    res.status(200).json({ 
      message: 'Comment deleted successfully',
      photo: updatedPhoto 
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user photos
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate({
        path: 'photos',
        populate: { path: 'event', select: 'title' }
      })
      .select('username photos');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(201).json({
      success: true,
      photos: savedPhotos,
      message: `Successfully uploaded ${savedPhotos.length} photo(s)`,
      eventId: eventId
    });
  } catch (error) {
    console.error('❌ Photo upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/create', protect, upload.single('photo'), async (req, res) => {
  try {
    const { caption } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    console.log(`📸 General post creation - User: ${req.user._id}`);

    // Create photo document (NO event association)
    const photo = new Photo({
      user: req.user._id,
      // event: null,              // ✅ No event for general posts
      // taggedEvent: null,        // ✅ No event for general posts  
      paths: [`/uploads/photos/${req.file.filename}`],
      visibleInEvent: false,      // ✅ This is a general post
      caption: caption || '',
      likes: [],                  // Initialize empty likes array
      comments: []                // Initialize empty comments array
    });
    await photo.save();

    // Add to user's photos
    const User = require('../models/User');
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { photos: photo._id } }
    );

    // ✅ NEW: Create activity for general photo upload (non-blocking)
    setImmediate(async () => {
      try {
        await onGeneralPhotoUpload(photo._id, req.user._id);
        console.log(`📸 Activity hook executed for general photo: ${photo._id}`);
      } catch (activityError) {
        console.error('Failed to create general photo activity:', activityError);
      }
    });

    console.log(`✅ Successfully created general post: ${photo._id}`);
    
    res.status(201).json({
      success: true,
      photo: photo,
      _id: photo._id,
      message: 'Post created successfully'
    });

  } catch (error) {
    console.error('❌ General post creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;