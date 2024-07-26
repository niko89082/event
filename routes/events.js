const express = require('express');
const multer = require('multer');
const Event = require('../models/Event');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

// Configure Multer for document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// Create an event
router.post('/create', protect, async (req, res) => {
  const { title, description, time, location, maxAttendees, price, isPublic, recurring } = req.body;

  try {
    const event = new Event({
      title,
      description,
      time,
      location,
      maxAttendees,
      price,
      host: req.user.id,
      isPublic,
      recurring,
    });

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all events
router.get('/', protect, async (req, res) => {
  try {
    const events = await Event.find().populate('host', 'username');
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Event by ID
router.get('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('host', 'username')
      .populate('coHosts', 'username')
      .populate('attendees', 'username');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (!event.isPublic && !(req.user && (event.host.toString() === req.user._id.toString() || event.coHosts.includes(req.user._id) || event.attendees.includes(req.user._id)))) {
      return res.status(403).json({ message: 'Access forbidden' });
    }
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Event
router.put('/:eventId', protect, async (req, res) => {
  const { eventId } = req.params;
  const { title, description, time, location, maxAttendees, price, isPublic, recurring } = req.body;

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    event.title = title || event.title;
    event.description = description || event.description;
    event.time = time || event.time;
    event.location = location || event.location;
    event.maxAttendees = maxAttendees || event.maxAttendees;
    event.price = price || event.price;
    event.isPublic = isPublic || event.isPublic;
    event.recurring = recurring || event.recurring;

    await event.save();
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Event
router.delete('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await event.remove();
    res.status(200).json({ message: 'Event removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Attend Event
router.post('/attend/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.attendees.length >= event.maxAttendees) {
      return res.status(400).json({ message: 'Event is full' });
    }

    if (event.attendees.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already attending this event' });
    }

    event.attendees.push(req.user._id);
    await event.save();
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Co-host
router.put('/:eventId/cohost', protect, async (req, res) => {
  const { eventId } = req.params;
  const { coHostId } = req.body;

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user._id.toString() && !event.coHosts.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!event.coHosts.includes(coHostId)) {
      event.coHosts.push(coHostId);
      await event.save();
    }

    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload documents for an event
router.post('/upload/:eventId', protect, upload.array('documents'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    req.files.forEach(file => {
      event.documents.push(`/uploads/documents/${file.filename}`);
    });

    await event.save();
    res.status(200).json({ message: 'Documents uploaded successfully', documents: event.documents });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send announcements to event attendees
router.post('/announce/:eventId', protect, async (req, res) => {
  const { message } = req.body;

  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    event.announcements.push({ message });

    await event.save();
    res.status(200).json({ message: 'Announcement sent', announcements: event.announcements });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;