// routes/events.js
const express = require('express');
const Event = require('../models/Event');
const protect = require('../middleware/auth');

const router = express.Router();

// Create Event
router.post('/create', protect, async (req, res) => {
  const { title, description, time, location, maxAttendees, price, isPublic } = req.body;

  try {
    const event = new Event({
      title,
      description,
      time,
      location,
      maxAttendees,
      price,
      host: req.user._id,
      isPublic,
    });

    await event.save();
    res.status(201).json(event);
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
      return res.status(403).json({ message: 'Access denied' });
    }
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


// Update Event
router.put('/:eventId', protect, async (req, res) => {
  const { title, description, time, location, maxAttendees, price, isPublic } = req.body;

  try {
    let event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user._id.toString() && !event.coHosts.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    event.title = title || event.title;
    event.description = description || event.description;
    event.time = time || event.time;
    event.location = location || event.location;
    event.maxAttendees = maxAttendees || event.maxAttendees;
    event.price = price !== undefined ? price : event.price;
    event.isPublic = isPublic !== undefined ? isPublic : event.isPublic;

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

module.exports = router;