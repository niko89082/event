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
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
console.log(process.env.STRIPE_SECRET_KEY)
const router = express.Router();

const UP_DIR      = path.join(__dirname, '..', 'uploads');
const PHOTO_DIR   = path.join(UP_DIR, 'photos');
const COVER_DIR   = path.join(UP_DIR, 'event-covers');
[PHOTO_DIR, COVER_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true }); });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'coverImage' ? COVER_DIR : PHOTO_DIR),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

/* helper to coerce booleans coming from multipart/form-data */
const bool = (v) => v === true || v === 'true';

// PayPal Configuration
paypal.configure({
  'mode': 'sandbox', // Sandbox or live
  'client_id': process.env.PAYPAL_CLIENT_ID,
  'client_secret': process.env.PAYPAL_CLIENT_SECRET,
});


router.post('/create', protect, upload.single('coverImage'), async (req, res) => {
  try {
    const {
      title, description, category = 'General',
      time, location,
      maxAttendees = 10, price = 0,
      
      // NEW PRIVACY FIELDS
      privacyLevel = 'public',
      canView = 'anyone',
      canJoin = 'anyone', 
      canShare = 'attendees',
      canInvite = 'attendees',
      appearInFeed = 'true',
      appearInSearch = 'true',
      showAttendeesToPublic = 'true',
      
      // Legacy fields (still supported)
      isPublic, allowPhotos, openToPublic,
      allowUploads, allowUploadsBeforeStart,
      groupId, geo,
      
      // NEW DISCOVERY FIELDS
      tags, weatherDependent = 'false',
      interests, ageMin, ageMax
    } = req.body;

    /* optional group link */
    let group = null;
    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: 'Group not found' });
      const isMember = group.members.some(m => String(m) === String(req.user._id));
      if (!isMember) return res.status(403).json({ message: 'Not a member of the group' });
    }

    /* parse privacy settings */
    const permissions = {
      canView: canView || 'anyone',
      canJoin: canJoin || 'anyone',
      canShare: canShare || 'attendees', 
      canInvite: canInvite || 'attendees',
      appearInFeed: bool(appearInFeed),
      appearInSearch: bool(appearInSearch),
      showAttendeesToPublic: bool(showAttendeesToPublic)
    };

    /* assemble doc */
    const event = new Event({
      title, description, category,
      time: new Date(time), location,
      maxAttendees: parseIntSafe(maxAttendees),
      price: parseFloatSafe(price),
      host: req.user._id,
      
      // NEW PRIVACY SYSTEM
      privacyLevel: privacyLevel || 'public',
      permissions,
      
      // Legacy fields for backward compatibility
      isPublic: bool(isPublic) ?? (privacyLevel === 'public'),
      allowPhotos: bool(allowPhotos) ?? true,
      openToPublic: bool(openToPublic) ?? (canJoin === 'anyone'),
      allowUploads: bool(allowUploads) ?? true,
      allowUploadsBeforeStart: bool(allowUploadsBeforeStart) ?? true,
      
      group: group?._id,
      
      // NEW DISCOVERY FIELDS
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      weatherDependent: bool(weatherDependent),
      interests: interests ? (Array.isArray(interests) ? interests : interests.split(',').map(i => i.trim())) : [],
      ageRestriction: {
        ...(ageMin && { min: parseIntSafe(ageMin) }),
        ...(ageMax && { max: parseIntSafe(ageMax) })
      }
    });

    /* geo JSON (optional) */
    if (geo) {
      const g = JSON.parse(geo);
      if (Array.isArray(g.coordinates) && g.coordinates.length === 2) {
        event.geo = g;
      }
    }

    if (req.file) {
      event.coverImage = `/uploads/event-covers/${req.file.filename}`;
    }

    await event.save();
    
    if (group) { 
      group.events.push(event._id); 
      await group.save(); 
    }

    // Auto-invite for private/secret events created from groups
    if ((privacyLevel === 'private' || privacyLevel === 'secret') && group) {
      event.invitedUsers = group.members.filter(m => String(m) !== String(req.user._id));
      await event.save();
    }

    res.status(201).json(event);

  } catch (err) {
    console.error('Create event →', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/create-from-group/:groupId', protect, upload.single('coverImage'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const eventData = {
      ...req.body,
      time: new Date(req.body.time)
    };

    if (req.file) {
      eventData.coverImage = `/uploads/event-covers/${req.file.filename}`;
    }

    const event = await EventPrivacyService.createFromGroupChat(
      groupId, 
      req.user._id, 
      eventData
    );

    res.status(201).json(event);
  } catch (err) {
    console.error('Create group event →', err);
    res.status(400).json({ message: err.message });
  }
});

// Get all events
router.get('/', protect, async (req, res) => {
  try {
    const { 
      location, radius, interests, includeSecret,
      limit = 20, skip = 0 
    } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      includeSecret: includeSecret === 'true'
    };

    if (location) {
      try {
        options.location = JSON.parse(location);
        if (radius) options.radius = parseInt(radius);
      } catch (e) {
        console.log('Invalid location format');
      }
    }

    if (interests) {
      options.interests = Array.isArray(interests) ? interests : interests.split(',');
    }

    const events = await EventPrivacyService.getVisibleEvents(req.user._id, options);
    res.json(events);
  } catch (e) { 
    console.error('Get events error:', e);
    res.status(500).json({ message: 'Server error' }); 
  }
});
router.get('/my-photo-events', protect, async (req, res) => {
  try {
    const list = await Event.find({
      allowPhotos:true,
      $or:[ { attendees:req.user._id }, { checkedIn:req.user._id } ]
    }).select('title time allowPhotos');
    res.json(list);
  } catch (err) {
    console.error('/my-photo-events =>', err);
    res.status(500).json({ message:'Server error' });
  }
});


// Get Event by ID// routes/events.js
router.get('/:eventId', protect, async (req,res)=>{
  try{
    const evt = await Event.findById(req.params.eventId)
      .populate('host',    'username profilePicture')
      .populate('coHosts', 'username')
      .populate('attendees invitedUsers', 'username')
      .populate({
        path:'photos',
        populate:{ path:'user', select:'username isPrivate followers' }
      });

    if (!evt) return res.status(404).json({ message:'Event not found' });

    /* privacy gate for private events */
    if (!evt.isPublic && ![
      String(evt.host._id),
      ...evt.coHosts.map(String),
      ...evt.attendees.map(String),
      ...evt.invitedUsers.map(String)
    ].includes(String(req.user._id))){
      return res.status(403).json({ message:'Private event' });
    }

    res.json(evt);

  }catch(e){ res.status(500).json({ message:'Server error' }); }
});
router.get('/recommendations', protect, async (req, res) => {
  try {
    const { location, weather, limit = 10 } = req.query;
    
    const options = { limit: parseInt(limit) };
    
    if (location) {
      try {
        options.location = JSON.parse(location);
      } catch (e) {
        console.log('Invalid location format');
      }
    }

    if (weather) {
      try {
        options.weatherData = JSON.parse(weather);
      } catch (e) {
        console.log('Invalid weather format');
      }
    }

    const recommendations = await EventPrivacyService.getRecommendations(req.user._id, options);
    res.json(recommendations);
  } catch (e) {
    console.error('Get recommendations error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/friends-activity', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const events = await EventPrivacyService.getFriendsActivity(req.user._id, { 
      limit: parseInt(limit) 
    });
    res.json(events);
  } catch (e) {
    console.error('Get friends activity error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});
// Update Event
router.put('/:eventId', protect, upload.single('coverImage'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      req.params.eventId, 
      'edit'
    );

    if (!permission.allowed) {
      return res.status(403).json({ message: permission.reason });
    }

    // Update basic fields
    const basicFields = [
      'title', 'description', 'category', 'time', 'location', 'maxAttendees',
      'price', 'allowPhotos', 'allowUploads', 'allowUploadsBeforeStart'
    ];
    
    basicFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'time') {
          event[field] = new Date(req.body[field]);
        } else if (field === 'price' || field === 'maxAttendees') {
          event[field] = parseFloatSafe(req.body[field]);
        } else if (typeof event[field] === 'boolean') {
          event[field] = bool(req.body[field]);
        } else {
          event[field] = req.body[field];
        }
      }
    });

    // Update privacy settings
    if (req.body.privacyLevel) {
      event.privacyLevel = req.body.privacyLevel;
    }

    if (req.body.permissions) {
      const permissions = typeof req.body.permissions === 'string' 
        ? JSON.parse(req.body.permissions) 
        : req.body.permissions;
      
      Object.assign(event.permissions, permissions);
    }

    // Update discovery fields
    if (req.body.tags) {
      event.tags = Array.isArray(req.body.tags) 
        ? req.body.tags 
        : req.body.tags.split(',').map(t => t.trim());
    }

    if (req.body.interests) {
      event.interests = Array.isArray(req.body.interests)
        ? req.body.interests
        : req.body.interests.split(',').map(i => i.trim());
    }

    if (req.body.weatherDependent !== undefined) {
      event.weatherDependent = bool(req.body.weatherDependent);
    }

    // Update location/geo
    if (req.body.geo) {
      const g = JSON.parse(req.body.geo);
      if (Array.isArray(g.coordinates) && g.coordinates.length === 2) {
        event.geo = g;
      }
    }

    // Update cover image
    if (req.file) {
      if (event.coverImage) {
        fs.unlink(path.join(__dirname, '..', event.coverImage), () => {});
      }
      event.coverImage = `/uploads/event-covers/${req.file.filename}`;
    }

    await event.save();
    res.json(event);

  } catch (e) {
    console.error('Update event error:', e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Delete Event
router.post('/attend/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (Date.now() > new Date(event.time)) {
      return res.status(400).json({ message: 'Event already started' });
    }

    if (event.attendees.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already attending' });
    }

    // Check if user can join
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      req.params.eventId, 
      'join'
    );

    if (!permission.allowed) {
      // If approval required, suggest join request instead
      if (event.permissions.canJoin === 'approval-required') {
        return res.status(400).json({ 
          message: 'This event requires approval to join',
          suggestion: 'Send a join request instead'
        });
      }
      return res.status(403).json({ message: permission.reason });
    }

    // Handle payment if required
    if (event.price > 0 && !req.body.paymentConfirmed) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(event.price * 100),
        currency: 'usd',
        metadata: { 
          eventId: event._id.toString(), 
          userId: req.user._id.toString() 
        }
      });
      return res.json({ clientSecret: paymentIntent.client_secret });
    }

    // Add to attendees
    event.attendees.push(req.user._id);
    await event.save();

    // Add to user's attending events
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { attendingEvents: event._id }
    });

    res.json({ message: 'You are now attending', event });

  } catch (e) { 
    console.error('Attend event error:', e);
    res.status(500).json({ message: 'Server error', error: e.message }); 
  }
});

router.delete('/attend/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!event.attendees.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are not attending' });
    }

    event.attendees.pull(req.user._id);
    await event.save();

    // Remove from user's attending events
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { attendingEvents: event._id }
    });

    res.json({ message: 'Left event', event });
  } catch (e) { 
    console.error('Unattend event error:', e);
    res.status(500).json({ message: 'Server error' }); 
  }
});

// Add Co-host
router.post('/:eventId/cohost', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body; // user we want to add as cohost

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Must be host to add co-hosts
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can add co-hosts' });
    }

    // Check if user is already in coHosts
    if (event.coHosts.includes(userId)) {
      return res.status(400).json({ message: 'User is already a co-host' });
    }

    event.coHosts.push(userId);
    await event.save();

    return res.json({ message: 'Co-host added successfully', event });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
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
router.delete('/:eventId/photo/:photoId', protect, async (req,res)=>{
  try{
    const { eventId, photoId } = req.params;
    const justUnlink = req.query.removeTagOnly === 'true';

    const evt = await Event.findById(eventId);
    if(!evt) return res.status(404).json({ message:'Event not found' });

    const isHostLike = String(evt.host) === String(req.user._id) ||
                       evt.coHosts.includes(req.user._id);
    if(!isHostLike) return res.status(403).json({ message:'Not authorized' });

    if (!evt.photos.includes(photoId)){
      return res.status(400).json({ message:'Photo not in event' });
    }

    evt.photos.pull(photoId);
    if (!evt.removedPhotos.includes(photoId)) evt.removedPhotos.push(photoId);
    await evt.save();

    if (justUnlink){
      await Photo.findByIdAndUpdate(photoId,{ visibleInEvent:false });
      return res.json({ message:'Photo un-linked from event' });
    }

    /* full delete */
    const ph = await Photo.findById(photoId);
    if(ph){
      ph.paths.forEach(p=>fs.unlink(path.join(__dirname,'..',p),()=>{}));
      await ph.remove();
    }
    res.json({ message:'Photo deleted' });

  }catch(e){ res.status(500).json({ message:'Server error', error:e.message }); }
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
// routes/events.js

router.post('/:eventId/checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { scannedUserId } = req.body; // user ID from the QR code

    const event = await Event.findById(eventId)
      .populate('attendees', '_id username profilePicture')
      .populate('checkedIn', '_id username profilePicture');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Ensure the requestor is the host or co-host
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts.some(
      (c) => String(c) === String(req.user._id)
    );
    if (!isHost && !isCoHost) {
      return res.status(401).json({
        message: 'User not authorized to check in attendees',
      });
    }

    // Find the user doc
    const user = await User.findById(scannedUserId).select('username profilePicture');
    if (!user) {
      return res.status(404).json({ message: 'Scanned user not found in system' });
    }

    // Check if user is in event.attendees
    const isAttendee = event.attendees.some((a) => a._id.equals(scannedUserId));
    if (!isAttendee) {
      // They are NOT in the official attendee list => front end can handle
      return res.json({
        status: 'not_attendee',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    }

    // If user is an attendee => see if they are already checked in
    const isAlreadyCheckedIn = event.checkedIn.some((id) =>
      String(id) === String(scannedUserId)
    );
    if (isAlreadyCheckedIn) {
      return res.json({
        status: 'already_checked_in',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    }

    // Otherwise, add them to checkedIn
    event.checkedIn.push(scannedUserId);
    await event.save();

    return res.json({
      status: 'success',
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture || null,
      },
    });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// In your events router:
// routes/events.js (excerpt)
router.get('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('host', 'username profilePicture')
      .populate('coHosts', 'username')
      .populate('attendees invitedUsers', 'username')
      .populate('joinRequests.user', 'username profilePicture')
      .populate({
        path: 'photos',
        populate: { path: 'user', select: 'username isPrivate followers' }
      });

    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if user can view this event
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      req.params.eventId, 
      'view'
    );

    if (!permission.allowed) {
      return res.status(403).json({ message: permission.reason });
    }

    // Filter sensitive information based on privacy settings
    const eventObj = event.toObject();
    
    // Hide attendee list if not public
    if (!event.permissions.showAttendeesToPublic && 
        String(event.host) !== String(req.user._id) &&
        !event.coHosts.some(c => String(c) === String(req.user._id))) {
      eventObj.attendees = eventObj.attendees.slice(0, 3); // Show only first 3
    }

    // Add user's relationship to event
    eventObj.userRelation = {
      isHost: String(event.host._id) === String(req.user._id),
      isCoHost: event.coHosts.some(c => String(c._id) === String(req.user._id)),
      isAttending: event.attendees.some(a => String(a._id) === String(req.user._id)),
      isInvited: event.invitedUsers.some(i => String(i._id) === String(req.user._id)),
      hasRequestedToJoin: event.joinRequests.some(jr => String(jr.user._id) === String(req.user._id))
    };

    res.json(eventObj);

  } catch (e) { 
    console.error('Get event error:', e);
    res.status(500).json({ message: 'Server error' }); 
  }
});


router.post('/:eventId/invite', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, userIds, message } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if user can invite
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      eventId, 
      'invite'
    );

    if (!permission.allowed) {
      return res.status(403).json({ message: permission.reason });
    }

    // Handle single or multiple invites
    const targetUsers = userIds || [userId];
    const newInvites = [];

    for (const targetUserId of targetUsers) {
      if (!event.invitedUsers.includes(targetUserId) && 
          !event.attendees.includes(targetUserId)) {
        event.invitedUsers.push(targetUserId);
        newInvites.push(targetUserId);
      }
    }

    await event.save();

    // TODO: Send notifications to invited users
    // createNotification(targetUserId, 'event-invite', message);

    res.json({ 
      message: `Invited ${newInvites.length} users successfully`,
      invitedUsers: newInvites
    });

  } catch (e) {
    console.error('Invite users error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/user/:userId/calendar', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;  // optional

    if (userId.toString() !== req.user._id.toString()) {
      // or check if admin, or if user is viewing own data
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Find the user
    const user = await User.findById(userId).populate('attendingEvents');
    if (!user) return res.status(404).json({ message: 'User not found' });

    let events = user.attendingEvents;  
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1); 
      events = events.filter((evt) => {
        if (!evt.time) return false;
        const t = new Date(evt.time);
        return (t >= startDate && t < endDate);
      });
    }

    res.json({ events });
  } catch (error) {
    console.error('GET /events/user/:userId/calendar error =>', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// routes/events.js
router.delete('/attend/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const isAttendee = event.attendees.includes(req.user._id);
    if (!isAttendee) {
      return res.status(400).json({ message: 'You are not attending this event' });
    }

    // remove user from event.attendees
    event.attendees.pull(req.user._id);
    await event.save();

    // also remove event._id from user.attendingEvents
    const user = await User.findById(req.user._id);
    user.attendingEvents.pull(event._id);
    await user.save();

    return res.json({ message: 'You have left the event', event });
  } catch (err) {
    console.error('Unattend =>', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// routes/events.js (partial)

router.post('/:eventId/cohost/request', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body; // The user we want to invite as co-host

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Must be the host to request co-host
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can request co-hosts' });
    }

    // If user is already a co-host or already in coHostRequests, skip
    if (event.coHosts.includes(userId)) {
      return res.status(400).json({ message: 'User is already a co-host' });
    }
    if (!event.coHostRequests) {
      event.coHostRequests = [];
    }
    if (event.coHostRequests.includes(userId)) {
      return res.status(400).json({ message: 'Co-host request already pending' });
    }

    // Push to a coHostRequests array
    event.coHostRequests.push(userId);
    await event.save();

    return res.json({
      message: 'Co-host request sent',
      event,
    });
  } catch (error) {
    console.error('cohost/request error =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/:eventId/cohost/accept', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is in coHostRequests
    if (!event.coHostRequests || !event.coHostRequests.includes(req.user._id)) {
      return res.status(400).json({ message: 'No co-host request found for you' });
    }

    // Remove from coHostRequests
    event.coHostRequests = event.coHostRequests.filter(
      (id) => String(id) !== String(req.user._id)
    );

    // Add to coHosts
    if (!event.coHosts.includes(req.user._id)) {
      event.coHosts.push(req.user._id);
    }

    // Also add them to attendees => no payment needed
    if (!event.attendees.includes(req.user._id)) {
      event.attendees.push(req.user._id);
    }

    await event.save();

    // Possibly notify the host or others that user accepted
    return res.json({
      message: 'You are now co-hosting this event.',
      event,
    });
  } catch (err) {
    console.error('cohost/accept error =>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/:eventId/banUser', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, banPermanently } = req.body; 
    // 'banPermanently' is a boolean: if true => user added to bannedUsers array

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Must be host or co-host to ban
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts?.some(
      (cId) => String(cId) === String(req.user._id)
    );

    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Not authorized to ban users' });
    }

    // Ensure the user we want to ban is an attendee OR at least valid
    if (!event.attendees.includes(userId)) {
      // Possibly they’re not even in the attendee list, handle that
      return res.status(400).json({ message: 'User is not an attendee' });
    }

    // Remove from attendees
    event.attendees = event.attendees.filter(
      (attId) => String(attId) !== String(userId)
    );

    // If we want to ban them permanently => push to bannedUsers
    if (banPermanently) {
      if (!event.bannedUsers) {
        event.bannedUsers = [];
      }
      if (!event.bannedUsers.includes(userId)) {
        event.bannedUsers.push(userId);
      }
    }

    await event.save();

    // Also remove the event from the user's `attendingEvents` list
    const user = await User.findById(userId);
    if (user) {
      user.attendingEvents = user.attendingEvents.filter(
        (evtId) => String(evtId) !== String(event._id)
      );
      await user.save();
    }

    return res.json({
      message: banPermanently
        ? 'User has been banned and removed from attendees'
        : 'User removed from attendees',
      event
    });
  } catch (err) {
    console.error('banUser error =>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});
router.post('/join-request/:eventId', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const event = await Event.findById(req.params.eventId);
    
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if user can request to join
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      req.params.eventId, 
      'join'
    );

    if (!permission.allowed && event.permissions.canJoin !== 'approval-required') {
      return res.status(403).json({ message: permission.reason });
    }

    // Check if already requested
    const existingRequest = event.joinRequests.find(
      jr => String(jr.user) === String(req.user._id)
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Join request already sent' });
    }

    // Add join request
    event.joinRequests.push({
      user: req.user._id,
      message: message || '',
      requestedAt: new Date()
    });

    await event.save();
    res.json({ message: 'Join request sent successfully' });

  } catch (e) {
    console.error('Join request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/mine/past', protect, async (req,res)=>{
  const events = await Event.find({
    attendees: req.user._id,
    time     : { $lt: new Date() }
  }).sort({ time:-1 });
  res.json(events);
});
router.post('/join-request/:eventId/:userId/approve', protect, async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const event = await Event.findById(eventId);
    
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Only host and co-hosts can approve
    const isAuthorized = String(event.host) === String(req.user._id) ||
                        event.coHosts.some(c => String(c) === String(req.user._id));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to approve requests' });
    }

    // Remove from join requests and add to attendees
    event.joinRequests = event.joinRequests.filter(
      jr => String(jr.user) !== String(userId)
    );

    if (!event.attendees.includes(userId)) {
      event.attendees.push(userId);
    }

    // Add to user's attending events
    await User.findByIdAndUpdate(userId, {
      $addToSet: { attendingEvents: eventId }
    });

    await event.save();
    res.json({ message: 'Join request approved' });

  } catch (e) {
    console.error('Approve join request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/join-request/:eventId/:userId/reject', protect, async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const event = await Event.findById(eventId);
    
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Only host and co-hosts can reject
    const isAuthorized = String(event.host) === String(req.user._id) ||
                        event.coHosts.some(c => String(c) === String(req.user._id));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to reject requests' });
    }

    // Remove from join requests
    event.joinRequests = event.joinRequests.filter(
      jr => String(jr.user) !== String(userId)
    );

    await event.save();
    res.json({ message: 'Join request rejected' });

  } catch (e) {
    console.error('Reject join request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;