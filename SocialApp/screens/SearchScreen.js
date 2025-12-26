// Enhanced SearchScreen.js - Blue theme with tabs for All, People, Songs, Movies, Posts, Events
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Image, RefreshControl,
  ScrollView, Dimensions, Animated, PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import CategoryManager from '../components/CategoryManager';
import PostCard from '../components/PostCard';
import ReviewCard from '../components/ReviewCard';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'localhost:3000';
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
  
  // Friend suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
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

  // Fetch friend suggestions
  const fetchFriendSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const { data } = await api.get('/api/friends/suggestions', {
        params: { limit: 15 }
      });
      
      if (data.success) {
        setSuggestions(data.suggestions || []);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
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
      fetchFriendSuggestions();
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
      fetchFriendSuggestions();
    }
  }, [activeTab]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length > 0) {
        performSearch();
      } else {
        setResults([]);
        // Load suggestions for people tab when query is empty
        if (activeTab === 'people') {
          fetchFriendSuggestions();
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
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
    
    setLoading(true);
    try {
      let endpoint = '';
      let params = { q: query };

      switch (activeTab) {
        case 'all':
          // Search all types
          await searchAll();
          return;
        case 'people':
          endpoint = '/api/users/search';
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
          break;
        case 'events':
          endpoint = '/api/search/events';
          break;
        default:
          setLoading(false);
          return;
      }

      const response = await api.get(endpoint, { params });
      
      if (activeTab === 'songs' || activeTab === 'movies') {
        setResults(response.data.items || response.data.results || []);
      } else {
        setResults(response.data || []);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      Alert.alert('Search Error', 'Could not complete search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Search all types
  const searchAll = async () => {
    try {
      const [usersRes, postsRes, eventsRes, songsRes, moviesRes] = await Promise.allSettled([
        api.get('/api/users/search', { params: { q: query, limit: 5 } }),
        api.get('/api/search/posts', { params: { q: query } }).then(r => r.data.slice(0, 5)),
        api.get('/api/search/events', { params: { q: query } }).then(r => r.data.slice(0, 5)),
        api.get('/api/reviews/search-songs', { params: { query, limit: 5 } }),
        api.get('/api/reviews/search-movies', { params: { query, page: 1 } })
      ]);

      const allResults = [];
      
      if (usersRes.status === 'fulfilled' && usersRes.value.data) {
        allResults.push(...usersRes.value.data.map(u => ({ ...u, _type: 'user' })));
      }
      if (postsRes.status === 'fulfilled' && postsRes.value) {
        allResults.push(...postsRes.value.map(p => ({ ...p, _type: 'post' })));
      }
      if (eventsRes.status === 'fulfilled' && eventsRes.value) {
        allResults.push(...eventsRes.value.map(e => ({ ...e, _type: 'event' })));
      }
      if (songsRes.status === 'fulfilled' && songsRes.value.data?.items) {
        allResults.push(...songsRes.value.data.items.map(s => ({ ...s, _type: 'song' })));
      }
      if (moviesRes.status === 'fulfilled' && moviesRes.value.data?.results) {
        allResults.push(...moviesRes.value.data.results.map(m => ({ ...m, _type: 'movie' })));
      }

      setResults(allResults);
    } catch (error) {
      console.error('Search all error:', error);
      setResults([]);
    }
  };

  // Send friend request
  const sendFriendRequest = async (userId, username) => {
    try {
      // Update UI immediately
      setResults(prev => prev.map(user => 
        user._id === userId 
          ? { ...user, relationshipStatus: 'request-sent', canAddFriend: false }
          : user
      ));
      
      setSuggestions(prev => prev.map(user => 
        user._id === userId 
          ? { ...user, relationshipStatus: 'request-sent', canAddFriend: false }
          : user
      ));

      await api.post(`/api/friends/request/${userId}`);
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Could not send friend request. Please try again.');
      
      // Revert UI
      setResults(prev => prev.map(user => 
        user._id === userId 
          ? { ...user, relationshipStatus: 'not-friends', canAddFriend: true }
          : user
      ));
      
      setSuggestions(prev => prev.map(user => 
        user._id === userId 
          ? { ...user, relationshipStatus: 'not-friends', canAddFriend: true }
          : user
      ));
    }
  };

  // Get button config for friend status
  const getButtonConfig = (relationshipStatus) => {
    switch (relationshipStatus) {
      case 'friends':
        return { text: 'Friends', color: COLORS.success, bgColor: COLORS.successLight, disabled: true };
      case 'request-sent':
        return { text: 'Requested', color: COLORS.textSecondary, bgColor: COLORS.border, disabled: true };
      case 'request-received':
        return { text: 'Respond', color: COLORS.primary, bgColor: COLORS.primaryLight, disabled: false };
      default:
        return { text: 'Add Friend', color: COLORS.primary, bgColor: COLORS.primaryLight, disabled: false };
    }
  };

  // Render user row (modernized UI)
  const renderUserRow = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}${item.profilePicture}`
      : `https://placehold.co/48x48/C7C7CC/FFFFFF?text=${item.username?.charAt(0).toUpperCase() || '?'}`;

    const relationshipStatus = item.relationshipStatus || 'not-friends';
    const buttonConfig = getButtonConfig(relationshipStatus);
    const canSendRequest = !buttonConfig.disabled && relationshipStatus === 'not-friends';

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
              if (canSendRequest) {
                sendFriendRequest(item._id, item.username);
              }
            }}
            activeOpacity={0.7}
            disabled={buttonConfig.disabled}
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

  // Render all results (for "All" tab)
  const renderAllResult = ({ item }) => {
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

    // Show suggestions or trending content when no query
    if (activeTab === 'people' && suggestions.length > 0) {
      return (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.sectionTitle}>People to connect with</Text>
          <FlatList
            data={suggestions}
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
                  renderItem={renderResult}
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
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 60,
  },
  resultsList: {
    paddingBottom: 20,
  },
});
