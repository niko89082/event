// routes/feed.js - COMPLETE: Activity Feed + Events Feed with Privacy Controls
const express = require('express');
const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const MemoryPhoto = require('../models/MemoryPhoto');
const Memory = require('../models/Memory');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');
const { PRIVACY_LEVELS } = require('../constants/privacyConstants');

console.log('🔧 COMPLETE: Activity Feed + Events Feed route loaded with Privacy Controls');

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY TYPE CONFIGURATION
══════════════════════════════════════════════════════════════════ */

const ACTIVITY_TYPES = {
  // ✅ POST TYPES: For both feeds
  'regular_post': { 
    priority: 'high', 
    weight: 2.0,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  'text_post': { 
    priority: 'high', 
    weight: 2.0,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  'review_post': { 
    priority: 'high', 
    weight: 2.2, // Reviews get slightly higher weight
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  
  // ✅ ACTIVITY TYPES: For Activity feed only (friend-based interactions)
  'event_invitation': { 
    priority: 'high', 
    weight: 2.0,
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
  },
  'friend_event_join': { 
    priority: 'medium', 
    weight: 1.1,
    maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
  },
  'event_created': { 
    priority: 'medium', 
    weight: 1.3,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  'photo_comment': { 
    priority: 'medium',
    weight: 1.2,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  'friend_cohost_added': { 
    priority: 'medium', 
    weight: 1.3,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
  
  // ❌ REMOVED: event_reminder (notifications only)
  // ❌ REMOVED: memory_post, memory_created, memory_photo_upload, memory_photo_comment (not in initial release)
};


const fetchPhotoComments = async (userId, followingIds, timeRange) => {
  console.log('💬 Fetching regular photo comments...');
  console.log('📅 Time range:', { start: timeRange.start, end: timeRange.end });
  console.log('👥 Following IDs count:', followingIds.length);
  
  try {
    const photoComments = await Photo.aggregate([
      // Add time range filtering first
      {
        $match: {
          'comments.createdAt': {
            $gte: timeRange.start,
            $lte: timeRange.end
          },
          // Don't filter out deleted photos here - let later stages handle it
        }
      },
      // Unwind comments to work with individual comments
      {
        $unwind: { path: '$comments', preserveNullAndEmptyArrays: false }
      },
      // Filter by time range again after unwinding
      {
        $match: {
          'comments.createdAt': {
            $gte: timeRange.start,
            $lte: timeRange.end
          }
        }
      },
      // Get photo owner info
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'photoOwner'
        }
      },
      {
        $unwind: { path: '$photoOwner', preserveNullAndEmptyArrays: false }
      },
      // Get commenter info
      {
        $lookup: {
          from: 'users',
          localField: 'comments.user',
          foreignField: '_id',
          as: 'commenter'
        }
      },
      {
        $unwind: { path: '$commenter', preserveNullAndEmptyArrays: false }
      },
      // ✅ FIXED: Improved visibility logic - REMOVED user's own comments
      {
        $match: {
          $or: [
            // Show comments on your own photos (from anyone)
            { 'photoOwner._id': userId },
            // Show comments from users you follow (on any photo you can see)
            { 'commenter._id': { $in: followingIds } }
            // ❌ REMOVED: Show your own comments (this was causing the issue)
            // { 'comments.user': userId }
          ]
        }
      },
      {
        $project: {
          photoId: '$_id',
          photoUrl: { $arrayElemAt: ['$paths', 0] },
          photoCaption: '$caption',
          photoOwner: {
            _id: '$photoOwner._id',
            username: '$photoOwner.username',
            fullName: '$photoOwner.fullName',
            profilePicture: '$photoOwner.profilePicture'
          },
          comment: {
            _id: '$comments._id',
            text: '$comments.text',
            createdAt: '$comments.createdAt'
          },
          commenter: {
            _id: '$commenter._id',
            username: '$commenter.username',
            fullName: '$commenter.fullName',
            profilePicture: '$commenter.profilePicture'
          }
        }
      },
      {
        $sort: { 'comment.createdAt': -1 }
      },
      {
        $limit: 50
      }
    ]);

    console.log(`💬 Found ${photoComments.length} regular photo comments`);

    // Transform to activity format
    return photoComments.map(comment => ({
      _id: `photo_comment_${comment.comment._id}`,
      activityType: 'photo_comment',
      timestamp: comment.comment.createdAt,
      data: {
        comment: comment.comment,
        photo: {
          _id: comment.photoId,
          url: comment.photoUrl,
          caption: comment.photoCaption
        },
        commenter: comment.commenter,
        photoOwner: comment.photoOwner
      },
      metadata: {
        actionable: true, // Users can view the photo/comment
        grouped: false,
        priority: 'medium'
      },
      score: calculateActivityScore(comment.comment, 'photo_comment', userId)
    }));
    
  } catch (error) {
    console.error('❌ Error fetching photo comments:', error);
    return [];
  }
};

// ✅ FIXED: Memory photo comments with proper time filtering and friend logic
// ✅ FIX 2: Memory photo comments based on participation, not friendship
const fetchMemoryPhotoComments = async (userId, followingIds, timeRange) => {
  console.log('💬 Fetching memory photo comments...');
  console.log('📅 Time range:', { start: timeRange.start, end: timeRange.end });
  
  try {
    // ✅ STEP 1: Get memories user participates in (creator or participant)
    const userMemories = await Memory.find({
      $or: [
        { creator: userId },
        { participants: userId }
      ]
    }).select('_id creator participants title');

    const userMemoryIds = userMemories.map(memory => memory._id);
    console.log(`🧠 User participates in ${userMemoryIds.length} memories`);

    if (userMemoryIds.length === 0) {
      console.log('💬 No accessible memories found for user');
      return [];
    }

    // ✅ STEP 2: Get all participants from these memories (not just friends)
    const memoryParticipantIds = new Set();
    userMemories.forEach(memory => {
      // Add creator
      memoryParticipantIds.add(String(memory.creator));
      // Add all participants
      if (memory.participants && Array.isArray(memory.participants)) {
        memory.participants.forEach(participantId => {
          memoryParticipantIds.add(String(participantId));
        });
      }
    });
    
    // Convert to ObjectIds for MongoDB aggregation
    const memoryParticipantObjectIds = Array.from(memoryParticipantIds)
      .map(id => new mongoose.Types.ObjectId(id));

    console.log(`👥 Found ${memoryParticipantIds.size} total memory participants (including user)`);

    // ✅ STEP 3: Fetch memory photo comments from memory participants
    const memoryPhotoComments = await MemoryPhoto.aggregate([
      // Filter by time range and accessible memories
      {
        $match: {
          memory: { $in: userMemoryIds }, // Only from memories user can access
          'comments.createdAt': {
            $gte: timeRange.start,
            $lte: timeRange.end
          },
          isDeleted: false
        }
      },
      // Unwind comments to work with individual comments
      {
        $unwind: { path: '$comments', preserveNullAndEmptyArrays: false }
      },
      // Filter by time range again after unwinding
      {
        $match: {
          'comments.createdAt': {
            $gte: timeRange.start,
            $lte: timeRange.end
          }
        }
      },
      // Get memory info
      {
        $lookup: {
          from: 'memories',
          localField: 'memory',
          foreignField: '_id',
          as: 'memoryData'
        }
      },
      {
        $unwind: { path: '$memoryData', preserveNullAndEmptyArrays: false }
      },
      // Get photo uploader info
      {
        $lookup: {
          from: 'users',
          localField: 'uploadedBy',
          foreignField: '_id',
          as: 'photoUploader'
        }
      },
      {
        $unwind: { path: '$photoUploader', preserveNullAndEmptyArrays: false }
      },
      // Get commenter info
      {
        $lookup: {
          from: 'users',
          localField: 'comments.user',
          foreignField: '_id',
          as: 'commenter'
        }
      },
      {
        $unwind: { path: '$commenter', preserveNullAndEmptyArrays: false }
      },
      // ✅ FIXED: Show comments from memory participants, not just friends
      // AND exclude user's own comments
      {
        $match: {
          $and: [
            // Show comments from memory participants (including uploader comments on others' photos)
            {
              $or: [
                // Comments on photos uploaded by user (from any memory participant)
                { 'uploadedBy': userId },
                // Comments from memory participants (on any photo in shared memories)
                { 'commenter._id': { $in: memoryParticipantObjectIds } }
              ]
            },
            // ✅ EXCLUDE user's own comments (this was missing before)
            { 'comments.user': { $ne: userId } }
          ]
        }
      },
      {
        $project: {
          photoId: '$_id',
          photoUrl: '$url',
          photoCaption: '$caption',
          photoUploader: {
            _id: '$photoUploader._id',
            username: '$photoUploader.username',
            fullName: '$photoUploader.fullName',
            profilePicture: '$photoUploader.profilePicture'
          },
          memory: {
            _id: '$memoryData._id',
            title: '$memoryData.title'
          },
          comment: {
            _id: '$comments._id',
            text: '$comments.text',
            createdAt: '$comments.createdAt'
          },
          commenter: {
            _id: '$commenter._id',
            username: '$commenter.username',
            fullName: '$commenter.fullName',
            profilePicture: '$commenter.profilePicture'
          }
        }
      },
      {
        $sort: { 'comment.createdAt': -1 }
      },
      {
        $limit: 50
      }
    ]);

    console.log(`💬 Found ${memoryPhotoComments.length} memory photo comments from participants`);

    // Transform to activity format
    return memoryPhotoComments.map(comment => ({
      _id: `memory_photo_comment_${comment.comment._id}`,
      activityType: 'memory_photo_comment',
      timestamp: comment.comment.createdAt,
      data: {
        comment: comment.comment,
        photo: {
          _id: comment.photoId,
          url: comment.photoUrl,
          caption: comment.photoCaption
        },
        memory: comment.memory,
        commenter: comment.commenter,
        photoUploader: comment.photoUploader
      },
      metadata: {
        actionable: true, // Users can view the photo/comment
        grouped: false,
        priority: 'medium'
      },
      score: calculateActivityScore(comment.comment, 'memory_photo_comment', userId)
    }));
    
  } catch (error) {
    console.error('❌ Error fetching memory photo comments:', error);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════════
   EXISTING FUNCTIONS (keeping for context)
══════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY SCORING SYSTEM
══════════════════════════════════════════════════════════════════ */








const calculateActivityScore = (activity, activityType, userId) => {
  const config = ACTIVITY_TYPES[activityType];
  if (!config) {
    console.warn(`⚠️ Unknown activity type: ${activityType}`);
    return 0;
  }

  const now = Date.now();
  const activityTime = new Date(activity.timestamp || activity.createdAt || activity.uploadDate).getTime();
  const ageHours = (now - activityTime) / (1000 * 60 * 60);
  
  // ✅ FIXED: Prevent negative scores
  if (ageHours < 0) {
    console.warn(`⚠️ Activity from future detected: ${activityType}`);
    return 0;
  }
  
  // Base recency score (exponential decay)
  const recencyScore = Math.exp(-ageHours / 24);
  
  // Priority multiplier
  const priorityMultiplier = {
    'high': 2.0,
    'medium': 1.0,
    'low': 0.5
  }[config.priority] || 1.0;
  
  // Engagement score (likes, comments, etc.)
  let engagementScore = 1.0;
  if (activity.likeCount) {
    engagementScore += Math.log(activity.likeCount + 1) * 0.1;
  }
  if (activity.commentCount) {
    engagementScore += Math.log(activity.commentCount + 1) * 0.2;
  }
  
  const finalScore = recencyScore * priorityMultiplier * engagementScore * config.weight;
  
  return Math.max(0, finalScore); // ✅ FIXED: Ensure non-negative scores
};

const calculateEngagementScore = (activity) => {
  const likes = activity.likeCount || activity.likes?.length || 0;
  const comments = activity.commentCount || activity.comments?.length || 0;
  const attendees = activity.attendees?.length || 0;
  
  return 1 + Math.log(1 + likes * 0.1 + comments * 0.2 + attendees * 0.05);
};

const calculateRelationshipScore = (activity, userId) => {
  // Higher score for closer relationships
  const user = activity.user || activity.sender || activity.host;
  if (!user) return 1;
  
  if (String(user._id) === String(userId)) return 1.5; // Own content
  // In real implementation, you'd check friend closeness, interaction frequency, etc.
  return 1;
};

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY FETCHERS WITH COMPLETE PRIVACY FILTERING
══════════════════════════════════════════════════════════════════ */

// ✅ NEW: Fetch posts from ALL users for "For You" feed (not just followed)
const fetchForYouPosts = async (userId, timeRange) => {
  console.log('🌟 Fetching For You posts from all users...');
  
  const posts = await Photo.aggregate([
    {
      $match: {
        // Get posts from ALL users including own posts
        $or: [
          { uploadDate: { $gte: timeRange.start } },
          { createdAt: { $gte: timeRange.start } }
        ],
        $and: [
          {
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false }
            ]
          },
          {
            $or: [
              { postType: { $in: ['photo', 'text'] } },
              { postType: { $exists: false } },
              { postType: null },
              { isRepost: true } // Include reposts
            ]
          }
        ]
      }
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
    // ✅ NEW: Lookup original post for reposts
    {
      $lookup: {
        from: 'photos',
        localField: 'originalPost',
        foreignField: '_id',
        as: 'originalPost'
      }
    },
    {
      $unwind: { path: '$user', preserveNullAndEmptyArrays: false }
    },
    {
      $unwind: { path: '$event', preserveNullAndEmptyArrays: true }
    },
    {
      $unwind: { path: '$originalPost', preserveNullAndEmptyArrays: true }
    },
    // ✅ NEW: Populate original post user
    {
      $lookup: {
        from: 'users',
        localField: 'originalPost.user',
        foreignField: '_id',
        as: 'originalPostUser'
      }
    },
    {
      $unwind: { path: '$originalPostUser', preserveNullAndEmptyArrays: true }
    },
    {
      $addFields: {
        'originalPost.user': '$originalPostUser'
      }
    },
    {
      $match: {
        // ✅ FOR YOU FEED: Only show public posts (no followers-only)
        // ✅ NEW: Filter out reposts of deleted posts
        $and: [
          {
            $or: [
              // Posts not associated with any event (personal posts - all visible)
              { event: { $exists: false } },
              { event: null },
              // Only posts from public events
              { 'event.privacyLevel': 'public' }
              // Private and followers-only event posts excluded from For You feed
            ]
          },
          {
            $or: [
              { isRepost: { $ne: true } }, // Not a repost
              { 
                isRepost: true,
                'originalPost.isDeleted': { $ne: true }, // Repost of non-deleted post
                'originalPost': { $exists: true, $ne: null } // Original post exists
              }
            ]
          }
        ]
      }
    },
    {
      $addFields: {
        // ✅ CRITICAL: Calculate like status for regular posts
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
        // ✅ NEW: For reposts, use original post's engagement metrics
        repostCount: {
          $cond: {
            if: { $eq: ['$isRepost', true] },
            then: { $ifNull: ['$originalPost.repostCount', 0] },
            else: { $ifNull: ['$repostCount', 0] }
          }
        }
      }
    },
    {
      $addFields: {
        sortDate: { $ifNull: ['$createdAt', '$uploadDate'] }
      }
    },
    { $sort: { sortDate: -1 } },
    { $limit: 100 } // Get more posts for For You feed (algorithmic selection)
  ]);

  console.log(`🌟 For You feed: Found ${posts.length} posts from all users (public only)`);

  return posts.map(post => {
    // Determine activity type based on post type
    let activityType = 'regular_post';
    if (post.postType === 'text') {
      activityType = 'text_post';
    } else if (post.review && post.review.type) {
      activityType = 'review_post';
    }
    
    return {
      ...post,
      activityType: activityType,
      timestamp: post.createdAt || post.uploadDate,
      score: calculateActivityScore(post, activityType, userId)
    };
  });
};

// ✅ UPDATED: Fetch posts from FOLLOWED users only (for Activity feed)
const fetchRegularPosts = async (userId, followingIds, timeRange) => {
  console.log('📸 Fetching regular posts from followed users...');
  
  const posts = await Photo.aggregate([
    {
      $match: {
        user: { $in: followingIds },
        $or: [
          { uploadDate: { $gte: timeRange.start } },
          { createdAt: { $gte: timeRange.start } }
        ],
        $and: [
          {
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false }
            ]
          },
          {
            $or: [
              { postType: { $in: ['photo', 'text'] } },
              { postType: { $exists: false } },
              { postType: null },
              { isRepost: true } // Include reposts
            ]
          }
        ]
      }
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
    // ✅ NEW: Lookup original post for reposts
    {
      $lookup: {
        from: 'photos',
        localField: 'originalPost',
        foreignField: '_id',
        as: 'originalPost'
      }
    },
    {
      $unwind: { path: '$user', preserveNullAndEmptyArrays: false }
    },
    {
      $unwind: { path: '$event', preserveNullAndEmptyArrays: true }
    },
    {
      $unwind: { path: '$originalPost', preserveNullAndEmptyArrays: true }
    },
    // ✅ NEW: Populate original post user
    {
      $lookup: {
        from: 'users',
        localField: 'originalPost.user',
        foreignField: '_id',
        as: 'originalPostUser'
      }
    },
    {
      $unwind: { path: '$originalPostUser', preserveNullAndEmptyArrays: true }
    },
    {
      $addFields: {
        'originalPost.user': '$originalPostUser'
      }
    },
    {
      $match: {
        // ✅ CRITICAL PRIVACY FILTER: Exclude photos from private events
        // ✅ NEW: Filter out reposts of deleted posts
        $and: [
          {
            $or: [
              // Posts not associated with any event (personal posts)
              { event: { $exists: false } },
              { event: null },
              // Posts from public events
              { 'event.privacyLevel': 'public' },
              // Posts from followers-only events where user follows the host
              { 
                'event.privacyLevel': 'followers',
                'event.host': { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) }
              }
              // Private event posts completely excluded
            ]
          },
          {
            $or: [
              { isRepost: { $ne: true } }, // Not a repost
              { 
                isRepost: true,
                'originalPost.isDeleted': { $ne: true }, // Repost of non-deleted post
                'originalPost': { $exists: true, $ne: null } // Original post exists
              }
            ]
          }
        ]
      }
    },
    {
      $addFields: {
        // ✅ CRITICAL: Calculate like status for regular posts
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
        // ✅ NEW: For reposts, use original post's engagement metrics
        repostCount: {
          $cond: {
            if: { $eq: ['$isRepost', true] },
            then: { $ifNull: ['$originalPost.repostCount', 0] },
            else: { $ifNull: ['$repostCount', 0] }
          }
        }
      }
    },
    {
      $addFields: {
        sortDate: { $ifNull: ['$createdAt', '$uploadDate'] }
      }
    },
    { $sort: { sortDate: -1 } },
    { $limit: 50 }
  ]);

  console.log(`🔒 Privacy filtered: Found ${posts.length} regular posts from followed users (private event posts excluded)`);

  return posts.map(post => {
    // Determine activity type based on post type
    let activityType = 'regular_post';
    if (post.postType === 'text') {
      activityType = 'text_post';
    } else if (post.review && post.review.type) {
      activityType = 'review_post';
    }
    
    return {
      ...post,
      activityType: activityType,
      timestamp: post.createdAt || post.uploadDate,
      score: calculateActivityScore(post, activityType, userId)
    };
  });
};





const fetchEventCreations = async (userId, followingIds, timeRange) => {
  console.log('🎉 Fetching event creations...');
  
  const events = await Event.aggregate([
    {
      $match: {
        host: { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) },
        createdAt: { $gte: timeRange.start },
        // ✅ CRITICAL PRIVACY FILTER: Only show events friends can see
        $or: [
          // Public events from friends
          { privacyLevel: 'public' },
          // Events from users you follow
          { 
            privacyLevel: 'followers',
            host: { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) }
          }
          // Private events completely excluded from activity feed
        ]
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'host',
        foreignField: '_id',
        as: 'host'
      }
    },
    {
      $unwind: { path: '$host', preserveNullAndEmptyArrays: false }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $limit: 50 // Reasonable limit
    }
  ]);

  console.log(`📅 Found ${events.length} event creations from friends`);

  return events.map(event => ({
    _id: `event_created_${event._id}`,
    activityType: 'event_created',
    timestamp: event.createdAt,
    user: event.host,
    data: {
      event: {
        _id: event._id,
        title: event.title,
        description: event.description,
        time: event.time,
        location: event.location,
        coverImage: event.coverImage,
        privacyLevel: event.privacyLevel,
        category: event.category,
        attendeeCount: event.attendees?.length || 0
      }
    },
    metadata: {
      actionable: true, // Users can view/join the event
      grouped: false,
      priority: 'medium'
    },
    score: calculateActivityScore(event, 'event_created', userId)
  }));
};

const fetchMemoryPosts = async (userId, followingIds, timeRange) => {
  console.log('🧠 Fetching memory posts...');
  
  // Get user's memories and accepted friends
  const userMemories = await Memory.find({
    $or: [
      { creator: userId },
      { participants: userId }
    ]
  }).select('_id');
  
  const userMemoryIds = userMemories.map(m => m._id);
  
  if (userMemoryIds.length === 0) return [];
  
  const memoryPosts = await MemoryPhoto.aggregate([
    {
      $match: {
        memory: { $in: userMemoryIds },
        uploadedBy: { $in: followingIds },
        uploadDate: { $gte: timeRange.start },
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
      $lookup: {
        from: 'events',
        localField: 'memoryData.event',
        foreignField: '_id',
        as: 'eventData'
      }
    },
    {
      $unwind: { path: '$user', preserveNullAndEmptyArrays: false }
    },
    {
      $unwind: { path: '$memoryData', preserveNullAndEmptyArrays: false }
    },
    {
      $unwind: { path: '$eventData', preserveNullAndEmptyArrays: true }
    },
    {
      $match: {
        // ✅ CRITICAL PRIVACY FILTER: Exclude memory photos from private events
        $or: [
          // Memories not associated with any event
          { eventData: { $exists: false } },
          { eventData: null },
          // Memories from public events
          { 'eventData.privacyLevel': 'public' },
          // Memories from followers-only events where user follows the host
          { 
            'eventData.privacyLevel': 'followers',
            'eventData.host': { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) }
          }
          // Private event memories completely excluded
        ]
      }
    },
    {
      $addFields: {
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
        }
      }
    },
    { $sort: { uploadDate: -1 } },
    { $limit: 30 }
  ]);

  console.log(`🔒 Privacy filtered: Found ${memoryPosts.length} memory posts (private event memories excluded)`);

  return memoryPosts.map(post => ({
    ...post,
    activityType: 'memory_post',
    timestamp: post.uploadDate,
    score: calculateActivityScore(post, 'memory_post', userId)
  }));
};
const fetchMemoryPhotoUploads = async (userId, followingIds, timeRange) => {
  console.log('📸 Fetching memory photo uploads...');
  
  try {
    // ✅ STEP 1: Find memories the user can see (where they're creator or participant)
    const userMemories = await Memory.find({
      $or: [
        { creator: userId },
        { participants: userId }
      ]
    }).select('_id creator participants');
    
    const userMemoryIds = userMemories.map(m => m._id);
    
    if (userMemoryIds.length === 0) {
      console.log('📸 No accessible memories found for user');
      return [];
    }
    
    console.log(`📸 User can see ${userMemoryIds.length} memories`);

    // ✅ STEP 2: Get all participants from these memories (not just friends)
    const memoryParticipantIds = new Set();
    userMemories.forEach(memory => {
      // Add creator
      memoryParticipantIds.add(String(memory.creator));
      // Add all participants
      if (memory.participants && Array.isArray(memory.participants)) {
        memory.participants.forEach(participantId => {
          memoryParticipantIds.add(String(participantId));
        });
      }
    });
    
    // Convert to ObjectIds for MongoDB aggregation (exclude current user)
    const memoryParticipantObjectIds = Array.from(memoryParticipantIds)
      .filter(id => String(id) !== String(userId)) // Don't show user their own uploads
      .map(id => new mongoose.Types.ObjectId(id));

    console.log(`👥 Found ${memoryParticipantIds.size} total memory participants`);
    console.log(`📤 Will show uploads from ${memoryParticipantObjectIds.length} other participants`);

    // ✅ STEP 3: Find memory photo uploads from memory participants (not just friends)
    const memoryPhotoUploads = await MemoryPhoto.aggregate([
      {
        $match: {
          memory: { $in: userMemoryIds }, // Only from memories user can access
          uploadedBy: { $in: memoryParticipantObjectIds }, // ✅ FIXED: From memory participants, not just friends
          uploadedAt: { $gte: timeRange.start },
          isDeleted: false
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'uploadedBy',
          foreignField: '_id',
          as: 'uploader'
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
        $unwind: { path: '$uploader', preserveNullAndEmptyArrays: false }
      },
      {
        $unwind: { path: '$memoryData', preserveNullAndEmptyArrays: false }
      },
      {
        $addFields: {
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
          }
        }
      },
      {
        $project: {
          _id: 1,
          url: 1,
          caption: 1,
          uploadedAt: 1,
          likeCount: 1,
          commentCount: 1,
          uploader: {
            _id: 1,
            username: 1,
            fullName: 1,
            profilePicture: 1
          },
          memory: {
            _id: '$memoryData._id',
            title: '$memoryData.title',
            creator: '$memoryData.creator'
          }
        }
      },
      {
        $sort: { uploadedAt: -1 }
      }
    ]);

    console.log(`📸 Found ${memoryPhotoUploads.length} memory photo uploads from participants`);

    // Transform to activity format
    return memoryPhotoUploads.map(upload => ({
      _id: `memory_photo_upload_${upload._id}`,
      activityType: 'memory_photo_upload',
      timestamp: upload.uploadedAt,
      data: {
        photo: {
          _id: upload._id,
          url: upload.url,
          caption: upload.caption,
          likeCount: upload.likeCount,
          commentCount: upload.commentCount
        },
        memory: upload.memory,
        uploader: upload.uploader
      },
      metadata: {
        actionable: true, // Users can view/like/comment on the photo
        grouped: true, // Can be grouped with other memory uploads
        priority: 'medium'
      },
      score: calculateActivityScore(upload, 'memory_photo_upload', userId)
    }));
    
  } catch (error) {
    console.error('❌ Error fetching memory photo uploads:', error);
    return [];
  }
};

const fetchEventInvitations = async (userId, timeRange) => {
  console.log('📧 Fetching event invitations for activity feed...');
  
  const invitations = await Notification.find({
    user: userId,
    type: { $in: ['event_invitation_batch'] },
    createdAt: { $gte: timeRange.start }
  })
  .populate('sender', 'username profilePicture')
  .populate({
    path: 'data.eventId',
    select: 'title coverImage time privacyLevel host',
    populate: { path: 'host', select: 'username' }
  })
  .sort({ updatedAt: -1 })
  .limit(10)
  .lean();

  console.log(`🔍 Found ${invitations.length} event invitations`);

  return invitations.map(invitation => ({
    _id: `invitation_${invitation._id}`,
    activityType: 'event_invitation',
    timestamp: invitation.updatedAt || invitation.createdAt,
    user: invitation.sender, // ✅ This is the main user for ActivityHeader
    data: {
      event: invitation.data.eventId ? {
        _id: invitation.data.eventId._id,
        title: invitation.data.eventId.title,
        coverImage: invitation.data.eventId.coverImage,
        time: invitation.data.eventId.time,
        privacyLevel: invitation.data.eventId.privacyLevel,
        host: invitation.data.eventId.host
      } : null,
      // ✅ FIX: Add invitedBy for backward compatibility
      invitedBy: invitation.sender,
      inviterCount: invitation.data.count || 1,
      inviterIds: invitation.data.inviterIds || [invitation.sender],
      message: invitation.message,
      isGrouped: (invitation.data.count || 1) > 1
    },
    metadata: {
      actionable: true,
      grouped: (invitation.data.count || 1) > 1,
      priority: 'high',
      actionType: 'VIEW_EVENT',
      actionData: { eventId: invitation.data.eventId?._id }
    },
    score: calculateActivityScore(invitation, 'event_invitation', userId)
  }));
};

const fetchCoHostActivities = async (userId, followingIds, timeRange) => {
  console.log('👥 Fetching cohost activities...');
  
  try {
    const mongoose = require('mongoose');
    
    // Fetch cohost activities
    const cohostActivities = await mongoose.connection.db.collection('activities').find({
      userId: { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) },
      type: 'friend_cohost_added',
      timestamp: { $gte: timeRange.start }
    }).sort({ timestamp: -1 }).limit(20).toArray();

    console.log(`🔍 Found ${cohostActivities.length} cohost activities`);

    return cohostActivities.map(activity => ({
      _id: `cohost_${activity._id}`,
      activityType: 'friend_cohost_added',
      timestamp: activity.timestamp,
      user: {
        _id: activity.actorId,
        username: activity.actorUsername,
        profilePicture: activity.actorProfilePicture
      },
      data: {
        event: {
          _id: activity.eventId,
          title: activity.eventTitle,
          time: activity.eventTime,
          coverImage: activity.eventCoverImage
        },
        host: {
          _id: activity.hostId,
          username: activity.hostUsername
        },
        cohost: {
          _id: activity.actorId,
          username: activity.actorUsername,
          profilePicture: activity.actorProfilePicture
        }
      },
      metadata: {
        actionable: false,
        grouped: false,
        priority: 'medium'
      },
      score: calculateActivityScore(activity, 'friend_cohost_added', userId)
    }));
  } catch (error) {
    console.error('❌ Error fetching cohost activities:', error);
    return [];
  }
};
// const fetchEventPhotoUploads = async (userId, friendIds, timeRange) => {
//   console.log('📷 Fetching event photo uploads...');
  
//   // Get user's accepted friends for privacy checking
//   const user = await User.findById(userId).select('attendingEvents');
//   const userFriendIds = user.getAcceptedFriends().map(id => String(id));
//   const attendingEventIds = user.attendingEvents || [];
  
//   // ✅ PRIVACY FIX: Filter out private events completely
//   const photoUploads = await Photo.aggregate([
//     {
//       $match: {
//         user: { $in: friendIds },
//         event: { $in: attendingEventIds },
//         uploadDate: { $gte: timeRange.start },
//         $or: [
//           { isDeleted: { $exists: false } },
//           { isDeleted: false }
//         ]
//       }
//     },
//     {
//       $lookup: {
//         from: 'events',
//         localField: 'event',
//         foreignField: '_id',
//         as: 'eventData'
//       }
//     },
//     {
//       $lookup: {
//         from: 'users',
//         localField: 'user',
//         foreignField: '_id',
//         as: 'userData'
//       }
//     },
//     {
//       $unwind: { path: '$eventData', preserveNullAndEmptyArrays: false }
//     },
//     {
//       $unwind: { path: '$userData', preserveNullAndEmptyArrays: false }
//     },
//     {
//       $match: {
//         // ✅ CRITICAL PRIVACY FILTER: Exclude private events completely
//         $or: [
//           { 'eventData.privacyLevel': 'public' },
//           { 
//             'eventData.privacyLevel': 'friends',
//             'eventData.host': { $in: userFriendIds.map(id => new mongoose.Types.ObjectId(id)) }
//           }
//           // Private events completely excluded - no photos from private events show up
//         ]
//       }
//     },
//     { $sort: { uploadDate: -1 } },
//     { $limit: 30 }
//   ]);

//   console.log(`🔒 Privacy filtered: Found ${photoUploads.length} event photo uploads (private events excluded)`);

//   return photoUploads.map(photo => {
//     // Check if user can add this person as friend
//     const canAddFriend = !friendIds.includes(photo.userData._id) && 
//                         String(photo.userData._id) !== String(userId);
    
//     return {
//       _id: `eventphoto_${photo._id}`,
//       activityType: 'event_photo_upload',
//       timestamp: photo.uploadDate,
//       user: photo.userData,
//       data: {
//         photo: {
//           _id: photo._id,
//           url: photo.paths?.[0] || photo.url,
//           caption: photo.caption
//         },
//         event: {
//           _id: photo.eventData._id,
//           title: photo.eventData.title,
//           coverImage: photo.eventData.coverImage,
//           privacyLevel: photo.eventData.privacyLevel // Include for debugging
//         },
//         uploader: photo.userData,
//         canAddFriend
//       },
//       metadata: {
//         actionable: canAddFriend,
//         grouped: false,
//         priority: 'medium'
//       },
//       score: calculateActivityScore(photo, 'event_photo_upload', userId)
//     };
//   });
// };

const fetchFriendEventJoins = async (userId, followingIds, timeRange) => {
  console.log('👥 Fetching following event joins...');
  
  // Find recent event updates where users you follow joined
  const recentJoins = await Event.aggregate([
    {
      $match: {
        attendees: { $in: followingIds },
        updatedAt: { $gte: timeRange.start },
        time: { $gte: new Date() }, // Only future events
        // ✅ CRITICAL PRIVACY FILTER: Exclude private events completely
        $or: [
          { privacyLevel: 'public' },
          { 
            privacyLevel: 'followers',
            host: { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) }
          }
          // Private events completely excluded - no joins from private events show up
        ]
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'attendees',
        foreignField: '_id',
        as: 'attendeeUsers'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'host',
        foreignField: '_id',
        as: 'host'
      }
    },
    {
      $unwind: { path: '$host', preserveNullAndEmptyArrays: false }
    },
    {
      $addFields: {
        followingAttendees: {
          $filter: {
            input: '$attendeeUsers',
            cond: { $in: ['$$this._id', followingIds] }
          }
        }
      }
    },
    {
      $match: {
        'friendAttendees.0': { $exists: true } // At least one friend attendee
      }
    },
    { $sort: { updatedAt: -1 } },
    { $limit: 20 }
  ]);

  console.log(`🔒 Privacy filtered: Found ${recentJoins.length} friend event joins (private events excluded)`);

  // Group joins by event and time window
  const groupedJoins = groupFriendJoins(recentJoins, timeRange);
  
  return groupedJoins.map(join => ({
    _id: `friendjoin_${join.event._id}_${join.timestamp}`,
    activityType: 'friend_event_join',
    timestamp: join.timestamp,
    user: join.friends[0], // Primary friend for display
    data: {
      event: {
        _id: join.event._id,
        title: join.event.title,
        coverImage: join.event.coverImage,
        time: join.event.time,
        attendeeCount: join.event.attendees?.length || 0
      },
      friends: join.friends,
      groupCount: join.friends.length,
      isGrouped: join.friends.length > 1
    },
    metadata: {
      actionable: false,
      grouped: join.friends.length > 1,
      priority: 'medium'
    },
    score: calculateActivityScore(join, 'friend_event_join', userId)
  }));
};

// Friend request functions removed - using follower-following system

const fetchEventReminders = async (userId, timeRange) => {
  console.log('⏰ Fetching event reminders...');
  
  // Get events user is attending that are coming up soon (next 24 hours)
  const upcomingEvents = await Event.find({
    attendees: userId,
    time: { 
      $gte: new Date(),
      $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
    }
  })
  .populate('host', 'username profilePicture')
  .sort({ time: 1 })
  .limit(5);

  return upcomingEvents.map(event => {
    const timeUntilEvent = new Date(event.time) - new Date();
    const hoursUntil = Math.floor(timeUntilEvent / (1000 * 60 * 60));
    
    return {
      _id: `reminder_${event._id}`,
      activityType: 'event_reminder',
      timestamp: new Date(), // Current time for reminder
      user: event.host,
      data: {
        event: {
          _id: event._id,
          title: event.title,
          coverImage: event.coverImage,
          time: event.time,
          location: event.location,
          attendeeCount: event.attendees?.length || 0
        },
        hoursUntil,
        reminderType: hoursUntil <= 1 ? 'urgent' : 'upcoming'
      },
      metadata: {
        actionable: true,
        grouped: false,
        priority: 'high'
      },
      score: calculateActivityScore(event, 'event_reminder', userId) * (hoursUntil <= 1 ? 2 : 1)
    };
  });
};

const fetchMemoriesCreated = async (userId, followingIds, timeRange) => {
  console.log('📚 Fetching created memories...');
  
  const memories = await Memory.aggregate([
    {
      $match: {
        creator: { $in: followingIds },
        createdAt: { $gte: timeRange.start },
        participants: userId // Only memories user is part of
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'creator',
        foreignField: '_id',
        as: 'creator'
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
      $unwind: { path: '$creator', preserveNullAndEmptyArrays: false }
    },
    {
      $unwind: { path: '$event', preserveNullAndEmptyArrays: true }
    },
    {
      $match: {
        // ✅ CRITICAL PRIVACY FILTER: Exclude memories from private events
        $or: [
          // Memories not associated with any event
          { event: { $exists: false } },
          { event: null },
          // Memories from public events
          { 'event.privacyLevel': 'public' },
          // Memories from followers-only events where user follows the host
          { 
            'event.privacyLevel': 'followers',
            'event.host': { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) }
          }
          // Private event memories completely excluded
        ]
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 10 }
  ]);

  console.log(`🔒 Privacy filtered: Found ${memories.length} created memories (private event memories excluded)`);

  return memories.map(memory => ({
    _id: `memory_${memory._id}`,
    activityType: 'memory_created',
    timestamp: memory.createdAt,
    user: memory.creator,
    data: {
      memory: {
        _id: memory._id,
        title: memory.title,
        description: memory.description,
        photoCount: memory.photos?.length || 0
      },
      event: memory.event ? {
        _id: memory.event._id,
        title: memory.event.title,
        time: memory.event.time,
        privacyLevel: memory.event.privacyLevel // Include for debugging
      } : null,
      creator: memory.creator
    },
    metadata: {
      actionable: false,
      grouped: false,
      priority: 'medium'
    },
    score: calculateActivityScore(memory, 'memory_created', userId)
  }));
};

/* ═══════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════ */

const groupFriendJoins = (joins, timeRange) => {
  const groups = {};
  const groupWindow = 6 * 60 * 60 * 1000; // 6 hours
  
  joins.forEach(join => {
    const eventId = join._id.toString();
    const joinTime = new Date(join.updatedAt).getTime();
    const timeSlot = Math.floor(joinTime / groupWindow);
    const groupKey = `${eventId}_${timeSlot}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        event: join,
        friends: [],
        timestamp: new Date(join.updatedAt)
      };
    }
    
    // Add friends who joined this event
    join.friendAttendees.forEach(friend => {
      if (!groups[groupKey].friends.find(f => f._id.toString() === friend._id.toString())) {
        groups[groupKey].friends.push(friend);
      }
    });
  });
  
  return Object.values(groups);
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN ACTIVITY FEED ENDPOINT
══════════════════════════════════════════════════════════════════ */

router.get('/feed/activity', protect, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 15;
  const skip = (page - 1) * limit;
  const userId = req.user._id;
  const feedType = req.query.feedType || 'activity'; // 'for-you' or 'activity'
  
  console.log(`🎯 [API] /feed/activity -> user ${userId} page ${page} feedType: ${feedType}`);

  try {
    // Get user's social connections (following relationships)
    const viewer = await User.findById(userId)
      .select('following attendingEvents')
      .populate('following', '_id');

    const followingIds = viewer.following?.map(u => u._id.toString()) || [];
    
    console.log(`🔍 User connections:`, {
      userId,
      followingCount: followingIds.length,
      feedType
    });

    // Define time range for activity fetching
    const timeRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    };

    let allActivities = [];

    // ✅ SEPARATE FEED LOGIC: For You vs Activity
    if (feedType === 'for-you') {
      // For You Feed: Only posts from anyone (not just friends), NO activity items
      console.log('🌟 Fetching For You feed (posts from all users, no activity items)');
      
      const forYouPosts = await fetchForYouPosts(userId, timeRange);
      
      allActivities = forYouPosts;
      
      console.log('📊 For You feed counts:', {
        posts: forYouPosts.length
      });
      
    } else {
      // Activity Feed: Friend-based activities only (posts, comments, joins, invitations)
      console.log('👥 Fetching Activity feed (friend-based activities)');
      
      const [
        regularPosts,
        eventInvitations,
        friendEventJoins,
        eventCreations,
        photoComments,
        cohostActivities
      ] = await Promise.all([
        fetchRegularPosts(userId, followingIds, timeRange), // Posts from followed users
        fetchEventInvitations(userId, timeRange),
        fetchFriendEventJoins(userId, followingIds, timeRange),
        fetchEventCreations(userId, followingIds, timeRange),
        fetchPhotoComments(userId, followingIds, timeRange), // Comments from friends
        fetchCoHostActivities(userId, followingIds, timeRange)
      ]);

      console.log('📊 Activity feed counts by type:', {
        regularPosts: regularPosts.length,
        eventInvitations: eventInvitations.length,
        friendEventJoins: friendEventJoins.length,
        eventCreations: eventCreations.length,
        photoComments: photoComments.length,
        cohostActivities: cohostActivities.length
      });

      // ✅ Combine friend-based activities (NO memories, NO event reminders)
      allActivities = [
        ...regularPosts,
        ...eventInvitations,
        ...friendEventJoins,
        ...eventCreations,
        ...photoComments,
        ...cohostActivities
      ];
    }

    console.log(`📈 Total activities before filtering: ${allActivities.length}`);

    // Filter out activities older than their maxAge
    const now = Date.now();
    const filteredActivities = allActivities.filter(activity => {
      const config = ACTIVITY_TYPES[activity.activityType];
      if (!config) return false;
      
      const activityTime = new Date(activity.timestamp || activity.createdAt).getTime();
      const age = now - activityTime;
      
      return age <= config.maxAge;
    });

    console.log(`🔍 Activities after age filtering: ${filteredActivities.length}`);

    // Sort by score (highest first), then by timestamp (newest first)
    filteredActivities.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      const aTime = new Date(a.timestamp || a.createdAt).getTime();
      const bTime = new Date(b.timestamp || b.createdAt).getTime();
      return bTime - aTime;
    });

    // Apply pagination
    const paginatedActivities = filteredActivities.slice(skip, skip + limit);

    console.log('📄 Pagination:', {
      totalActivities: filteredActivities.length,
      startIndex: skip,
      endIndex: skip + limit,
      returnedCount: paginatedActivities.length
    });

    // Debug: Log activity types in final feed
    const activityTypeCounts = {};
    paginatedActivities.forEach(activity => {
      activityTypeCounts[activity.activityType] = (activityTypeCounts[activity.activityType] || 0) + 1;
    });
    
    console.log('📊 Final feed activity types:', activityTypeCounts);

    const response = {
      activities: paginatedActivities,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredActivities.length / limit),
        totalActivities: filteredActivities.length,
        hasMore: skip + limit < filteredActivities.length,
        limit
      },
      debug: {
        feedType: feedType,
        activityCounts: feedType === 'for-you' ? {
          posts: allActivities.length,
          total: allActivities.length
        } : {
          regularPosts: allActivities.filter(a => ['regular_post', 'text_post', 'review_post'].includes(a.activityType)).length,
          eventInvitations: allActivities.filter(a => a.activityType === 'event_invitation').length,
          friendEventJoins: allActivities.filter(a => a.activityType === 'friend_event_join').length,
          eventCreations: allActivities.filter(a => a.activityType === 'event_created').length,
          photoComments: allActivities.filter(a => a.activityType === 'photo_comment').length,
          cohostActivities: allActivities.filter(a => a.activityType === 'friend_cohost_added').length,
          total: allActivities.length
        },
        finalFeedTypes: activityTypeCounts,
        userConnections: {
          followingCount: followingIds.length
        },
        timeRange,
        privacyFiltered: true,
        memoriesRemoved: true, // ✅ Indicates memories removed from feed
        eventRemindersRemoved: true // ✅ Indicates event reminders removed from feed
      }
    };

    console.log(`🟢 [${feedType.toUpperCase()}] Sending feed response:`, {
      feedType,
      totalActivities: filteredActivities.length,
      paginatedCount: paginatedActivities.length,
      hasMore: response.pagination.hasMore,
      topActivityTypes: paginatedActivities.slice(0, 5).map(a => a.activityType)
    });

    res.json(response);

  } catch (err) {
    console.error(`❌ [${feedType.toUpperCase()}] Feed error:`, err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message,
      feedType: feedType,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   BACKWARD COMPATIBILITY - DEPRECATED POSTS ENDPOINT
══════════════════════════════════════════════════════════════════ */

router.get('/feed/posts', protect, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;
  const userId = req.user._id;
  
  console.log('⚠️ DEPRECATED: /feed/posts endpoint used. Please migrate to /feed/activity');
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
        $match: {
          // ✅ CRITICAL PRIVACY FILTER: Exclude photos from private events
          $or: [
            // Posts not associated with any event (personal posts)
            { event: { $exists: false } },
            { event: null },
            // Posts from public events
            { 'event.privacyLevel': 'public' },
            // Posts from followers-only events where user follows the host
            { 
              'event.privacyLevel': 'followers',
              'event.host': { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) }
            }
            // Private event posts completely excluded
          ]
        }
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
          $lookup: {
            from: 'events',
            localField: 'memoryData.event',
            foreignField: '_id',
            as: 'eventData'
          }
        },
        {
          $unwind: { path: '$user', preserveNullAndEmptyArrays: false }
        },
        {
          $unwind: { path: '$memoryData', preserveNullAndEmptyArrays: false }
        },
        {
          $unwind: { path: '$eventData', preserveNullAndEmptyArrays: true }
        },
        {
          $match: {
            // ✅ CRITICAL PRIVACY FILTER: Exclude memory photos from private events
            $or: [
              // Memories not associated with any event
              { eventData: { $exists: false } },
              { eventData: null },
              // Memories from public events
              { 'eventData.privacyLevel': 'public' },
              // Memories from friends-only events where user is friends with host
              { 
                'eventData.privacyLevel': 'followers',
                'eventData.host': { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) }
              }
              // Private event memories completely excluded
            ]
          }
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
        },
        privacyFiltered: true,
        deprecationWarning: 'This endpoint is deprecated. Please use /feed/activity instead.'
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
const debugFollowRelationship = async (userAId, userBId) => {
  try {
    const userA = await User.findById(userAId).select('following followers username');
    const userB = await User.findById(userBId).select('following followers username');
    
    const aFollowing = (userA.following || []).map(id => String(id));
    const bFollowing = (userB.following || []).map(id => String(id));
    
    console.log('🔍 Follow Relationship Debug:', {
      userA: { id: userAId, username: userA.username, followingCount: aFollowing.length },
      userB: { id: userBId, username: userB.username, followingCount: bFollowing.length },
      aFollowsB: aFollowing.includes(String(userBId)),
      bFollowsA: bFollowing.includes(String(userAId)),
      mutualFollow: aFollowing.includes(String(userBId)) && bFollowing.includes(String(userAId))
    });
    
    return {
      areFriends: aFriends.includes(String(userBId)) && bFriends.includes(String(userAId)),
      aFriends,
      bFriends
    };
  } catch (error) {
    console.error('Error debugging friendship:', error);
    return { areFriends: false };
  }
};

router.get('/debug/friendship/:otherUserId', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.otherUserId;
    
    const debug = await debugFollowRelationship(userId, otherUserId);
    
    res.json({
      success: true,
      friendship: debug,
      note: 'Both users should show as friends of each other'
    });
  } catch (error) {
    console.error('Debug friendship error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   EVENTS FEED - KEPT AS IS FOR EventsScreen COMPATIBILITY
══════════════════════════════════════════════════════════════════ */

router.get('/feed/events', protect, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const skip = (page - 1) * limit;
  const { type = 'discover' } = req.query;
  
  console.log(`🟡 [PHASE 2] /feed/events -> user ${req.user._id} page ${page} type ${type}`);

  try {
    const viewer = await User.findById(req.user._id)
      .select('following attendingEvents')
      .populate('following', '_id')
      .populate('attendingEvents', '_id');

    const followingIds = viewer.following.map(u => u._id.toString());
    const attendingEventIds = viewer.attendingEvents.map(e => e._id.toString());
    
    console.log(`🔍 [PHASE 2] User following: ${followingIds.length}, attending: ${attendingEventIds.length}`);

    let events = [];
    let totalEvents = 0;

    // ✅ PHASE 2: Privacy-aware event discovery based on feed type
    if (type === 'following') {
      console.log(`📱 [PHASE 2] Getting following feed for user ${req.user._id}`);
      
      if (followingIds.length === 0) {
        return res.json({
          events: [],
          page: 1,
          totalPages: 0,
          hasMore: false,
          message: 'Follow some users to see their events in your feed!'
        });
      }
      
      // ✅ PHASE 2: Privacy-aware following feed query
      const followingFeedQuery = {
        $and: [
          // Only future events
          { time: { $gte: new Date() } },
          
          // Privacy filtering for following feed
          {
            $or: [
              // User's own events
              { host: req.user._id },
              
              // Co-hosted events
              { coHosts: req.user._id },
              
              // Events user is attending
              { attendees: req.user._id },
              
              // Public events from followed users that appear in feed
              {
                host: { $in: followingIds },
                privacyLevel: PRIVACY_LEVELS.PUBLIC,
                'permissions.appearInFeed': true
              },
              
              // Friends-only events from followed users that appear in feed
              {
                host: { $in: followingIds },
                privacyLevel: PRIVACY_LEVELS.FRIENDS,
                'permissions.appearInFeed': true
              }
              
              // Private events only appear if user is invited (covered by attendees/invitedUsers above)
            ]
          }
        ]
      };

      events = await Event.find(followingFeedQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username profilePicture')
        .sort({ time: 1, createdAt: -1 })
        .limit(limit + 1) // Get one extra to check for more
        .skip(skip);

      totalEvents = await Event.countDocuments(followingFeedQuery);
      
    } else {
      // Discovery feed
      console.log(`🌟 [PHASE 2] Getting discovery feed for user ${req.user._id}`);
      
      // ✅ PHASE 2: Privacy-aware discovery feed query
      const discoveryFeedQuery = {
        $and: [
          // Only future events
          { time: { $gte: new Date() } },
          
          // Privacy filtering for discovery
          {
            $or: [
              // User's own events
              { host: req.user._id },
              
              // Co-hosted events
              { coHosts: req.user._id },
              
              // Events user is attending
              { attendees: req.user._id },
              
              // Events where user is invited
              { invitedUsers: req.user._id },
              
              // Public events that appear in feed
              {
                privacyLevel: PRIVACY_LEVELS.PUBLIC,
                'permissions.appearInFeed': true
              },
              
              // Friends-only events from followed users that appear in feed
              {
                privacyLevel: PRIVACY_LEVELS.FRIENDS,
                host: { $in: followingIds },
                'permissions.appearInFeed': true
              }
              
              // Private events don't appear in discovery unless user is involved
            ]
          }
        ]
      };

      events = await Event.find(discoveryFeedQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username profilePicture')
        .sort({ 
          time: 1, // Sort by event time first
          createdAt: -1 // Then by newest
        })
        .limit(limit + 1) // Get one extra to check for more
        .skip(skip);

      totalEvents = await Event.countDocuments(discoveryFeedQuery);
    }

    // Check if there are more events
    const hasMoreEvents = events.length > limit;
    const eventsToReturn = hasMoreEvents ? events.slice(0, limit) : events;

    console.log(`🎉 [PHASE 2] Found ${eventsToReturn.length} events for ${type} feed`);

    // ✅ PHASE 2: Enhanced events with privacy-aware context
    const eventsWithContext = eventsToReturn.map(event => {
      const isAttending = attendingEventIds.includes(event._id.toString());
      const isHosted = followingIds.includes(event.host._id.toString());
      const isHost = event.host._id.toString() === req.user._id.toString();
      const isInvited = event.invitedUsers?.some(u => u.toString() === req.user._id.toString());
      
      return {
        ...event.toObject(),
        isAttending,
        isHosted,
        isHost,
        isInvited,
        attendeeCount: event.attendees ? event.attendees.length : 0,
        source: isAttending ? 'attending' : (isHosted ? 'friend' : 'discover'),
        
        // ✅ PHASE 2: Add privacy metadata
        privacyMetadata: {
          level: event.privacyLevel,
          canUserView: true, // If we got here, user can view
          canUserJoin: event.canUserJoin(req.user._id, followingIds),
          isDiscoverable: event.permissions?.appearInFeed || false,
          discoveryReason: isHost ? 'own_event' : 
                          isAttending ? 'attending' :
                          isInvited ? 'invited' :
                          isHosted ? 'following_host' :
                          event.privacyLevel === PRIVACY_LEVELS.PUBLIC ? 'public_discovery' :
                          'unknown'
        },
        
        // Add recommendation reason for discover feed
        ...(type === 'discover' && {
          recommendationReason: generateEventRecommendationReason(event, req.user._id, isHosted, isAttending, isInvited)
        })
      };
    });
    
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
      // ✅ PHASE 2: Enhanced debugging with privacy info
      debug: {
        type: type,
        followingCount: followingIds.length,
        attendingCount: attendingEventIds.length,
        foundEvents: eventsToReturn.length,
        userId: req.user._id,
        privacyFiltered: true,
        phase2Enforced: true
      }
    };

    console.log(`🟢 [PHASE 2] Sending events response: ${eventsToReturn.length} events, hasMore: ${hasMoreEvents}`);
    res.json(response);

  } catch (err) {
    console.error('❌ [PHASE 2] Feed events error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message,
      phase2Error: true,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ✅ PHASE 2: Helper function to generate event recommendation reasons
function generateEventRecommendationReason(event, userId, isHosted, isAttending, isInvited) {
  if (isAttending) return 'You\'re attending';
  if (isInvited) return 'You\'re invited';
  if (isHosted) return 'From someone you follow';
  
  // Privacy-aware recommendation reasons
  if (event.privacyLevel === PRIVACY_LEVELS.PUBLIC) {
    const publicReasons = [
      'Popular public event',
      'Trending in your area',
      'Based on your interests',
      'New public event near you',
      'Similar to events you\'ve attended',
      'Happening soon'
    ];
    return publicReasons[Math.floor(Math.random() * publicReasons.length)];
  } else if (event.privacyLevel === PRIVACY_LEVELS.FRIENDS) {
    return 'Shared by someone you follow';
  } else if (event.privacyLevel === PRIVACY_LEVELS.PRIVATE) {
    return 'You\'re invited to this private event';
  }
  
  return 'Recommended for you';
}

module.exports = router;