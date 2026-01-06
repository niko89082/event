// services/searchService.js - Unified search service for all content types
const User = require('../models/User');
const Event = require('../models/Event');
const Photo = require('../models/Photo');
const TMDBService = require('./tmdbService');
const SpotifyService = require('./spotifyService');

class SearchService {
  /**
   * Calculate relevance score for a search result
   * @param {Object} item - The search result item
   * @param {string} query - The search query
   * @param {Object} options - Additional scoring options
   * @returns {number} Relevance score
   */
  static calculateRelevanceScore(item, query, options = {}) {
    const term = query.toLowerCase().trim();
    let score = 0;

    // Get searchable fields based on item type
    let searchableText = '';
    if (item.username) searchableText += ` ${item.username}`;
    if (item.displayName) searchableText += ` ${item.displayName}`;
    if (item.fullName) searchableText += ` ${item.fullName}`;
    if (item.title) searchableText += ` ${item.title}`;
    if (item.name) searchableText += ` ${item.name}`;
    if (item.caption) searchableText += ` ${item.caption}`;
    if (item.textContent) searchableText += ` ${item.textContent}`;
    if (item.description) searchableText += ` ${item.description}`;
    
    const text = searchableText.toLowerCase();

    // Exact match bonus (100 points)
    if (text === term || text.trim() === term) {
      score += 100;
    }

    // Starts with bonus (50 points)
    if (text.startsWith(term) || 
        (item.username && item.username.toLowerCase().startsWith(term)) ||
        (item.title && item.title.toLowerCase().startsWith(term)) ||
        (item.name && item.name.toLowerCase().startsWith(term))) {
      score += 50;
    }

    // Word boundary match (30 points)
    const wordBoundaryRegex = new RegExp(`\\b${this.escapeRegex(term)}`, 'i');
    if (wordBoundaryRegex.test(text)) {
      score += 30;
    }

    // Contains match (15 points)
    if (text.includes(term)) {
      score += 15;
    }

    // Relationship bonus
    if (options.isFriend) score += 1000;
    if (options.isFollowing) score += 500;
    if (options.mutualFriendsCount) score += options.mutualFriendsCount * 10;

    // Recency bonus (for events and posts)
    if (item.time || item.uploadDate || item.createdAt) {
      const date = item.time || item.uploadDate || item.createdAt;
      const daysAgo = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo < 7) score += 10;
      else if (daysAgo < 30) score += 5;
    }

    // Engagement bonus
    if (item.likeCount) score += item.likeCount * 5;
    if (item.attendees && Array.isArray(item.attendees)) {
      score += item.attendees.length * 5;
    }
    if (item.followerCount) score += Math.min(item.followerCount / 100, 50);

    return score;
  }

  /**
   * Escape regex special characters
   */
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Search users with enhanced relevance scoring
   */
  static async searchUsers(query, userId, options = {}) {
    const { limit = 10, skip = 0 } = options;
    const searchTerm = query.trim();

    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    try {
      const currentUser = await User.findById(userId);
      if (!currentUser) return [];

      const followingIds = (currentUser.following || []).map(id => String(id));
      const friendIds = currentUser.getAcceptedFriends ? currentUser.getAcceptedFriends().map(f => String(f)) : [];

      // Build search query
      const searchQuery = {
        _id: { $ne: userId },
        $or: [
          { username: { $regex: `^${this.escapeRegex(searchTerm)}`, $options: 'i' } },
          { username: { $regex: this.escapeRegex(searchTerm), $options: 'i' } },
          { displayName: { $regex: `^${this.escapeRegex(searchTerm)}`, $options: 'i' } },
          { displayName: { $regex: this.escapeRegex(searchTerm), $options: 'i' } },
          { fullName: { $regex: `^${this.escapeRegex(searchTerm)}`, $options: 'i' } },
          { fullName: { $regex: this.escapeRegex(searchTerm), $options: 'i' } },
          { fullName: { $regex: `\\b${this.escapeRegex(searchTerm)}`, $options: 'i' } }
        ]
      };

      const users = await User.find(searchQuery)
        .select('username displayName fullName profilePicture bio followerCount')
        .limit(limit * 2)
        .lean();

      // Process and score results
      const processed = users.map(user => {
        const userIdStr = user._id.toString();
        const isFriend = friendIds.includes(userIdStr);
        const isFollowing = followingIds.includes(userIdStr);
        
        // Calculate mutual friends
        let mutualFriendsCount = 0;
        if (!isFollowing && !isFriend) {
          // Simplified: would need to check actual mutual friends
          mutualFriendsCount = 0;
        }

        const score = this.calculateRelevanceScore(user, searchTerm, {
          isFriend,
          isFollowing,
          mutualFriendsCount
        });

        return {
          ...user,
          isFollowing,
          isFriend,
          relevanceScore: score
        };
      });

      // Sort by relevance and limit
      return processed
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  /**
   * Search events with privacy filtering
   */
  static async searchEvents(query, userId, options = {}) {
    const { limit = 10, skip = 0, when } = options;
    const searchTerm = query.trim();

    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    try {
      const currentUser = await User.findById(userId);
      const friendIds = currentUser ? (currentUser.getAcceptedFriends ? currentUser.getAcceptedFriends().map(f => String(f)) : []) : [];

      // Build privacy-aware search query
      const searchQuery = {
        $and: [
          {
            $or: [
              { title: { $regex: this.escapeRegex(searchTerm), $options: 'i' } },
              { description: { $regex: this.escapeRegex(searchTerm), $options: 'i' } },
              { tags: { $in: [new RegExp(this.escapeRegex(searchTerm), 'i')] } },
              { category: { $regex: this.escapeRegex(searchTerm), $options: 'i' } }
            ]
          },
          {
            $or: [
              { privacyLevel: 'public' },
              {
                privacyLevel: 'friends',
                host: { $in: friendIds }
              },
              {
                privacyLevel: 'private',
                invitedUsers: userId
              },
              { host: userId }
            ]
          }
        ]
      };

      // Add date filter if provided
      if (when) {
        // Simple date parsing - can be enhanced
        const parsed = new Date(when);
        if (!isNaN(parsed.getTime())) {
          const start = new Date(parsed.setHours(0, 0, 0, 0));
          const end = new Date(parsed.setHours(23, 59, 59, 999));
          searchQuery.time = { $gte: start, $lte: end };
        }
      }

      const events = await Event.find(searchQuery)
        .populate('host', 'username profilePicture')
        .populate('attendees', 'username profilePicture')
        .sort({ time: 1 })
        .limit(limit)
        .skip(skip)
        .lean();

      // Score and sort by relevance
      const processed = events.map(event => {
        const score = this.calculateRelevanceScore(event, searchTerm, {
          isFollowing: friendIds.includes(String(event.host?._id || ''))
        });
        return {
          ...event,
          relevanceScore: score,
          attendeeCount: event.attendees ? event.attendees.length : 0
        };
      });

      return processed.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error searching events:', error);
      return [];
    }
  }

  /**
   * Search posts with privacy filtering
   */
  static async searchPosts(query, userId, options = {}) {
    const { limit = 10, skip = 0 } = options;
    const searchTerm = query.trim();

    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    try {
      const currentUser = await User.findById(userId);
      const followingIds = (currentUser?.following || []).map(id => String(id));

      const posts = await Photo.find({
        $and: [
          {
            $or: [
              { textContent: { $regex: this.escapeRegex(searchTerm), $options: 'i' } },
              { caption: { $regex: this.escapeRegex(searchTerm), $options: 'i' } }
            ]
          },
          {
            $or: [
              { user: userId },
              { user: { $in: followingIds } },
              { 'visibility.level': 'public' }
            ]
          },
          {
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false }
            ]
          }
        ]
      })
        .populate('user', 'username displayName profilePicture')
        .sort({ uploadDate: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      // Add metadata
      return posts.map(post => {
        const likesArray = post.likes || [];
        const score = this.calculateRelevanceScore(post, searchTerm);
        return {
          ...post,
          userLiked: likesArray.map(l => String(l)).includes(String(userId)),
          likeCount: likesArray.length,
          commentCount: post.comments ? post.comments.length : 0,
          relevanceScore: score
        };
      });
    } catch (error) {
      console.error('Error searching posts:', error);
      return [];
    }
  }

  /**
   * Search songs via Spotify
   */
  static async searchSongs(query, options = {}) {
    const { limit = 10 } = options;
    const searchTerm = query.trim();

    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    try {
      const results = await SpotifyService.searchTracks(searchTerm, limit, 0);
      return (results.tracks || []).map(track => ({
        ...track,
        relevanceScore: this.calculateRelevanceScore(track, searchTerm)
      })).sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error searching songs:', error);
      return [];
    }
  }

  /**
   * Search movies via TMDB
   */
  static async searchMovies(query, options = {}) {
    const { limit = 10, page = 1 } = options;
    const searchTerm = query.trim();

    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    try {
      const results = await TMDBService.searchMovies(searchTerm, page);
      return (results.results || []).slice(0, limit).map(movie => ({
        ...movie,
        relevanceScore: this.calculateRelevanceScore(movie, searchTerm)
      })).sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error searching movies:', error);
      return [];
    }
  }

  /**
   * Unified search across all content types
   */
  static async unifiedSearch(query, userId, options = {}) {
    const {
      types = ['users', 'events', 'posts', 'songs', 'movies'],
      limit = 10,
      skip = 0
    } = options;

    const searchTerm = query.trim();
    if (!searchTerm || searchTerm.length < 1) {
      return {
        users: [],
        events: [],
        posts: [],
        songs: [],
        movies: []
      };
    }

    const startTime = Date.now();
    const results = {
      users: [],
      events: [],
      posts: [],
      songs: [],
      movies: []
    };

    // Execute searches in parallel
    const searchPromises = [];

    if (types.includes('users')) {
      searchPromises.push(
        this.searchUsers(searchTerm, userId, { limit, skip })
          .then(users => { results.users = users; })
          .catch(err => console.error('User search error:', err))
      );
    }

    if (types.includes('events')) {
      searchPromises.push(
        this.searchEvents(searchTerm, userId, { limit, skip, when: options.when })
          .then(events => { results.events = events; })
          .catch(err => console.error('Event search error:', err))
      );
    }

    if (types.includes('posts')) {
      searchPromises.push(
        this.searchPosts(searchTerm, userId, { limit, skip })
          .then(posts => { results.posts = posts; })
          .catch(err => console.error('Post search error:', err))
      );
    }

    if (types.includes('songs')) {
      searchPromises.push(
        this.searchSongs(searchTerm, { limit })
          .then(songs => { results.songs = songs; })
          .catch(err => console.error('Song search error:', err))
      );
    }

    if (types.includes('movies')) {
      searchPromises.push(
        this.searchMovies(searchTerm, { limit, page: 1 })
          .then(movies => { results.movies = movies; })
          .catch(err => console.error('Movie search error:', err))
      );
    }

    await Promise.allSettled(searchPromises);

    const searchTime = Date.now() - startTime;
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    return {
      query: searchTerm,
      results,
      metadata: {
        totalResults,
        searchTime,
        hasMore: totalResults >= limit * types.length
      }
    };
  }

  /**
   * Get search suggestions for autocomplete
   */
  static async getSuggestions(query, userId, options = {}) {
    const { limit = 5 } = options;
    const searchTerm = query.trim();

    if (!searchTerm || searchTerm.length < 2) {
      return {
        suggestions: [],
        recent: [],
        trending: []
      };
    }

    try {
      // Get top results from each type
      const [users, events, posts] = await Promise.allSettled([
        this.searchUsers(searchTerm, userId, { limit: 3 }),
        this.searchEvents(searchTerm, userId, { limit: 3 }),
        this.searchPosts(searchTerm, userId, { limit: 3 })
      ]);

      const suggestions = [];

      // Add user suggestions
      if (users.status === 'fulfilled') {
        users.value.forEach(user => {
          suggestions.push({
            type: 'user',
            text: user.displayName || user.username,
            id: user._id,
            username: user.username,
            profilePicture: user.profilePicture
          });
        });
      }

      // Add event suggestions
      if (events.status === 'fulfilled') {
        events.value.forEach(event => {
          suggestions.push({
            type: 'event',
            text: event.title,
            id: event._id,
            time: event.time
          });
        });
      }

      // Add post suggestions (simplified)
      if (posts.status === 'fulfilled' && posts.value.length > 0) {
        suggestions.push({
          type: 'post',
          text: `Posts matching "${searchTerm}"`,
          count: posts.value.length
        });
      }

      return {
        suggestions: suggestions.slice(0, limit * 3),
        recent: [], // Can be populated from user's search history
        trending: [] // Can be populated from trending searches
      };
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return {
        suggestions: [],
        recent: [],
        trending: []
      };
    }
  }
}

module.exports = SearchService;

