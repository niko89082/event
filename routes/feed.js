// routes/feed.js - PHASE 1: Enhanced Posts Feed with Memory Photos and Privacy Controls
const express = require('express');
const Photo = require('../models/Photo');
const MemoryPhoto = require('../models/MemoryPhoto');
const Memory = require('../models/Memory');
const Event = require('../models/Event');
const User = require('../models/User');
const protect = require('../middleware/auth');

console.log('🔧 Feed route loaded with Memory Photo support');

const router = express.Router();

/* ─── scoring helper ─── */
const recencyScore = (d) => {
  const hours = (Date.now() - d.getTime()) / 3.6e6;
  return Math.exp(-hours / 24);
};

/* ─── PHASE 1: Enhanced Posts Feed with Memory Photos ─── */
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
    console.log(`  - Attending events: ${attendingEventIds.length}`);

    /* 2) Fetch regular posts from followed users --------------------------- */
    const friendPostsQuery = {
      user: { $in: followingIds },
      visibleInEvent: { $ne: false }, // Include both true and undefined
    };
    
    // Get regular posts from followed users
    const friendPosts = await Photo.find(friendPostsQuery)
      .populate('user', 'username profilePicture')
      .populate('event', 'title time location')
      .sort({ uploadDate: -1 })
      .lean();

    console.log(`📸 Found ${friendPosts.length} regular posts from followed users`);

    /* 3) 🔒 PRIVACY-CONTROLLED Memory Photos Query ------------------------- */
    
    // Find all memories where current user is a participant (creator OR participant)
    const userMemories = await Memory.find({
      $or: [
        { creator: req.user._id },
        { participants: req.user._id }
      ]
    }).select('_id creator participants');

    const userMemoryIds = userMemories.map(memory => memory._id);
    console.log(`🧠 User is participant in ${userMemoryIds.length} memories`);

    let memoryPosts = [];
    
    if (userMemoryIds.length > 0) {
      // Get memory photos ONLY from memories where user is a participant
      // AND from users they follow (to keep feed relevant)
      const memoryPhotosQuery = {
        memory: { $in: userMemoryIds }, // 🔒 PRIVACY: Only from user's memories
        uploadedBy: { $in: followingIds }, // Only from followed users
        isDeleted: false
      };

      memoryPosts = await MemoryPhoto.find(memoryPhotosQuery)
        .populate('uploadedBy', 'username profilePicture')
        .populate({
          path: 'memory',
          select: 'title participants creator',
          populate: [
            { path: 'creator', select: 'username' },
            { path: 'participants', select: 'username' }
          ]
        })
        .sort({ uploadedAt: -1 })
        .lean();

      console.log(`🔐 Found ${memoryPosts.length} memory photos (privacy-filtered)`);
    }

    /* 4) Transform memory posts to match regular post format --------------- */
    const transformedMemoryPosts = memoryPosts.map(photo => ({
      _id: photo._id,
      url: photo.url,
      caption: photo.caption || '',
      uploadDate: photo.uploadedAt, // Map uploadedAt to uploadDate for consistency
      user: photo.uploadedBy, // Map uploadedBy to user for consistency
      postType: 'memory', // 🏷️ Mark as memory post
      memoryInfo: {
        memoryId: photo.memory._id,
        memoryTitle: photo.memory.title,
        participantCount: photo.memory.participants.length + 1, // +1 for creator
        isCreator: photo.memory.creator._id.toString() === req.user._id.toString()
      },
      likeCount: photo.likeCount || 0,
      commentCount: photo.commentCount || 0,
      source: 'memory' // Distinguish source
    }));

    /* 5) Transform regular posts for consistency ---------------------------- */
    const transformedFriendPosts = friendPosts.map(post => ({
      ...post,
      postType: 'regular', // 🏷️ Mark as regular post
      source: 'friend'
    }));

    /* 6) Combine, sort, and paginate all posts ----------------------------- */
    const allPosts = [...transformedFriendPosts, ...transformedMemoryPosts]
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
      .slice(skip, skip + limit); // Apply pagination

    /* 7) Calculate totals for pagination ------------------------------------ */
    const totalRegularPosts = await Photo.countDocuments(friendPostsQuery);
    
    let totalMemoryPosts = 0;
    if (userMemoryIds.length > 0) {
      totalMemoryPosts = await MemoryPhoto.countDocuments({
        memory: { $in: userMemoryIds },
        uploadedBy: { $in: followingIds },
        isDeleted: false
      });
    }

    const totalPosts = totalRegularPosts + totalMemoryPosts;
    
    /* 8) Build response with debugging info -------------------------------- */
    const response = {
      posts: allPosts,
      page,
      totalPages: Math.ceil(totalPosts / limit),
      hasMore: skip + limit < totalPosts,
      debug: {
        regularPosts: transformedFriendPosts.length,
        memoryPosts: transformedMemoryPosts.length,
        totalPosts: allPosts.length,
        userMemoryCount: userMemoryIds.length,
        followingCount: followingIds.length
      }
    };

    console.log(`🟢 Sending feed response:`, response.debug);
    res.json(response);

  } catch (err) {
    console.error('❌ Feed posts error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

/* ─── Fallback Events Feed (unchanged) ─── */
router.get('/feed/events', protect, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;
  
  console.log(`🟡 [API] /feed/events -> user ${req.user._id} page ${page}`);

  try {
    const viewer = await User.findById(req.user._id)
      .select('following attendingEvents')
      .populate('following', '_id')
      .populate('attendingEvents', '_id');

    const followingIds = viewer.following.map(u => u._id);
    const attendingEventIds = viewer.attendingEvents.map(e => e._id);
    
    console.log(`🔍 User following: ${followingIds.length}, attending: ${attendingEventIds.length}`);

    if (followingIds.length === 0 && attendingEventIds.length === 0) {
      return res.json({
        events: [],
        page: 1,
        totalPages: 0,
        hasMore: false
      });
    }

    // Events from followed users OR events user is attending
    const eventsQuery = {
      $or: [
        { host: { $in: followingIds } },
        { _id: { $in: attendingEventIds } }
      ],
      time: { $gte: new Date() }
    };

    const events = await Event.find(eventsQuery)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username profilePicture')
      .sort({ time: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`🎉 Found ${events.length} events for feed`);

    const eventsWithScore = events.map(event => {
      const isAttending = attendingEventIds.some(id => id.toString() === event._id.toString());
      const isHosted = followingIds.some(id => id.toString() === event.host._id.toString());
      
      return {
        ...event,
        isAttending,
        isHosted,
        source: isAttending ? 'attending' : 'friend'
      };
    });

    const totalEvents = await Event.countDocuments(eventsQuery);
    
    const response = {
      events: eventsWithScore,
      page,
      totalPages: Math.ceil(totalEvents / limit),
      hasMore: skip + limit < totalEvents
    };

    console.log(`🟢 Sending events response: ${events.length} events`);
    res.json(response);

  } catch (err) {
    console.error('❌ Feed events error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message 
    });
  }
});

module.exports = router;