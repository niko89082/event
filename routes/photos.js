// routes/photos.js
const express = require('express');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const protect = require('../middleware/auth');
const upload = require('../config/multer');

const router = express.Router();

// Upload photo to event
router.post('/event/:eventId', protect, (req, res) => {
  Event.findById(req.params.eventId, (err, event) => {
    if (err || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err });
      }

      const newPhoto = new Photo({
        user: req.user._id,
        event: event._id,
        path: req.file.path,
      });

      newPhoto.save()
        .then(photo => res.status(201).json(photo))
        .catch(err => res.status(500).json({ message: 'Server error' }));
    });
  });
});

// Upload photo to user's main page
router.post('/main', protect, (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err });
    }

    const newPhoto = new Photo({
      user: req.user._id,
      path: req.file.path,
    });

    newPhoto.save()
      .then(photo => res.status(201).json(photo))
      .catch(err => res.status(500).json({ message: 'Server error' }));
  });
});


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
      res.status(200).json(photo);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
//comment on an existing post
router.post('/comment/:photoId', protect, async (req, res) => {
    try {
      const photo = await Photo.findById(req.params.photoId);
  
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }
  
      const newComment = {
        user: req.user._id,
        text: req.body.text,
      };
  
      photo.comments.push(newComment);
      await photo.save();
  
      res.status(201).json(photo);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  module.exports = router;