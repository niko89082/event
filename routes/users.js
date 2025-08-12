// routes/users.js - FIXED WITH CONSISTENT AUTH MIDDLEWARE

const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const Photo = require('../models/Photo');
const protect = require('../middleware/auth'); // ✅ FIXED: Use consistent middleware name

const router = express.Router();

// Generate event recommendations for the user
router.get('/recommendations/events', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const attendedEvents = await Event.find({ attendees: user._id }).populate('host', 'username');
    const likedEvents = await Event.find({ likes: user._id }).populate('host', 'username');
    const commentedEvents = await Event.find({ 'comments.user': user._id }).populate('host', 'username');

    const allEvents = [...new Set([...attendedEvents, ...likedEvents, ...commentedEvents])];

    res.status(200).json(allEvents);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate user recommendations for the user
router.get('/recommendations/users', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const followedUsers = user.following;

    const recommendedUsers = await User.find({ _id: { $in: followedUsers } }).populate('followers');
    const filteredUsers = recommendedUsers.filter(u => u._id.toString() !== user._id.toString());

    res.status(200).json(filteredUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:userId/followers', protect, async (req, res) => {
  console.log("getting followers");
  try {
    const user = await User.findById(req.params.userId).populate('followers', 'username');
    res.json(user.followers);
  } catch (e) {
    console.log(e);
  }
});

router.get('/:userId/following', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('following', 'username');
    res.json(user.following);
  } catch (e) {
    console.log(e);
  }
});


router.get('/:userId/events/attended', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, includePast = true } = req.query;

    const dateFilter = includePast === 'true' ? {} : { time: { $gte: new Date() } };

    const events = await Event.find({
      attendees: userId,
      ...dateFilter
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

    res.json({
      events,
      total: events.length,
      hasMore: events.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get attended events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/share-memory', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId, message, shareWith } = req.body; // shareWith could be 'public', 'friends', or specific user IDs

    // Verify user has access to this event
    const event = await Event.findById(eventId)
      .populate('host', 'username')
      .lean();
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isHost = String(event.host._id) === String(userId);
    const isAttendee = event.attendees && event.attendees.includes(userId);
    
    if (!isHost && !isAttendee) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get some photos from this event to include with the memory
    const eventPhotos = await Photo.find({
      event: eventId,
      user: userId
    })
    .limit(3)
    .sort({ uploadDate: -1 })
    .lean();

    // Create a memory share object (this could be stored in a separate collection)
    const memoryShare = {
      user: userId,
      event: eventId,
      message: message || `Great memories from ${event.title}!`,
      photos: eventPhotos.map(p => p._id),
      shareWith: shareWith || 'friends',
      createdAt: new Date()
    };

    // Here you would typically:
    // 1. Store the memory share in a database
    // 2. Send notifications to relevant users
    // 3. Update user's activity feed

    res.json({ 
      success: true, 
      memoryShare,
      message: 'Memory shared successfully!' 
    });

  } catch (error) {
    console.error('Share memory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:userId/events/hosted', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, includePast = true } = req.query;

    const dateFilter = includePast === 'true' ? {} : { time: { $gte: new Date() } };

    const events = await Event.find({
      host: userId,
      ...dateFilter
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

    res.json({
      events,
      total: events.length,
      hasMore: events.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get hosted events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🎯 FIX #1: ADD THE MISSING EVENTS ENDPOINT THAT PROFILESCREEN IS CALLING
router.get('/:userId/events', protect, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user._id;
    const isOwnProfile = String(userId) === String(currentUserId);
    
    const { 
      type = 'all', // 'hosted', 'attending', 'shared', 'all'
      includePast = 'true', // PHASE 1 FIX: Default to true
      limit = 100, // Increased default limit
      skip = 0 
    } = req.query;

    console.log(`🔍 Fetching events for user ${userId}, type: ${type}, includePast: ${includePast}`);

    // Get user for validation
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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
        // Get user's shared event IDs
        const sharedEventIds = user.sharedEvents || [];
        query._id = { $in: sharedEventIds };
        break;
      default: // 'all'
        query.$or = [
          { host: userId },
          { attendees: userId }
        ];
    }

    // PHASE 1 FIX: Always include past events unless explicitly excluded
    if (includePast !== 'true') {
      query.time = { $gte: new Date() };
    }

    // Privacy filtering for non-self profiles
    if (!isOwnProfile) {
      const currentUser = await User.findById(currentUserId).select('following');
      const userFollowing = currentUser ? currentUser.following.map(f => String(f)) : [];
      
      // Add privacy filters
      const privacyFilters = [];
      
      // Public events
      privacyFilters.push({ privacyLevel: 'public' });
      
      // Friends-only events if current user follows this user
      if (userFollowing.includes(String(userId))) {
        privacyFilters.push({ 
          privacyLevel: 'friends',
          host: userId 
        });
      }
      
      // Events current user is invited to or attending
      privacyFilters.push({ 
        $or: [
          { attendees: currentUserId },
          { invitedUsers: currentUserId }
        ]
      });
      
      // Combine with existing query
      if (query.$or) {
        query = {
          $and: [
            { $or: query.$or },
            { $or: privacyFilters }
          ]
        };
      } else {
        query.$or = privacyFilters;
      }
    }

    // Execute query with proper sorting
    const events = await Event.find(query)
      .populate('host', 'username fullName profilePicture')
      .populate('attendees', 'username profilePicture')
      .sort({ time: -1 }) // PHASE 1: Most recent first (includes past events)
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // Add user relationship flags to each event
    const eventsWithFlags = events.map(event => {
      const eventObj = event.toJSON();
      const eventHostId = String(event.host._id);
      const isHost = String(userId) === eventHostId;
      const isAttending = event.attendees.some(a => String(a._id) === String(userId));
      
      return {
        ...eventObj,
        isHost,
        isAttending,
        userRelationship: isHost ? 'host' : isAttending ? 'attendee' : 'none'
      };
    });

    // Get shared event IDs for own profile
    let sharedEventIds = [];
    if (isOwnProfile) {
      sharedEventIds = user.sharedEvents || [];
    }

    console.log(`✅ Found ${eventsWithFlags.length} events for user ${userId}`);

    res.json({
      events: eventsWithFlags,
      sharedEventIds,
      total: eventsWithFlags.length,
      hasMore: eventsWithFlags.length === parseInt(limit),
      filters: {
        type,
        includePast,
        userId,
        isOwnProfile
      }
    });

  } catch (error) {
    console.error('❌ Get user events error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// NEW: General user search endpoint (includes all users when no friendship filter)
router.get('/search', protect, async (req, res) => {
  try {
    const { q, limit = 20, type = 'all' } = req.query; // type: 'all', 'friends', 'non-friends'
    
    console.log(`🔍 GENERAL: User search - Query: "${q}", Type: ${type}`);

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const includeNonFriends = type === 'all' || type === 'non-friends';
    
    // Use the enhanced friends search with includeNonFriends flag
    req.query.includeNonFriends = includeNonFriends.toString();
    
    // Call the enhanced search function
    return router.handle(req, res);
    
  } catch (error) {
    console.error('❌ General search error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    });
  }
});



// ✅ FIXED: Advanced search with correct middleware
router.get('/search-advanced', protect, async (req, res) => {
  try {
    const { q, excludeIds = [] } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ users: [] });
    }
    
    const searchQuery = q.trim();
    const excludeList = Array.isArray(excludeIds) ? excludeIds : [excludeIds].filter(Boolean);
    
    // Add current user to exclude list
    excludeList.push(req.user._id); // ✅ FIXED: Use req.user._id
    
    const users = await User.find({
      $and: [
        { _id: { $nin: excludeList } },
        {
          $or: [
            { username: { $regex: searchQuery, $options: 'i' } },
            { fullName: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    })
    .select('username fullName profilePicture followerCount')
    .limit(20)
    .sort({ 
      // Prioritize exact matches, then by follower count
      username: 1,
      followerCount: -1 
    });
    
    res.json({ users });
    
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

// GET /users/following - Get users that current user follows
router.get('/following', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
      .populate('following', 'username fullName email profilePicture')
      .select('following');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(currentUser.following || []);
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /users/followers - Get users that follow current user
router.get('/followers', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
      .populate('followers', 'username fullName email profilePicture')
      .select('followers');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(currentUser.followers || []);
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's shared events (for the shared events functionality)
router.get('/shared-events', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId)
      .populate({
        path: 'sharedEvents',
        populate: {
          path: 'host',
          select: 'username profilePicture'
        },
        options: { sort: { time: -1 } } // FIXED: Sort shared events by most recent
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const eventIds = (user.sharedEvents || []).map(event => event._id);
    
    res.json({
      eventIds,
      sharedEvents: user.sharedEvents || []
    });

  } catch (error) {
    console.error('Get shared events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add/remove event from shared events
router.post('/shared-events/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure user has access to this event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isHost = String(event.host) === String(req.user._id);
    const isAttending = event.attendees.some(a => String(a) === String(req.user._id));
    
    if (!isHost && !isAttending) {
      return res.status(403).json({ message: 'You can only share events you are hosting or attending' });
    }

    // Add to shared events if not already there
    if (!user.sharedEvents) {
      user.sharedEvents = [];
    }
    
    if (!user.sharedEvents.includes(eventId)) {
      user.sharedEvents.push(eventId);
      await user.save();
    }

    res.json({ message: 'Event added to shared events' });
  } catch (error) {
    console.error('Add shared event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove event from shared events
router.delete('/shared-events/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.sharedEvents) {
      user.sharedEvents = user.sharedEvents.filter(id => String(id) !== String(eventId));
      await user.save();
    }

    res.json({ message: 'Event removed from shared events' });
  } catch (error) {
    console.error('Remove shared event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's past events with statistics
router.get('/past-events', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      startDate, 
      endDate = new Date().toISOString(),
      includeHosted = 'true',
      includeAttended = 'true'
    } = req.query;

    // Build date filter
    const dateFilter = {
      time: { $lt: new Date(endDate) }
    };
    
    if (startDate) {
      dateFilter.time.$gte = new Date(startDate);
    }

    // Build the match conditions
    const matchConditions = [];
    
    if (includeHosted === 'true') {
      matchConditions.push({ host: userId });
    }
    
    if (includeAttended === 'true') {
      matchConditions.push({ attendees: userId });
    }

    if (matchConditions.length === 0) {
      return res.json({ events: [], stats: {} });
    }

    // Find past events
    const events = await Event.find({
      ...dateFilter,
      $or: matchConditions
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: -1 }) // Most recent first
    .lean();

    // Add additional metadata to each event
    const enrichedEvents = await Promise.all(events.map(async (event) => {
      // Check if user hosted this event
      const isHost = String(event.host._id) === String(userId);
      
      // Get photo count for this event
      const photoCount = await Photo.countDocuments({ 
        event: event._id,
        user: userId 
      });

      // Calculate event duration (estimate 2 hours if not specified)
      const eventDuration = 2; // hours - you could store this in the event model

      return {
        ...event,
        isHost,
        photoCount,
        attendeeCount: event.attendees ? event.attendees.length : 0,
        duration: eventDuration
      };
    }));

    // Calculate statistics
    const stats = calculateEventStats(enrichedEvents, userId);

    res.json({
      events: enrichedEvents,
      stats,
      total: enrichedEvents.length
    });

  } catch (error) {
    console.error('Get past events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate event statistics
function calculateEventStats(events, userId) {
  const stats = {
    totalEvents: events.length,
    hostedEvents: 0,
    attendedEvents: 0,
    totalHours: 0,
    uniqueLocations: 0,
    favoriteCategory: null,
    categoryBreakdown: {},
    monthlyBreakdown: {},
    locationBreakdown: {}
  };

  const locations = new Set();
  const categories = {};
  const months = {};

  events.forEach(event => {
    // Count hosted vs attended
    if (event.isHost) {
      stats.hostedEvents++;
    } else {
      stats.attendedEvents++;
    }

    // Add to total hours
    stats.totalHours += event.duration || 2;

    // Track unique locations
    if (event.location) {
      locations.add(event.location.toLowerCase().trim());
      
      // Location breakdown
      const locationKey = event.location.trim();
      stats.locationBreakdown[locationKey] = (stats.locationBreakdown[locationKey] || 0) + 1;
    }

    // Track categories
    if (event.category) {
      categories[event.category] = (categories[event.category] || 0) + 1;
    }

    // Track monthly breakdown
    const eventDate = new Date(event.time);
    const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
    months[monthKey] = (months[monthKey] || 0) + 1;
  });

  stats.uniqueLocations = locations.size;
  stats.categoryBreakdown = categories;
  stats.monthlyBreakdown = months;

  // Find favorite category
  let maxCategoryCount = 0;
  let favoriteCategory = null;
  
  Object.entries(categories).forEach(([category, count]) => {
    if (count > maxCategoryCount) {
      maxCategoryCount = count;
      favoriteCategory = category;
    }
  });

  stats.favoriteCategory = favoriteCategory;

  return stats;
}

// Get user's event memories (events with photos)
router.get('/event-memories', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, offset = 0 } = req.query;

    // Find events where user has uploaded photos
    const photosWithEvents = await Photo.find({
      user: userId,
      event: { $exists: true, $ne: null }
    })
    .populate({
      path: 'event',
      match: { time: { $lt: new Date() } }, // Only past events
      populate: {
        path: 'host',
        select: 'username profilePicture'
      }
    })
    .sort({ uploadDate: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

    // Filter out null events and group by event
    const eventMemories = {};
    
    photosWithEvents.forEach(photo => {
      if (photo.event) {
        const eventId = photo.event._id.toString();
        
        if (!eventMemories[eventId]) {
          eventMemories[eventId] = {
            event: photo.event,
            photos: [],
            photoCount: 0,
            lastPhotoDate: photo.uploadDate
          };
        }
        
        eventMemories[eventId].photos.push(photo);
        eventMemories[eventId].photoCount++;
        
        // Update last photo date if this photo is more recent
        if (photo.uploadDate > eventMemories[eventId].lastPhotoDate) {
          eventMemories[eventId].lastPhotoDate = photo.uploadDate;
        }
      }
    });

    // Convert to array and sort by last photo date
    const memoriesArray = Object.values(eventMemories)
      .sort((a, b) => new Date(b.lastPhotoDate) - new Date(a.lastPhotoDate));

    res.json({
      memories: memoriesArray,
      total: memoriesArray.length,
      hasMore: memoriesArray.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get event memories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed stats for a specific time period
router.get('/event-stats/:period', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { period } = req.params; // 'week', 'month', 'quarter', 'year'
    
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const endDate = new Date();

    // Get events in the period
    const events = await Event.find({
      time: { $gte: startDate, $lt: endDate },
      $or: [
        { host: userId },
        { attendees: userId }
      ]
    }).lean();

    // Calculate detailed statistics
    const stats = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalEvents: events.length,
      hostedEvents: events.filter(e => String(e.host) === String(userId)).length,
      attendedEvents: events.filter(e => 
        e.attendees && e.attendees.some(a => String(a) === String(userId))
      ).length,
      averageAttendeesHosted: 0,
      topCategories: {},
      topLocations: {},
      busyDays: {},
      socialScore: 0 // Custom metric based on event participation
    };

    // Calculate average attendees for hosted events
    const hostedEvents = events.filter(e => String(e.host) === String(userId));
    if (hostedEvents.length > 0) {
      const totalAttendees = hostedEvents.reduce((sum, event) => 
        sum + (event.attendees ? event.attendees.length : 0), 0
      );
      stats.averageAttendeesHosted = Math.round(totalAttendees / hostedEvents.length);
    }

    // Analyze categories, locations, and busy days
    events.forEach(event => {
      // Categories
      if (event.category) {
        stats.topCategories[event.category] = (stats.topCategories[event.category] || 0) + 1;
      }

      // Locations
      if (event.location) {
        stats.topLocations[event.location] = (stats.topLocations[event.location] || 0) + 1;
      }

      // Busy days (day of week)
      const dayOfWeek = new Date(event.time).toLocaleDateString('en-US', { weekday: 'long' });
      stats.busyDays[dayOfWeek] = (stats.busyDays[dayOfWeek] || 0) + 1;
    });

    // Calculate social score (0-100)
    const maxPossibleEvents = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 7)); // Rough weekly estimate
    stats.socialScore = Math.min(100, Math.round((stats.totalEvents / Math.max(1, maxPossibleEvents)) * 100));

    res.json(stats);

  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Share a memory from a past event
router.post('/share-memory', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId, message, shareWith } = req.body; // shareWith could be 'public', 'friends', or specific user IDs

    // Verify user has access to this event
    const event = await Event.findById(eventId)
      .populate('host', 'username')
      .lean();
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isHost = String(event.host._id) === String(userId);
    const isAttendee = event.attendees && event.attendees.includes(userId);
    
    if (!isHost && !isAttendee) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get some photos from this event to include with the memory
    const eventPhotos = await Photo.find({
      event: eventId,
      user: userId
    })
    .limit(3)
    .sort({ uploadDate: -1 })
    .lean();

    // Create a memory share object (this could be stored in a separate collection)
    const memoryShare = {
      user: userId,
      event: eventId,
      message: message || `Great memories from ${event.title}!`,
      photos: eventPhotos.map(p => p._id),
      shareWith: shareWith || 'friends',
      createdAt: new Date()
    };

    // Here you would typically:
    // 1. Store the memory share in a database
    // 2. Send notifications to relevant users
    // 3. Create social media posts if requested
    
    // For now, we'll just return success
    res.json({
      message: 'Memory shared successfully',
      memoryShare,
      event: {
        title: event.title,
        time: event.time,
        photoCount: eventPhotos.length
      }
    });

  } catch (error) {
    console.error('Share memory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's event timeline (chronological view of all events)
router.get('/event-timeline', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      year = new Date().getFullYear(),
      month = null 
    } = req.query;

    // Build date filter
    let startDate, endDate;
    
    if (month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    // Get all events in the time period
    const events = await Event.find({
      time: { $gte: startDate, $lte: endDate },
      $or: [
        { host: userId },
        { attendees: userId }
      ]
    })
    .populate('host', 'username profilePicture')
    .sort({ time: 1 }) // Chronological order
    .lean();

    // Add metadata and group by month
    const timeline = {};
    
    for (const event of events) {
      const eventDate = new Date(event.time);
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!timeline[monthKey]) {
        timeline[monthKey] = {
          month: eventDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          events: [],
          stats: {
            total: 0,
            hosted: 0,
            attended: 0
          }
        };
      }

      const isHost = String(event.host._id) === String(userId);
      const photoCount = await Photo.countDocuments({ 
        event: event._id,
        user: userId 
      });

      const enrichedEvent = {
        ...event,
        isHost,
        photoCount,
        attendeeCount: event.attendees ? event.attendees.length : 0,
        dayOfWeek: eventDate.toLocaleDateString('en-US', { weekday: 'long' }),
        timeOfDay: eventDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      };

      timeline[monthKey].events.push(enrichedEvent);
      timeline[monthKey].stats.total++;
      
      if (isHost) {
        timeline[monthKey].stats.hosted++;
      } else {
        timeline[monthKey].stats.attended++;
      }
    }

    // Convert to array and sort by month
    const timelineArray = Object.entries(timeline)
      .map(([key, data]) => ({ monthKey: key, ...data }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    res.json({
      timeline: timelineArray,
      year: parseInt(year),
      month: month ? parseInt(month) : null,
      totalEvents: events.length
    });

  } catch (error) {
    console.error('Get event timeline error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function calculatePriorityScore(user, searchTerm, relationship, mutualFriendsCount = 0) {
  let score = 0;
  const term = searchTerm.toLowerCase();
  const username = (user.username || '').toLowerCase();
  const displayName = (user.displayName || '').toLowerCase();
  const fullName = (user.fullName || '').toLowerCase();

  // === EXACT MATCH BONUSES ===
  if (username === term) score += 100;
  if (displayName === term) score += 90;
  if (fullName === term) score += 85;

  // === STARTS WITH BONUSES ===
  if (username.startsWith(term)) score += 50;
  if (displayName.startsWith(term)) score += 45;
  if (fullName.startsWith(term)) score += 40;

  // === WORD BOUNDARY BONUSES ===
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(term)}`, 'i');
  if (wordBoundaryRegex.test(username)) score += 30;
  if (wordBoundaryRegex.test(displayName)) score += 25;
  if (wordBoundaryRegex.test(fullName)) score += 20;

  // === CONTAINS BONUSES ===
  if (username.includes(term)) score += 15;
  if (displayName.includes(term)) score += 12;
  if (fullName.includes(term)) score += 10;

  // === RELATIONSHIP BONUSES ===
  switch (relationship) {
    case 'friend':
      score += 1000; // Friends always rank highest
      break;
    case 'pending':
      score += 500; // Pending requests rank high
      break;
    case 'non-friend':
      // Mutual friends boost for non-friends
      score += mutualFriendsCount * 10;
      break;
  }

  // === LENGTH PENALTY (prefer shorter names for partial matches) ===
  if (term.length > 0) {
    const usernameRatio = term.length / username.length;
    const displayNameRatio = displayName ? term.length / displayName.length : 0;
    score += Math.max(usernameRatio, displayNameRatio) * 10;
  }

  return score;
}

// routes/users.js - FIXED friends/search endpoint
router.get('/friends/search', protect, async (req, res) => {
  try {
    const { q, eventId, memoryId, limit = 20, includeNonFriends = false } = req.query;
    
    console.log(`🔍 ENHANCED: User search - Query: "${q}", IncludeNonFriends: ${includeNonFriends}`);

    // Allow searches starting from 1 character
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const searchTerm = q.trim();
    const friendIds = currentUser.getAcceptedFriends();
    const pendingRequestIds = currentUser.getSentRequests().map(req => req.user.toString());
    const receivedRequestIds = currentUser.getPendingRequests().map(req => req.user.toString());
    
    console.log(`📊 User has ${friendIds.length} friends, ${pendingRequestIds.length} sent requests, ${receivedRequestIds.length} received requests`);

    // Enhanced search algorithm with multiple tiers
    const searchResults = [];
    
    // === TIER 1: FRIENDS SEARCH (Always included) ===
    if (friendIds.length > 0) {
      const friendsQuery = {
        _id: { $in: friendIds },
        $or: [
          // Exact starts-with matches (highest priority)
          { username: { $regex: `^${escapeRegex(searchTerm)}`, $options: 'i' } },
          { displayName: { $regex: `^${escapeRegex(searchTerm)}`, $options: 'i' } },
          { fullName: { $regex: `^${escapeRegex(searchTerm)}`, $options: 'i' } },
          
          // Word boundary matches
          { username: { $regex: `\\b${escapeRegex(searchTerm)}`, $options: 'i' } },
          { displayName: { $regex: `\\b${escapeRegex(searchTerm)}`, $options: 'i' } },
          { fullName: { $regex: `\\b${escapeRegex(searchTerm)}`, $options: 'i' } },
          
          // Contains matches (lower priority)
          { username: { $regex: escapeRegex(searchTerm), $options: 'i' } },
          { displayName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
          { fullName: { $regex: escapeRegex(searchTerm), $options: 'i' } }
        ]
      };

      const friends = await User.find(friendsQuery)
        .select('username displayName fullName profilePicture bio')
        .limit(parseInt(limit))
        .lean();

      // Add friend status and prioritization score
      friends.forEach(friend => {
        friend.relationshipStatus = 'friends';
        friend.priorityReason = 'Your friend';
        friend.priorityScore = calculatePriorityScore(friend, searchTerm, 'friend');
        friend.canAddFriend = false;
        searchResults.push(friend);
      });
    }

    // === TIER 2: NON-FRIENDS SEARCH (When includeNonFriends=true) ===
    if (includeNonFriends === 'true') {
      const excludeIds = [
        currentUser._id.toString(),
        ...friendIds.map(id => id.toString()),
        ...pendingRequestIds,
        ...receivedRequestIds
      ];

      const nonFriendsQuery = {
        _id: { $nin: excludeIds },
        $or: [
          { username: { $regex: `^${escapeRegex(searchTerm)}`, $options: 'i' } },
          { displayName: { $regex: `^${escapeRegex(searchTerm)}`, $options: 'i' } },
          { fullName: { $regex: `^${escapeRegex(searchTerm)}`, $options: 'i' } },
          { username: { $regex: escapeRegex(searchTerm), $options: 'i' } },
          { displayName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
          { fullName: { $regex: escapeRegex(searchTerm), $options: 'i' } }
        ]
      };

      const nonFriends = await User.find(nonFriendsQuery)
        .select('username displayName fullName profilePicture bio')
        .limit(parseInt(limit) - searchResults.length)
        .lean();

      // Check for mutual friends and add metadata
      for (const user of nonFriends) {
        const targetFriends = await User.findById(user._id).then(u => u ? u.getAcceptedFriends() : []);
        const mutualFriendIds = friendIds.filter(friendId => 
          targetFriends.includes(friendId.toString())
        );

        user.relationshipStatus = 'not-friends';
        user.mutualFriendsCount = mutualFriendIds.length;
        user.priorityScore = calculatePriorityScore(user, searchTerm, 'non-friend', mutualFriendIds.length);
        user.canAddFriend = true;
        
        if (mutualFriendIds.length > 0) {
          user.priorityReason = `${mutualFriendIds.length} mutual friend${mutualFriendIds.length > 1 ? 's' : ''}`;
          
          // Get mutual friends details for display
          const mutualFriends = await User.find({
            _id: { $in: mutualFriendIds.slice(0, 3) } // Limit to 3 for performance
          }).select('username displayName').lean();
          
          user.mutualFriends = mutualFriends;
        } else {
          user.priorityReason = 'Suggested for you';
        }
        
        searchResults.push(user);
      }
    }

    // === TIER 3: PENDING REQUESTS (Show status) ===
    const pendingUsers = await User.find({
      _id: { $in: [...pendingRequestIds, ...receivedRequestIds] },
      $or: [
        { username: { $regex: escapeRegex(searchTerm), $options: 'i' } },
        { displayName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
        { fullName: { $regex: escapeRegex(searchTerm), $options: 'i' } }
      ]
    }).select('username displayName fullName profilePicture bio').lean();

    pendingUsers.forEach(user => {
      const userId = user._id.toString();
      if (pendingRequestIds.includes(userId)) {
        user.relationshipStatus = 'request-sent';
        user.priorityReason = 'Friend request sent';
        user.canAddFriend = false;
      } else if (receivedRequestIds.includes(userId)) {
        user.relationshipStatus = 'request-received';
        user.priorityReason = 'Wants to be friends';
        user.canAddFriend = false;
      }
      
      user.priorityScore = calculatePriorityScore(user, searchTerm, 'pending');
      searchResults.push(user);
    });

    // Sort by priority score (highest first) and relationship status
    const sortedResults = searchResults
      .sort((a, b) => {
        // First sort by relationship priority
        const relationshipPriority = {
          'friends': 4,
          'request-received': 3,
          'request-sent': 2,
          'not-friends': 1
        };
        
        const aPriority = relationshipPriority[a.relationshipStatus] || 0;
        const bPriority = relationshipPriority[b.relationshipStatus] || 0;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        // Then by priority score
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      })
      .slice(0, parseInt(limit));

    console.log(`✅ ENHANCED: Returning ${sortedResults.length} search results`);
    
    res.json(sortedResults);

  } catch (error) {
    console.error('❌ Enhanced search error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    });
  }
});




router.get('/event-photos/:eventId', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user._id;

    console.log(`🔍 Getting event photos for event: ${eventId}, user: ${userId}`);

    // Get event with proper population
    const event = await Event.findById(eventId)
      .populate('host', '_id username')
      .populate('attendees', '_id username');
      
    if (!event) {
      console.log(`❌ Event not found: ${eventId}`);
      return res.status(404).json({ message: 'Event not found' });
    }

    // Enhanced access control logic
    const isHost = String(event.host._id || event.host) === String(userId);
    const isAttendee = event.attendees && event.attendees.some(attendee => 
      String(attendee._id || attendee) === String(userId)
    );
    
    console.log(`🔍 Access check - isHost: ${isHost}, isAttendee: ${isAttendee}`);
    
    if (event.privacyLevel === 'public') {
  // Allow access for public events
    } else {
      // For non-public events, check attendee status
      if (!isHost && !isAttendee) {
        return res.status(403).json({ 
          message: 'Access denied - you must be attending this event to view photos' 
        });
      }
    }

    // ✅ FIXED: Query both event and taggedEvent fields for consistency
    let photoQuery = {
      $or: [
        { event: eventId },
        { taggedEvent: eventId }
      ],
      $and: [
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false }
          ]
        }
      ]
    };

    // If user is not the host, only show photos they can see
    if (!isHost) {
      photoQuery = {
        ...photoQuery,
        $and: [
          ...photoQuery.$and,
          {
            $or: [
              { user: userId }, // User's own photos
              { isPrivate: { $ne: true } }, // Public photos
              { visibleInEvent: true } // Photos marked as visible in event
            ]
          }
        ]
      };
    }

    console.log(`🔍 Photo query:`, JSON.stringify(photoQuery, null, 2));

    const photos = await Photo.find(photoQuery)
      .populate('user', 'username profilePicture')
      .populate('event', 'title time')
      .sort({ uploadDate: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // ✅ ADDED: Add like status to each photo (like the main photos endpoint)
    const photosWithLikeStatus = photos.map(photo => {
      const photoObj = photo.toObject();
      
      // Initialize likes array if it doesn't exist
      if (!photoObj.likes) {
        photoObj.likes = [];
      }
      
      // Calculate user liked status
      const userLiked = photoObj.likes.some(likeId => 
        likeId.toString() === userId.toString()
      );
      const likeCount = photoObj.likes.length;
      
      return {
        ...photoObj,
        userLiked,
        likeCount,
        commentCount: photoObj.comments ? photoObj.comments.length : 0
      };
    });

    console.log(`✅ Found ${photosWithLikeStatus.length} photos for event ${eventId}`);

    res.json({
      photos: photosWithLikeStatus, // ✅ Return photos with like status
      event: {
        _id: event._id,
        title: event.title,
        time: event.time,
        location: event.location
      },
      total: photosWithLikeStatus.length,
      hasMore: photosWithLikeStatus.length === parseInt(limit),
      canUpload: isHost || isAttendee
    });

  } catch (error) {
    console.error('❌ Get event photos error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});


module.exports = router;