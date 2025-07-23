// services/eventDiscoveryService.js - FIXED: Remove permissions.appearInFeed dependencies
const Event = require('../models/Event');
const User = require('../models/User');

class EventDiscoveryService {
  
  /**
   * ✅ FIXED: Get discoverable events WITHOUT permissions.appearInFeed checks
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

      console.log(`\n🔍 === DEBUGGING DISCOVERABLE EVENTS ===`);
      console.log(`User: ${userId}, Options:`, { limit, skip, category, includePrivate });

      // Get user's FRIENDS list
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];

      console.log(`👥 User has ${userFriends.length} friends: ${userFriends}`);

      // ✅ SIMPLIFIED: Build query WITHOUT permissions checks
      const baseQuery = {
        time: { $gte: new Date() }, // Only future events
        $or: []
      };

      // ✅ FIXED: Public events - NO permissions check
      baseQuery.$or.push({
        privacyLevel: 'public'
      });

      // Friends-only events - visible if user is friends with host
      if (userFriends.length > 0) {
        baseQuery.$or.push({
          privacyLevel: 'friends',
          host: { $in: userFriends }
        });
      }

      // Private events - only if user is invited
      if (includePrivate) {
        baseQuery.$or.push({
          privacyLevel: 'private',
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
            $maxDistance: radius * 1000
          }
        };
      }

      console.log('📋 Discovery query (NO permissions checks):', JSON.stringify(baseQuery, null, 2));

      // Count events by category
      const publicCount = await Event.countDocuments({ 
        privacyLevel: 'public', 
        time: { $gte: new Date() } 
      });
      const friendsCount = userFriends.length > 0 ? await Event.countDocuments({ 
        privacyLevel: 'friends',
        host: { $in: userFriends },
        time: { $gte: new Date() } 
      }) : 0;

      console.log(`📊 Available events: ${publicCount} public, ${friendsCount} from friends`);

      const events = await Event.find(baseQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ [sortBy]: sortBy === 'time' ? 1 : -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ Found ${events.length} discoverable events`);
      console.log(`🔍 === END DISCOVERABLE EVENTS DEBUG ===\n`);

      return events;

    } catch (error) {
      console.error('❌ Error in getDiscoverableEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Get friends feed WITHOUT permissions.appearInFeed
   */
  static async getFriendsFeed(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, friendIds } = options;

      console.log(`\n📱 === DEBUGGING FRIENDS FEED ===`);
      console.log(`User: ${userId}`);

      // Get user's FRIENDS
      let userFriends = friendIds;
      if (!userFriends) {
        const user = await User.findById(userId);
        userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      }

      console.log(`👥 User has ${userFriends.length} friends: ${userFriends}`);

      if (userFriends.length === 0) {
        console.log(`❌ No friends found, returning empty feed`);
        return [];
      }

      // ✅ SIMPLIFIED: Build query WITHOUT permissions.appearInFeed
      const friendsQuery = {
        host: { $in: userFriends },
        time: { $gte: new Date() }, // Only future events
        $or: [
          // Public events from friends
          { privacyLevel: 'public' },
          // Friends-only events from friends
          { privacyLevel: 'friends' },
          // Private events where user is invited
          {
            privacyLevel: 'private',
            invitedUsers: userId
          }
        ]
      };

      console.log('📱 Friends feed query (NO permissions):', JSON.stringify(friendsQuery, null, 2));

      const events = await Event.find(friendsQuery)
        .populate('host', 'username profilePicture displayName')
        .populate('attendees', 'username profilePicture')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ Found ${events.length} friends feed events`);
      
      // Debug each event
      events.forEach((event, index) => {
        console.log(`   ${index + 1}. "${event.title}" by ${event.host.username} (${event.privacyLevel})`);
      });

      console.log(`📱 === END FRIENDS FEED DEBUG ===\n`);

      return events;

    } catch (error) {
      console.error('❌ Error in getFriendsFeed:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Main feed method WITHOUT permissions.appearInFeed
   */
  static async getFeedEvents(userId, options = {}) {
    try {
      const { limit = 20, skip = 0 } = options;

      console.log(`\n📰 === DEBUGGING MAIN FEED ===`);
      console.log(`User: ${userId}, Limit: ${limit}, Skip: ${skip}`);

      // Get user's FRIENDS list and event attendance
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      const userEventAttendance = user ? user.attendingEvents.map(e => String(e)) : [];

      console.log(`👥 User has ${userFriends.length} friends`);
      console.log(`🎫 User attending ${userEventAttendance.length} events`);

      // ✅ SIMPLIFIED: Build feed query WITHOUT permissions.appearInFeed
      const feedQuery = {
        time: { $gte: new Date() },
        $or: [
          // ✅ FIXED: Public events (NO permissions check)
          { privacyLevel: 'public' },
          // Friends-only events from actual friends
          {
            privacyLevel: 'friends',
            host: { $in: userFriends }
          },
          // Private events user is invited to
          {
            privacyLevel: 'private',
            invitedUsers: userId
          },
          // Events user is attending (can see regardless of privacy)
          {
            _id: { $in: userEventAttendance }
          }
        ]
      };

      console.log('📰 Main feed query (NO permissions):', JSON.stringify(feedQuery, null, 2));

      // Debug: Count events by category
      const publicEventsCount = await Event.countDocuments({ 
        privacyLevel: 'public', 
        time: { $gte: new Date() } 
      });
      
      const friendsEventsCount = userFriends.length > 0 ? await Event.countDocuments({ 
        privacyLevel: 'friends',
        host: { $in: userFriends },
        time: { $gte: new Date() } 
      }) : 0;

      console.log(`📊 BREAKDOWN:`);
      console.log(`   - Public events total: ${publicEventsCount}`);
      console.log(`   - Friends events total: ${friendsEventsCount}`);
      console.log(`   - User attending: ${userEventAttendance.length}`);

      const events = await Event.find(feedQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ createdAt: -1 }) // Newest first
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ FINAL RESULT: Found ${events.length} feed events`);
      
      // Debug each event found
      events.forEach((event, index) => {
        const hostId = String(event.host._id);
        const isFriend = userFriends.includes(hostId);
        const isAttending = userEventAttendance.includes(String(event._id));
        
        console.log(`   ${index + 1}. "${event.title}" by ${event.host.username}`);
        console.log(`      Privacy: ${event.privacyLevel}, Host is friend: ${isFriend}, Attending: ${isAttending}`);
      });

      console.log(`📰 === END MAIN FEED DEBUG ===\n`);

      return events;

    } catch (error) {
      console.error('❌ Error in getFeedEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Filter events array by privacy rules (NO permissions checks)
   */
  static async filterEventsByPrivacy(events, userId) {
    try {
      if (!events || events.length === 0) return [];

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
      console.error('❌ Error filtering events by privacy:', error);
      return events; // Return unfiltered on error to avoid breaking the app
    }
  }

  /**
   * ✅ SIMPLIFIED: Check if user can view event (no permissions checks)
   */
  static async canUserViewEvent(event, userId, userFriends = null) {
    try {
      const userIdStr = userId.toString();
      const hostIdStr = event.host._id ? event.host._id.toString() : event.host.toString();

      console.log(`\n🔍 === CHECKING VIEW PERMISSION ===`);
      console.log(`Event: "${event.title}" (${event.privacyLevel})`);
      console.log(`Host: ${hostIdStr}, Viewer: ${userIdStr}`);

      // Host can always view their own events
      if (userIdStr === hostIdStr) {
        console.log(`✅ ALLOWED: User is the host`);
        return true;
      }

      // Co-hosts can always view
      if (event.coHosts && event.coHosts.some(c => c.toString() === userIdStr)) {
        console.log(`✅ ALLOWED: User is co-host`);
        return true;
      }

      // Attendees can always view
      if (event.attendees && event.attendees.some(a => 
        a._id ? a._id.toString() === userIdStr : a.toString() === userIdStr)) {
        console.log(`✅ ALLOWED: User is attendee`);
        return true;
      }

      // Get user FRIENDS if not provided
      if (!userFriends) {
        const user = await User.findById(userId);
        userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      }

      const isFriend = userFriends.includes(hostIdStr);
      console.log(`👥 Is host a friend: ${isFriend}`);

      // ✅ SIMPLIFIED: Check privacy level (NO permissions checks)
      switch (event.privacyLevel) {
        case 'public':
          console.log(`✅ ALLOWED: Public event`);
          return true;

        case 'friends':
          if (isFriend) {
            console.log(`✅ ALLOWED: Friends-only event and user is friend`);
            return true;
          } else {
            console.log(`❌ DENIED: Friends-only event but user is not friend`);
            return false;
          }

        case 'private':
          const isInvited = event.invitedUsers && 
            event.invitedUsers.some(u => 
              u._id ? u._id.toString() === userIdStr : u.toString() === userIdStr);
          
          if (isInvited) {
            console.log(`✅ ALLOWED: Private event and user is invited`);
            return true;
          } else {
            console.log(`❌ DENIED: Private event and user is not invited`);
            return false;
          }

        default:
          console.log(`❌ DENIED: Unknown privacy level: ${event.privacyLevel}`);
          return false;
      }

    } catch (error) {
      console.error('❌ Error checking user view permission:', error);
      return false;
    }
  }

  /**
   * ✅ FIXED: Search events WITHOUT permissions checks
   */
  static async searchEvents(query, userId, options = {}) {
    try {
      const { limit = 20, skip = 0, category } = options;

      console.log(`🔍 Searching events for query: "${query}"`);

      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];

      // ✅ SIMPLIFIED: Build search query WITHOUT permissions checks
      const searchQuery = {
        $text: { $search: query },
        time: { $gte: new Date() },
        $or: [
          // Public events
          { privacyLevel: 'public' },
          // Friends-only events
          {
            privacyLevel: 'friends',
            host: { $in: userFriends }
          },
          // Private events user is invited to
          {
            privacyLevel: 'private',
            invitedUsers: userId
          }
        ]
      };

      if (category) {
        searchQuery.category = category;
      }

      const events = await Event.find(searchQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username')
        .sort({ score: { $meta: 'textScore' }, time: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      console.log(`✅ Search found ${events.length} events`);
      return events;

    } catch (error) {
      console.error('❌ Error in searchEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Get user events WITHOUT permissions checks
   */
  static async getUserEvents(userId, requestingUserId, options = {}) {
    try {
      const { limit = 20, skip = 0, includePast = false } = options;
      const isOwnProfile = userId.toString() === requestingUserId.toString();

      console.log(`👤 Getting events for user ${userId}, requested by ${requestingUserId}`);

      let query = {
        $or: [
          { host: userId },
          { attendees: userId }
        ]
      };

      if (!includePast) {
        query.time = { $gte: new Date() };
      }

      // If not own profile, apply privacy filtering
      if (!isOwnProfile) {
        const requestingUser = await User.findById(requestingUserId);
        const userFriends = requestingUser ? requestingUser.getAcceptedFriends().map(f => String(f)) : [];

        query.$and = [
          query,
          {
            $or: [
              // Public events
              { privacyLevel: 'public' },
              // Friends-only events if users are friends
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

      console.log(`✅ Found ${events.length} user events`);
      return events;

    } catch (error) {
      console.error('❌ Error in getUserEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Get friends feed count WITHOUT permissions checks
   */
  static async getFriendsFeedCount(userId, options = {}) {
    try {
      const { friendIds } = options;

      let userFriends = friendIds;
      if (!userFriends) {
        const user = await User.findById(userId);
        userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      }

      if (userFriends.length === 0) {
        return 0;
      }

      // ✅ SIMPLIFIED: No permissions check
      const friendsQuery = {
        host: { $in: userFriends },
        time: { $gte: new Date() },
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
      console.log(`📊 Friends feed count: ${count}`);
      return count;

    } catch (error) {
      console.error('❌ Error in getFriendsFeedCount:', error);
      return 0;
    }
  }

  /**
   * ✅ FIXED: Enhanced feed events WITHOUT permissions checks
   */
  static async getEnhancedFeedEvents(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, includeRecommendations = false } = options;

      console.log(`📰 Getting enhanced feed events for user ${userId}`);

      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      const userEventAttendance = user ? user.attendingEvents.map(e => String(e)) : [];

      // ✅ SIMPLIFIED: No permissions checks
      const feedQuery = {
        time: { $gte: new Date() },
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

      let events = await Event.find(feedQuery)
        .populate('host', 'username profilePicture displayName')
        .populate('attendees', 'username profilePicture')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      if (includeRecommendations && events.length > 0) {
        events = await this.rankFeedEvents(events, userId, userFriends, userEventAttendance);
      }

      console.log(`✅ Found ${events.length} enhanced feed events`);
      return events;

    } catch (error) {
      console.error('❌ Error in enhanced getFeedEvents:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Get feed events count WITHOUT permissions checks
   */
  static async getFeedEventsCount(userId) {
    try {
      const user = await User.findById(userId);
      const userFriends = user ? user.getAcceptedFriends().map(f => String(f)) : [];
      const userEventAttendance = user ? user.attendingEvents.map(e => String(e)) : [];

      // ✅ SIMPLIFIED: No permissions checks
      const feedQuery = {
        time: { $gte: new Date() },
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
      console.log(`📊 Feed events count: ${count}`);
      return count;

    } catch (error) {
      console.error('❌ Error in getFeedEventsCount:', error);
      return 0;
    }
  }

  /**
   * ✅ FIXED: Get public events (guaranteed to work)
   */
  static async getPublicEvents(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, category } = options;

      console.log(`🌍 Getting public events (should always work)`);

      let query = {
        privacyLevel: 'public',
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

      console.log(`✅ Found ${events.length} public events (always discoverable)`);
      return events;

    } catch (error) {
      console.error('❌ Error in getPublicEvents:', error);
      throw error;
    }
  }

  /**
   * 🐛 NEW: Debug specific event visibility
   */
  static async debugEventVisibility(eventId, userId) {
    try {
      console.log(`\n🐛 === DEBUGGING EVENT VISIBILITY ===`);
      console.log(`Event ID: ${eventId}, User ID: ${userId}`);

      const event = await Event.findById(eventId).populate('host', 'username');
      const user = await User.findById(userId);

      if (!event) {
        console.log(`❌ Event not found`);
        return { canView: false, reason: 'Event not found' };
      }

      if (!user) {
        console.log(`❌ User not found`);
        return { canView: false, reason: 'User not found' };
      }

      console.log(`📋 Event Details:`);
      console.log(`   Title: "${event.title}"`);
      console.log(`   Host: ${event.host.username} (${event.host._id})`);
      console.log(`   Privacy: ${event.privacyLevel}`);
      console.log(`   Created: ${event.createdAt}`);
      console.log(`   Permissions: ${JSON.stringify(event.permissions)}`);

      const userFriends = user.getAcceptedFriends().map(f => String(f));
      console.log(`👥 User Friends (${userFriends.length}): ${userFriends}`);

      const canView = await this.canUserViewEvent(event, userId, userFriends);
      
      console.log(`🔍 Final Result: ${canView ? 'CAN VIEW' : 'CANNOT VIEW'}`);
      console.log(`🐛 === END DEBUGGING ===\n`);

      return { 
        canView, 
        eventDetails: {
          title: event.title,
          host: event.host.username,
          hostId: String(event.host._id),
          privacyLevel: event.privacyLevel,
          permissions: event.permissions
        },
        userDetails: {
          username: user.username,
          friendsCount: userFriends.length,
          friends: userFriends
        }
      };

    } catch (error) {
      console.error('❌ Error in debugEventVisibility:', error);
      return { canView: false, reason: error.message };
    }
  }

  /**
   * ✅ Intelligent event ranking for personalized feeds
   */
  static async rankFeedEvents(events, userId, userFriends, userEventAttendance) {
    try {
      console.log(`🎯 Ranking ${events.length} events for user ${userId}`);

      const scoredEvents = events.map(event => {
        let score = 0;
        const eventObj = event.toObject ? event.toObject() : event;

        // Base score factors
        const isFriendWithHost = userFriends.includes(eventObj.host._id.toString());
        const isAttending = userEventAttendance.includes(eventObj._id.toString());
        const attendeeCount = eventObj.attendees ? eventObj.attendees.length : 0;
        const timeUntilEvent = new Date(eventObj.time) - new Date();
        const daysUntilEvent = timeUntilEvent / (1000 * 60 * 60 * 24);

        // Scoring factors
        if (isAttending) score += 100; // Highest priority
        if (isFriendWithHost) score += 60; // Higher priority for friends
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

      console.log(`🎯 Events ranked by score:`, 
        rankedEvents.slice(0, 5).map(e => ({
          title: e.title,
          score: e._feedScore,
          factors: e._scoringFactors
        }))
      );

      return rankedEvents;

    } catch (error) {
      console.error('❌ Error ranking feed events:', error);
      return events; // Return unranked on error
    }
  }

  /**
   * ✅ Get personalized event recommendations
   */
  static async getPersonalizedRecommendations(userId, options = {}) {
    try {
      const { limit = 10, excludeEventIds = [] } = options;

      console.log(`🎲 Getting personalized recommendations for user ${userId}`);

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

      // Build recommendation query
      const recommendationQuery = {
        _id: { $nin: excludeEventIds },
        time: { $gte: new Date() },
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

      console.log(`✅ Found ${recommendations.length} personalized recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ Error in getPersonalizedRecommendations:', error);
      return [];
    }
  }

  /**
   * ✅ Check if user can view photos from an event
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

      // If user attended this event, they can see ALL photos
      if (userEventAttendance.includes(String(eventId))) {
        return true;
      }

      // Use the event's photo privacy method if it exists
      if (event.canUserViewEventPhotos) {
        return event.canUserViewEventPhotos(userId, userFriends, userEventAttendance);
      }

      // Default fallback - use same logic as viewing the event
      return this.canUserViewEvent(event, userId, userFriends);

    } catch (error) {
      console.error('❌ Error checking photo view permission:', error);
      return false;
    }
  }
}

module.exports = EventDiscoveryService;