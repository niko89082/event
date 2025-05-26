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
router.post('/upload/:eventId', protect, upload.array('photos'), async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId).populate('host');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    /* ─── 1) permission checks ───────────────────────────────────────────── */
    if (!event.allowPhotos) return res.status(403).json({ message: 'Photo uploads are disabled' });

    const isHost      = String(event.host) === String(req.user._id);
    const isAttendee  = event.attendees.includes(req.user._id);

    if (!isHost && !isAttendee) {
      return res.status(403).json({ message: 'Only attendees may upload' });
    }

    /* host might block uploads until the event starts */
    if (!event.allowUploadsBeforeStart && !isHost) {
      const eventHasStarted = new Date(event.time) <= new Date();
      if (!eventHasStarted) {
        return res.status(403).json({ message: 'Uploads open once the event begins' });
      }
    }

    if (req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    /* ─── 2) save a Photo doc for every file ─────────────────────────────── */
    const savedPhotos = [];
    for (const file of req.files) {
      const p = new Photo({
        user:  req.user._id,
        event: eventId,
        paths: [`/uploads/photos/${file.filename}`],
        visibleInEvent: true,
      });
      await p.save();

      /* do NOT re‑add a photo the host previously removed */
      if (!event.removedPhotos.includes(p._id)) {
        event.photos.push(p._id);
      }
      savedPhotos.push(p);
    }
    await event.save();

    /* also add the photos to the uploader’s profile pics array */
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { photos: { $each: savedPhotos.map(p => p._id) } } },
    );

    res.status(201).json(savedPhotos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/upload', protect, upload.array('photos'), async (req, res) => {
  console.log("uploading photo")
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No user found in request' });
    }
    console.log('req.user is', req.user);
    
    if (req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }
    const paths = req.files.map(file => `/uploads/photos/${file.filename}`);

    const photo = new Photo({
      user: req.user._id,
      paths: paths,
      visibleInEvent: false, 
    });

    await photo.save();

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found in DB' });
    }

    user.photos.push(photo._id);
    await user.save();

    res.status(201).json(photo);
  } catch (error) {
    console.error('Server catch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all photos
router.get('/', protect, async (req, res) => {
  try {
    const photos = await Photo.find().populate('user', 'username').populate('event', 'title');
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Photo by ID// GET /photos/:photoId
router.get('/:photoId', protect, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId)
      .populate('user', 'username')
      .populate('event', 'title')
      .populate({
        path: 'comments.user',
        select: 'username',
      });
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    res.status(200).json(photo);
  } catch (error) {
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

// Like Photo
router.post('/like/:photoId', protect, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.likes.includes(req.user._id)) {
      // Unlike the photo
      photo.likes.pull(req.user._id);
    } else {
      // Like the photo
      photo.likes.push(req.user._id);
    }

    await photo.save();
    res.status(200).json({likes: photo.likes, likeCount: photo.likes.length});
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Comment on Photo
router.post('/comment/:photoId', protect, async (req, res) => {
  const { text, tags } = req.body;

  try {
    const photo = await Photo.findById(req.params.photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const comment = {
      user: req.user._id,
      text,
      tags,
    };

    photo.comments.push(comment);
    await photo.save();
    res.status(200).json(photo.comments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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

module.exports = router;