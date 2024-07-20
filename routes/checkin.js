// routes/checkin.js
const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const protect = require('../middleware/auth');

const router = express.Router();

// Check-in Route
router.post('/checkin/:eventId', protect, async (req, res) => {
  const { qrCodeData } = req.body;
  const { eventId } = req.params;

  try {
    const user = await User.findById(qrCodeData);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.attendees.includes(user._id)) {
      return res.status(400).json({ message: 'User already checked in' });
    }

    event.attendees.push(user._id);
    await event.save();

    res.status(200).json({ message: 'Check-in successful', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;