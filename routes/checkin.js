const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const protect = require('../middleware/auth');

const router = express.Router();

router.post('/verify', protect, async (req, res) => {
  const { qrCodeData, eventId } = req.body;

  try {
    const user = await User.findOne({ qrCode: qrCodeData });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (!event.openToPublic && !event.attendees.includes(user._id)) {
      return res.status(403).json({ success: false, message: 'User is not registered for this event' });
    }

    if (!event.checkedIn) {
      event.checkedIn = [];
    }

    if (event.checkedIn.includes(user._id)) {
      return res.status(400).json({ success: false, message: 'User has already checked in' });
    }

    event.checkedIn.push(user._id);
    await event.save();

    res.status(200).json({ success: true, message: 'User verified and checked in' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
});

module.exports = router;