// services/EventPrivacyService.js - Privacy & Discovery Logic
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

    // Add location filter if provided
    if (location && location.coordinates) {
      query.$and.push({
        geo: {
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

    // Add interest filter
    if (interests.length > 0) {
      query.$and.push({
        $or: [
          { category: { $in: interests } },
          { tags: { $in: interests } },
          { interests: { $in: interests } }
        ]
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
  static async getRecommendations(userId, options = {}) {
    const {
      location,
      weatherData,
      limit = 10
    } = options;

    const user = await User.findById(userId)
      .populate('following', '_id interests')
      .populate('attendingEvents', 'category tags interests');

    // Get user's interests from profile and past events
    const userInterests = [
      ...(user.interests || []),
      ...user.attendingEvents.flatMap(e => [e.category, ...(e.tags || []), ...(e.interests || [])])
    ];

    // Get friends' activity
    const friendsEvents = await this.getFriendsActivity(userId, { limit: 5 });

    // Get location-based events
    const locationEvents = location ? 
      await this.getLocationBasedEvents(userId, location, { limit: 10 }) : [];

    // Get interest-based events
    const interestEvents = await this.getInterestBasedEvents(userId, userInterests, { limit: 10 });

    // Get weather-appropriate events
    const weatherEvents = weatherData ? 
      await this.getWeatherBasedEvents(userId, weatherData, { limit: 5 }) : [];

    // Combine and score recommendations
    const recommendations = this.scoreAndCombineRecommendations({
      friends: friendsEvents,
      location: locationEvents,
      interests: interestEvents,
      weather: weatherEvents
    }, user);

    return recommendations.slice(0, limit);
  }

  /**
   * Get events that user's friends are attending
   */
  static async getFriendsActivity(userId, options = {}) {
    const { limit = 10 } = options;

    const user = await User.findById(userId).populate('following', '_id');
    const followingIds = user.following.map(f => f._id);

    const events = await Event.find({
      attendees: { $in: followingIds },
      time: { $gte: new Date() },
      privacyLevel: { $in: ['public', 'friends'] },
      'permissions.appearInFeed': true
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'friends',
      score: 0.8
    }));
  }

  /**
   * Get events near user's location
   */
  static async getLocationBasedEvents(userId, location, options = {}) {
    const { radius = 25, limit = 10 } = options;

    if (!location.coordinates) return [];

    const events = await Event.find({
      geo: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: location.coordinates
          },
          $maxDistance: radius * 1000
        }
      },
      time: { $gte: new Date() },
      privacyLevel: 'public',
      'permissions.appearInSearch': true
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'location',
      score: 0.6
    }));
  }

  /**
   * Get events matching user's interests
   */
  static async getInterestBasedEvents(userId, interests, options = {}) {
    const { limit = 10 } = options;

    if (!interests.length) return [];

    const events = await Event.find({
      $or: [
        { category: { $in: interests } },
        { tags: { $in: interests } },
        { interests: { $in: interests } }
      ],
      time: { $gte: new Date() },
      privacyLevel: 'public',
      'permissions.appearInSearch': true
    })
    .populate('host', 'username profilePicture')
    .populate('attendees', 'username')
    .sort({ time: 1 })
    .limit(limit);

    return events.map(event => ({
      ...event.toObject(),
      recommendationType: 'interests',
      score: 0.7
    }));
  }

  /**
   * Get weather-appropriate events
   */
  static async getWeatherBasedEvents(userId, weatherData, options = {}) {
    const { limit = 5 } = options;

    // Simple weather-based filtering
    const isRainy = weatherData.condition?.includes('rain');
    const isHot = weatherData.temperature > 30;
    const isCold = weatherData.temperature < 10;

    let weatherQuery = {};
    
    if (isRainy) {
      weatherQuery = {
        $or: [
          { category: { $in: ['Indoor', 'Museum', 'Shopping', 'Movies'] } },
          { tags: { $in: ['indoor', 'covered'] } }
        ]
      };
    } else if (isHot) {
      weatherQuery = {
        $or: [
          { category: { $in: ['Beach', 'Pool', 'Water Sports', 'Indoor'] } },
          { tags: { $in: ['swimming', 'air-conditioned'] } }
        ]
      };
    } else if (isCold) {
      weatherQuery = {
        $or: [
          { category: { $in: ['Indoor', 'Fitness', 'Arts', 'Food'] } },
          { tags: { $in: ['warm', 'heated'] } }
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
   * Check if user can perform specific action on event
   */
  static async checkPermission(userId, eventId, action) {
    const event = await Event.findById(eventId).populate('host coHosts attendees invitedUsers');
    if (!event) return { allowed: false, reason: 'Event not found' };

    const user = await User.findById(userId).populate('following', '_id');
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
        const canEdit = String(event.host) === String(userId) || 
                       event.coHosts.some(c => String(c) === String(userId));
        return {
          allowed: canEdit,
          reason: canEdit ? null : 'Only host and co-hosts can edit this event'
        };

      default:
        return { allowed: false, reason: 'Unknown action' };
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