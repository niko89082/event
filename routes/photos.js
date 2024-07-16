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

module.exports = router;