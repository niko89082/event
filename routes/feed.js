// routes/feed.js - ENHANCED: Fixed posts feed with fallback content and debugging
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

/* ─── Enhanced Posts Feed (FIXED) ─── */
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
    
    console.log(`🔍 DEBUG INFO:`);
    console.log(`  - User ID: ${req.user._id}`);
    console.log(`  - Following count: ${followingIds.length}`);
    console.log(`  - Following IDs: ${followingIds.slice(0, 5)}${followingIds.length > 5 ? '...' : ''}`);
    console.log(`  - Attending events: ${attendingEventIds.length}`);

    /* 2) Fetch posts from TWO sources -------------------------------------- */
    
    // Source 1: Posts from users you follow
    const friendPostsQuery = {
      user: { $in: followingIds },
      visibleInEvent: { $ne: false }, // Include both true and undefined
    };
    
    // Source 2: PUBLIC posts from other attendees of events you attended
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

    // Debug what we found
    console.log(`🔍 POSTS FOUND:`);
    console.log(`  - Friend posts: ${friendPosts.length}`);
    console.log(`  - Event attendee posts: ${eventAttendeePosts.length}`);
    
    // Check total posts from friends in DB for debugging
    if (followingIds.length > 0) {
      const totalFriendPostsInDB = await Photo.countDocuments({
        user: { $in: followingIds }
      });
      console.log(`  - Total posts from friends in DB: ${totalFriendPostsInDB}`);
    }

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

    /* 4) FALLBACK: If no posts from friends/events, show trending content ---- */
    if (allPosts.length === 0) {
      console.log(`🟡 No friend posts found, fetching fallback content...`);
      
      // Fallback to popular recent posts from last 7 days
      const fallbackPosts = await Photo.find({
        visibleInEvent: { $ne: false },
        uploadDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        user: { $ne: req.user._id } // Don't show user's own posts
      })
      .populate('user', 'username profilePicture')
      .populate('event', 'title time location')
      .sort({ likes: -1, uploadDate: -1 })
      .limit(limit)
      .lean();
      
      console.log(`🟡 Fallback posts found: ${fallbackPosts.length}`);
      
      const fallbackWithSource = fallbackPosts.map(post => {
        const recency = recencyScore(post.uploadDate);
        const engagement = Math.log10((post.likes?.length || 0) + (post.comments?.length || 0) + 1);
        const score = recency * 0.3 + engagement * 0.7; // Favor engagement for trending
        
        return {
          ...post,
          source: 'trending',
          score
        };
      });
      
      allPosts.push(...fallbackWithSource);
    }

    /* 5) Sort and paginate -------------------------------------------------- */
    allPosts.sort((a, b) => b.score - a.score);
    const totalPosts = allPosts.length;
    const paginatedPosts = allPosts.slice(skip, skip + limit);

    console.log(`🟢 Sending posts: ${paginatedPosts.length} (total: ${totalPosts})`);
    
    return res.json({
      posts: paginatedPosts,
      page,
      totalPages: Math.ceil(totalPosts / limit),
      hasMore: skip + limit < totalPosts,
      debug: {
        friendsCount: followingIds.length,
        friendPosts: friendPosts.length,
        eventPosts: eventAttendeePosts.length,
        fallbackUsed: friendPosts.length + eventAttendeePosts.length === 0,
        totalInFeed: totalPosts
      }
    });

  } catch (err) {
    console.error('❌ /feed/posts error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ─── Following Events Feed (EXISTING) ─── */
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