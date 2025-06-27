const express = require('express');
const multer = require('multer');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Photo = require('../models/Photo');
const User = require('../models/User');
const protect = require('../middleware/auth');
const EventPrivacyService = require('../services/eventPrivacyService');
const paypal = require('paypal-rest-sdk');
const fs = require('fs');
const path = require('path');
const notificationService = require('../services/notificationService'); // Add this import at the top
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

const UP_DIR      = path.join(__dirname, '..', 'uploads');
const PHOTO_DIR   = path.join(UP_DIR, 'photos');
const COVER_DIR   = path.join(UP_DIR, 'event-covers');
const COVERS_DIR  = path.join(UP_DIR, 'covers');

// Ensure all directories exist
[PHOTO_DIR, COVER_DIR, COVERS_DIR].forEach((d) => { 
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); 
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'coverImage' ? COVER_DIR : PHOTO_DIR),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Separate cover image storage
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, COVERS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadCover = multer({
  storage: coverStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/* helper to coerce booleans coming from multipart/form-data */
const bool = (v) => v === true || v === 'true';
const parseIntSafe = (val, defaultVal = 0) => {
  const parsed = parseInt(val);
  return isNaN(parsed) ? defaultVal : parsed;
};
const parseFloatSafe = (val, defaultVal = 0) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
};

// PayPal Configuration
paypal.configure({
  'mode': 'sandbox',
  'client_id': process.env.PAYPAL_CLIENT_ID,
  'client_secret': process.env.PAYPAL_CLIENT_SECRET,
});

// ========================================
// SPECIFIC ROUTES FIRST (CRITICAL ORDER)
// ========================================

// Get Events with Following Filter
router.get('/following-events', protect, async (req, res) => {
  console.log('🟡 Following events endpoint hit');
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    console.log('🟡 User ID:', req.user._id);
    
    // Get current user with populated following list
    const viewer = await User.findById(req.user._id)
      .select('following')
      .populate('following', '_id username')
      .lean();
    
    if (!viewer) {
      console.log('❌ User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('🟡 User following count:', viewer.following?.length || 0);
    const followingIds = (viewer.following || []).map(user => user._id);

    if (followingIds.length === 0) {
      console.log('🟡 No following users, returning empty');
      return res.json({
        events: [],
        page: 1,
        totalPages: 0,
        hasMore: false
      });
    }

    // Build query for events from people you follow
    const query = {
      host: { $in: followingIds },
      time: { $gte: new Date() }, // Only future events
      $or: [
        { privacyLevel: 'public' },
        { 
          privacyLevel: 'friends',
          host: { $in: followingIds } // Friends can see friends-only events
        }
      ]
    };

    console.log('🟡 Query:', JSON.stringify(query, null, 2));

    // Get events with populated data
    const events = await Event.find(query)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username')
      .sort({ time: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log('🟡 Found events:', events.length);

    // Add user relationship metadata to each event
    const eventsWithMetadata = events.map(event => {
      const isHost = String(event.host._id) === String(req.user._id);
      const isAttending = event.attendees.some(attendee => 
        String(attendee._id) === String(req.user._id)
      );
      
      return {
        ...event,
        userRelation: {
          isHost,
          isAttending,
          canJoin: !isHost && !isAttending
        },
        attendeeCount: event.attendees.length
      };
    });

    // Get total count for pagination
    const totalEvents = await Event.countDocuments(query);
    const totalPages = Math.ceil(totalEvents / limit);
    const hasMore = skip + limit < totalEvents;

    const response = {
      events: eventsWithMetadata,
      page,
      totalPages,
      hasMore,
      total: totalEvents
    };

    console.log('🟢 Sending response:', { 
      eventsCount: eventsWithMetadata.length, 
      page, 
      totalPages,
      hasMore 
    });
    
    res.json(response);

  } catch (err) {
    console.error('❌ Following events error:', err);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Enhanced Posts Feed Route
router.get('/feed/posts', protect, async (req, res) => {
  console.log('🟡 Enhanced posts endpoint hit');
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;
  
  try {
    const viewer = await User.findById(req.user._id).select('following');
    
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingIds = viewer.following || [];
    console.log('🟡 Following count for posts:', followingIds.length);

    if (followingIds.length === 0) {
      return res.json({
        posts: [],
        page: 1,
        totalPages: 0,
        hasMore: false
      });
    }

    // Get posts from friends
    const posts = await Photo.find({
      user: { $in: followingIds }
    })
    .populate('user', 'username profilePicture')
    .populate('event', 'title time location')
    .sort({ uploadDate: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    console.log('🟡 Found posts:', posts.length);

    // Add source field
    const postsWithSource = posts.map(post => ({
      ...post,
      source: 'friend'
    }));

    const totalPosts = await Photo.countDocuments({
      user: { $in: followingIds }
    });
    
    const response = {
      posts: postsWithSource,
      page,
      totalPages: Math.ceil(totalPosts / limit),
      hasMore: skip + limit < totalPosts
    };

    console.log('🟢 Sending posts response:', { postsCount: posts.length, page });
    res.json(response);

  } catch (err) {
    console.error('❌ Enhanced posts error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Get Event Recommendations
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

// Get Friends Activity
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

// Get My Photo Events
router.get('/my-photo-events', protect, async (req, res) => {
  try {
    const list = await Event.find({
      allowPhotos: true,
      $or: [
        { attendees: req.user._id }, 
        { checkedIn: req.user._id },
        { host: req.user._id } // Include hosted events
      ]
    }).select('title time allowPhotos host attendees');
    res.json(list);
  } catch (err) {
    console.error('/my-photo-events =>', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================================
// FIXED: NOTIFICATION ROUTES MOVED TO TOP
// ================================

// Get My Event Invites - MUST BE BEFORE /:eventId route
router.get('/my-invites', protect, async (req, res) => {
  try {
    console.log(`📋 Fetching invites for user: ${req.user._id}`);
    
    const events = await Event.find({
      invitedUsers: req.user._id,
      // Exclude events the user is already attending
      attendees: { $ne: req.user._id }
    })
    .populate('host', 'username profilePicture')
    .populate('coHosts', 'username profilePicture')
    .select('title description time location host coHosts invitedUsers price visibility coverImage')
    .sort({ time: 1 }) // Upcoming events first
    .lean();

    console.log(`✅ Found ${events.length} event invitations`);

    // Transform to match expected format for NotificationScreen
    const eventInvites = events.map(event => ({
      event,
      invitedAt: new Date(), // Note: You might want to add this field to Event model later
      status: 'pending'
    }));

    res.json(eventInvites);
  } catch (error) {
    console.error('❌ Get my invites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get My Join Requests - MUST BE BEFORE /:eventId route  
router.get('/my-join-requests', protect, async (req, res) => {
  try {
    console.log(`📋 Fetching join requests for events hosted by: ${req.user._id}`);
    
    const events = await Event.find({
      $or: [
        { host: req.user._id },
        { coHosts: req.user._id }
      ],
      'joinRequests.0': { $exists: true } // Only events with join requests
    })
    .populate({
      path: 'joinRequests.user',
      select: 'username profilePicture'
    })
    .select('title joinRequests host coHosts')
    .lean();

    console.log(`✅ Found ${events.length} events with join requests`);

    // Flatten join requests with event info
    const joinRequests = [];
    events.forEach(event => {
      event.joinRequests.forEach(request => {
        joinRequests.push({
          event: {
            _id: event._id,
            title: event.title
          },
          user: request.user,
          message: request.message,
          requestedAt: request.requestedAt || new Date()
        });
      });
    });

    // Sort by most recent
    joinRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    console.log(`✅ Returning ${joinRequests.length} total join requests`);
    res.json(joinRequests);
  } catch (error) {
    console.error('❌ Get my join requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload Cover Image
router.post('/upload-cover', protect, uploadCover.single('coverImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Return the file path relative to uploads directory
    const coverImagePath = `/uploads/covers/${req.file.filename}`;
    
    res.json({
      success: true,
      coverImage: coverImagePath,
      filename: req.file.filename
    });

  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload cover image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// Get User Events
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      type = 'all', // 'hosted', 'attending', 'shared', 'all'
      includePast = 'false',
      limit = 50,
      skip = 0 
    } = req.query;

    const currentUserId = req.user._id;
    const isOwnProfile = String(userId) === String(currentUserId);

    // Build query based on type
    let query = {};
    
    switch (type) {
      case 'hosted':
        query.host = userId;
        break;
      case 'attending':
        query.attendees = userId;
        query.host = { $ne: userId }; // Exclude hosted events
        break;
      case 'shared':
        // For shared events, we need to get the user's shared event IDs first
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        const sharedEventIds = user.sharedEvents || [];
        query._id = { $in: sharedEventIds };
        break;
      default: // 'all'
        query.$or = [
          { host: userId },
          { attendees: userId }
        ];
    }

    // Add time filter
    if (includePast !== 'true') {
      query.time = { $gte: new Date() };
    }

    // Check privacy permissions
    if (!isOwnProfile) {
      // For other users, only show public events they can see
      const permission = await EventPrivacyService.getVisibleEvents(currentUserId, {
        hostFilter: userId,
        limit: parseInt(limit),
        skip: parseInt(skip)
      });
      
      return res.json({
        events: permission,
        total: permission.length,
        isOwnProfile: false
      });
    }

    // For own profile, get all events with metadata
    const events = await Event.find(query)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username')
      .sort({ time: includePast === 'true' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // Add metadata about user's relationship to each event
    const eventsWithMetadata = events.map(event => {
      const isHost = String(event.host._id) === String(userId);
      const isAttending = event.attendees.some(a => String(a._id) === String(userId));
      const isPast = new Date(event.time) < new Date();
      
      return {
        ...event.toObject(),
        isHost,
        isAttending,
        isPast,
        relationshipType: isHost ? 'host' : 'attendee'
      };
    });

    res.json({
      events: eventsWithMetadata,
      total: eventsWithMetadata.length,
      isOwnProfile: true
    });

  } catch (error) {
    console.error('Get user events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User Calendar Events
router.get('/user/:userId/calendar', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    if (userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

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

// Create Event with Enhanced Privacy
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
      try {
        const g = typeof geo === 'string' ? JSON.parse(geo) : geo;
        if (g && Array.isArray(g.coordinates) && g.coordinates.length === 2) {
          event.geo = g;
        }
      } catch (error) {
        console.log('Invalid geo format during creation:', error);
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

// Create Event from Group Chat
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

// Get Events with Privacy Filtering
router.get('/', protect, async (req, res) => {
  try {
    const { 
      host,
      attendee, 
      location, 
      radius, 
      interests, 
      includeSecret,
      includePast = 'false',
      limit = 20, 
      skip = 0 
    } = req.query;

    // If specific user filters are provided, handle them
    if (host || attendee) {
      let query = {};
      
      if (host) {
        query.host = host;
      }
      
      if (attendee) {
        query.attendees = attendee;
        // If both host and attendee are the same, get all user's events
        if (host === attendee) {
          query = {
            $or: [
              { host: attendee },
              { attendees: attendee }
            ]
          };
        }
      }

      // Add time filter
      if (includePast !== 'true') {
        query.time = { $gte: new Date() };
      }

      // Check if requesting user can see these events
      const requestingUserId = req.user._id;
      const targetUserId = host || attendee;
      const isOwnEvents = String(requestingUserId) === String(targetUserId);

      if (!isOwnEvents) {
        // Apply privacy filtering for other users' events
        const visibleEvents = await EventPrivacyService.getVisibleEvents(requestingUserId, {
          hostFilter: targetUserId,
          limit: parseInt(limit),
          skip: parseInt(skip)
        });
        return res.json({ events: visibleEvents });
      }

      // For own events, return all with metadata
      const events = await Event.find(query)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ time: includePast === 'true' ? -1 : 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      return res.json({ events });
    }

    // Default behavior - get recommended/visible events
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
    res.json({ events });

  } catch (e) { 
    console.error('Get events error:', e);
    res.status(500).json({ message: 'Server error' }); 
  }
});

// Attend Event with Privacy Check
router.post('/attend/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Event is considered over 3 hours after start time
    const eventEndTime = new Date(event.time).getTime() + (3 * 60 * 60 * 1000);
    if (Date.now() > eventEndTime) {
      return res.status(400).json({ message: 'Event has already ended' });
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

// Leave Event
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

// Send Join Request
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

// Approve Join Request
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

// Reject Join Request
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

// Invite Users to Event
router.post('/:eventId/invite', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userIds } = req.body; // Array of user IDs

    console.log(`📨 Processing invite for event ${eventId} from user ${req.user._id}`);
    console.log(`📨 Inviting users:`, userIds);

    // Validate userIds
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user can invite (host, co-host, or has permission)
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts?.some(c => String(c) === String(req.user._id));
    
    if (!isHost && !isCoHost) {
      // Check event permissions for regular attendees
      if (event.permissions?.canInvite !== 'attendees' && event.permissions?.canInvite !== 'anyone') {
        return res.status(403).json({ message: 'You do not have permission to invite users to this event' });
      }
      
      // If permission allows attendees, check if user is attending
      if (event.permissions?.canInvite === 'attendees') {
        const isAttending = event.attendees?.some(a => String(a) === String(req.user._id));
        if (!isAttending) {
          return res.status(403).json({ message: 'Only attendees can invite others to this event' });
        }
      }
    }

    const newInvites = [];
    const alreadyInvited = [];
    const alreadyAttending = [];
    const invalidUsers = [];

    // Process each user ID
    for (const userId of userIds) {
      try {
        // Check if user exists
        const userExists = await User.findById(userId);
        if (!userExists) {
          invalidUsers.push(userId);
          continue;
        }

        // Check if already attending
        if (event.attendees?.includes(userId)) {
          alreadyAttending.push(userId);
          continue;
        }

        // Check if already invited
        if (event.invitedUsers?.includes(userId)) {
          alreadyInvited.push(userId);
          continue;
        }

        // Add to invited users
        if (!event.invitedUsers) {
          event.invitedUsers = [];
        }
        event.invitedUsers.push(userId);
        newInvites.push(userId);

        // Send notification (optional - depends on your notification system)
        try {
          // If you have a notification service, uncomment this
          // await notificationService.sendEventInvitation(req.user._id, userId, event);
          console.log(`✅ Notification would be sent to user ${userId}`);
        } catch (notifError) {
          console.error(`❌ Failed to send notification to user ${userId}:`, notifError);
          // Continue with invite even if notification fails
        }

      } catch (userError) {
        console.error(`❌ Error processing user ${userId}:`, userError);
        invalidUsers.push(userId);
      }
    }

    // Save the event with new invites
    await event.save();

    console.log(`✅ Successfully invited ${newInvites.length} users`);

    // Return detailed response
    res.json({
      message: `Successfully invited ${newInvites.length} user${newInvites.length !== 1 ? 's' : ''}`,
      invited: newInvites.length,
      alreadyInvited: alreadyInvited.length,
      alreadyAttending: alreadyAttending.length,
      invalid: invalidUsers.length,
      details: {
        newInvites,
        alreadyInvited,
        alreadyAttending,
        invalidUsers
      }
    });

  } catch (error) {
    console.error('❌ Invite users error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});
// Decline Event Invite - MUST BE BEFORE /:eventId route
router.delete('/invite/:eventId', protect, async (req, res) => {
  try {
    console.log(`❌ User ${req.user._id} declining invite to event ${req.params.eventId}`);
    
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Remove user from invited users
    const wasInvited = event.invitedUsers.includes(req.user._id);
    event.invitedUsers.pull(req.user._id);
    await event.save();

    if (wasInvited) {
      console.log(`✅ Successfully declined invitation to ${event.title}`);
    }

    res.json({ message: 'Event invitation declined' });
  } catch (error) {
    console.error('❌ Decline invite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Ban User from Event
router.post('/:eventId/banUser', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, banPermanently } = req.body;

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

// Check-in endpoint
router.post('/:eventId/checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { scannedUserId, userId, manualCheckIn } = req.body;

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

    // Determine which user to check in
    const targetUserId = scannedUserId || userId;
    if (!targetUserId) {
      return res.status(400).json({ message: 'No user ID provided for check-in' });
    }

    // Find the user doc
    const user = await User.findById(targetUserId).select('username profilePicture');
    if (!user) {
      return res.status(404).json({ message: 'User not found in system' });
    }

    // Check if user is in event.attendees
    const isAttendee = event.attendees.some((a) => a._id.equals(targetUserId));
    if (!isAttendee) {
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
      String(id) === String(targetUserId)
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
    event.checkedIn.push(targetUserId);
    await event.save();

    return res.json({
      status: 'success',
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture || null,
      },
      manualCheckIn: manualCheckIn || false
    });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Event Attendees
router.get('/:eventId/attendees', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId)
      .populate('attendees', 'username profilePicture bio')
      .populate('checkedIn', '_id')
      .populate('host', 'username profilePicture');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user can view attendees
    const userId = req.user._id;
    const isHost = String(event.host._id) === String(userId);
    const isAttending = event.attendees.some(attendee => 
      String(attendee._id) === String(userId)
    );

    // Privacy check - only hosts, attendees, or public events can show attendees
    if (!isHost && !isAttending && !event.permissions?.showAttendeesToPublic) {
      return res.status(403).json({ message: 'Not authorized to view attendees' });
    }

    // Return attendees with check-in status
    const attendeesWithStatus = event.attendees.map(attendee => ({
      _id: attendee._id,
      username: attendee.username,
      profilePicture: attendee.profilePicture,
      bio: attendee.bio,
      isCheckedIn: event.checkedIn.some(checkedUser => 
        String(checkedUser._id) === String(attendee._id)
      )
    }));

    res.json({
      attendees: attendeesWithStatus,
      checkedInCount: event.checkedIn.length,
      totalCount: event.attendees.length,
      canManage: isHost
    });

  } catch (error) {
    console.error('Get attendees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// PARAMETERIZED ROUTES LAST (CRITICAL!)
// ========================================

// Get Event by ID with Privacy Check - MUST BE LAST
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

    // Add timing metadata with 3-hour buffer
    const eventEndTime = new Date(event.time).getTime() + (3 * 60 * 60 * 1000);
    eventObj.isOver = Date.now() > eventEndTime;
    eventObj.canCheckIn = Date.now() <= eventEndTime;

    res.json(eventObj);

  } catch (e) { 
    console.error('Get event error:', e);
    res.status(500).json({ message: 'Server error' }); 
  }
});

// Update Event with Privacy Controls - MUST BE LAST
router.post('/:eventId/cover', protect, upload.single('coverImage'), async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is the host
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can update the cover image' });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No cover image uploaded' });
    }
    
    // Delete old cover image if it exists
    if (event.coverImage) {
      const oldImagePath = path.join(__dirname, '..', event.coverImage);
      fs.unlink(oldImagePath, (err) => {
        if (err) console.error('Error deleting old cover image:', err);
      });
    }
    
    // Update event with new cover image path
    const coverImagePath = `/uploads/event-covers/${req.file.filename}`;
    event.coverImage = coverImagePath;
    await event.save();
    
    res.json({
      message: 'Cover image updated successfully',
      coverImage: coverImagePath,
      event: {
        _id: event._id,
        title: event.title,
        coverImage: event.coverImage
      }
    });
    
  } catch (error) {
    console.error('Cover image upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:eventId/cover', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is the host
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can remove the cover image' });
    }
    
    // Delete the cover image file if it exists
    if (event.coverImage) {
      const imagePath = path.join(__dirname, '..', event.coverImage);
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Error deleting cover image file:', err);
      });
    }
    
    // Remove cover image from event
    event.coverImage = null;
    await event.save();
    
    res.json({
      message: 'Cover image removed successfully',
      event: {
        _id: event._id,
        title: event.title,
        coverImage: null
      }
    });
    
  } catch (error) {
    console.error('Cover image removal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;