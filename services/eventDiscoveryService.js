// services/eventDiscoveryService.js - PHASE 3: Complete Friends System Implementation
const Event = require('../models/Event');
const User = require('../models/User');

class EventDiscoveryService {
  
  /**
   * ✅ PHASE 3: Updated to use FRIENDS instead of followers
   * Get events with privacy filtering based on friends system
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

      console.log(`🔍 PHASE 3: Getting discoverable events for user ${userId} (friends system)`);
      console.log(`📋 Options:`, { limit, skip, category, location, includePrivate });

      // ✅ PHASE 3: Get user's FRIENDS list (not followers)
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];

      // ✅ PHASE 3: Build privacy-aware query using friends system
      const baseQuery = {
        time: { $gte: new Date() }, // Only future events
        $or: []
      };

      // Public events - always visible
      baseQuery.$or.push({
        privacyLevel: 'public',
        'permissions.appearInSearch': true
      });

      // ✅ FRIENDS-ONLY events - visible if user is friends with host
      if (userFriends.length > 0) {
        baseQuery.$or.push({
          privacyLevel: 'friends',
          'permissions.appearInSearch': true,
          host: { $in: userFriends }
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

      console.log('🔍 PHASE 3: Discovery query (friends system):', JSON.stringify(baseQuery, null, 2));

      // Execute query
      const events = await Event.find(baseQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ [sortBy]: sortBy === 'time' ? 1 : -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 3: Found ${events.length} discoverable events using friends system`);

      // Filter out events user shouldn't see (double-check)
      const filteredEvents = await this.filterEventsByPrivacy(events, userId);

      console.log(`🔒 PHASE 3: After privacy filtering: ${filteredEvents.length} events`);

      return filteredEvents;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getDiscoverableEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ PHASE 3: Updated to use FRIENDS instead of followers
   * Get friends' events feed
   */
  static async getFriendsFeed(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, friendIds } = options;

      console.log(`📱 PHASE 3: Getting friends feed for user ${userId}`);

      // ✅ PHASE 3: Get user's FRIENDS (not following)
      let userFriends = friendIds;
      if (!userFriends) {
        const user = await User.findById(userId);
        userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      }

      if (userFriends.length === 0) {
        return [];
      }

      // ✅ PHASE 3: Build friends feed query with privacy filtering
      const friendsQuery = {
        host: { $in: userFriends },
        time: { $gte: new Date() }, // Only future events
        'permissions.appearInFeed': true, // Must be configured to appear in feeds
        $or: [
          // Public events from friends
          { privacyLevel: 'public' },
          // Friends-only events from friends (user is friends with them)
          { privacyLevel: 'friends' },
          // Private events where user is invited
          {
            privacyLevel: 'private',
            invitedUsers: userId
          }
        ]
      };

      console.log('📱 PHASE 3: Friends feed query:', JSON.stringify(friendsQuery, null, 2));

      const events = await Event.find(friendsQuery)
        .populate('host', 'username profilePicture displayName')
        .populate('attendees', 'username profilePicture')
        .sort({ createdAt: -1 }) // Newest first
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 3: Found ${events.length} friends feed events`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getFriendsFeed:', error);
      throw error;
    }
  }

  /**
   * ✅ PHASE 3: Updated to use FRIENDS instead of followers
   * Get events for user feed with privacy filtering
   */
  static async getFeedEvents(userId, options = {}) {
    try {
      const { limit = 20, skip = 0 } = options;

      console.log(`📰 PHASE 3: Getting feed events for user ${userId} (friends system)`);

      // ✅ PHASE 3: Get user's FRIENDS list and event attendance
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      const userEventAttendance = user ? user.attendingEvents.map(e => String(e)) : [];

      // ✅ PHASE 3: Build feed query with friends-based privacy filtering
      const feedQuery = {
        time: { $gte: new Date() },
        'permissions.appearInFeed': true,
        $or: [
          // Public events (discoverable by everyone)
          { privacyLevel: 'public' },
          // ✅ FRIENDS-ONLY events from actual friends
          {
            privacyLevel: 'friends',
            host: { $in: userFriends }
          },
          // Private events user is invited to
          {
            privacyLevel: 'private',
            invitedUsers: userId
          },
          // ✅ CRITICAL: Events user is attending (can see regardless of privacy)
          {
            _id: { $in: userEventAttendance }
          }
        ]
      };

      console.log('📰 PHASE 3: Friends-based feed query:', JSON.stringify(feedQuery, null, 2));

      const events = await Event.find(feedQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ time: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 3: Found ${events.length} feed events using friends system`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getFeedEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ PHASE 3: Updated to use FRIENDS instead of followers
   * Filter events array by privacy rules
   */
  static async filterEventsByPrivacy(events, userId) {
    try {
      if (!events || events.length === 0) return [];

      // ✅ PHASE 3: Get user's FRIENDS list (not followers)
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];

      const filteredEvents = [];

      for (const event of events) {
        const canView = await this.canUserViewEvent(event, userId, userFriends);
        if (canView) {
          filteredEvents.push(event);
        }
      }

      return filteredEvents;

    } catch (error) {
      console.error('❌ PHASE 3: Error filtering events by privacy:', error);
      return events; // Return unfiltered on error to avoid breaking the app
    }
  }

  /**
   * ✅ PHASE 3: Updated to use FRIENDS instead of followers
   * Check if user can view a specific event
   */
  static async canUserViewEvent(event, userId, userFriends = null) {
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

      // ✅ PHASE 3: Get user FRIENDS if not provided
      if (!userFriends) {
        const user = await User.findById(userId);
        userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      }

      // ✅ PHASE 3: Check privacy level permissions using FRIENDS
      switch (event.privacyLevel) {
        case 'public':
          // Public events are visible to everyone if they appear in search/feed
          return event.permissions?.appearInSearch || event.permissions?.appearInFeed;

        case 'friends':
          // ✅ FRIENDS-ONLY events are visible if user is friends with host
          return userFriends.includes(hostIdStr) && 
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
      console.error('❌ PHASE 3: Error checking user view permission:', error);
      return false; // Deny access on error for security
    }
  }

  /**
   * ✅ PHASE 3: Updated to use FRIENDS instead of followers
   * Search events with privacy filtering
   */
  static async searchEvents(query, userId, options = {}) {
    try {
      const { limit = 20, skip = 0, category } = options;

      console.log(`🔍 PHASE 3: Searching events for query: "${query}" (friends system)`);

      // ✅ PHASE 3: Get user FRIENDS for privacy filtering
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];

      // Build search query with friends-based privacy filtering
      const searchQuery = {
        $text: { $search: query },
        time: { $gte: new Date() },
        $or: [
          // Public events
          {
            privacyLevel: 'public',
            'permissions.appearInSearch': true
          },
          // ✅ FRIENDS-ONLY events
          {
            privacyLevel: 'friends',
            'permissions.appearInSearch': true,
            host: { $in: userFriends }
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

      console.log('🔍 PHASE 3: Friends-based search query:', JSON.stringify(searchQuery, null, 2));

      const events = await Event.find(searchQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ score: { $meta: 'textScore' }, time: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 3: Search found ${events.length} events using friends system`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 3: Error in searchEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ PHASE 3: Updated to use FRIENDS instead of followers
   * Get user's events with privacy metadata
   */
  static async getUserEvents(userId, requestingUserId, options = {}) {
    try {
      const { limit = 20, skip = 0, includePast = false } = options;
      const isOwnProfile = userId.toString() === requestingUserId.toString();

      console.log(`👤 PHASE 3: Getting events for user ${userId}, requested by ${requestingUserId} (friends system)`);
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

      // If not own profile, apply friends-based privacy filtering
      if (!isOwnProfile) {
        const requestingUser = await User.findById(requestingUserId);
        const userFriends = requestingUser ? requestingUser.getAcceptedFriends().map(f => String(f)) : [];

        // ✅ PHASE 3: Only show events the requesting user can see based on FRIENDS
        query.$and = [
          query,
          {
            $or: [
              // Public events
              { privacyLevel: 'public' },
              // ✅ FRIENDS-ONLY events if users are friends
              {
                privacyLevel: 'friends',
                host: userId,
                _id: { $in: userFriends.includes(String(userId)) ? [userId] : [] }
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

      console.log(`✅ PHASE 3: Found ${events.length} user events using friends system`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getUserEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ PHASE 3: Updated friends feed count
   */
  static async getFriendsFeedCount(userId, options = {}) {
    try {
      const { friendIds } = options;

      // ✅ PHASE 3: Get user's FRIENDS (not following)
      let userFriends = friendIds;
      if (!userFriends) {
        const user = await User.findById(userId);
        userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      }

      if (userFriends.length === 0) {
        return 0;
      }

      const friendsQuery = {
        host: { $in: userFriends },
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

      const count = await Event.countDocuments(friendsQuery);
      console.log(`📊 PHASE 3: Friends feed count: ${count}`);

      return count;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getFriendsFeedCount:', error);
      return 0;
    }
  }

  /**
   * ✅ PHASE 3: Enhanced getFeedEvents method with recommendations (friends system)
   */
  static async getEnhancedFeedEvents(userId, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0,
        includeRecommendations = false
      } = options;

      console.log(`📰 PHASE 3: Getting enhanced feed events for user ${userId} (friends system)`);

      // ✅ PHASE 3: Get user's FRIENDS list and attending events
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      const userEventAttendance = user ? user.attendingEvents.map(e => String(e)) : [];

      // ✅ PHASE 3: Build comprehensive feed query with friends-based privacy filtering
      const feedQuery = {
        time: { $gte: new Date() },
        'permissions.appearInFeed': true,
        $or: [
          // Public events (discoverable by everyone)
          { privacyLevel: 'public' },
          // ✅ FRIENDS-ONLY events from actual friends
          {
            privacyLevel: 'friends',
            host: { $in: userFriends }
          },
          // Private events user is invited to
          {
            privacyLevel: 'private',
            invitedUsers: userId
          },
          // Events user is attending (regardless of privacy)
          {
            _id: { $in: userEventAttendance }
          }
        ]
      };

      console.log('📰 PHASE 3: Enhanced friends-based feed query:', JSON.stringify(feedQuery, null, 2));

      let events = await Event.find(feedQuery)
        .populate('host', 'username profilePicture displayName')
        .populate('attendees', 'username profilePicture')
        .sort({ createdAt: -1 }) // Newest first, or use scoring algorithm
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // ✅ PHASE 3: Add intelligent event scoring/ranking if recommendations enabled
      if (includeRecommendations && events.length > 0) {
        events = await this.rankFeedEvents(events, userId, userFriends, userEventAttendance);
      }

      console.log(`✅ PHASE 3: Found ${events.length} enhanced feed events using friends system`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 3: Error in enhanced getFeedEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ PHASE 3: Get count of feed events (friends system)
   */
  static async getFeedEventsCount(userId) {
    try {
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      const userEventAttendance = user ? user.attendingEvents.map(e => String(e)) : [];

      const feedQuery = {
        time: { $gte: new Date() },
        'permissions.appearInFeed': true,
        $or: [
          { privacyLevel: 'public' },
          {
            privacyLevel: 'friends',
            host: { $in: userFriends }
          },
          {
            privacyLevel: 'private',
            invitedUsers: userId
          },
          {
            _id: { $in: userEventAttendance }
          }
        ]
      };

      const count = await Event.countDocuments(feedQuery);
      console.log(`📊 PHASE 3: Feed events count (friends system): ${count}`);

      return count;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getFeedEventsCount:', error);
      return 0;
    }
  }

  /**
   * ✅ PHASE 3: Intelligent event ranking for personalized feeds (friends system)
   */
  static async rankFeedEvents(events, userId, userFriends, userEventAttendance) {
    try {
      console.log(`🎯 PHASE 3: Ranking ${events.length} events for user ${userId} (friends system)`);

      // Enhanced scoring algorithm for friends system
      const scoredEvents = events.map(event => {
        let score = 0;
        const eventObj = event.toObject ? event.toObject() : event;

        // Base score factors
        const isFriendWithHost = userFriends.includes(eventObj.host._id.toString());
        const isAttending = userEventAttendance.includes(eventObj._id.toString());
        const attendeeCount = eventObj.attendees ? eventObj.attendees.length : 0;
        const timeUntilEvent = new Date(eventObj.time) - new Date();
        const daysUntilEvent = timeUntilEvent / (1000 * 60 * 60 * 24);

        // ✅ PHASE 3: Enhanced scoring factors for friends system
        if (isAttending) score += 100; // Highest priority
        if (isFriendWithHost) score += 60; // Higher priority for friends vs followers
        if (eventObj.privacyLevel === 'private') score += 30; // Private invites are important
        if (eventObj.privacyLevel === 'friends') score += 20; // Friends-only events get boost
        if (attendeeCount > 0) score += Math.min(attendeeCount * 2, 20); // Popular events
        if (daysUntilEvent <= 7) score += 15; // Events happening soon
        if (daysUntilEvent <= 1) score += 25; // Events happening very soon

        // Count mutual friends attending
        const mutualFriendsAttending = eventObj.attendees ? 
          eventObj.attendees.filter(a => userFriends.includes(a._id.toString())).length : 0;
        if (mutualFriendsAttending > 0) score += mutualFriendsAttending * 5;

        // Penalize events far in the future
        if (daysUntilEvent > 30) score -= 10;

        return {
          ...eventObj,
          _feedScore: score,
          _scoringFactors: {
            isAttending,
            isFriendWithHost,
            attendeeCount,
            mutualFriendsAttending,
            daysUntilEvent: Math.round(daysUntilEvent),
            privacyLevel: eventObj.privacyLevel
          }
        };
      });

      // Sort by score (highest first)
      const rankedEvents = scoredEvents.sort((a, b) => b._feedScore - a._feedScore);

      console.log(`🎯 PHASE 3: Events ranked by score (friends system):`, 
        rankedEvents.slice(0, 5).map(e => ({
          title: e.title,
          score: e._feedScore,
          factors: e._scoringFactors
        }))
      );

      return rankedEvents;

    } catch (error) {
      console.error('❌ PHASE 3: Error ranking feed events:', error);
      return events; // Return unranked on error
    }
  }

  /**
   * ✅ PHASE 3: Get personalized event recommendations (friends system)
   */
  static async getPersonalizedRecommendations(userId, options = {}) {
    try {
      const { limit = 10, excludeEventIds = [] } = options;

      console.log(`🎲 PHASE 3: Getting personalized recommendations for user ${userId} (friends system)`);

      // Get user's interests and event history
      const user = await User.findById(userId);
      if (!user) return [];

      const userFriends = user.getAcceptedFriends().map(f => String(f));
      const userEventAttendance = user.attendingEvents || [];

      // Analyze user's event preferences
      const attendedEvents = await Event.find({ _id: { $in: userEventAttendance } })
        .select('category tags');

      const userCategories = attendedEvents
        .map(e => e.category)
        .filter(Boolean);
      
      const userTags = attendedEvents
        .flatMap(e => e.tags || [])
        .filter(Boolean);

      // ✅ PHASE 3: Build recommendation query using friends system
      const recommendationQuery = {
        _id: { $nin: excludeEventIds },
        time: { $gte: new Date() },
        'permissions.appearInFeed': true,
        $or: [
          { privacyLevel: 'public' },
          {
            privacyLevel: 'friends',
            host: { $in: userFriends }
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

      console.log(`✅ PHASE 3: Found ${recommendations.length} personalized recommendations using friends system`);

      return recommendations;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getPersonalizedRecommendations:', error);
      return [];
    }
  }

  /**
   * ✅ PHASE 3: Get public events (no friends required)
   * This ensures public events remain discoverable regardless of friendship
   */
  static async getPublicEvents(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, category } = options;

      console.log(`🌍 PHASE 3: Getting public events (no friends filtering required)`);

      let query = {
        privacyLevel: 'public',
        'permissions.appearInSearch': true,
        time: { $gte: new Date() }
      };

      if (category) {
        query.category = category;
      }

      const events = await Event.find(query)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ PHASE 3: Found ${events.length} public events (always discoverable)`);

      return events;

    } catch (error) {
      console.error('❌ PHASE 3: Error in getPublicEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ PHASE 3: Check if user can view photos from an event
   * This handles the special case: users who attended same event can see photos
   */
  static async canUserViewEventPhotos(userId, eventId, userFriends = null, userEventAttendance = null) {
    try {
      const event = await Event.findById(eventId).populate('host', '_id');
      if (!event) return false;

      const userIdStr = String(userId);
      const hostIdStr = String(event.host._id);

      // Host can always see photos from their events
      if (userIdStr === hostIdStr) return true;

      // Get user data if not provided
      if (!userFriends || !userEventAttendance) {
        const user = await User.findById(userId);
        userFriends = userFriends || (user ? user.getAcceptedFriends().map(f => String(f)) : []);
        userEventAttendance = userEventAttendance || (user ? user.attendingEvents.map(e => String(e)) : []);
      }

      // ✅ CRITICAL: If user attended this event, they can see ALL photos
      if (userEventAttendance.includes(String(eventId))) {
        return true;
      }

      // Use the event's photo privacy method
      return event.canUserViewEventPhotos(userId, userFriends, userEventAttendance);

    } catch (error) {
      console.error('❌ PHASE 3: Error checking photo view permission:', error);
      return false;
    }
  }
}

module.exports = EventDiscoveryService;