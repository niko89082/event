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
import SearchEventCard from '../components/SearchEventCard';
import SearchPeopleCard from '../components/SearchPeopleCard';
import SearchMovieCard from '../components/SearchMovieCard';
import SearchSongCard from '../components/SearchSongCard';
import { LinearGradient } from 'expo-linear-gradient';

import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
// Use the IP from .env, add port 3000 when constructing URLs
const API_BASE_URL = ENV_API_BASE_URL ? `${ENV_API_BASE_URL}:3000` : (process.env.EXPO_PUBLIC_API_URL || 'localhost:3000');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = ['all', 'people', 'events', 'movies', 'songs'];

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
  // POPULATED WITH MOCK DATA FOR PREVIEW - will be replaced when user searches
  const [results, setResults] = useState([]);
  
  // Mock data for each tab when no query (for preview)
  const mockMoviesResults = [
    {
      id: 'movie1',
      title: 'Oppenheimer',
      release_date: '2023-07-21',
      poster_path: null,
      overview: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
      vote_average: 8.3,
      popularity: 95.2,
    },
    {
      id: 'movie2',
      title: 'Barbie',
      release_date: '2023-07-21',
      poster_path: null,
      overview: 'Barbie suffers a crisis that leads her to question her world and her existence.',
      vote_average: 7.8,
      popularity: 92.5,
    },
    {
      id: 'movie3',
      title: 'Dune: Part Two',
      release_date: '2024-03-01',
      poster_path: null,
      overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
      vote_average: 8.5,
      popularity: 88.7,
    },
    {
      id: 'movie4',
      title: 'The Holdovers',
      release_date: '2023-11-10',
      poster_path: null,
      overview: 'A curmudgeonly instructor at a New England prep school is forced to remain on campus during Christmas break.',
      vote_average: 8.1,
      popularity: 76.3,
    },
    {
      id: 'movie5',
      title: 'Poor Things',
      release_date: '2023-12-08',
      poster_path: null,
      overview: 'The incredible tale of the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.',
      vote_average: 8.0,
      popularity: 74.2,
    },
    {
      id: 'movie6',
      title: 'Killers of the Flower Moon',
      release_date: '2023-10-20',
      poster_path: null,
      overview: 'When oil is discovered in 1920s Oklahoma under Osage Nation land, the Osage people are murdered one by one.',
      vote_average: 7.7,
      popularity: 72.8,
    },
  ];

  const mockSongsResults = [
    {
      id: 'song1',
      name: 'Flowers',
      artists: [{ name: 'Miley Cyrus' }],
      album: { name: 'Endless Summer Vacation' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/4Z2HD6q0' },
      popularity: 95,
      hasReview: false,
    },
    {
      id: 'song2',
      name: 'As It Was',
      artists: [{ name: 'Harry Styles' }],
      album: { name: "Harry's House" },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/4LRqX' },
      popularity: 92,
      hasReview: true,
    },
    {
      id: 'song3',
      name: 'Watermelon Sugar',
      artists: [{ name: 'Harry Styles' }],
      album: { name: 'Fine Line' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/6Uel' },
      popularity: 88,
      hasReview: false,
    },
    {
      id: 'song4',
      name: 'Blinding Lights',
      artists: [{ name: 'The Weeknd' }],
      album: { name: 'After Hours' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/0VjIj' },
      popularity: 85,
      hasReview: true,
    },
    {
      id: 'song5',
      name: 'Levitating',
      artists: [{ name: 'Dua Lipa' }],
      album: { name: 'Future Nostalgia' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/463Ck' },
      popularity: 83,
      hasReview: false,
    },
    {
      id: 'song6',
      name: 'Good 4 U',
      artists: [{ name: 'Olivia Rodrigo' }],
      album: { name: 'SOUR' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/4ZtQ' },
      popularity: 81,
      hasReview: false,
    },
  ];

  const mockEventsResults = [
    {
      _id: 'event1',
      title: 'Tech Meetup 2024',
      description: 'Join us for an evening of networking and tech talks',
      time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'San Francisco, CA' },
      coverImage: null,
      category: 'Technology',
      attendees: [
        { _id: 'user1', username: 'alexchen', profilePicture: null },
        { _id: 'user2', username: 'mariagarcia', profilePicture: null },
      ],
      attendeeCount: 42,
    },
    {
      _id: 'event2',
      title: 'Summer Music Festival',
      description: 'Outdoor music festival featuring local artists',
      time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'Golden Gate Park, SF' },
      coverImage: null,
      category: 'Music & Nightlife',
      attendees: [
        { _id: 'user3', username: 'davidkim', profilePicture: null },
      ],
      attendeeCount: 128,
    },
    {
      _id: 'event3',
      title: 'Art Gallery Opening',
      description: 'Contemporary art exhibition featuring local artists',
      time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'Downtown Gallery, SF' },
      coverImage: null,
      category: 'Arts & Culture',
      attendees: [
        { _id: 'user4', username: 'emilyjones', profilePicture: null },
      ],
      attendeeCount: 67,
    },
    {
      _id: 'event4',
      title: 'Food & Wine Tasting',
      description: 'Sample local wines and artisanal foods',
      time: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'Napa Valley, CA' },
      coverImage: null,
      category: 'Food & Drink',
      attendees: [
        { _id: 'user2', username: 'mariagarcia', profilePicture: null },
      ],
      attendeeCount: 35,
    },
    {
      _id: 'event5',
      title: 'Yoga in the Park',
      description: 'Morning yoga session in the beautiful park setting',
      time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'Central Park, SF' },
      coverImage: null,
      category: 'Health & Wellness',
      attendees: [
        { _id: 'user5', username: 'jameswilson', profilePicture: null },
      ],
      attendeeCount: 24,
    },
    {
      _id: 'event6',
      title: 'Photography Workshop',
      description: 'Learn photography techniques from professionals',
      time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'SF Art Institute' },
      coverImage: null,
      category: 'Education',
      attendees: [
        { _id: 'user6', username: 'sophiamartinez', profilePicture: null },
      ],
      attendeeCount: 18,
    },
  ];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search suggestions state
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Following suggestions state (for people tab) - POPULATED WITH MOCK DATA FOR PREVIEW
  const [peopleSuggestions, setPeopleSuggestions] = useState([
    {
      _id: 'user1',
      username: 'alexchen',
      displayName: 'Alex Chen',
      profilePicture: null,
      bio: 'Tech enthusiast & event organizer • SF',
      followersCount: 1240,
      followingCount: 342,
      isFollowing: false,
      followedBy: [{ username: 'sarahm' }, { username: 'mikej' }],
    },
    {
      _id: 'user2',
      username: 'mariagarcia',
      displayName: 'Maria Garcia',
      profilePicture: null,
      bio: 'Food blogger & event curator • NYC',
      followersCount: 3420,
      followingCount: 890,
      isFollowing: false,
      reviewedMoviesCount: 12,
    },
    {
      _id: 'user3',
      username: 'davidkim',
      displayName: 'David Kim',
      profilePicture: null,
      bio: 'Music producer & DJ • LA',
      followersCount: 890,
      followingCount: 234,
      isFollowing: false,
      attendingEvent: 'Summer Music Festival',
    },
    {
      _id: 'user4',
      username: 'emilyjones',
      displayName: 'Emily Jones',
      profilePicture: null,
      bio: 'Art curator & gallery owner • Chicago',
      followersCount: 2100,
      followingCount: 567,
      isFollowing: false,
      followedBy: [{ username: 'alexchen' }],
    },
    {
      _id: 'user5',
      username: 'jameswilson',
      displayName: 'James Wilson',
      profilePicture: null,
      bio: 'Fitness coach & wellness advocate',
      followersCount: 1560,
      followingCount: 412,
      isFollowing: true,
    },
    {
      _id: 'user6',
      username: 'sophiamartinez',
      displayName: 'Sophia Martinez',
      profilePicture: null,
      bio: 'Photographer & travel blogger',
      followersCount: 2890,
      followingCount: 678,
      isFollowing: false,
      reviewedMoviesCount: 8,
    },
  ]);
  
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

  // New state for enhanced sections - POPULATED WITH MOCK DATA FOR PREVIEW
  const [trendingTopics, setTrendingTopics] = useState([
    { id: 1, category: 'Technology', tag: '#TechMeetup2024', posts: '12.5K', trending: true },
    { id: 2, category: 'Movies', tag: 'Barbie & Oppenheimer', posts: '85.2K', trending: true },
    { id: 3, category: 'Music', tag: 'Summer Festival Lineup', posts: '4.1K', live: true },
    { id: 4, category: 'Food', tag: '#FoodieWeekend', posts: '8.3K', trending: true },
    { id: 5, category: 'Art', tag: '#ArtBasel2024', posts: '15.2K', trending: true },
  ]);
  const [suggestedPeople, setSuggestedPeople] = useState([
    {
      _id: 'user1',
      username: 'alexchen',
      displayName: 'Alex Chen',
      profilePicture: null,
      bio: 'Tech enthusiast & event organizer',
      followersCount: 1240,
      isFollowing: false,
      followedBy: [{ username: 'sarahm' }, { username: 'mikej' }],
    },
    {
      _id: 'user2',
      username: 'mariagarcia',
      displayName: 'Maria Garcia',
      profilePicture: null,
      bio: 'Food blogger & event curator',
      followersCount: 3420,
      isFollowing: false,
      reviewedMoviesCount: 12,
    },
    {
      _id: 'user3',
      username: 'davidkim',
      displayName: 'David Kim',
      profilePicture: null,
      bio: 'Music producer & DJ',
      followersCount: 890,
      isFollowing: false,
      attendingEvent: 'Summer Music Festival',
    },
    {
      _id: 'user4',
      username: 'emilyjones',
      displayName: 'Emily Jones',
      profilePicture: null,
      bio: 'Art curator & gallery owner',
      followersCount: 2100,
      isFollowing: false,
      followedBy: [{ username: 'alexchen' }],
    },
  ]);
  const [upcomingEvents, setUpcomingEvents] = useState([
    {
      _id: 'event1',
      title: 'Tech Meetup 2024',
      description: 'Join us for an evening of networking and tech talks',
      time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'San Francisco, CA' },
      coverImage: null,
      category: 'Technology',
      attendees: [
        { _id: 'user1', username: 'alexchen', profilePicture: null },
        { _id: 'user2', username: 'mariagarcia', profilePicture: null },
      ],
      attendeeCount: 42,
    },
    {
      _id: 'event2',
      title: 'Summer Music Festival',
      description: 'Outdoor music festival featuring local artists',
      time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'Golden Gate Park, SF' },
      coverImage: null,
      category: 'Music & Nightlife',
      attendees: [
        { _id: 'user3', username: 'davidkim', profilePicture: null },
      ],
      attendeeCount: 128,
    },
    {
      _id: 'event3',
      title: 'Art Gallery Opening',
      description: 'Contemporary art exhibition featuring local artists',
      time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      location: { address: 'Downtown Gallery, SF' },
      coverImage: null,
      category: 'Arts & Culture',
      attendees: [
        { _id: 'user4', username: 'emilyjones', profilePicture: null },
      ],
      attendeeCount: 67,
    },
  ]);
  const [popularMovies, setPopularMovies] = useState([
    {
      id: 'movie1',
      title: 'Oppenheimer',
      release_date: '2023-07-21',
      poster_path: null,
      overview: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
      vote_average: 8.3,
      popularity: 95.2,
    },
    {
      id: 'movie2',
      title: 'Barbie',
      release_date: '2023-07-21',
      poster_path: null,
      overview: 'Barbie suffers a crisis that leads her to question her world and her existence.',
      vote_average: 7.8,
      popularity: 92.5,
    },
    {
      id: 'movie3',
      title: 'Dune: Part Two',
      release_date: '2024-03-01',
      poster_path: null,
      overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
      vote_average: 8.5,
      popularity: 88.7,
    },
    {
      id: 'movie4',
      title: 'The Holdovers',
      release_date: '2023-11-10',
      poster_path: null,
      overview: 'A curmudgeonly instructor at a New England prep school is forced to remain on campus during Christmas break.',
      vote_average: 8.1,
      popularity: 76.3,
    },
  ]);
  const [trendingSongs, setTrendingSongs] = useState([
    {
      id: 'song1',
      name: 'Flowers',
      artists: [{ name: 'Miley Cyrus' }],
      album: { name: 'Endless Summer Vacation' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/4Z2HD6q0' },
      popularity: 95,
      hasReview: false,
    },
    {
      id: 'song2',
      name: 'As It Was',
      artists: [{ name: 'Harry Styles' }],
      album: { name: "Harry's House" },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/4LRqX' },
      popularity: 92,
      hasReview: true,
    },
    {
      id: 'song3',
      name: 'Watermelon Sugar',
      artists: [{ name: 'Harry Styles' }],
      album: { name: 'Fine Line' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/6Uel' },
      popularity: 88,
      hasReview: false,
    },
    {
      id: 'song4',
      name: 'Blinding Lights',
      artists: [{ name: 'The Weeknd' }],
      album: { name: 'After Hours' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/0VjIj' },
      popularity: 85,
      hasReview: true,
    },
    {
      id: 'song5',
      name: 'Levitating',
      artists: [{ name: 'Dua Lipa' }],
      album: { name: 'Future Nostalgia' },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/463Ck' },
      popularity: 83,
      hasReview: false,
    },
  ]);

  // Auth context
  const { currentUser } = useContext(AuthContext);

  // Swipe animation refs
  const scrollX = useRef(new Animated.Value(0)).current;
  const currentTabIndex = useRef(0);
  const isAnimating = useRef(false);
  const tabScrollViewRef = useRef(null);
  const tabsWrapperRef = useRef(null);
  const tabLayouts = useRef({}); // Store tab layout positions
  const tabScrollOffset = useRef(0); // Track ScrollView scroll offset
  const indicatorPosition = useRef(new Animated.Value(16)).current; // Animated indicator position
  const indicatorWidth = useRef(new Animated.Value(60)).current; // Animated indicator width
  
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

  // Update indicator position for a specific tab index (simpler approach like ProfileScreen)
  const updateIndicatorPosition = useCallback((index) => {
    const tabLayout = tabLayouts.current[index];
    if (tabLayout && tabLayout.x !== undefined) {
      const screenX = tabLayout.x - tabScrollOffset.current;
      indicatorPosition.setValue(screenX);
      indicatorWidth.setValue(tabLayout.width);
    }
  }, []);

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

    // Animate content scroll (using timing like ProfileScreen for smoother performance)
    const targetContentOffset = -index * SCREEN_WIDTH;
    Animated.timing(scrollX, {
      toValue: targetContentOffset,
      duration: 250,
      useNativeDriver: true,
    }).start((finished) => {
      if (finished) {
      isAnimating.current = false;
        // Update indicator to final position after animation
        updateIndicatorPosition(index);
      }
    });

    // Animate indicator position (simpler approach like ProfileScreen)
    const tabLayout = tabLayouts.current[index];
    if (tabLayout) {
      const screenX = tabLayout.x - tabScrollOffset.current;
      const targetWidth = tabLayout.width;
      
      Animated.parallel([
        Animated.timing(indicatorPosition, {
          toValue: screenX,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(indicatorWidth, {
          toValue: targetWidth,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      // Fallback if layout not yet measured
      setTimeout(() => {
        updateIndicatorPosition(index);
      }, 100);
    }

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
  }, [scrollX, updateIndicatorPosition]);

  // PanResponder for horizontal swipe - allow swipes anywhere
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        
        // Only respond to strong horizontal swipes
        const isStrongHorizontalSwipe = Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 2;
        return isStrongHorizontalSwipe && !isAnimating.current;
      },
      onPanResponderGrant: () => {
        scrollX.stopAnimation();
        isAnimating.current = false; // Allow real-time updates during swipe
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

  // Render user row (using new SearchPeopleCard component)
  const renderUserRow = ({ item }) => {
    // Determine connection context
    let connectionContext = null;
    if (item.followedBy && item.followedBy.length > 0) {
      connectionContext = {
        type: 'followed_by',
        data: { name: item.followedBy[0].username, count: item.followedBy.length }
      };
    } else if (item.attendingEvent) {
      connectionContext = {
        type: 'attending',
        data: { eventName: item.attendingEvent }
      };
    } else if (item.reviewedMoviesCount) {
      connectionContext = {
        type: 'reviewed',
        data: { count: item.reviewedMoviesCount }
      };
    }

    return (
      <SearchPeopleCard
        user={item}
        onPress={(user) => navigation.navigate('ProfileScreen', { userId: user._id })}
        onFollow={handleFollow}
        API_BASE_URL={API_BASE_URL}
        connectionContext={connectionContext}
      />
    );
  };

  // Render event card (using new SearchEventCard component)
  const renderEventCard = ({ item }) => {
    return (
      <SearchEventCard
        event={item}
        onPress={(event) => navigation.navigate('EventDetailsScreen', { eventId: event._id })}
        API_BASE_URL={API_BASE_URL}
      />
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

  // Render song card (using new SearchSongCard component)
  const renderSongCard = ({ item }) => {
    return (
      <SearchSongCard
        song={item}
        onPress={(song) => {
          navigation.navigate('PostDetailsScreen', { 
            songId: song.id,
            song: song 
          });
        }}
        onAction={(song) => {
          // Handle review/add action
          navigation.navigate('PostDetailsScreen', { 
            songId: song.id,
            song: song 
          });
        }}
        hasReview={item.hasReview || false}
      />
    );
  };

  // Render movie card (using new SearchMovieCard component)
  const renderMovieCard = ({ item }) => {
    return (
      <SearchMovieCard
        movie={item}
        onPress={(movie) => {
          navigation.navigate('PostDetailsScreen', { 
            movieId: movie.id,
            movie: movie 
          });
        }}
      />
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
                        item._type === 'song' ? 'songs' : 
                        item._type === 'movie' ? 'movies' : 'users';

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
      // Show horizontal category sections when no query
      if (!query.trim()) {
      return (
          <ScrollView 
            style={styles.fullHeightScroll}
            contentContainerStyle={styles.eventsCategoriesContainer}
            showsVerticalScrollIndicator={false}
          >
            {['Music', 'Party', 'Social', 'Sports', 'Food', 'Business', 'Entertainment', 'Art', 'Technology'].map((category) => {
              const categoryConfig = {
                'Music': { icon: 'musical-notes', colors: ['#FF6B6B', '#FF8E8E'] },
                'Party': { icon: 'sparkles', colors: ['#4ECDC4', '#6FE8E0'] },
                'Social': { icon: 'people', colors: ['#45B7D1', '#66C5F0'] },
                'Sports': { icon: 'fitness', colors: ['#FECA57', '#FED569'] },
                'Food': { icon: 'restaurant', colors: ['#FF9FF3', '#FFB3F7'] },
                'Business': { icon: 'briefcase', colors: ['#54A0FF', '#74B9FF'] },
                'Entertainment': { icon: 'film', colors: ['#5F27CD', '#7C4DFF'] },
                'Art': { icon: 'color-palette', colors: ['#00D2D3', '#1DD1A1'] },
                'Technology': { icon: 'laptop', colors: ['#FF3838', '#FF6B6B'] },
              }[category] || { icon: 'calendar', colors: ['#6366F1', '#8B5CF6'] };
              
              const categoryEvents = mockEventsResults.filter(e => 
                e.category === category || 
                e.category?.includes(category) ||
                category === 'Music' && (e.category?.includes('Music') || e.category?.includes('Nightlife'))
              );
              
              if (categoryEvents.length === 0) {
                // Add some mock events for each category
                categoryEvents.push(...mockEventsResults.slice(0, 3).map((e, i) => ({
                  ...e,
                  _id: `${category}-${i}`,
                  title: `${category} Event ${i + 1}`,
                  category: category,
                })));
              }
              
              return (
                <View key={category} style={styles.categorySection}>
                  <View style={styles.categorySectionHeader}>
                    <Text style={styles.categorySectionTitle}>{category}</Text>
                    <TouchableOpacity>
                      <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.categoryEventsScroll, { paddingLeft: 16, paddingRight: 16 }]}
                    style={{ marginLeft: -16, marginRight: -16 }}
                    nestedScrollEnabled={true}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    onScrollBeginDrag={() => {
                      isAnimating.current = true;
                    }}
                    onScrollEndDrag={() => {
                      setTimeout(() => {
                        isAnimating.current = false;
                      }, 100);
                    }}
                  >
                    {categoryEvents.map((event) => (
                      <SearchEventCard
                        key={event._id}
                        event={event}
                        onPress={(e) => navigation.navigate('EventDetailsScreen', { eventId: e._id })}
                        API_BASE_URL={API_BASE_URL}
                        horizontal={true}
                      />
                    ))}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        );
      }
      
      // Show search results when query exists
      return null; // Will be handled by FlatList below
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
        <View style={[
          styles.searchContainer,
          showSuggestions && (searchSuggestions.length > 0 || recentSearches.length > 0) && styles.searchContainerWithSuggestions
        ]}>
          <Ionicons name="search" size={24} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              activeTab === 'all' ? "Search events, people, movies..." :
              activeTab === 'people' ? "Search people..." :
              activeTab === 'events' ? "Search events..." :
              activeTab === 'movies' ? "Search movies..." :
              activeTab === 'songs' ? "Search songs, artists, lyrics..." :
              "Search..."
            }
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
        <View ref={tabsWrapperRef} style={styles.tabsWrapper}>
          <ScrollView 
            ref={tabScrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsContainer}
            contentContainerStyle={styles.tabsContent}
            onScroll={(event) => {
              const newOffset = event.nativeEvent.contentOffset.x;
              tabScrollOffset.current = newOffset;
              // Update indicator position when scrolling
              const activeIndex = TABS.indexOf(activeTab);
              if (activeIndex >= 0) {
                const tabLayout = tabLayouts.current[activeIndex];
                if (tabLayout && tabLayout.x !== undefined) {
                  // Adjust for scroll offset - tabs are in ScrollView, indicator is outside
                  // Position relative to tabsWrapper = tab.x (in ScrollView content) - scrollOffset
                  const adjustedX = tabLayout.x - newOffset;
                  indicatorPosition.setValue(adjustedX);
                }
              }
            }}
            scrollEventThrottle={16}
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
                    // x is relative to ScrollView's contentContainer
                    // tabsContent has paddingHorizontal: 16, so first tab is at x=16
                    // When ScrollView scrolls by offset, tab's position relative to tabsWrapper is: x - offset
                    // Store both for use in animations
                    const screenX = x - tabScrollOffset.current;
                    tabLayouts.current[index] = { 
                      x, // Position in ScrollView content
                      width,
                      xScreen: screenX // Position relative to tabsWrapper (for indicator)
                    };
                    // Update indicator position if this is the active tab
                    if (activeTab === tab) {
                      updateIndicatorPosition(index);
                    }
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
          {/* Tab Indicator - animated position directly under active tab */}
          <View style={styles.tabIndicatorContainer}>
            <Animated.View
                  style={[
                    styles.tabIndicator,
                styles.tabIndicatorActive,
                {
                      position: 'absolute',
                  left: indicatorPosition,
                      width: indicatorWidth,
                    }
                  ]}
                />
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
              <View key={tab} style={styles.tabContentWrapper}>
                {/* Results Header for Movies and Songs tabs */}
                {isCurrentTab && query.trim() && (activeTab === 'movies' || activeTab === 'songs') && (
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsHeaderText}>
                      {activeTab === 'movies' 
                        ? `Found ${results.length} movie${results.length !== 1 ? 's' : ''}`
                        : 'Top Results'}
                    </Text>
                    <TouchableOpacity style={styles.filterButton}>
                      <Ionicons 
                        name={activeTab === 'movies' ? 'filter-outline' : 'options-outline'} 
                        size={16} 
                        color={COLORS.primary} 
                      />
                      <Text style={styles.filterButtonText}>Filter</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Movies Grid Layout - Use FlatList with numColumns for proper 2-column grid */}
                {isCurrentTab && activeTab === 'movies' ? (
                <FlatList
                    data={query.trim() ? results : mockMoviesResults}
                    keyExtractor={(item, idx) => item.id || `movie-${idx}`}
                    renderItem={({ item }) => (
                      <SearchMovieCard
                        movie={item}
                        onPress={(m) => navigation.navigate('PostDetailsScreen', { movieId: m.id, movie: m })}
                      />
                    )}
                    numColumns={2}
                    columnWrapperStyle={styles.moviesRow}
                    contentContainerStyle={styles.moviesGridContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmptyState}
                  />
                ) : (
                  <FlatList
                    key={`${activeTab}-${activeTab === 'events' ? 'grid' : 'list'}`}
                    style={styles.fullHeightList}
                    data={isCurrentTab ? (
                      query.trim() ? results : (
                        activeTab === 'movies' ? mockMoviesResults :
                        activeTab === 'songs' ? mockSongsResults :
                        activeTab === 'events' ? mockEventsResults :
                        results
                      )
                    ) : []}
                  keyExtractor={(item, idx) => item._id || item.id || `item-${idx}`}
                  renderItem={activeTab === 'all' ? renderAllResult : renderResult}
                    contentContainerStyle={[
                      styles.resultsList,
                      results.length === 0 && styles.emptyListContainer
                    ]}
                  showsVerticalScrollIndicator={false}
                    numColumns={activeTab === 'events' ? 2 : undefined}
                    columnWrapperStyle={activeTab === 'events' ? styles.eventsRow : undefined}
                  ListHeaderComponent={() => {
                    // Enhanced All Tab Sections (only when no query and on "all" tab)
                    if (!query.trim() && activeTab === 'all' && isCurrentTab) {
                      return (
                        <View>
                          {/* Trends for you Section */}
                          <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Trends for you</Text>
                            {trendingTopics.slice(0, 3).map((topic) => (
                              <TouchableOpacity
                                key={topic.id}
                                style={styles.trendItem}
                                onPress={() => setQuery(topic.tag)}
                              >
                                <View style={styles.trendItemContent}>
                                  <View style={styles.trendItemLeft}>
                                    <Text style={styles.trendItemRank}>{topic.id}.</Text>
                                    <View style={styles.trendItemInfo}>
                                      <Text style={styles.trendItemCategory}>
                                        {topic.category} {topic.trending ? '• Trending' : topic.live ? '• Live' : ''}
                                      </Text>
                                      <Text style={styles.trendItemTag}>{topic.tag}</Text>
                                      <Text style={styles.trendItemPosts}>{topic.posts} posts</Text>
                                    </View>
                            </View>
                            <TouchableOpacity>
                                    <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />
                                  </TouchableOpacity>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {/* Suggested People Section */}
                          {suggestedPeople.length > 0 && (
                            <View style={styles.sectionContainer}>
                              <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Suggested People</Text>
                                <TouchableOpacity onPress={() => switchToTab(TABS.indexOf('people'))}>
                              <Text style={styles.seeAllText}>See all</Text>
                            </TouchableOpacity>
                          </View>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={[styles.horizontalScrollContent, { paddingLeft: 16, paddingRight: 16 }]}
                            style={{ marginLeft: -16, marginRight: -16 }}
                            nestedScrollEnabled={true}
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            onResponderTerminationRequest={() => false}
                            onScrollBeginDrag={() => {
                              isAnimating.current = true;
                            }}
                            onScrollEndDrag={() => {
                              setTimeout(() => {
                                isAnimating.current = false;
                              }, 100);
                            }}
                          >
                            {suggestedPeople.map((person) => (
                                  <View key={person._id} style={styles.suggestedPersonCard}>
                                    <View style={styles.suggestedPersonAvatarContainer}>
                                      <Image
                                        source={{ 
                                          uri: person.profilePicture 
                                            ? `http://${API_BASE_URL}${person.profilePicture}`
                                            : `https://placehold.co/60x60/C7C7CC/FFFFFF?text=${person.username?.charAt(0) || '?'}`
                                        }}
                                        style={styles.suggestedPersonAvatar}
                                      />
                                      {person.verified && (
                                        <View style={styles.suggestedPersonVerified}>
                                          <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                                        </View>
                                      )}
                                    </View>
                                    <Text style={styles.suggestedPersonName} numberOfLines={1}>
                                      {person.displayName || person.username}
                                    </Text>
                                    <Text style={styles.suggestedPersonHandle} numberOfLines={1}>
                                      @{person.username}
                                    </Text>
                              <TouchableOpacity
                                      style={styles.suggestedPersonFollowButton}
                                      onPress={() => handleFollow(person._id, person.username)}
                                    >
                                      <Text style={styles.suggestedPersonFollowText}>Follow</Text>
                                    </TouchableOpacity>
                                  </View>
                                ))}
                              </ScrollView>
                            </View>
                          )}

                          {/* Upcoming Events Section */}
                          {upcomingEvents.length > 0 && (
                            <View style={styles.sectionContainer}>
                              <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Upcoming Events</Text>
                                <TouchableOpacity>
                                  <Text style={styles.seeAllText}>See all</Text>
                                </TouchableOpacity>
                              </View>
                              {upcomingEvents.slice(0, 1).map((event) => {
                                const eventDate = event.time ? new Date(event.time) : null;
                                const month = eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
                                const day = eventDate ? eventDate.getDate() : '';
                                return (
                                  <TouchableOpacity
                                    key={event._id}
                                    style={styles.upcomingEventCard}
                                    onPress={() => navigation.navigate('EventDetailsScreen', { eventId: event._id })}
                                  >
                                    <View style={styles.upcomingEventDateBlock}>
                                      <Text style={styles.upcomingEventMonth}>{month}</Text>
                                      <Text style={styles.upcomingEventDay}>{day}</Text>
                                    </View>
                                    <View style={styles.upcomingEventInfo}>
                                      <Text style={styles.upcomingEventTitle}>{event.title}</Text>
                                      <View style={styles.upcomingEventLocation}>
                                        <Ionicons name="location" size={14} color={COLORS.textSecondary} />
                                        <Text style={styles.upcomingEventLocationText}>
                                          {event.location?.address || 'Location TBD'}
                                        </Text>
                                      </View>
                                      {event.attendees && event.attendees.length > 0 && (
                                        <View style={styles.upcomingEventAttendees}>
                                          <View style={styles.upcomingEventAvatars}>
                                            {event.attendees.slice(0, 3).map((attendee, idx) => (
                                              <Image
                                key={idx}
                                                source={{ 
                                                  uri: attendee.profilePicture 
                                                    ? `http://${API_BASE_URL}${attendee.profilePicture}`
                                                    : `https://placehold.co/20x20/C7C7CC/FFFFFF?text=${attendee.username?.charAt(0) || '?'}`
                                                }}
                                                style={[styles.upcomingEventAvatar, { marginLeft: idx > 0 ? -8 : 0 }]}
                                              />
                                            ))}
                                          </View>
                                          <Text style={styles.upcomingEventAttendeeCount}>
                                            {event.attendees.length}
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                    {event.coverImage && (
                                      <Image
                                        source={{ uri: `http://${API_BASE_URL}${event.coverImage}` }}
                                        style={styles.upcomingEventImage}
                                      />
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* Popular Movies Section */}
                          {popularMovies.length > 0 && (
                            <View style={styles.sectionContainer}>
                              <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Popular Movies</Text>
                                <TouchableOpacity>
                                  <Text style={styles.seeAllText}>See all</Text>
                                </TouchableOpacity>
                              </View>
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={[styles.horizontalScrollContent, { paddingLeft: 16, paddingRight: 16 }]}
                                style={{ marginLeft: -16, marginRight: -16 }}
                                nestedScrollEnabled={true}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                                onResponderTerminationRequest={() => false}
                                onScrollBeginDrag={() => {
                                  isAnimating.current = true;
                                }}
                                onScrollEndDrag={() => {
                                  setTimeout(() => {
                                    isAnimating.current = false;
                                  }, 100);
                                }}
                              >
                                {popularMovies.slice(0, 3).map((movie) => (
                                  <SearchMovieCard
                                    key={movie.id}
                                    movie={movie}
                                    onPress={(m) => navigation.navigate('PostDetailsScreen', { movieId: m.id, movie: m })}
                                  />
                                ))}
                              </ScrollView>
                            </View>
                          )}

                          {/* Trending Songs Section */}
                          {trendingSongs.length > 0 && (
                            <View style={styles.sectionContainer}>
                              <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Trending Songs</Text>
                                <TouchableOpacity>
                                  <Text style={styles.seeAllText}>See all</Text>
                              </TouchableOpacity>
                              </View>
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={[styles.horizontalScrollContent, { paddingLeft: 16, paddingRight: 16 }]}
                                style={{ marginLeft: -16, marginRight: -16 }}
                                nestedScrollEnabled={true}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                                onResponderTerminationRequest={() => false}
                                onScrollBeginDrag={() => {
                                  isAnimating.current = true;
                                }}
                                onScrollEndDrag={() => {
                                  setTimeout(() => {
                                    isAnimating.current = false;
                                  }, 100);
                                }}
                              >
                                {trendingSongs.slice(0, 3).map((song) => (
                                  <View key={song.id} style={styles.trendingSongCard}>
                                    <LinearGradient
                                      colors={['#8B5CF6', '#6366F1']}
                                      style={styles.trendingSongGradient}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                    >
                                      <Ionicons name="musical-notes" size={32} color="rgba(255, 255, 255, 0.8)" />
                                    </LinearGradient>
                                    <Text style={styles.trendingSongTitle} numberOfLines={1}>
                                      {song.name}
                                    </Text>
                                    <Text style={styles.trendingSongArtist} numberOfLines={1}>
                                      {song.artists?.[0]?.name || 'Unknown Artist'}
                                    </Text>
                                  </View>
                            ))}
                          </ScrollView>
                            </View>
                          )}
                        </View>
                      );
                    }
                    return null;
                  }}
                  ListEmptyComponent={isCurrentTab ? renderEmptyState : () => null}
                  ListFooterComponent={() => {
                    if (isCurrentTab && activeTab === 'people' && results.length > 0 && !loading) {
                      return (
                        <View style={styles.endOfResults}>
                          <Text style={styles.endOfResultsText}>End of results</Text>
                        </View>
                      );
                    }
                    return null;
                  }}
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
              )}
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
    zIndex: 10,
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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginHorizontal: 16,
    marginBottom: 0,
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
  searchContainerWithSuggestions: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
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
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 60,
    borderRadius: 20,
    marginRight: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabIndicatorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 10,
  },
  tabIndicator: {
    height: 3,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
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
    width: SCREEN_WIDTH,
  },
  swipeableContent: {
    flexDirection: 'row',
    width: SCREEN_WIDTH * TABS.length,
    height: '100%',
  },
  tabContentWrapper: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  fullHeightScroll: {
    flex: 1,
  },
  fullHeightList: {
    flex: 1,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  fullHeightContainer: {
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    minHeight: 400,
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
    maxHeight: 300,
    marginHorizontal: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
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
  // New All Tab Section Styles
  sectionContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Trends Section
  trendItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  trendItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendItemLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  trendItemRank: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginRight: 12,
    minWidth: 20,
  },
  trendItemInfo: {
    flex: 1,
  },
  trendItemCategory: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  trendItemTag: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  trendItemPosts: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  showMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Suggested People Section
  horizontalScrollContent: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
  },
  suggestedPersonCard: {
    width: 120,
    alignItems: 'center',
    marginRight: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  suggestedPersonAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  suggestedPersonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  suggestedPersonVerified: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  suggestedPersonName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  suggestedPersonHandle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  suggestedPersonFollowButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  suggestedPersonFollowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Upcoming Events Section
  upcomingEventCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  upcomingEventDateBlock: {
    width: 60,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upcomingEventMonth: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  upcomingEventDay: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  upcomingEventInfo: {
    flex: 1,
  },
  upcomingEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  upcomingEventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  upcomingEventLocationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  upcomingEventAttendees: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upcomingEventAvatars: {
    flexDirection: 'row',
  },
  upcomingEventAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  upcomingEventAttendeeCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  upcomingEventImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginLeft: 12,
  },
  // Trending Songs Section
  trendingSongCard: {
    width: 120,
    marginRight: 12,
  },
  trendingSongGradient: {
    width: 120,
    height: 120,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendingSongTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  trendingSongArtist: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  // Results Header (for Movies and Songs tabs)
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultsHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Movies Grid Layout
  moviesGridContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  moviesRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eventsCategoriesContainer: {
    paddingBottom: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categorySectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryEventsScroll: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  eventsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  // Category Buttons
  categoryButton: {
    alignItems: 'center',
    marginRight: 16,
    width: 100,
  },
  categoryIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  // End of results indicator
  endOfResults: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  endOfResultsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
