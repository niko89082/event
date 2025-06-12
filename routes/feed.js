// routes/feed.js - Enhanced posts feed endpoint
const express = require('express');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

/* ─── scoring helper ─── */
const recencyScore = (d) => {
  const hours = (Date.now() - d.getTime()) / 3.6e6;
  return Math.exp(-hours / 24); // Adjusted for posts vs events
};

/* ─── Enhanced Posts Feed (NEW) ─── */
router.get('/feed/posts', protect, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;
  
  console.log(`🟡 [API] /feed/posts -> user ${req.user._id} page ${page}`);

  try {
    /* 1) Get viewer info ---------------------------------------------------- */
    const viewer = await User.findById(req.user._id)
      .select('following attendingEvents')
      .populate('following', '_id')
      .populate('attendingEvents', '_id');

    const followingIds = viewer.following.map(u => u._id);
    const attendingEventIds = viewer.attendingEvents.map(e => e._id);
    
    console.log(`🟡   following ${followingIds.length}   attending events ${attendingEventIds.length}`);

    /* 2) Fetch posts from TWO sources -------------------------------------- */
    
    // Source 1: Posts from users you follow
    const friendPostsQuery = {
      user: { $in: followingIds },
      visibleInEvent: { $ne: false }, // Include both true and undefined
    };
    
    // Source 2: PUBLIC posts from other attendees of events you attended
    // First get all attendees from events you attended
    const eventAttendeesQuery = attendingEventIds.length > 0 ? await Event.find({
      _id: { $in: attendingEventIds }
    }).select('attendees') : [];
    
    const eventAttendeeIds = eventAttendeesQuery.reduce((acc, event) => {
      event.attendees.forEach(attendeeId => {
        if (!acc.includes(attendeeId) && !followingIds.includes(attendeeId) && String(attendeeId) !== String(req.user._id)) {
          acc.push(attendeeId);
        }
      });
      return acc;
    }, []);

    const eventAttendeePostsQuery = eventAttendeeIds.length > 0 ? {
      user: { $in: eventAttendeeIds },
      event: { $in: attendingEventIds },
      visibleInEvent: true, // Only public event posts
    } : null;

    // Execute queries
    const [friendPosts, eventAttendeePosts] = await Promise.all([
      Photo.find(friendPostsQuery)
        .populate('user', 'username profilePicture')
        .populate('event', 'title time location')
        .sort({ uploadDate: -1 })
        .lean(),
      
      eventAttendeePostsQuery ? Photo.find(eventAttendeePostsQuery)
        .populate('user', 'username profilePicture')
        .populate('event', 'title time location')
        .sort({ uploadDate: -1 })
        .lean() : []
    ]);

    console.log('🟡   friendPosts', friendPosts.length, 'eventAttendeePosts', eventAttendeePosts.length);

    /* 3) Score and merge posts ---------------------------------------------- */
    const allPosts = [];
    
    // Add friend posts with source
    friendPosts.forEach(post => {
      const recency = recencyScore(post.uploadDate);
      const engagement = Math.log10((post.likes?.length || 0) + (post.comments?.length || 0) + 1);
      const score = recency * 0.7 + engagement * 0.3;
      
      allPosts.push({
        ...post,
        source: 'friend',
        score
      });
    });

    // Add event attendee posts with source
    eventAttendeePosts.forEach(post => {
      const recency = recencyScore(post.uploadDate);
      const engagement = Math.log10((post.likes?.length || 0) + (post.comments?.length || 0) + 1);
      const score = recency * 0.7 + engagement * 0.3;
      
      allPosts.push({
        ...post,
        source: 'event_attendee',
        score
      });
    });

    /* 4) Sort and paginate -------------------------------------------------- */
    allPosts.sort((a, b) => b.score - a.score);
    const totalPosts = allPosts.length;
    const paginatedPosts = allPosts.slice(skip, skip + limit);

    console.log('🟢  sending posts len', paginatedPosts.length);
    
    return res.json({
      posts: paginatedPosts,
      page,
      totalPages: Math.ceil(totalPosts / limit),
      hasMore: skip + limit < totalPosts
    });

  } catch (err) {
    console.error('❌  /feed/posts error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ─── Following Events Feed (NEW) ─── */
router.get('/events/following-events', protect, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;

  try {
    const viewer = await User.findById(req.user._id)
      .select('following')
      .populate('following', '_id');

    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingIds = viewer.following.map(u => u._id);

    if (followingIds.length === 0) {
      return res.json({
        events: [],
        page,
        totalPages: 0,
        hasMore: false
      });
    }

    // Get future events from people you follow
    const query = {
      host: { $in: followingIds },
      time: { $gte: new Date() },
      $or: [
        { privacyLevel: 'public', 'permissions.appearInSearch': true },
        { privacyLevel: 'friends' },
        { isPublic: true } // Fallback for older events without privacy system
      ]
    };

    const events = await Event.find(query)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username')
      .sort({ time: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalEvents = await Event.countDocuments(query);

    res.json({
      events,
      page,
      totalPages: Math.ceil(totalEvents / limit),
      hasMore: skip + limit < totalEvents
    });

  } catch (err) {
    console.error('Following events error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;