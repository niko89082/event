// routes/events.js
const express = require('express');
const Event = require('../models/Event');
const protect = require('../middleware/auth');

const router = express.Router();

// Create Event
router.post('/create', protect, async (req, res) => {
  const { title, description, time, location } = req.body;

  try {
    const event = new Event({
      title,
      description,
      time,
      location,
      host: req.user._id,
    });

    await event.save();
    res.status(201).json(event);
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

module.exports = router;