// services/eventDiscoveryService.js - PHASE 2: Privacy-aware event discovery
const Event = require('../models/Event');
const User = require('../models/User');

class EventDiscoveryService {
  
  /**
   * PHASE 2: Get events with privacy filtering
   */
  static async getDiscoverableEvents(userId, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0,
        category,
        location,
        radius,
        includePrivate = false,
        sortBy = 'time'
      } = options;

      console.log(`🔍 PHASE 2: Getting discoverable events for user ${userId}`);
      console.log(`📋 Options:`, { limit, skip, category, location, includePrivate });

      // Get user's following list for friends-only events
      const user = await User.findById(userId).select('following');
      const userFollowing = user ? user.following.map(f => f.toString()) : [];

      // PHASE 2: Build privacy-aware query
      const baseQuery = {
        time: { $gte: new Date() }, // Only future events
        $or: []
      };

      // Public events - always visible
      baseQuery.$or.push({
        privacyLevel: 'public',
        'permissions.appearInSearch': true
      });

      // Friends-only events - visible if following host
      if (userFollowing.length > 0) {
        baseQuery.$or.push({
          privacyLevel: 'friends',
          'permissions.appearInSearch': true,
          host: { $in: userFollowing }
        });
      }

      // Private events - only if user is invited (and includePrivate is true)
      if (includePrivate) {
        baseQuery.$or.push({
          privacyLevel: 'private',
          'permissions.appearInSearch': true,
          invitedUsers: userId
        });
      }

      // Add category filter if specified
      if (category) {
        baseQuery.category = category;
      }

      // Add location filter if specified
      if (location && radius) {
        baseQuery.coordinates = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [location.lng, location.lat]
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        };
      }

      console.log('🔍 PHASE 2: Discovery query:', JSON.stringify(baseQuery, null, 2));

      // Execute query
      const events = await Event.find(baseQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ [sortBy]: sortBy === 'time' ? 1 : -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 2: Found ${events.length} discoverable events`);

      // Filter out events user shouldn't see (double-check)
      const filteredEvents = await this.filterEventsByPrivacy(events, userId);

      console.log(`🔒 PHASE 2: After privacy filtering: ${filteredEvents.length} events`);

      return filteredEvents;

    } catch (error) {
      console.error('❌ PHASE 2: Error in getDiscoverableEvents:', error);
      throw error;
    }
  }
static async getFollowingFeed(userId, options = {}) {
  try {
    const { limit = 20, skip = 0, followingIds } = options;

    console.log(`📱 PHASE 2: Getting following feed for user ${userId}`);

    // If no following IDs provided, get them
    let userFollowing = followingIds;
    if (!userFollowing) {
      const user = await User.findById(userId).select('following');
      userFollowing = user ? user.following.map(f => f.toString()) : [];
    }

    if (userFollowing.length === 0) {
      return [];
    }

    // PHASE 2: Build following feed query with privacy filtering
    const followingQuery = {
      host: { $in: userFollowing },
      time: { $gte: new Date() }, // Only future events
      'permissions.appearInFeed': true, // Must be configured to appear in feeds
      $or: [
        // Public events from followed users
        { privacyLevel: 'public' },
        // Friends-only events from followed users (user follows them)
        { privacyLevel: 'friends' },
        // Private events where user is invited
        {
          privacyLevel: 'private',
          invitedUsers: userId
        }
      ]
    };

    console.log('📱 PHASE 2: Following feed query:', JSON.stringify(followingQuery, null, 2));

    const events = await Event.find(followingQuery)
      .populate('host', 'username profilePicture displayName')
      .populate('attendees', 'username profilePicture')
      .sort({ createdAt: -1 }) // Newest first
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    console.log(`✅ PHASE 2: Found ${events.length} following feed events`);

    return events;

  } catch (error) {
    console.error('❌ PHASE 2: Error in getFollowingFeed:', error);
    throw error;
  }
}
  /**
   * PHASE 2: Get events for user feed with privacy filtering
   */
  static async getFeedEvents(userId, options = {}) {
    try {
      const { limit = 20, skip = 0 } = options;

      console.log(`📰 PHASE 2: Getting feed events for user ${userId}`);

      // Get user's following list
      const user = await User.findById(userId).select('following');
      const userFollowing = user ? user.following.map(f => f.toString()) : [];

      // PHASE 2: Build feed query with privacy filtering
      const feedQuery = {
        time: { $gte: new Date() },
        'permissions.appearInFeed': true,
        $or: [
          // Public events
          { privacyLevel: 'public' },
          // Friends-only events from people user follows
          {
            privacyLevel: 'friends',
            host: { $in: userFollowing }
          },
          // Private events user is invited to
          {
            privacyLevel: 'private',
            invitedUsers: userId
          }
        ]
      };

      console.log('📰 PHASE 2: Feed query:', JSON.stringify(feedQuery, null, 2));

      const events = await Event.find(feedQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ time: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 2: Found ${events.length} feed events`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 2: Error in getFeedEvents:', error);
      throw error;
    }
  }

  /**
   * PHASE 2: Filter events array by privacy rules
   */
  static async filterEventsByPrivacy(events, userId) {
    try {
      if (!events || events.length === 0) return [];

      // Get user's following list once
      const user = await User.findById(userId).select('following');
      const userFollowing = user ? user.following.map(f => f.toString()) : [];

      const filteredEvents = [];

      for (const event of events) {
        const canView = await this.canUserViewEvent(event, userId, userFollowing);
        if (canView) {
          filteredEvents.push(event);
        }
      }

      return filteredEvents;

    } catch (error) {
      console.error('❌ PHASE 2: Error filtering events by privacy:', error);
      return events; // Return unfiltered on error to avoid breaking the app
    }
  }

  /**
   * PHASE 2: Check if user can view a specific event
   */
  static async canUserViewEvent(event, userId, userFollowing = null) {
    try {
      const userIdStr = userId.toString();
      const hostIdStr = event.host._id ? event.host._id.toString() : event.host.toString();

      // Host can always view their own events
      if (userIdStr === hostIdStr) {
        return true;
      }

      // Co-hosts can always view
      if (event.coHosts && event.coHosts.some(c => c.toString() === userIdStr)) {
        return true;
      }

      // Attendees can always view
      if (event.attendees && event.attendees.some(a => a._id ? a._id.toString() === userIdStr : a.toString() === userIdStr)) {
        return true;
      }

      // Get user following if not provided
      if (!userFollowing) {
        const user = await User.findById(userId).select('following');
        userFollowing = user ? user.following.map(f => f.toString()) : [];
      }

      // PHASE 2: Check privacy level permissions
      switch (event.privacyLevel) {
        case 'public':
          // Public events are visible to everyone if they appear in search/feed
          return event.permissions?.appearInSearch || event.permissions?.appearInFeed;

        case 'friends':
          // Friends-only events are visible if user follows the host
          return userFollowing.includes(hostIdStr) && 
                 (event.permissions?.appearInSearch || event.permissions?.appearInFeed);

        case 'private':
          // Private events are visible if user is invited
          return event.invitedUsers && 
                 event.invitedUsers.some(u => u._id ? u._id.toString() === userIdStr : u.toString() === userIdStr);

        default:
          console.warn(`⚠️  Unknown privacy level: ${event.privacyLevel}`);
          return false;
      }

    } catch (error) {
      console.error('❌ PHASE 2: Error checking user view permission:', error);
      return false; // Deny access on error for security
    }
  }

  /**
   * PHASE 2: Search events with privacy filtering
   */
  static async searchEvents(query, userId, options = {}) {
    try {
      const { limit = 20, skip = 0, category } = options;

      console.log(`🔍 PHASE 2: Searching events for query: "${query}"`);

      // Get user following for privacy filtering
      const user = await User.findById(userId).select('following');
      const userFollowing = user ? user.following.map(f => f.toString()) : [];

      // Build search query with privacy filtering
      const searchQuery = {
        $text: { $search: query },
        time: { $gte: new Date() },
        $or: [
          // Public events
          {
            privacyLevel: 'public',
            'permissions.appearInSearch': true
          },
          // Friends-only events
          {
            privacyLevel: 'friends',
            'permissions.appearInSearch': true,
            host: { $in: userFollowing }
          },
          // Private events user is invited to
          {
            privacyLevel: 'private',
            invitedUsers: userId
          }
        ]
      };

      // Add category filter if specified
      if (category) {
        searchQuery.category = category;
      }

      console.log('🔍 PHASE 2: Search query:', JSON.stringify(searchQuery, null, 2));

      const events = await Event.find(searchQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ score: { $meta: 'textScore' }, time: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 2: Search found ${events.length} events`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 2: Error in searchEvents:', error);
      throw error;
    }
  }

  /**
   * PHASE 2: Get user's events with privacy metadata
   */
  static async getUserEvents(userId, requestingUserId, options = {}) {
    try {
      const { limit = 20, skip = 0, includePast = false } = options;
      const isOwnProfile = userId.toString() === requestingUserId.toString();

      console.log(`👤 PHASE 2: Getting events for user ${userId}, requested by ${requestingUserId}`);
      console.log(`🔒 Is own profile: ${isOwnProfile}`);

      let query = {
        $or: [
          { host: userId },
          { attendees: userId }
        ]
      };

      // Add time filter
      if (!includePast) {
        query.time = { $gte: new Date() };
      }

      // If not own profile, apply privacy filtering
      if (!isOwnProfile) {
        const user = await User.findById(requestingUserId).select('following');
        const userFollowing = user ? user.following.map(f => f.toString()) : [];

        // Only show events the requesting user can see
        query.$and = [
          query,
          {
            $or: [
              // Public events
              { privacyLevel: 'public' },
              // Friends-only events if following
              {
                privacyLevel: 'friends',
                host: userId,
                _id: { $in: userFollowing.length > 0 ? [userId] : [] }
              },
              // Private events if invited
              {
                privacyLevel: 'private',
                invitedUsers: requestingUserId
              }
            ]
          }
        ];
      }

      const events = await Event.find(query)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ time: includePast ? -1 : 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 2: Found ${events.length} user events`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 2: Error in getUserEvents:', error);
      throw error;
    }
  }
static async getFollowingFeedCount(userId, options = {}) {
  try {
    const { followingIds } = options;

    // If no following IDs provided, get them
    let userFollowing = followingIds;
    if (!userFollowing) {
      const user = await User.findById(userId).select('following');
      userFollowing = user ? user.following.map(f => f.toString()) : [];
    }

    if (userFollowing.length === 0) {
      return 0;
    }

    const followingQuery = {
      host: { $in: userFollowing },
      time: { $gte: new Date() },
      'permissions.appearInFeed': true,
      $or: [
        { privacyLevel: 'public' },
        { privacyLevel: 'friends' },
        {
          privacyLevel: 'private',
          invitedUsers: userId
        }
      ]
    };

    const count = await Event.countDocuments(followingQuery);
    console.log(`📊 PHASE 2: Following feed count: ${count}`);

    return count;

  } catch (error) {
    console.error('❌ PHASE 2: Error in getFollowingFeedCount:', error);
    return 0;
  }
}

/**
 * PHASE 2: Enhanced getFeedEvents method with recommendations
 */
static async getFeedEvents(userId, options = {}) {
  try {
    const {
      limit = 20,
      skip = 0,
      includeRecommendations = false
    } = options;

    console.log(`📰 PHASE 2: Getting enhanced feed events for user ${userId}`);

    // Get user's following list and attending events
    const user = await User.findById(userId)
      .select('following attendingEvents')
      .populate('attendingEvents', '_id');
    
    const userFollowing = user ? user.following.map(f => f.toString()) : [];
    const attendingEventIds = user ? user.attendingEvents.map(e => e._id.toString()) : [];

    // PHASE 2: Build comprehensive feed query with privacy filtering
    const feedQuery = {
      time: { $gte: new Date() },
      'permissions.appearInFeed': true,
      $or: [
        // Public events (discoverable by everyone)
        { privacyLevel: 'public' },
        // Friends-only events from people user follows
        {
          privacyLevel: 'friends',
          host: { $in: userFollowing }
        },
        // Private events user is invited to
        {
          privacyLevel: 'private',
          invitedUsers: userId
        },
        // Events user is attending (regardless of privacy)
        {
          _id: { $in: attendingEventIds }
        }
      ]
    };

    console.log('📰 PHASE 2: Enhanced feed query:', JSON.stringify(feedQuery, null, 2));

    let events = await Event.find(feedQuery)
      .populate('host', 'username profilePicture displayName')
      .populate('attendees', 'username profilePicture')
      .sort({ createdAt: -1 }) // Newest first, or use scoring algorithm
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // PHASE 2: Add intelligent event scoring/ranking if recommendations enabled
    if (includeRecommendations && events.length > 0) {
      events = await this.rankFeedEvents(events, userId, userFollowing, attendingEventIds);
    }

    console.log(`✅ PHASE 2: Found ${events.length} enhanced feed events`);

    return events;

  } catch (error) {
    console.error('❌ PHASE 2: Error in enhanced getFeedEvents:', error);
    throw error;
  }
}

/**
 * PHASE 2: Get count of feed events
 */
static async getFeedEventsCount(userId) {
  try {
    const user = await User.findById(userId)
      .select('following attendingEvents');
    
    const userFollowing = user ? user.following.map(f => f.toString()) : [];
    const attendingEventIds = user ? user.attendingEvents.map(e => e._id.toString()) : [];

    const feedQuery = {
      time: { $gte: new Date() },
      'permissions.appearInFeed': true,
      $or: [
        { privacyLevel: 'public' },
        {
          privacyLevel: 'friends',
          host: { $in: userFollowing }
        },
        {
          privacyLevel: 'private',
          invitedUsers: userId
        },
        {
          _id: { $in: attendingEventIds }
        }
      ]
    };

    const count = await Event.countDocuments(feedQuery);
    console.log(`📊 PHASE 2: Feed events count: ${count}`);

    return count;

  } catch (error) {
    console.error('❌ PHASE 2: Error in getFeedEventsCount:', error);
    return 0;
  }
}

/**
 * PHASE 2: Intelligent event ranking for personalized feeds
 */
static async rankFeedEvents(events, userId, userFollowing, attendingEventIds) {
  try {
    console.log(`🎯 PHASE 2: Ranking ${events.length} events for user ${userId}`);

    // Simple scoring algorithm - can be enhanced with ML later
    const scoredEvents = events.map(event => {
      let score = 0;
      const eventObj = event.toObject ? event.toObject() : event;

      // Base score factors
      const isFollowingHost = userFollowing.includes(eventObj.host._id.toString());
      const isAttending = attendingEventIds.includes(eventObj._id.toString());
      const attendeeCount = eventObj.attendees ? eventObj.attendees.length : 0;
      const timeUntilEvent = new Date(eventObj.time) - new Date();
      const daysUntilEvent = timeUntilEvent / (1000 * 60 * 60 * 24);

      // Scoring factors
      if (isAttending) score += 100; // Highest priority
      if (isFollowingHost) score += 50; // High priority for followed users
      if (eventObj.privacyLevel === 'private') score += 30; // Private invites are important
      if (attendeeCount > 0) score += Math.min(attendeeCount * 2, 20); // Popular events
      if (daysUntilEvent <= 7) score += 15; // Events happening soon
      if (daysUntilEvent <= 1) score += 25; // Events happening very soon

      // Penalize events far in the future
      if (daysUntilEvent > 30) score -= 10;

      return {
        ...eventObj,
        _feedScore: score,
        _scoringFactors: {
          isAttending,
          isFollowingHost,
          attendeeCount,
          daysUntilEvent: Math.round(daysUntilEvent),
          privacyLevel: eventObj.privacyLevel
        }
      };
    });

    // Sort by score (highest first)
    const rankedEvents = scoredEvents.sort((a, b) => b._feedScore - a._feedScore);

    console.log(`🎯 PHASE 2: Events ranked by score:`, 
      rankedEvents.slice(0, 5).map(e => ({
        title: e.title,
        score: e._feedScore,
        factors: e._scoringFactors
      }))
    );

    return rankedEvents;

  } catch (error) {
    console.error('❌ PHASE 2: Error ranking feed events:', error);
    return events; // Return unranked on error
  }
}

/**
 * PHASE 2: Get personalized event recommendations
 */
static async getPersonalizedRecommendations(userId, options = {}) {
  try {
    const { limit = 10, excludeEventIds = [] } = options;

    console.log(`🎲 PHASE 2: Getting personalized recommendations for user ${userId}`);

    // Get user's interests and event history
    const user = await User.findById(userId)
      .select('following attendingEvents interests')
      .populate('attendingEvents', 'category tags');

    if (!user) {
      return [];
    }

    // Analyze user's event preferences
    const userCategories = user.attendingEvents
      .map(e => e.category)
      .filter(Boolean);
    
    const userTags = user.attendingEvents
      .flatMap(e => e.tags || [])
      .filter(Boolean);

    const userFollowing = user.following.map(f => f.toString());

    // Build recommendation query
    const recommendationQuery = {
      _id: { $nin: excludeEventIds },
      time: { $gte: new Date() },
      'permissions.appearInFeed': true,
      $or: [
        { privacyLevel: 'public' },
        {
          privacyLevel: 'friends',
          host: { $in: userFollowing }
        }
      ]
    };

    // Add category/tag preferences if we have them
    if (userCategories.length > 0 || userTags.length > 0) {
      recommendationQuery.$or.push({
        $or: [
          ...(userCategories.length > 0 ? [{ category: { $in: userCategories } }] : []),
          ...(userTags.length > 0 ? [{ tags: { $in: userTags } }] : [])
        ]
      });
    }

    const recommendations = await Event.find(recommendationQuery)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username profilePicture')
      .sort({ attendeeCount: -1, createdAt: -1 }) // Popular and recent
      .limit(parseInt(limit));

    console.log(`✅ PHASE 2: Found ${recommendations.length} personalized recommendations`);

    return recommendations;

  } catch (error) {
    console.error('❌ PHASE 2: Error in getPersonalizedRecommendations:', error);
    return [];
  }
}
}

module.exports = EventDiscoveryService;