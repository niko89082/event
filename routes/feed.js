// routes/feed.js - UPDATED: Enhanced Posts Feed with Memory Photos and PROPER LIKE STATUS
const express = require('express');
const Photo = require('../models/Photo');
const MemoryPhoto = require('../models/MemoryPhoto');
const Memory = require('../models/Memory');
const Event = require('../models/Event');
const User = require('../models/User');
const protect = require('../middleware/auth');

console.log('🔧 Feed route loaded with Memory Photo support and Instagram-style likes');

const router = express.Router();

/* ─── scoring helper ─── */
const recencyScore = (d) => {
  const hours = (Date.now() - d.getTime()) / 3.6e6;
  return Math.exp(-hours / 24);
};

/* ─── UPDATED: Enhanced Posts Feed with Memory Photos and PROPER LIKE STATUS ─── */
router.get('/feed/posts', protect, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;
  const userId = req.user._id;
  
  console.log(`🟡 [API] /feed/posts -> user ${userId} page ${page}`);

  try {
    /* 1) Get viewer info ---------------------------------------------------- */
    const viewer = await User.findById(userId)
      .select('following attendingEvents')
      .populate('following', '_id')
      .populate('attendingEvents', '_id');

    const followingIds = viewer.following.map(u => u._id);
    const attendingEventIds = viewer.attendingEvents.map(e => e._id);
    
    console.log(`🔍 DEBUG INFO:`);
    console.log(`  - User ID: ${userId}`);
    console.log(`  - Following count: ${followingIds.length}`);
    console.log(`  - Attending events: ${attendingEventIds.length}`);

    /* 2) ✅ FIXED: Fetch regular posts with PROPER LIKE STATUS using aggregation */
    const friendPostsQuery = {
      user: { $in: followingIds },
      visibleInEvent: { $ne: false }, // Include both true and undefined
      $and: [
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false }
          ]
        }
      ]
    };
    
    console.log(`📸 Fetching regular posts with like status...`);
    
    // ✅ CRITICAL: Use aggregation to calculate like status properly
    const friendPosts = await Photo.aggregate([
      {
        $match: friendPostsQuery
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'event'
        }
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: false }
      },
      {
        $unwind: { path: '$event', preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          // ✅ CRITICAL: Calculate like status properly
          userLiked: {
            $cond: {
              if: { $isArray: '$likes' },
              then: { $in: [userId, '$likes'] },
              else: false
            }
          },
          likeCount: {
            $cond: {
              if: { $isArray: '$likes' },
              then: { $size: '$likes' },
              else: 0
            }
          },
          commentCount: {
            $cond: {
              if: { $isArray: '$comments' },
              then: { $size: '$comments' },
              else: 0
            }
          },
          postType: 'regular', // Mark as regular post
          source: 'friend'
        }
      },
      {
        $project: {
          _id: 1,
          paths: 1,
          caption: 1,
          uploadDate: 1,
          createdAt: 1,
          user: {
            _id: 1,
            username: 1,
            profilePicture: 1,
            fullName: 1
          },
          event: {
            _id: 1,
            title: 1,
            time: 1,
            location: 1
          },
          likes: 1, // Keep for compatibility
          comments: 1, // Keep for compatibility  
          userLiked: 1, // ✅ CRITICAL
          likeCount: 1, // ✅ CRITICAL
          commentCount: 1,
          postType: 1,
          source: 1,
          visibleInEvent: 1
        }
      },
      {
        $sort: { uploadDate: -1 }
      }
    ]);

    console.log(`📸 Found ${friendPosts.length} regular posts from followed users with like status`);

    /* 3) 🔒 PRIVACY-CONTROLLED Memory Photos Query ------------------------- */
    
    // Find all memories where current user is a participant (creator OR participant)
    const userMemories = await Memory.find({
      $or: [
        { creator: userId },
        { participants: userId }
      ]
    }).select('_id creator participants title');

    const userMemoryIds = userMemories.map(memory => memory._id);
    console.log(`🧠 User is participant in ${userMemoryIds.length} memories`);

    let memoryPosts = [];
    
    if (userMemoryIds.length > 0) {
      console.log(`📷 Fetching memory posts with like status...`);
      
      // ✅ CRITICAL: Use aggregation for memory photos with proper like status
      memoryPosts = await MemoryPhoto.aggregate([
        {
          $match: {
            memory: { $in: userMemoryIds }, // 🔒 PRIVACY: Only from user's memories
            uploadedBy: { $in: followingIds }, // Only from followed users
            isDeleted: false
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'uploadedBy',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'memories',
            localField: 'memory',
            foreignField: '_id',
            as: 'memoryData'
          }
        },
        {
          $unwind: { path: '$user', preserveNullAndEmptyArrays: false }
        },
        {
          $unwind: { path: '$memoryData', preserveNullAndEmptyArrays: false }
        },
        {
          $addFields: {
            // ✅ CRITICAL: Calculate like status for memory photos
            userLiked: {
              $cond: {
                if: { $isArray: '$likes' },
                then: { $in: [userId, '$likes'] },
                else: false
              }
            },
            likeCount: {
              $cond: {
                if: { $isArray: '$likes' },
                then: { $size: '$likes' },
                else: 0
              }
            },
            commentCount: {
              $cond: {
                if: { $isArray: '$comments' },
                then: { $size: '$comments' },
                else: 0
              }
            },
            postType: 'memory', // Mark as memory post
            source: 'memory',
            uploadDate: '$uploadedAt', // Map for consistency
            memoryInfo: {
              memoryId: '$memoryData._id',
              memoryTitle: '$memoryData.title',
              participantCount: { $add: [{ $size: '$memoryData.participants' }, 1] }, // +1 for creator
              isCreator: { $eq: ['$memoryData.creator', userId] }
            }
          }
        },
        {
          $project: {
            _id: 1,
            url: 1,
            caption: 1,
            uploadDate: 1,
            uploadedAt: 1,
            user: {
              _id: 1,
              username: 1,
              profilePicture: 1,
              fullName: 1
            },
            likes: 1, // Keep for compatibility
            comments: 1, // Keep for compatibility
            userLiked: 1, // ✅ CRITICAL
            likeCount: 1, // ✅ CRITICAL
            commentCount: 1,
            postType: 1,
            source: 1,
            memoryInfo: 1
          }
        },
        {
          $sort: { uploadedAt: -1 }
        }
      ]);

      console.log(`🔐 Found ${memoryPosts.length} memory photos (privacy-filtered) with like status`);
    }

    /* 4) ✅ ENHANCED: Combine and validate all posts with like status ------- */
    const allPosts = [...friendPosts, ...memoryPosts];
    
    // ✅ VALIDATION: Ensure all posts have required like fields
    const validatedPosts = allPosts.map(post => ({
      ...post,
      userLiked: Boolean(post.userLiked), // Ensure boolean
      likeCount: Number(post.likeCount) || 0, // Ensure number
      commentCount: Number(post.commentCount) || 0 // Ensure number
    }));

    // Sort by upload date (newest first)
    validatedPosts.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    // Apply pagination
    const paginatedPosts = validatedPosts.slice(skip, skip + limit);

    /* 5) Calculate totals for pagination ------------------------------------ */
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
    const hasMore = validatedPosts.length > skip + limit;
    
    /* 6) ✅ ENHANCED: Build response with like status debugging ------------- */
    const response = {
      posts: paginatedPosts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts: totalPosts,
        hasMore: hasMore,
        limit: limit
      },
      debug: {
        regularPosts: friendPosts.length,
        memoryPosts: memoryPosts.length,
        totalPosts: validatedPosts.length,
        paginatedCount: paginatedPosts.length,
        userMemoryCount: userMemoryIds.length,
        followingCount: followingIds.length,
        postsWithUserLikes: paginatedPosts.filter(p => p.userLiked).length,
        likeStatusValidation: {
          allHaveUserLiked: paginatedPosts.every(p => typeof p.userLiked === 'boolean'),
          allHaveLikeCount: paginatedPosts.every(p => typeof p.likeCount === 'number')
        }
      }
    };

    console.log(`🟢 Sending feed response:`, {
      totalPosts: response.debug.totalPosts,
      paginatedPosts: response.debug.paginatedCount,
      postsWithLikes: response.debug.postsWithUserLikes,
      likeValidation: response.debug.likeStatusValidation
    });
    
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
  const { type = 'discover' } = req.query; // Support different feed types
  
  console.log(`🟡 [API] /feed/events -> user ${req.user._id} page ${page} type ${type}`);

  try {
    const viewer = await User.findById(req.user._id)
      .select('following attendingEvents')
      .populate('following', '_id')
      .populate('attendingEvents', '_id');

    const followingIds = viewer.following.map(u => u._id);
    const attendingEventIds = viewer.attendingEvents.map(e => e._id);
    
    console.log(`🔍 User following: ${followingIds.length}, attending: ${attendingEventIds.length}`);

    let eventsQuery = {};
    
    // Different queries based on feed type
    switch (type) {
      case 'following':
        if (followingIds.length === 0) {
          return res.json({
            events: [],
            page: 1,
            totalPages: 0,
            hasMore: false
          });
        }
        
        // Events from followed users only
        eventsQuery = {
          host: { $in: followingIds },
          time: { $gte: new Date() }, // Only future events
          $or: [
            { privacyLevel: 'public' },
            { privacyLevel: 'friends' },
            { 
              privacyLevel: 'private',
              $or: [
                { invitedUsers: req.user._id },
                { attendees: req.user._id }
              ]
            }
          ]
        };
        break;
        
      case 'discover':
      default:
        // Mix of public events, events from followed users, and events user is attending
        eventsQuery = {
          time: { $gte: new Date() }, // Only future events
          $or: [
            { privacyLevel: 'public' }, // All public events
            { 
              privacyLevel: 'friends',
              host: { $in: followingIds } // Friends events from followed users
            },
            { 
              privacyLevel: 'private',
              $or: [
                { invitedUsers: req.user._id },
                { attendees: req.user._id }
              ]
            },
            { _id: { $in: attendingEventIds } } // Events user is attending
          ]
        };
        break;
    }

    console.log(`🔍 Events query for type ${type}:`, JSON.stringify(eventsQuery, null, 2));

    const events = await Event.find(eventsQuery)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username profilePicture')
      .sort({ createdAt: -1 }) // Newest first for discovery, or use { time: 1 } for chronological
      .skip(skip)
      .limit(limit + 1) // Fetch one extra to check if there are more
      .lean();

    // Check if there are more events
    const hasMoreEvents = events.length > limit;
    const eventsToReturn = hasMoreEvents ? events.slice(0, limit) : events;

    console.log(`🎉 Found ${eventsToReturn.length} events for ${type} feed`);

    // Enhance events with user context
    const eventsWithContext = eventsToReturn.map(event => {
      const isAttending = attendingEventIds.some(id => id.toString() === event._id.toString());
      const isHosted = followingIds.some(id => id.toString() === event.host._id.toString());
      const isHost = event.host._id.toString() === req.user._id.toString();
      
      return {
        ...event,
        isAttending,
        isHosted,
        isHost,
        attendeeCount: event.attendees ? event.attendees.length : 0,
        source: isAttending ? 'attending' : (isHosted ? 'friend' : 'discover'),
        // Add recommendation reason for discover feed
        ...(type === 'discover' && {
          recommendationReason: generateEventRecommendationReason(event, req.user._id, isHosted, isAttending)
        })
      };
    });

    // Get total count for pagination (optional, can be expensive for large datasets)
    const totalEvents = await Event.countDocuments(eventsQuery);
    
    const response = {
      events: eventsWithContext,
      page,
      totalPages: Math.ceil(totalEvents / limit),
      hasMore: hasMoreEvents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalEvents / limit),
        totalEvents: totalEvents,
        hasMore: hasMoreEvents,
        limit: limit
      },
      debug: {
        type: type,
        followingCount: followingIds.length,
        attendingCount: attendingEventIds.length,
        foundEvents: eventsToReturn.length,
        userId: req.user._id
      }
    };

    console.log(`🟢 Sending events response: ${eventsToReturn.length} events, hasMore: ${hasMoreEvents}`);
    res.json(response);

  } catch (err) {
    console.error('❌ Feed events error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Helper function to generate event recommendation reasons
function generateEventRecommendationReason(event, userId, isHosted, isAttending) {
  if (isAttending) return 'You\'re attending';
  if (isHosted) return 'From someone you follow';
  
  const reasons = [
    'Popular in your area',
    'Trending now',
    'Based on your interests',
    'New event near you',
    'Similar to events you\'ve attended',
    'Happening soon'
  ];
  
  return reasons[Math.floor(Math.random() * reasons.length)];
}

module.exports = router;