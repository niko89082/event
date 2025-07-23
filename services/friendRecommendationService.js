// services/friendRecommendationService.js
// PHASE 2: Friend Recommendation Service with Event-Based Intelligence

const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');

class FriendRecommendationService {
  
  /**
   * PHASE 2: Main recommendation generation with event intelligence
   */
  static async generateRecommendations(userId, options = {}) {
    const { 
      limit = 10, 
      includeEventData = false,
      minScore = 5,
      prioritizeEventOverlap = false 
    } = options;
    
    try {
      console.log(`🎯 Generating recommendations for user ${userId}`);
      
      // Get user context
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');
      
      const currentFriends = user.getAcceptedFriends();
      const excludeIds = this.getExcludedUserIds(user, currentFriends);
      
      // Get user's event history
      const eventContext = await this.getUserEventContext(userId);
      
      // Generate suggestions using advanced algorithm
      const suggestions = await this.calculateAdvancedSuggestions(
        userId, 
        currentFriends, 
        excludeIds, 
        eventContext, 
        { limit, minScore, prioritizeEventOverlap }
      );
      
      // Enhance suggestions with detailed information
      const enhancedSuggestions = await this.enhanceSuggestions(
        suggestions, 
        currentFriends, 
        eventContext, 
        includeEventData
      );
      
      console.log(`✅ Generated ${enhancedSuggestions.length} recommendations`);
      
      return {
        suggestions: enhancedSuggestions,
        metadata: {
          algorithmVersion: '2.0',
          userEventProfile: {
            attendedEvents: eventContext.attendedEvents.length,
            uniqueCategories: eventContext.categories.length,
            coAttendees: eventContext.coAttendees.size
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Error generating recommendations:', error);
      throw error;
    }
  }
  
  /**
   * Get users to exclude from recommendations
   */
  static getExcludedUserIds(user, currentFriends) {
    const blockedUsers = user.blockedUsers || [];
    const pendingUsers = user.friends.map(f => String(f.user));
    
    return [
      user._id,
      ...currentFriends.map(id => new mongoose.Types.ObjectId(id)),
      ...blockedUsers.map(id => new mongoose.Types.ObjectId(id)),
      ...pendingUsers.map(id => new mongoose.Types.ObjectId(id))
    ];
  }
  
  /**
   * PHASE 2: Get comprehensive user event context
   */
  static async getUserEventContext(userId) {
    // Get all events user attended
    const attendedEvents = await Event.find({
      attendees: userId
    }).select('_id attendees category tags time location').lean();
    
    // Build co-attendance map and category preferences
    const coAttendees = new Set();
    const coAttendanceMap = new Map();
    const categories = new Set();
    const tags = new Set();
    
    attendedEvents.forEach(event => {
      // Track categories and tags for preference matching
      if (event.category) categories.add(event.category);
      if (event.tags) event.tags.forEach(tag => tags.add(tag));
      
      // Track co-attendees
      if (event.attendees && Array.isArray(event.attendees)) {
        event.attendees.forEach(attendee => {
          const attendeeStr = String(attendee);
          if (attendeeStr !== String(userId)) {
            coAttendees.add(attendeeStr);
            
            const currentCount = coAttendanceMap.get(attendeeStr) || 0;
            coAttendanceMap.set(attendeeStr, currentCount + 1);
          }
        });
      }
    });
    
    return {
      attendedEvents,
      attendedEventIds: attendedEvents.map(e => e._id),
      coAttendees,
      coAttendanceMap,
      categories: Array.from(categories),
      tags: Array.from(tags)
    };
  }
  
  /**
   * PHASE 2: Advanced suggestion calculation with event intelligence
   */
  static async calculateAdvancedSuggestions(userId, currentFriends, excludeIds, eventContext, options) {
    const { limit, minScore, prioritizeEventOverlap } = options;
    const currentFriendsObjectIds = currentFriends.map(id => new mongoose.Types.ObjectId(id));
    
    const pipeline = [
      // Stage 1: Find potential friends
      {
        $match: {
          _id: { $nin: excludeIds },
          isPublic: true,
          $or: [
            { 'friends.status': 'accepted' }, // For mutual friends
            { _id: { $in: Array.from(eventContext.coAttendees).map(id => new mongoose.Types.ObjectId(id)) } }
          ]
        }
      },
      
      // Stage 2: Add event overlap calculation
      {
        $lookup: {
          from: 'events',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$userId', '$attendees'] },
                _id: { $in: eventContext.attendedEventIds }
              }
            },
            { $project: { _id: 1, category: 1, tags: 1, time: 1, attendees: 1 } }
          ],
          as: 'sharedEvents'
        }
      },
      
      // Stage 3: Calculate mutual friends
      {
        $addFields: {
          acceptedFriends: {
            $map: {
              input: { $filter: { input: '$friends', cond: { $eq: ['$$this.status', 'accepted'] } } },
              as: 'friend',
              in: '$$friend.user'
            }
          }
        }
      },
      
      // Stage 4: Calculate all scoring metrics
      {
        $addFields: {
          mutualFriendsCount: {
            $size: { $setIntersection: ['$acceptedFriends', currentFriendsObjectIds] }
          },
          mutualEventsCount: { $size: '$sharedEvents' },
          mutualFriendIds: {
            $setIntersection: ['$acceptedFriends', currentFriendsObjectIds]
          },
          
          // Category overlap scoring
          categoryOverlap: {
            $size: {
              $setIntersection: [
                {
                  $map: {
                    input: '$sharedEvents',
                    as: 'event',
                    in: '$$event.category'
                  }
                },
                eventContext.categories
              ]
            }
          }
        }
      },
      
      // Stage 5: Filter by minimum connection
      {
        $match: {
          $or: [
            { mutualFriendsCount: { $gte: 1 } },
            { mutualEventsCount: { $gte: 1 } }
          ]
        }
      },
      
      // Stage 6: Advanced scoring algorithm
      {
        $addFields: {
          // Base scores
          mutualFriendsScore: { $multiply: ['$mutualFriendsCount', 10] },
          mutualEventsScore: { $multiply: ['$mutualEventsCount', prioritizeEventOverlap ? 8 : 5] },
          
          // Bonus calculations
          strongMutualFriendsBonus: { $cond: [{ $gte: ['$mutualFriendsCount', 3] }, 15, 0] },
          highEventOverlapBonus: { $cond: [{ $gte: ['$mutualEventsCount', 3] }, 10, 0] },
          categoryMatchBonus: { $multiply: ['$categoryOverlap', 3] },
          
          // Hybrid bonus (both friends and events)
          hybridBonus: {
            $cond: [
              { $and: [
                { $gte: ['$mutualFriendsCount', 1] },
                { $gte: ['$mutualEventsCount', 1] }
              ]},
              20, 0
            ]
          },
          
          // Recent activity bonus (events in last 6 months)
          recentActivityBonus: {
            $cond: [
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: '$sharedEvents',
                        cond: {
                          $gte: [
                            '$this.time',
                            new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) // 6 months ago
                          ]
                        }
                      }
                    }
                  },
                  0
                ]
              },
              5, 0
            ]
          }
        }
      },
      
      // Stage 7: Calculate total score
      {
        $addFields: {
          suggestionScore: {
            $add: [
              '$mutualFriendsScore',
              '$mutualEventsScore',
              '$strongMutualFriendsBonus',
              '$highEventOverlapBonus',
              '$categoryMatchBonus',
              '$hybridBonus',
              '$recentActivityBonus'
            ]
          }
        }
      },
      
      // Stage 8: Filter by minimum score
      { $match: { suggestionScore: { $gte: minScore } } },
      
      // Stage 9: Sort by score
      { $sort: { suggestionScore: -1, mutualFriendsCount: -1, mutualEventsCount: -1 } },
      
      // Stage 10: Limit results
      { $limit: limit * 2 }, // Get extra for filtering
      
      // Stage 11: Project fields
      {
        $project: {
          username: 1,
          displayName: 1,
          profilePicture: 1,
          bio: 1,
          mutualFriendsCount: 1,
          mutualEventsCount: 1,
          mutualFriendIds: 1,
          sharedEvents: 1,
          categoryOverlap: 1,
          suggestionScore: 1,
          createdAt: 1
        }
      }
    ];
    
    return await User.aggregate(pipeline);
  }
  
  /**
   * PHASE 2: Enhance suggestions with detailed information
   */
  static async enhanceSuggestions(suggestions, currentFriends, eventContext, includeEventData) {
    return await Promise.all(
      suggestions.map(async (user) => {
        // Get mutual friends details
        const mutualFriendsDetails = user.mutualFriendsCount > 0 
          ? await User.find({
              _id: { $in: user.mutualFriendIds.slice(0, 3) }
            }).select('username displayName profilePicture').lean()
          : [];

        // Get shared events details if requested
        let sharedEventsDetails = [];
        if (includeEventData && user.sharedEvents && user.sharedEvents.length > 0) {
          sharedEventsDetails = await Event.find({
            _id: { $in: user.sharedEvents.map(e => e._id).slice(0, 3) }
          }).select('title time category coverImage location').lean();
        }

        // Generate intelligent reason
        const { reason, reasonType } = this.generateSuggestionReason(
          user, 
          mutualFriendsDetails, 
          eventContext
        );

        // Get event co-attendance count
        const eventCoAttendanceCount = eventContext.coAttendanceMap.get(String(user._id)) || 0;

        return {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          mutualFriends: user.mutualFriendsCount,
          mutualEvents: user.mutualEventsCount,
          eventCoAttendance: eventCoAttendanceCount,
          categoryOverlap: user.categoryOverlap || 0,
          mutualFriendsDetails: mutualFriendsDetails,
          sharedEventsDetails: sharedEventsDetails,
          reason: reason,
          reasonType: reasonType,
          score: user.suggestionScore,
          suggestionType: 'enhanced_algorithm_v2'
        };
      })
    );
  }
  
  /**
   * PHASE 2: Generate intelligent suggestion reasons
   */
  static generateSuggestionReason(user, mutualFriendsDetails, eventContext) {
    let reason = '';
    let reasonType = '';
    
    if (user.mutualFriendsCount > 0 && user.mutualEventsCount > 0) {
      // Hybrid reason (strongest signal)
      reasonType = 'hybrid';
      const friendNames = mutualFriendsDetails.slice(0, 2).map(f => f.displayName || f.username);
      
      if (user.mutualEventsCount === 1) {
        reason = friendNames.length === 1 
          ? `Friends with ${friendNames[0]} • Attended an event together`
          : `Friends with ${friendNames.join(', ')} • Attended an event together`;
      } else {
        reason = friendNames.length === 1
          ? `Friends with ${friendNames[0]} • ${user.mutualEventsCount} events together`
          : `Friends with ${friendNames.join(', ')} • ${user.mutualEventsCount} events together`;
      }
    } else if (user.mutualFriendsCount > 0) {
      // Mutual friends only
      reasonType = 'mutual_friends';
      const friendNames = mutualFriendsDetails.map(f => f.displayName || f.username);
      
      if (friendNames.length === 1) {
        reason = `Friends with ${friendNames[0]}`;
      } else if (friendNames.length === 2) {
        reason = `Friends with ${friendNames[0]} and ${friendNames[1]}`;
      } else if (friendNames.length > 2) {
        const remaining = user.mutualFriendsCount - 2;
        reason = `Friends with ${friendNames[0]}, ${friendNames[1]} and ${remaining} other${remaining > 1 ? 's' : ''}`;
      }
    } else if (user.mutualEventsCount > 0) {
      // Event overlap only
      reasonType = 'mutual_events';
      
      if (user.mutualEventsCount === 1) {
        reason = `Attended an event together`;
      } else if (user.mutualEventsCount <= 3) {
        reason = `Attended ${user.mutualEventsCount} events together`;
      } else {
        reason = `Attended many events together (${user.mutualEventsCount})`;
      }
      
      // Add category context if available
      if (user.categoryOverlap > 0) {
        reason += ` • Similar interests`;
      }
    }
    
    return { reason, reasonType };
  }
  
  /**
   * PHASE 2: Get fallback suggestions when main algorithm doesn't return enough
   */
  static async getFallbackSuggestions(userId, excludeIds, eventContext, limit) {
    const suggestions = [];
    
    // Strategy 1: Users who attend similar event categories
    if (eventContext.categories.length > 0) {
      const categoryBasedUsers = await this.getSimilarEventCategoryUsers(
        userId, 
        excludeIds, 
        eventContext.categories, 
        Math.ceil(limit * 0.7)
      );
      suggestions.push(...categoryBasedUsers);
    }
    
    // Strategy 2: Recent active users (if still need more)
    if (suggestions.length < limit) {
      const remaining = limit - suggestions.length;
      const recentUsers = await this.getRecentActiveUsers(excludeIds, remaining);
      suggestions.push(...recentUsers);
    }
    
    return suggestions;
  }
  
  /**
   * Get users who attend similar event categories
   */
  static async getSimilarEventCategoryUsers(userId, excludeIds, userCategories, limit) {
    const similarEventUsers = await Event.aggregate([
      {
        $match: {
          category: { $in: userCategories },
          attendees: { $ne: new mongoose.Types.ObjectId(userId) }
        }
      },
      { $unwind: '$attendees' },
      {
        $match: {
          attendees: { $nin: excludeIds }
        }
      },
      {
        $group: {
          _id: '$attendees',
          eventCount: { $sum: 1 },
          categories: { $addToSet: '$category' },
          commonCategories: {
            $sum: {
              $cond: [{ $in: ['$category', userCategories] }, 1, 0]
            }
          }
        }
      },
      { $sort: { commonCategories: -1, eventCount: -1 } },
      { $limit: limit }
    ]);

    if (similarEventUsers.length === 0) return [];

    const userIds = similarEventUsers.map(u => u._id);
    const users = await User.find({
      _id: { $in: userIds },
      isPublic: true
    }).select('username displayName profilePicture bio').lean();

    return users.map(user => {
      const userData = similarEventUsers.find(u => String(u._id) === String(user._id));
      const sharedCategories = userData.categories.filter(cat => userCategories.includes(cat));
      
      return {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        bio: user.bio,
        mutualFriends: 0,
        mutualEvents: 0,
        eventCoAttendance: 0,
        categoryOverlap: userData.commonCategories,
        mutualFriendsDetails: [],
        sharedEventsDetails: [],
        reason: `Attends ${sharedCategories.slice(0, 2).join(', ')} events`,
        reasonType: 'similar_events',
        score: 3 + userData.commonCategories,
        suggestionType: 'event_category_fallback'
      };
    });
  }
  
  /**
   * Get recent active users as last resort
   */
  static async getRecentActiveUsers(excludeIds, limit) {
    const users = await User.find({
      _id: { $nin: excludeIds },
      isPublic: true
    })
    .select('username displayName profilePicture bio createdAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    return users.map(user => ({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      profilePicture: user.profilePicture,
      bio: user.bio,
      mutualFriends: 0,
      mutualEvents: 0,
      eventCoAttendance: 0,
      categoryOverlap: 0,
      mutualFriendsDetails: [],
      sharedEventsDetails: [],
      reason: 'Recently joined',
      reasonType: 'recent_user',
      score: 1,
      suggestionType: 'recent_user_fallback'
    }));
  }
  
  /**
   * PHASE 2: Calculate suggestion strength for analytics
   */
  static calculateSuggestionStrength(mutualFriends, mutualEvents, categoryOverlap) {
    const score = (mutualFriends * 10) + (mutualEvents * 5) + (categoryOverlap * 3);
    
    if (score >= 50) return 'very_strong';
    if (score >= 30) return 'strong'; 
    if (score >= 15) return 'moderate';
    if (score >= 5) return 'weak';
    return 'very_weak';
  }
  
  /**
   * PHASE 2: Validate and explain why a user is or isn't suggested
   */
  static async explainSuggestion(currentUserId, targetUserId) {
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!currentUser || !targetUser) {
      throw new Error('User not found');
    }
    
    const currentFriends = currentUser.getAcceptedFriends();
    const targetFriends = targetUser.getAcceptedFriends();
    
    // Calculate mutual friends
    const mutualFriends = currentFriends.filter(friendId => 
      targetFriends.includes(String(friendId))
    );
    
    // Get event overlap
    const currentUserEvents = await Event.find({ attendees: currentUserId }).select('_id title category');
    const targetUserEvents = await Event.find({ attendees: targetUserId }).select('_id title category');
    
    const currentEventIds = currentUserEvents.map(e => String(e._id));
    const sharedEvents = targetUserEvents.filter(e => currentEventIds.includes(String(e._id)));
    
    // Check exclusion reasons
    const friendshipStatus = currentUser.getFriendshipStatus(targetUserId);
    const isBlocked = (currentUser.blockedUsers || []).includes(targetUserId);
    const isPrivate = !targetUser.isPublic;
    
    // Calculate scores
    const mutualFriendsScore = mutualFriends.length * 10;
    const mutualEventsScore = sharedEvents.length * 5;
    const hybridBonus = (mutualFriends.length > 0 && sharedEvents.length > 0) ? 20 : 0;
    const totalScore = mutualFriendsScore + mutualEventsScore + hybridBonus;
    
    return {
      targetUser: {
        _id: targetUser._id,
        username: targetUser.username,
        isPublic: targetUser.isPublic
      },
      analysis: {
        mutualFriendsCount: mutualFriends.length,
        mutualEventsCount: sharedEvents.length,
        totalScore: totalScore,
        suggestionStrength: this.calculateSuggestionStrength(
          mutualFriends.length, 
          sharedEvents.length, 
          0
        )
      },
      eligibility: {
        meetsScoreThreshold: totalScore >= 5,
        isNotFriend: friendshipStatus.status === 'not-friends',
        isNotBlocked: !isBlocked,
        hasPublicProfile: !isPrivate,
        wouldBeSuggested: totalScore >= 5 && 
                         friendshipStatus.status === 'not-friends' && 
                         !isBlocked && 
                         !isPrivate
      },
      details: {
        mutualFriends: mutualFriends.slice(0, 5),
        sharedEvents: sharedEvents.slice(0, 5),
        exclusionReasons: [
          ...(friendshipStatus.status !== 'not-friends' ? [`Already ${friendshipStatus.status}`] : []),
          ...(isBlocked ? ['User is blocked'] : []),
          ...(isPrivate ? ['User profile is private'] : []),
          ...(totalScore < 5 ? ['Score too low (minimum 5)'] : [])
        ]
      }
    };
  }
}

module.exports = FriendRecommendationService;