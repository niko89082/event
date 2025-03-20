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
router.post('/upload/:eventId', protect, upload.array('photos'), async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!event.allowPhotos) {
      return res.status(403).json({ message: 'Photo uploads are not allowed for this event' });
    }

    if (!event.attendees.includes(req.user._id)) {
      return res.status(403).json({ message: 'Only attendees can upload photos to this event' });
    }

    if (req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    const paths = req.files.map(file => `/uploads/photos/${file.filename}`);

    const photo = new Photo({
      user: req.user._id,
      event: eventId,
      paths: paths,
      visibleInEvent: true,
    });

    await photo.save();
    event.photos.push(photo._id);
    await event.save();

    res.status(201).json(photo);
  } catch (error) {
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

// Get Photo by ID
router.get('/:photoId', protect, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId)
      .populate('user', 'username')
      .populate('event', 'title');
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    res.status(200).json(photo);
  } catch (error) {
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

    await photo.remove();

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