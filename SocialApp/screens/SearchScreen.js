// Enhanced SearchScreen.js - Blue theme with tabs for All, People, Songs, Movies, Posts, Events
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Image, RefreshControl,
  ScrollView, Dimensions, Animated, PanResponder, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import CategoryManager from '../components/CategoryManager';
import PostCard from '../components/PostCard';
import ReviewCard from '../components/ReviewCard';
import SearchHistoryService from '../services/searchHistoryService';

import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
// Use the IP from .env, add port 3000 when constructing URLs
const API_BASE_URL = ENV_API_BASE_URL ? `${ENV_API_BASE_URL}:3000` : (process.env.EXPO_PUBLIC_API_URL || 'localhost:3000');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = ['all', 'people', 'songs', 'movies', 'posts', 'events'];

// Blue theme colors
const COLORS = {
  primary: '#607AFB',
  primaryLight: '#E8ECFF',
  primaryDark: '#4A5FD9',
  background: '#F5F6F8',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  successLight: '#D1FAE5',
};

export default function SearchScreen({ navigation, route }) {
  // Search state
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'people', 'songs', 'movies', 'posts', 'events'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search suggestions state
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Following suggestions state (for people tab)
  const [peopleSuggestions, setPeopleSuggestions] = useState([]);
  
  // Loading states per type (for progressive loading)
  const [loadingStates, setLoadingStates] = useState({
    users: false,
    events: false,
    posts: false,
    songs: false,
    movies: false
  });
  
  // Trending hashtags (mock data for now)
  const [trendingHashtags] = useState([
    '#TechMeetup2024',
    '#SummerVibes',
    '#LiveMusic',
    '#ArtBasel',
    '#FoodieHeaven'
  ]);

  // Auth context
  const { currentUser } = useContext(AuthContext);

  // Swipe animation refs
  const scrollX = useRef(new Animated.Value(0)).current;
  const currentTabIndex = useRef(0);
  const isAnimating = useRef(false);
  const tabScrollViewRef = useRef(null);
  const tabLayouts = useRef({}); // Store tab layout positions
  
  // Search debouncing refs
  const searchTimeoutRef = useRef(null);
  const suggestionsTimeoutRef = useRef(null);
  const lastTypingTime = useRef(0);
  const searchAbortController = useRef(null);

  // Load recent searches on mount
  useEffect(() => {
    const loadRecentSearches = async () => {
      const recent = await SearchHistoryService.getRecentSearches();
      setRecentSearches(recent);
    };
    loadRecentSearches();
  }, []);

  // Fetch following suggestions (based on who your following follow)
  const fetchFollowingSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const { data } = await api.get('/api/users/following/suggestions', {
        params: { limit: 15 }
      });
      
      if (data.success) {
        setPeopleSuggestions(data.suggestions || []);
      } else {
        setPeopleSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching following suggestions:', error);
      setPeopleSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Fetch search suggestions for autocomplete
  const fetchSearchSuggestions = async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);
      const { data } = await api.get('/api/search/suggestions', {
        params: { q: searchQuery, limit: 5 }
      });
      
      setSearchSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching search suggestions:', error);
      setSearchSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Switch to tab function
  const switchToTab = useCallback((index) => {
    if (isAnimating.current) return;
    if (index < 0 || index >= TABS.length) return;
    
    isAnimating.current = true;
    currentTabIndex.current = index;
    const newTab = TABS[index];
    setActiveTab(newTab);
    setQuery('');
    setResults([]);

    Animated.spring(scrollX, {
      toValue: -index * SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start(() => {
      isAnimating.current = false;
    });


    // Scroll tab indicator to center
    if (tabScrollViewRef.current) {
      const tabWidth = 60; // Tab minWidth
      const gap = 24; // Gap between tabs
      const offset = Math.max(0, (index * (tabWidth + gap)) - SCREEN_WIDTH / 2 + tabWidth / 2);
      tabScrollViewRef.current.scrollTo({ x: offset, animated: true });
    }

    // Load suggestions for people tab
    if (newTab === 'people') {
      fetchFollowingSuggestions();
    }
  }, [scrollX]);

  // PanResponder for horizontal swipe - only in main content area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy, y0 } = gestureState;
        
        // Don't capture if gesture started in header area (search bar, tabs, trending)
        const HEADER_AREA_HEIGHT = 200; // Approximate height of header + tabs + trending
        if (y0 < HEADER_AREA_HEIGHT) {
          return false;
        }
        
        // Only respond to strong horizontal swipes in main content area
        const isStrongHorizontalSwipe = Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 2;
        return isStrongHorizontalSwipe && !isAnimating.current;
      },
      onPanResponderGrant: () => {
        scrollX.stopAnimation();
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isAnimating.current) return;
        
        const { dx } = gestureState;
        const currentTab = currentTabIndex.current;
        const baseOffset = -currentTab * SCREEN_WIDTH;
        let newOffset = baseOffset + dx;
        
        // Add resistance at boundaries
        const minOffset = -(TABS.length - 1) * SCREEN_WIDTH;
        const maxOffset = 0;
        const RESISTANCE_FACTOR = 0.25;
        
        if (newOffset > maxOffset) {
          newOffset = maxOffset + (newOffset - maxOffset) * RESISTANCE_FACTOR;
        } else if (newOffset < minOffset) {
          newOffset = minOffset + (newOffset - minOffset) * RESISTANCE_FACTOR;
        }
        
        if (Number.isFinite(newOffset)) {
          scrollX.setValue(newOffset);
          // Update indicator position proportionally during swipe
          const progress = -newOffset / SCREEN_WIDTH;
          // Indicator position will be updated by onLayout when tab changes
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (isAnimating.current) return;
        
        const { dx, vx } = gestureState;
        const currentTab = currentTabIndex.current;
        let targetIndex = currentTab;
        
        const DISTANCE_THRESHOLD = 80;
        const VELOCITY_THRESHOLD = 0.4;
        
        const shouldSwipe = Math.abs(dx) > DISTANCE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD;
        
        if (shouldSwipe) {
          // Swiping right (dx > 0) - go to previous tab
          if (dx > 0) {
            if (currentTab === 0) {
              // On "all" tab - exit screen
              navigation.goBack();
              return;
            } else {
              targetIndex = currentTab - 1;
            }
          } 
          // Swiping left (dx < 0) - go to next tab
          else if (dx < 0 && currentTab < TABS.length - 1) {
            targetIndex = currentTab + 1;
          }
        }
        
        switchToTab(targetIndex);
      },
      onPanResponderTerminationRequest: () => {
        // Allow termination to let nested ScrollViews work
        return true;
      },
      onPanResponderTerminate: () => {
        isAnimating.current = false;
        // Snap back to current tab
        switchToTab(currentTabIndex.current);
      },
    })
  ).current;

  // Load suggestions on mount for people tab
  useEffect(() => {
    if (activeTab === 'people' && query.trim() === '') {
      fetchFollowingSuggestions();
    }
  }, [activeTab]);

  // Smart debounced search with adaptive timing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Cancel previous search request
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }

    const currentTime = Date.now();
    const timeSinceLastType = currentTime - lastTypingTime.current;
    lastTypingTime.current = currentTime;

    // Adaptive debounce: 150ms for fast typing, 300ms for pauses
    const debounceDelay = timeSinceLastType < 200 ? 150 : 300;

    if (query.trim().length > 0) {
      // Show suggestions dropdown
      setShowSuggestions(true);
      
      // Fetch suggestions with shorter delay
      if (suggestionsTimeoutRef.current) {
        clearTimeout(suggestionsTimeoutRef.current);
      }
      suggestionsTimeoutRef.current = setTimeout(() => {
        fetchSearchSuggestions(query);
      }, 150);

      // Perform search with adaptive debounce
      searchTimeoutRef.current = setTimeout(() => {
        performSearch();
      }, debounceDelay);
    } else {
      setResults([]);
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setError(null);
      
      // Load suggestions for people tab when query is empty
      if (activeTab === 'people') {
        fetchFollowingSuggestions();
      }
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (suggestionsTimeoutRef.current) {
        clearTimeout(suggestionsTimeoutRef.current);
      }
    };
  }, [query, activeTab]);

  // Navigation header setup
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false, // Disable default back gesture, we'll handle it
    });
  }, [navigation]);


  // Perform search based on active tab
  const performSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Create new abort controller for this search
    searchAbortController.current = new AbortController();
    const signal = searchAbortController.current.signal;
    
    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    
    // Add to search history
    await SearchHistoryService.addSearch(query);
    const recent = await SearchHistoryService.getRecentSearches();
    setRecentSearches(recent);

    try {
      if (activeTab === 'all') {
        // Use unified search endpoint
        await searchAllUnified(signal);
      } else {
        // Use specific endpoint for each tab
        let endpoint = '';
        let params = { q: query };

        switch (activeTab) {
          case 'people':
            endpoint = '/api/search/users';
            params.limit = 20;
            break;
          case 'songs':
            endpoint = '/api/reviews/search-songs';
            params.query = query;
            params.limit = 20;
            break;
          case 'movies':
            endpoint = '/api/reviews/search-movies';
            params.query = query;
            params.page = 1;
            break;
          case 'posts':
            endpoint = '/api/search/posts';
            params.limit = 20;
            break;
          case 'events':
            endpoint = '/api/search/events';
            params.limit = 20;
            break;
          default:
            setLoading(false);
            return;
        }

        const response = await api.get(endpoint, { params, signal });
        
        if (activeTab === 'songs') {
          setResults(response.data.items || response.data.tracks || []);
        } else if (activeTab === 'movies') {
          setResults(response.data.results || []);
        } else {
          setResults(response.data || []);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        // Request was cancelled, ignore
        return;
      }
      console.error('Search error:', error);
      setError('Could not complete search. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Unified search for "all" tab
  const searchAllUnified = async (signal) => {
    try {
      setLoadingStates({
        users: true,
        events: true,
        posts: true,
        songs: true,
        movies: true
      });

      const response = await api.get('/api/search/unified', {
        params: {
          q: query,
          types: 'users,events,posts,songs,movies',
          limit: 5
        },
        signal
      });

      const { results: searchResults } = response.data;
      const allResults = [];

      // Combine results with type markers
      if (searchResults.users) {
        allResults.push(...searchResults.users.map(u => ({ ...u, _type: 'user' })));
        setLoadingStates(prev => ({ ...prev, users: false }));
      }
      if (searchResults.events) {
        allResults.push(...searchResults.events.map(e => ({ ...e, _type: 'event' })));
        setLoadingStates(prev => ({ ...prev, events: false }));
      }
      if (searchResults.posts) {
        allResults.push(...searchResults.posts.map(p => ({ ...p, _type: 'post' })));
        setLoadingStates(prev => ({ ...prev, posts: false }));
      }
      if (searchResults.songs) {
        allResults.push(...searchResults.songs.map(s => ({ ...s, _type: 'song' })));
        setLoadingStates(prev => ({ ...prev, songs: false }));
      }
      if (searchResults.movies) {
        allResults.push(...searchResults.movies.map(m => ({ ...m, _type: 'movie' })));
        setLoadingStates(prev => ({ ...prev, movies: false }));
      }

      setResults(allResults);
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.error('Unified search error:', error);
        setError('Could not complete search. Please try again.');
      }
    } finally {
      setLoadingStates({
        users: false,
        events: false,
        posts: false,
        songs: false,
        movies: false
      });
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion) => {
    setQuery(suggestion.text || suggestion);
    setShowSuggestions(false);
    // Search will be triggered by the query change
  };

  // Send friend request
  const handleFollow = async (userId, username) => {
    try {
      const user = results.find(u => u._id === userId) || 
                   peopleSuggestions.find(u => u._id === userId) ||
                   searchSuggestions.find(u => u.id === userId);
      const isCurrentlyFollowing = user?.isFollowing || false;

      if (isCurrentlyFollowing) {
        // Unfollow
        await api.delete(`/api/follow/unfollow/${userId}`);
        setResults(prev => prev.map(u => 
          u._id === userId ? { ...u, isFollowing: false } : u
        ));
        setPeopleSuggestions(prev => prev.map(u => 
          u._id === userId ? { ...u, isFollowing: false } : u
        ));
      } else {
        // Follow
        await api.post(`/api/follow/follow/${userId}`);
        setResults(prev => prev.map(u => 
          u._id === userId ? { ...u, isFollowing: true } : u
        ));
        setPeopleSuggestions(prev => prev.map(u => 
          u._id === userId ? { ...u, isFollowing: true } : u
        ));
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Could not update follow status. Please try again.');
    }
  };

  // Get button config for follow status
  const getButtonConfig = (isFollowing, isSelf) => {
    if (isSelf) {
      return { text: 'You', color: COLORS.textSecondary, bgColor: COLORS.border, disabled: true };
    }
    if (isFollowing) {
      return { text: 'Following', color: COLORS.success, bgColor: COLORS.successLight, disabled: false };
    }
    return { text: 'Follow', color: COLORS.primary, bgColor: COLORS.primaryLight, disabled: false };
  };

  // Render user row (modernized UI)
  const renderUserRow = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}${item.profilePicture}`
      : `https://placehold.co/48x48/C7C7CC/FFFFFF?text=${item.username?.charAt(0).toUpperCase() || '?'}`;

    const isFollowing = item.isFollowing || false;
    const isSelf = item.isSelf || false;
    const buttonConfig = getButtonConfig(isFollowing, isSelf);

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
        activeOpacity={0.95}
      >
        <View style={styles.userContent}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatar }} style={styles.userAvatar} />
            {item.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>
          
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.username} numberOfLines={1}>
                {item.displayName || item.username}
              </Text>
            </View>
            <Text style={styles.handle} numberOfLines={1}>
              @{item.username}
            </Text>
            {item.profession && (
              <Text style={styles.profession} numberOfLines={1}>
                {item.profession}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.friendButton,
              { 
                backgroundColor: buttonConfig.disabled ? COLORS.border : COLORS.primary,
                borderColor: buttonConfig.disabled ? COLORS.border : COLORS.primary
              }
            ]}
            onPress={(e) => {
              e.stopPropagation();
              if (!isSelf) {
                handleFollow(item._id, item.username);
              }
            }}
            activeOpacity={0.7}
            disabled={isSelf}
          >
            <Text style={[
              styles.friendButtonText, 
              { color: buttonConfig.disabled ? COLORS.textSecondary : '#FFFFFF' }
            ]}>
              {buttonConfig.text}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Render event card (keeping existing UI)
  const renderEventCard = ({ item }) => {
    const eventDate = item.time ? new Date(item.time) : null;
    const month = eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
    const day = eventDate ? eventDate.getDate() : '';
    
    const coverImage = item.coverImage 
      ? `http://${API_BASE_URL}${item.coverImage}`
      : null;

    return (
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
        activeOpacity={0.95}
      >
        <View style={styles.eventCardContent}>
          {/* Date Badge */}
          <View style={styles.eventDateBadge}>
            <Text style={styles.eventMonth}>{month}</Text>
            <Text style={styles.eventDay}>{day}</Text>
          </View>
          
          {/* Content */}
          <View style={styles.eventInfo}>
            <View style={styles.eventHeader}>
              <View style={styles.eventStatusBadge}>
                <Text style={styles.eventStatusText}>Selling Fast</Text>
              </View>
              <TouchableOpacity>
                <Ionicons name="bookmark-outline" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
            
            {item.location?.address && (
              <View style={styles.eventLocation}>
                <Ionicons name="location" size={16} color={COLORS.primary} />
                <Text style={styles.eventLocationText} numberOfLines={1}>
                  {item.location.address}
                </Text>
              </View>
            )}
            
            {item.attendees && item.attendees.length > 0 && (
              <View style={styles.eventAttendees}>
                <View style={styles.attendeeAvatars}>
                  {item.attendees.slice(0, 3).map((attendee, idx) => (
                    <Image
                      key={idx}
                      source={{ 
                        uri: attendee.profilePicture 
                          ? `http://${API_BASE_URL}${attendee.profilePicture}`
                          : `https://placehold.co/20x20/C7C7CC/FFFFFF?text=${attendee.username?.charAt(0) || '?'}`
                      }}
                      style={styles.attendeeAvatar}
                    />
                  ))}
                </View>
                <Text style={styles.attendeeCount}>
                  +{item.attendees.length} going
                </Text>
              </View>
            )}
          </View>
          
          {/* Image */}
          {coverImage && (
            <Image source={{ uri: coverImage }} style={styles.eventImage} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render post card
  const renderPostCard = ({ item }) => {
    return (
      <View style={styles.postCard}>
        <PostCard 
          post={item} 
          currentUserId={currentUser?._id} 
          navigation={navigation}
        />
      </View>
    );
  };

  // Render song card
  const renderSongCard = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.mediaCard}
        onPress={() => {
          // Navigate to song details or create review
          navigation.navigate('PostDetailsScreen', { 
            songId: item.id,
            song: item 
          });
        }}
        activeOpacity={0.95}
      >
        <Image
          source={{ uri: item.album?.images?.[0]?.url || item.images?.[0]?.url }}
          style={styles.mediaImage}
        />
        <View style={styles.mediaInfo}>
          <Text style={styles.mediaTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.mediaSubtitle} numberOfLines={1}>
            {item.artists?.[0]?.name || 'Unknown Artist'}
          </Text>
          {item.album && (
            <Text style={styles.mediaMeta} numberOfLines={1}>
              {item.album.name}
            </Text>
          )}
        </View>
        <Ionicons name="musical-notes" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    );
  };

  // Render movie card
  const renderMovieCard = ({ item }) => {
    const posterUrl = item.poster_path 
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null;

    return (
      <TouchableOpacity
        style={styles.mediaCard}
        onPress={() => {
          // Navigate to movie details or create review
          navigation.navigate('PostDetailsScreen', { 
            movieId: item.id,
            movie: item 
          });
        }}
        activeOpacity={0.95}
      >
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.mediaImage} />
        ) : (
          <View style={[styles.mediaImage, styles.mediaImagePlaceholder]}>
            <Ionicons name="film-outline" size={32} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={styles.mediaInfo}>
          <Text style={styles.mediaTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.release_date && (
            <Text style={styles.mediaSubtitle}>
              {new Date(item.release_date).getFullYear()}
            </Text>
          )}
          {item.vote_average && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Ionicons name="film" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    );
  };

  // Render all results (for "All" tab) with section headers
  const renderAllResult = ({ item, index }) => {
    // Check if this is the first item of its type to show section header
    const prevItem = index > 0 ? results[index - 1] : null;
    const showHeader = !prevItem || prevItem._type !== item._type;
    
    const renderItem = () => {
      switch (item._type) {
        case 'user':
          return renderUserRow({ item });
        case 'post':
          return renderPostCard({ item });
        case 'event':
          return renderEventCard({ item });
        case 'song':
          return renderSongCard({ item });
        case 'movie':
          return renderMovieCard({ item });
        default:
          return null;
      }
    };

    if (showHeader) {
      const typeLabels = {
        user: 'People',
        event: 'Events',
        post: 'Posts',
        song: 'Songs',
        movie: 'Movies'
      };
      const typeCounts = {
        user: results.filter(r => r._type === 'user').length,
        event: results.filter(r => r._type === 'event').length,
        post: results.filter(r => r._type === 'post').length,
        song: results.filter(r => r._type === 'song').length,
        movie: results.filter(r => r._type === 'movie').length
      };
      const loadingKey = item._type === 'user' ? 'users' : 
                        item._type === 'post' ? 'posts' : 
                        item._type === 'event' ? 'events' : 
                        item._type === 'song' ? 'songs' : 'movies';

      return (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>
              {typeLabels[item._type]} ({typeCounts[item._type]})
            </Text>
            {loadingStates[loadingKey] && (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
            )}
          </View>
          {renderItem()}
        </View>
      );
    }

    return renderItem();
  };

  // Render result based on active tab
  const renderResult = ({ item }) => {
    switch (activeTab) {
      case 'people':
        return renderUserRow({ item });
      case 'posts':
        return renderPostCard({ item });
      case 'events':
        return renderEventCard({ item });
      case 'songs':
        return renderSongCard({ item });
      case 'movies':
        return renderMovieCard({ item });
      case 'all':
        return renderAllResult({ item });
      default:
        return null;
    }
  };

  // Render empty state
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (query.trim()) {
      return (
        <View style={styles.emptyState}>
          <Ionicons 
            name={
              activeTab === 'people' ? 'people-outline' :
              activeTab === 'events' ? 'calendar-outline' :
              activeTab === 'posts' ? 'document-text-outline' :
              activeTab === 'songs' ? 'musical-notes-outline' :
              activeTab === 'movies' ? 'film-outline' :
              'search-outline'
            } 
            size={64} 
            color={COLORS.textSecondary} 
          />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtext}>
            Try different keywords or check your spelling
          </Text>
        </View>
      );
    }

    // Show error state
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Search Error</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={performSearch}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show suggestions or trending content when no query
    if (activeTab === 'people' && peopleSuggestions.length > 0) {
      return (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.sectionTitle}>People to connect with</Text>
          <FlatList
            data={peopleSuggestions}
            keyExtractor={(item) => item._id}
            renderItem={renderUserRow}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      );
    }

    if (activeTab === 'events') {
      return (
        <CategoryManager
          navigation={navigation}
          currentUserId={currentUser?._id}
        />
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons 
          name="search-outline" 
          size={64} 
          color={COLORS.textSecondary} 
        />
        <Text style={styles.emptyTitle}>Start searching</Text>
        <Text style={styles.emptySubtext}>
          Search for {activeTab === 'all' ? 'people, events, posts, songs, and movies' : activeTab}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
      <SafeAreaView style={styles.safeAreaTop} />
      
      {/* Search Header */}
      <View style={styles.searchHeader}>
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={24} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Events, People, & Tags"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => {
              if (query.trim().length === 0 && recentSearches.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay to allow suggestion clicks
              setTimeout(() => setShowSuggestions(false), 200);
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity>
            <Ionicons name="mic-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search Suggestions Dropdown */}
        {showSuggestions && (searchSuggestions.length > 0 || recentSearches.length > 0) && (
          <View style={styles.suggestionsDropdown}>
            {recentSearches.length > 0 && query.trim().length === 0 && (
              <View>
                <View style={styles.suggestionsHeader}>
                  <Text style={styles.suggestionsHeaderText}>Recent Searches</Text>
                  <TouchableOpacity onPress={async () => {
                    await SearchHistoryService.clearHistory();
                    setRecentSearches([]);
                  }}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {recentSearches.slice(0, 5).map((search, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionSelect(search)}
                  >
                    <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.suggestionText}>{search}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {searchSuggestions.length > 0 && (
              <View>
                {recentSearches.length > 0 && query.trim().length > 0 && (
                  <Text style={styles.suggestionsHeaderText}>Suggestions</Text>
                )}
                {searchSuggestions.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionSelect(suggestion)}
                  >
                    <Ionicons 
                      name={
                        suggestion.type === 'user' ? 'person-outline' :
                        suggestion.type === 'event' ? 'calendar-outline' :
                        suggestion.type === 'post' ? 'document-text-outline' :
                        'search-outline'
                      } 
                      size={20} 
                      color={COLORS.textSecondary} 
                    />
                    <Text style={styles.suggestionText}>{suggestion.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView 
            ref={tabScrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsContainer}
            contentContainerStyle={styles.tabsContent}
          >
            {TABS.map((tab, index) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={styles.tab}
                  onPress={() => switchToTab(index)}
                  activeOpacity={0.7}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    tabLayouts.current[index] = { x, width };
                  }}
                >
                  <Text style={[
                    styles.tabText,
                    isActive && styles.tabTextActive
                  ]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Tab Indicator - positioned at border, aligned with active tab */}
          <View style={styles.tabIndicatorContainer}>
            {TABS.map((tab, index) => {
              const isActive = activeTab === tab;
              const tabLayout = tabLayouts.current[index];
              const indicatorWidth = tabLayout ? Math.min(tabLayout.width, 60) : 60;
              const indicatorLeft = tabLayout ? tabLayout.x + (tabLayout.width / 2) - (indicatorWidth / 2) : 16 + index * 84;
              
              return (
                <View
                  key={tab}
                  style={[
                    styles.tabIndicator,
                    isActive && styles.tabIndicatorActive,
                    isActive && {
                      position: 'absolute',
                      left: indicatorLeft,
                      width: indicatorWidth,
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* Swipeable Content */}
      <View 
        style={styles.swipeableContainer}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[
          styles.swipeableContent,
          { transform: [{ translateX: scrollX }] }]
        }>
          {TABS.map((tab, index) => {
            const isCurrentTab = activeTab === tab;
            return (
              <View key={tab} style={[styles.tabContentWrapper, { width: SCREEN_WIDTH }]}>
                <FlatList
                  data={isCurrentTab ? results : []}
                  keyExtractor={(item, idx) => item._id || item.id || `item-${idx}`}
                  renderItem={activeTab === 'all' ? renderAllResult : renderResult}
                  contentContainerStyle={styles.resultsList}
                  showsVerticalScrollIndicator={false}
                  ListHeaderComponent={() => {
                    // Trending Section (only when no query and on "all" tab)
                    if (!query.trim() && activeTab === 'all' && isCurrentTab) {
                      return (
                        <View style={styles.trendingSection}>
                          <View style={styles.trendingHeader}>
                            <View style={styles.trendingTitleRow}>
                              <Ionicons name="trending-up" size={20} color={COLORS.primary} />
                              <Text style={styles.trendingTitle}>Trending Now</Text>
                            </View>
                            <TouchableOpacity>
                              <Text style={styles.seeAllText}>See all</Text>
                            </TouchableOpacity>
                          </View>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            style={styles.trendingChips}
                            contentContainerStyle={styles.trendingChipsContent}
                            nestedScrollEnabled={true}
                          >
                            {trendingHashtags.map((tag, idx) => (
                              <TouchableOpacity
                                key={idx}
                                style={styles.trendingChip}
                                onPress={() => setQuery(tag)}
                              >
                                <Text style={styles.trendingChipHash}>#</Text>
                                <Text style={styles.trendingChipText}>{tag.replace('#', '')}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      );
                    }
                    return null;
                  }}
                  ListEmptyComponent={isCurrentTab ? renderEmptyState : () => null}
                  refreshControl={
                    isCurrentTab ? (
                      <RefreshControl
                        refreshing={loading}
                        onRefresh={performSearch}
                        tintColor={COLORS.primary}
                      />
                    ) : undefined
                  }
                  scrollEnabled={isCurrentTab}
                  nestedScrollEnabled={true}
                />
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeAreaTop: {
    backgroundColor: COLORS.surface,
  },
  searchHeader: {
    backgroundColor: COLORS.surface,
    paddingTop: 12,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 12,
    zIndex: 10,
    padding: 8,
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginLeft: 56, // Make room for back button
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    padding: 0,
  },
  tabsWrapper: {
    position: 'relative',
    backgroundColor: COLORS.surface,
  },
  tabsContainer: {
    maxHeight: 50,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  tab: {
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 60,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  tabIndicatorContainer: {
    position: 'absolute',
    bottom: -1, // Position right on the border
    left: 0,
    right: 0,
    height: 2,
    zIndex: 10,
  },
  tabIndicator: {
    height: 2,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  trendingSection: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  trendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  trendingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  trendingChips: {
    paddingLeft: 16,
  },
  trendingChipsContent: {
    gap: 12,
    paddingRight: 16,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  trendingChipHash: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  trendingChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  resultsList: {
    paddingBottom: 20,
  },
  // User Row Styles (Modernized)
  userRow: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  handle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  profession: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  friendButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  friendButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Swipeable Container
  swipeableContainer: {
    flex: 1,
  },
  swipeableContent: {
    flexDirection: 'row',
    width: SCREEN_WIDTH * TABS.length,
  },
  tabContentWrapper: {
    flex: 1,
  },
  // Event Card Styles (keeping existing UI)
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  eventCardContent: {
    flexDirection: 'row',
    height: 128,
  },
  eventDateBadge: {
    width: 80,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  eventMonth: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventDay: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  eventInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventStatusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  eventStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  eventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  eventLocationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  eventAttendees: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attendeeAvatars: {
    flexDirection: 'row',
    marginRight: 4,
  },
  attendeeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.surface,
    marginLeft: -8,
  },
  attendeeCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  eventImage: {
    width: 112,
    height: 128,
    backgroundColor: COLORS.border,
  },
  // Post Card Styles
  postCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Media Card Styles (Songs & Movies)
  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mediaImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: COLORS.border,
  },
  mediaImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaInfo: {
    flex: 1,
  },
  mediaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  mediaSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  mediaMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Suggestions Container
  suggestionsContainer: {
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 60,
  },
  resultsList: {
    paddingBottom: 20,
  },
  // Suggestions Dropdown Styles
  suggestionsDropdown: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    maxHeight: 300,
    marginHorizontal: 16,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionsHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 12,
    flex: 1,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
