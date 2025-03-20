const express = require('express');
const multer = require('multer');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Photo = require('../models/Photo');
const User = require('../models/User');
const protect = require('../middleware/auth');
const paypal = require('paypal-rest-sdk');
const fs = require('fs');
const path = require('path');

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

// PayPal Configuration
paypal.configure({
  'mode': 'sandbox', // Sandbox or live
  'client_id': process.env.PAYPAL_CLIENT_ID,
  'client_secret': process.env.PAYPAL_CLIENT_SECRET,
});

// Create Event
router.post('/create', protect, async (req, res) => {
  const { title, description, category, time, location, maxAttendees, price, isPublic, recurring, allowPhotos, openToPublic, allowUploads, groupId } = req.body;

  try {
    let group = null;
    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
      if (!group.members.includes(req.user._id)) {
        return res.status(401).json({ message: 'User not authorized to create an event for this group' });
      }
    }

    const event = new Event({
      title,
      description,
      time,
      location,
      category,
      maxAttendees,
      price,
      host: req.user._id,
      isPublic: group ? false : isPublic,
      recurring,
      allowPhotos,
      openToPublic,
      allowUploads,
      group: groupId || undefined,
    });

    await event.save();

    if (group) {
      group.events.push(event._id);
      await group.save();
    }

    // Handle recurring events
    if (recurring) {
      const recurringEvents = [];
      let currentTime = new Date(time);

      for (let i = 0; i < 10; i++) { // Create 10 recurring events
        currentTime = getNextRecurringDate(currentTime, recurring);
        const newEvent = new Event({
          title,
          description,
          time: currentTime,
          location,
          maxAttendees,
          price,
          host: req.user._id,
          isPublic: group ? false : isPublic,
          recurring,
          allowPhotos,
          openToPublic,
          allowUploads,
          group: groupId || undefined,
        });
        recurringEvents.push(newEvent);
      }

      await Event.insertMany(recurringEvents);
    }

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

function getNextRecurringDate(currentDate, recurring) {
  const nextDate = new Date(currentDate);
  switch (recurring) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    // Add more cases if needed
  }
  return nextDate;
}

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
      .populate('attendees', 'username')
      .populate('comments.user', 'username')
      .populate('comments.tags', 'username')
      .populate('announcements')
      .populate('documents')
      .populate('likes', 'username')
      .populate('photos'); // Populate photos associated with the event

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Ensure only attendees and group members can view private events
    if (!event.isPublic && !event.attendees.includes(req.user._id)) {
      if (event.group) {
        const group = await Group.findById(event.group);
        if (!group || !group.members.includes(req.user._id)) {
          return res.status(401).json({ message: 'User not authorized to view this private event' });
        }
      } else {
        return res.status(401).json({ message: 'User not authorized to view this private event' });
      }
    }

    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Event
router.put('/:eventId', protect, async (req, res) => {
  const { title, description, time, location, maxAttendees, price, isPublic, recurring, allowPhotos, openToPublic, allowUploads } = req.body;

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
    event.recurring = recurring || event.recurring;
    event.allowPhotos = allowPhotos !== undefined ? allowPhotos : event.allowPhotos;
    event.openToPublic = openToPublic !== undefined ? openToPublic : event.openToPublic;
    event.allowUploads = allowUploads !== undefined ? allowUploads : event.allowUploads;

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

    if (event.host.toString() !== req.user.id && !event.coHosts.includes(req.user._id)) {
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

    if (event.host.toString() !== req.user.id && !event.coHosts.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    event.announcements.push({ message });

    await event.save();
    res.status(200).json({ message: 'Announcement sent', announcements: event.announcements });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Like Event
router.post('/like/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.likes.includes(req.user._id)) {
      // Unlike the event
      event.likes.pull(req.user._id);
    } else {
      // Like the event
      event.likes.push(req.user._id);
    }

    await event.save();
    res.status(200).json(event.likes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Comment on Event
router.post('/comment/:eventId', protect, async (req, res) => {
  const { text, tags } = req.body;

  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const comment = {
      user: req.user._id,
      text,
      tags,
    };

    event.comments.push(comment);
    await event.save();
    res.status(200).json(event.comments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending events
router.get('/trending', async (req, res) => {
  try {
    const events = await Event.find().sort({ attendees: -1 }).limit(10).populate('host', 'username');
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Purchase ticket using PayPal
router.post('/purchase/:eventId', protect, async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.attendees.length >= event.maxAttendees) {
      return res.status(400).json({ message: 'Event is full' });
    }

    const payment = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal',
      },
      redirect_urls: {
        return_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
      },
      transactions: [{
        item_list: {
          items: [{
            name: event.title,
            sku: '001',
            price: event.ticketPrice.toString(),
            currency: 'USD',
            quantity: 1,
          }],
        },
        amount: {
          currency: 'USD',
          total: event.ticketPrice.toString(),
        },
        description: `Ticket for ${event.title}`,
      }],
    };

    paypal.payment.create(payment, (error, payment) => {
      if (error) {
        return res.status(500).json({ message: 'PayPal payment error', error });
      }

      for (let i = 0; i < payment.links.length; i++) {
        if (payment.links[i].rel === 'approval_url') {
          return res.status(200).json({ forwardLink: payment.links[i].href });
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get events for a calendar view
router.get('/calendar', protect, async (req, res) => {
  try {
    const events = await Event.find().populate('host', 'username');
    const calendarEvents = events.map(event => ({
      title: event.title,
      start: event.time,
      end: event.time, // Assuming the event is a one-day event. Adjust if needed.
      url: `/events/${event._id}`,
    }));
    res.status(200).json(calendarEvents);
  } catch (error) {
    res.status500.json({ message: 'Server error' });
  }
});

// Delete Photo from Event
router.delete('/:eventId/photo/:photoId', protect, async (req, res) => {
  const { eventId, photoId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user._id.toString() && !event.coHosts.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.event.toString() !== eventId) {
      return res.status(400).json({ message: 'Photo does not belong to this event' });
    }

    // Delete photo file from server
    fs.unlink(path.join(__dirname, '..', photo.path), (err) => {
      if (err) {
        console.error(err);
      }
    });

    await photo.remove();
    event.photos.pull(photoId);
    await event.save();

    res.status(200).json({ message: 'Photo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Share Event
router.get('/share/:eventId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Increment share count
    event.shareCount += 1;
    await event.save();

    const shareLink = `${req.protocol}://${req.get('host')}/events/${event._id}`;
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
// Check-in endpoint
router.post('/:eventId/checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { scannedUserId } = req.body; // user ID from the QR code

    const event = await Event.findById(eventId).populate('attendees', '_id username profilePicture');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Ensure the requestor is the host or co-host
    if (event.host.toString() !== req.user._id.toString() &&
        !event.coHosts.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized to check in attendees' });
    }

    // Find the user
    const user = await User.findById(scannedUserId).select('username profilePicture');
    if (!user) {
      return res.status(404).json({ message: 'Scanned user not found in system' });
    }

    // Check if user is in attendees
    const isAttendee = event.attendees.some(a => a._id.equals(scannedUserId));

    if (isAttendee) {
      // Optional: Mark them as "checkedIn" if you store that in the Event or a separate list
      // e.g.: event.checkedIn.push(userId)...

      // Return success + user info
      return res.json({
        status: 'success',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    } else {
      // They are NOT in the official attendee list
      return res.json({
        status: 'not_attendee', // let the front-end handle
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    }
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;