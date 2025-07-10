// services/eventPrivacyService.js - FIXED VERSION
const Event = require('../models/Event');
const User = require('../models/User');

class EventPrivacyService {
  
  /**
   * Get events that a user can view based on privacy settings
   */
  static async getVisibleEvents(userId, options = {}) {
    const {
      includeSecret = false,
      location,
      radius = 50, // km
      interests = [],
      limit = 20,
      skip = 0
    } = options;

    const user = await User.findById(userId).populate('following', '_id');
    const followingIds = user.following.map(f => String(f._id));
    const userIdStr = String(userId);

    // Build query based on privacy levels
    const query = {
      $and: [
        { time: { $gte: new Date() } }, // Future events only
        {
          $or: [
            // Public events that appear in search
            { 
              privacyLevel: 'public',
              'permissions.appearInSearch': true
            },
            
            // Friends-only events where user follows host
            {
              privacyLevel: 'friends',
              host: { $in: followingIds }
            },
            
            // Private events where user is invited/attending
            {
              privacyLevel: 'private',
              $or: [
                { invitedUsers: userId },
                { attendees: userId },
                { host: userId },
                { coHosts: userId }
              ]
            },
            
            // Secret events (only if specifically requested and user has access)
            ...(includeSecret ? [{
              privacyLevel: 'secret',
              $or: [
                { invitedUsers: userId },
                { attendees: userId },
                { host: userId },
                { coHosts: userId }
              ]
            }] : [])
          ]
        }
      ]
    };

    // Add location filter if specified
    if (location && location.coordinates) {
      query.$and.push({
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: location.coordinates
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        }
      });
    }

    // Add interest filter if specified
    if (interests.length > 0) {
      query.$and.push({
        category: { $in: interests }
      });
    }

    const events = await Event.find(query)
      .populate('host', 'username profilePicture')
      .populate('attendees', 'username')
      .sort({ time: 1 })
      .limit(limit)
      .skip(skip);

    return events;
  }

  /**
   * Get personalized event recommendations
   */
  static async getRecommendations(userId, limit = 10) {
    const user = await User.findById(userId).populate('following', '_id');
    const followingIds = user.following.map(f => String(f._id));

    const recommendations = {
      following: await this.getFollowingEvents(userId, followingIds, Math.ceil(limit * 0.4)),
      interests: await this.getInterestBasedEvents(userId, user.interests, Math.ceil(limit * 0.3)),
      location: await this.getLocationBasedEvents(userId, user.location, Math.ceil(limit * 0.2)),
      trending: await this.getTrendingEvents(userId, Math.ceil(limit * 0.1))
    };

    return this.scoreAndCombineRecommendations(recommendations, user).slice(0, limit);
  }

  /**
   * Get events from users being followed
   */
  static async getFollowingEvents(userId, followingIds, limit) {
    const events = await Event.find({
      host: { $in: followingIds },
      time: { $gte: new Date() },
      privacyLevel: { $in: ['public', 'friends'] },
      'permissions.appearInFeed': true,
      attendees: { $ne: userId } // Don't recommend events already attending
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'following',
      score: 0.8
    }));
  }

  /**
   * Get events based on user interests
   */
  static async getInterestBasedEvents(userId, interests, limit) {
    if (!interests || interests.length === 0) return [];

    const events = await Event.find({
      category: { $in: interests },
      time: { $gte: new Date() },
      privacyLevel: 'public',
      'permissions.appearInSearch': true,
      attendees: { $ne: userId },
      host: { $ne: userId }
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'interests',
      score: 0.6
    }));
  }

  /**
   * Get events based on user location
   */
  static async getLocationBasedEvents(userId, userLocation, limit) {
    if (!userLocation || !userLocation.coordinates) return [];

    const events = await Event.find({
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: userLocation.coordinates
          },
          $maxDistance: 25000 // 25km radius
        }
      },
      time: { $gte: new Date() },
      privacyLevel: 'public',
      'permissions.appearInSearch': true,
      attendees: { $ne: userId },
      host: { $ne: userId }
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'location',
      score: 0.5
    }));
  }

  /**
   * Get trending events (high attendance)
   */
  static async getTrendingEvents(userId, limit) {
    const events = await Event.find({
      time: { $gte: new Date() },
      privacyLevel: 'public',
      'permissions.appearInSearch': true,
      attendees: { $ne: userId },
      host: { $ne: userId }
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ 'attendees': -1, time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'trending',
      score: Math.min(0.7, event.attendees.length / 100)
    }));
  }

  /**
   * Get weather-appropriate events
   */
  static async getWeatherBasedEvents(userId, weather, limit) {
    if (!weather) return [];

    let weatherQuery = {};
    
    // Match events to weather conditions
    if (weather.main === 'Rain' || weather.main === 'Drizzle') {
      weatherQuery = {
        $or: [
          { location: { $regex: /indoor|mall|center|building/i } },
          { category: { $in: ['indoor', 'entertainment', 'shopping'] } }
        ]
      };
    } else if (weather.main === 'Clear' && weather.main.temp > 20) {
      weatherQuery = {
        $or: [
          { location: { $regex: /park|beach|outdoor|garden/i } },
          { category: { $in: ['outdoor', 'sports', 'festival'] } }
        ]
      };
    }

    if (Object.keys(weatherQuery).length === 0) return [];

    const events = await Event.find({
      ...weatherQuery,
      time: { $gte: new Date() },
      privacyLevel: 'public',
      'permissions.appearInSearch': true,
      weatherDependent: true
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'weather',
      score: 0.5
    }));
  }

  /**
   * Score and combine different recommendation types
   */
  static scoreAndCombineRecommendations(recommendations, user) {
    const combined = [];
    const seenEventIds = new Set();

    // Process each recommendation type
    Object.entries(recommendations).forEach(([type, events]) => {
      events.forEach(event => {
        if (!seenEventIds.has(event._id.toString())) {
          seenEventIds.add(event._id.toString());
          combined.push(event);
        }
      });
    });

    // Sort by score and time
    return combined.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return new Date(a.time) - new Date(b.time);
    });
  }

  /**
   * ✅ FIXED: Check if user can perform specific action on event
   */
  static async checkPermission(userId, eventId, action) {
    try {
      // ✅ FIX: Use findById instead of lean() to get full Mongoose document with methods
      const event = await Event.findById(eventId)
        .populate('host', '_id username')
        .populate('coHosts', '_id username')
        .populate('attendees', '_id username')
        .populate('invitedUsers', '_id username');
        
      if (!event) {
        return { allowed: false, reason: 'Event not found' };
      }

      const user = await User.findById(userId).populate('following', '_id');
      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      const userFollowing = user.following.map(f => String(f._id));

      switch (action) {
        case 'view':
          return {
            allowed: event.canUserView(userId, userFollowing),
            reason: event.canUserView(userId, userFollowing) ? null : 'Not authorized to view this event'
          };

        case 'join':
          return {
            allowed: event.canUserJoin(userId, userFollowing),
            reason: event.canUserJoin(userId, userFollowing) ? null : 'Cannot join this event'
          };

        case 'invite':
          return {
            allowed: event.canUserInvite(userId),
            reason: event.canUserInvite(userId) ? null : 'Cannot invite others to this event'
          };

        case 'edit':
          const canEdit = String(event.host._id || event.host) === String(userId) || 
                         (event.coHosts && event.coHosts.some(c => String(c._id || c) === String(userId)));
          return {
            allowed: canEdit,
            reason: canEdit ? null : 'Only host and co-hosts can edit this event'
          };

        default:
          return { allowed: false, reason: 'Unknown action' };
      }
    } catch (error) {
      console.error('❌ EventPrivacyService.checkPermission error:', error);
      return { allowed: false, reason: 'Permission check failed' };
    }
  }

  /**
   * Create event from group chat (one-click creation)
   */
  static async createFromGroupChat(groupId, hostId, eventData) {
    const Group = require('../models/Group');
    const group = await Group.findById(groupId).populate('members');
    
    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.members.some(m => String(m._id) === String(hostId))) {
      throw new Error('You must be a group member to create events');
    }

    // Create event with group members auto-invited
    const event = new Event({
      ...eventData,
      host: hostId,
      group: groupId,
      privacyLevel: 'private', // Group events are private by default
      invitedUsers: group.members.map(m => m._id),
      permissions: {
        canView: 'invitees',
        canJoin: 'invited',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: false,
        appearInSearch: false,
        showAttendeesToPublic: false
      }
    });

    await event.save();

    // Add event to group
    group.events.push(event._id);
    await group.save();

    return event;
  }
}

module.exports = EventPrivacyService;