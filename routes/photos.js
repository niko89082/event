const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const User = require('../models/User'); // Import the User model
const protect = require('../middleware/auth');

const router = express.Router();

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
  limits: { files: 10 } // Cap uploads at 10 files
});

// Upload Photos to an Event
// routes/photos.js   –  inside this router
// routes/photos.js - FIXED: Upload Photos Endpoint with Better Permissions

// Upload Photos to an Event
// FIXED VERSION - routes/photos.js
// Upload Photos to an Event - FIXED permission checks
router.post('/upload/:eventId', protect, upload.array('photos'), async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId).populate('host');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    console.log(`📸 Photo upload attempt - User: ${req.user._id}, Event: ${event.title}`);
    console.log(`👥 Event attendees:`, event.attendees.map(id => String(id)));

    /* ─── 1) permission checks ───────────────────────────────────────────── */
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

    // ✅ Allow uploads at any time (before, during, and after events)
    console.log('✅ Upload timing: Always allowed - no time restrictions');

    if (req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    console.log(`✅ Permission granted - uploading ${req.files.length} photos`);

    /* ─── 2) save a Photo doc for every file ─────────────────────────────── */
    const savedPhotos = [];
    for (const file of req.files) {
      const p = new Photo({
        user: req.user._id,
        event: eventId,           // ✅ MAIN: Save with 'event' field
        taggedEvent: eventId,     // ✅ ALSO: Save with 'taggedEvent' field for compatibility
        paths: [`/uploads/photos/${file.filename}`],
        visibleInEvent: true,
      });
      await p.save();

      /* do NOT re‑add a photo the host previously removed */
      // ✅ FIXED: Check if removedPhotos array exists before using includes()
      if (!event.removedPhotos || !event.removedPhotos.includes(p._id)) {
        // ✅ FIXED: Ensure photos array exists before pushing
        if (!event.photos) {
          event.photos = [];
        }
        event.photos.push(p._id);
      }
      savedPhotos.push(p);
    }
    await event.save();

    /* also add the photos to the uploader's profile pics array */
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { photos: { $each: savedPhotos.map(p => p._id) } } },
    );

    console.log(`✅ Successfully uploaded ${savedPhotos.length} photos to event`);
    
    // ✅ ENHANCED: Return more detailed response
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
      event: eventId,           // ✅ MAIN: Save with 'event' field
      taggedEvent: eventId,     // ✅ ALSO: Save with 'taggedEvent' field for compatibility
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

// Get all photos
router.get('/', protect, async (req, res) => {
  try {
    const { eventId, limit = 50, offset = 0 } = req.query;
    const userId = req.user._id;
    
    let query = {};
    
    // If eventId is provided, filter by event
    if (eventId) {
      query = {
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
      };
    }
    
    const photos = await Photo.find(query)
      .populate('user', 'username profilePicture')
      .populate('event', 'title time')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    // ✅ CRITICAL FIX: Add like status to each photo
    const photosWithLikeStatus = photos.map(photo => {
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
      
      return {
        ...photoObj,
        userLiked,
        likeCount,
        commentCount: photoObj.comments ? photoObj.comments.length : 0
      };
    });
    
    res.status(200).json(photosWithLikeStatus);
  } catch (error) {
    console.error('❌ Get photos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// ---------------------
// POST a new comment on a photo (single route)
// ---------------------
router.post('/comment/:photoId', protect, async (req, res) => {
  const { text, tags } = req.body;
  try {
    // 1) Append the new comment to the photo
    await Photo.findByIdAndUpdate(
      req.params.photoId,
      { $push: { comments: { user: req.user._id, text, tags } } },
      { new: true, runValidators: true }
    );

    // 2) Re-query with full population
    const updatedPhoto = await Photo.findById(req.params.photoId)
      .populate('user', 'username')
      .populate('event', 'title')
      .populate({
        path: 'comments.user',
        select: 'username',
      });

    if (!updatedPhoto) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Return the entire updated, populated photo
    res.status(200).json(updatedPhoto);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

router.get('/user/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate({
        path: 'photos',
        populate: { path: 'event', select: 'title' }
      })
      .select('username photos'); // show whichever fields you want

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // user.photos is an array of Photo docs, each can have .paths, .event, etc.
    res.status(200).json(user.photos);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.put('/:photoId', protect, async (req, res) => {
  const { caption, eventId } = req.body;
  const photo = await Photo.findById(req.params.photoId).populate('event');

  if (!photo) return res.status(404).json({ message: 'Photo not found' });
  if (String(photo.user) !== String(req.user._id))
    return res.status(401).json({ message: 'Not authorised' });

  if (caption !== undefined) photo.caption = caption;

  /* handle event re-linking */
  const oldEvId = photo.event ? String(photo.event._id) : null;
  const newEvId = eventId || null;        // null or '' means remove link

  if (oldEvId !== newEvId) {
    if (oldEvId) await Event.findByIdAndUpdate(oldEvId, { $pull: { photos: photo._id } });

    if (newEvId) {
      const ev = await Event.findById(newEvId);
      if (!ev) return res.status(404).json({ message: 'Event not found' });

      const banned = ev.removedPhotos?.some(id => String(id) === String(photo._id));
      if (!banned) await Event.findByIdAndUpdate(newEvId, { $addToSet: { photos: photo._id } });

      photo.event = newEvId;
    } else {
      photo.event = undefined;
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
// GET photos for a specific event
router.get('/event/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    
    console.log(`🔍 Getting photos for event: ${eventId}`);

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
    .populate('user', 'username profilePicture')
    .populate('event', 'title time')
    .sort({ createdAt: -1 });

    // ✅ CRITICAL FIX: Add like status to each photo
    const photosWithLikeStatus = photos.map(photo => {
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
      
      return {
        ...photoObj,
        userLiked,
        likeCount,
        commentCount: photoObj.comments ? photoObj.comments.length : 0
      };
    });

    console.log(`✅ Found ${photosWithLikeStatus.length} photos for event ${eventId}`);
    res.json(photosWithLikeStatus);

  } catch (error) {
    console.error('❌ Get event photos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

    // Find the photo
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // ✅ CRITICAL FIX: Initialize likes array if it doesn't exist
    if (!photo.likes) {
      photo.likes = [];
      await photo.save(); // Save the initialization
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

    // ✅ CONSISTENT RESPONSE FORMAT (same as memory photos)
    const finalResponse = {
      success: true,
      liked: newLikedStatus,        // ✅ CRITICAL: Include this field
      userLiked: newLikedStatus,    // ✅ ALTERNATIVE: Also include this
      likeCount: newLikesArray.length,
      likes: newLikesArray,         // ✅ Keep this for compatibility
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
router.get('/likes/:photoId', protect, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user._id;
    
    const photo = await Photo.findById(photoId)
      .populate('likes', 'username fullName profilePicture');
    
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
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

// ✅ GET: Get photo comments (for loading comments separately)
router.get('/comments/:photoId', protect, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const photo = await Photo.findById(photoId)
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      });
    
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Get comments with pagination
    const comments = photo.comments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Latest first
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      comments: comments,
      commentCount: photo.comments.length,
      hasMore: photo.comments.length > (parseInt(offset) + parseInt(limit))
    });
    
  } catch (error) {
    console.error('Error fetching photo comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// ✅ Enhanced GET photo by ID with like status and proper population
router.get('/:photoId', protect, async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const userId = req.user._id;

    console.log('📸 GET photo request:', {
      photoId,
      userId: userId.toString()
    });

    const photo = await Photo.findById(photoId)
      .populate('user', 'username profilePicture')
      .populate('event', 'title time location')
      .populate('comments.user', 'username profilePicture');

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // ✅ CRITICAL FIX: Proper like status calculation
    // Initialize likes array if it doesn't exist
    if (!photo.likes) {
      photo.likes = [];
    }

    // Calculate user liked status - check if userId is in likes array
    const userLiked = photo.likes.some(likeId => 
      likeId.toString() === userId.toString()
    );
    const likeCount = photo.likes.length;

    console.log('📸 Photo like status calculated:', {
      photoId,
      userId: userId.toString(),
      likesArray: photo.likes.map(id => id.toString()),
      userLiked,
      likeCount
    });

    const response = {
      ...photo.toObject(),
      userLiked,           // ✅ CRITICAL: Include this
      likeCount,           // ✅ CRITICAL: Include this
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

// Get trending photos
router.get('/trending', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ likes: -1 }).limit(10).populate('user', 'username');
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Share Photo
router.get('/share/:photoId', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
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


router.delete('/comment/:photoId/:commentId', protect, async (req, res) => {
  try {
    const { photoId, commentId } = req.params;
    const photo = await Photo.findById(photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
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


module.exports = router;