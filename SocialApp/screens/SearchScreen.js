// Enhanced SearchScreen.js - Unified Instagram-style search experience
import React, { useState, useEffect, useContext } from 'react';
import {
  View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Image, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import CategoryManager from '../components/CategoryManager';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'localhost:3000';

export default function SearchScreen({ navigation, route }) {
  // Basic search state
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('users'); // users | events
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Enhanced search state
  const [searchType, setSearchType] = useState('all'); // 'all', 'friends', 'non-friends'
  const [friendStatuses, setFriendStatuses] = useState({}); // Track friendship statuses
  
  // Friend suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showingCategories, setShowingCategories] = useState(false);
  const [categoryLimit, setCategoryLimit] = useState(5);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categoryRefreshTrigger, setCategoryRefreshTrigger] = useState(0);

  // Auth context
  const { currentUser } = useContext(AuthContext);

  // Handle navigation params for friend suggestions
  useEffect(() => {
    if (route.params?.showSuggestions) {
      setShowSuggestions(true);
      fetchFriendSuggestions();
    }
  }, [route.params?.showSuggestions]);

  // Load suggestions immediately if starting on users tab
  useEffect(() => {
    if (tab === 'users') {
      fetchFriendSuggestions();
    }
  }, []); // Only run once on mount

  // Navigation header setup
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: showSuggestions ? 'People You May Know' : 'Search',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, showSuggestions]);

  // Enhanced auto-loading useEffect
    useEffect(() => {
    if (tab === 'users' && query.trim() === '' && suggestions.length === 0 && !loadingSuggestions) {
      console.log('🚀 Loading friend suggestions for users tab...');
      fetchFriendSuggestions();
    }
  }, [tab]); // Only depend on tab change, not suggestions.length

  // Separate effect to clear results when query is empty
  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
    }
  }, [query]);

  // Debounced search effect - Instagram/Facebook style timing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length > 0) {
        runEnhancedSearch();
      } else {
        setResults([]);
      }
    }, 150); // Optimized timing - fast but not overwhelming

    return () => clearTimeout(timeoutId);
  }, [query, tab, searchType]);

  // CLEAN: Enhanced search function (no more infinite loops!)
  const runEnhancedSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      console.log(`🔍 CLEAN SEARCH: ${tab} - "${query}" (Type: ${searchType})`);
      
      if (tab === 'users') {
        let endpoint = '/api/users/search';
        let params = { q: query, limit: 20 };
        
        // Use friends-only search if filter is set to friends
        if (searchType === 'friends') {
          endpoint = '/api/users/friends/search';
        } else {
          params.includeNonFriends = 'true';
        }
        
        const response = await api.get(endpoint, { params });
        const searchResults = response.data || [];
        
        console.log(`✅ CLEAN SEARCH: Found ${searchResults.length} results`);
        
        // Update friend statuses for UI
        const statusMap = {};
        searchResults.forEach(user => {
          statusMap[user._id] = user.relationshipStatus || 'unknown';
        });
        setFriendStatuses(statusMap);
        
        setResults(searchResults);
      } else {
        // Search events (existing functionality)
        const response = await api.get(`/api/search/events`, {
          params: { q: query }
        });
        setResults(response.data || []);
      }
      
    } catch (error) {
      console.error('❌ Clean search error:', error);
      setResults([]);
      
      // Better error handling
      if (error.response?.status === 429) {
        Alert.alert('Too Many Requests', 'Please slow down your searching.');
      } else if (error.response?.status === 500) {
        Alert.alert('Server Error', 'Search is temporarily unavailable.');
      } else {
        Alert.alert('Search Error', 'Could not complete search. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch friend suggestions using existing friends.js API
  const fetchFriendSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      console.log('🎯 Fetching friend suggestions...');
      
      const { data } = await api.get('/api/friends/suggestions', {
        params: { limit: 15 }
      });
      
      if (data.success) {
        setSuggestions(data.suggestions || []);
        console.log(`📱 Loaded ${data.suggestions?.length || 0} suggestions`);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('❌ Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // ENHANCED: Send friend request with instant UX
  const sendFriendRequest = async (userId, username) => {
    try {
      console.log(`📤 ENHANCED: Sending friend request to user: ${userId}`);
      
      // Update UI immediately for instant feedback
      setResults(prev => prev.map(user => 
        user._id === userId 
          ? { 
              ...user, 
              relationshipStatus: 'request-sent', 
              priorityReason: 'Friend request sent',
              canAddFriend: false 
            }
          : user
      ));
      
      // Update friend statuses
      setFriendStatuses(prev => ({
        ...prev,
        [userId]: 'request-sent'
      }));
      
      // Remove from suggestions if present
      setSuggestions(prev => prev.filter(user => user._id !== userId));
      
      try {
        // Send API request in background
        await api.post(`/api/friends/request/${userId}`);
        console.log('✅ ENHANCED: Friend request sent successfully');
      } catch (error) {
        console.error('❌ ENHANCED: Error sending friend request:', error);
        
        // Revert UI changes on error
        setResults(prev => prev.map(user => 
          user._id === userId 
            ? { 
                ...user, 
                relationshipStatus: 'not-friends', 
                priorityReason: null,
                canAddFriend: true 
              }
            : user
        ));
        
        setFriendStatuses(prev => ({
          ...prev,
          [userId]: 'not-friends'
        }));
        
        let errorMessage = 'Could not send friend request. Please try again.';
        if (error.response?.status === 400) {
          errorMessage = error.response.data.error || errorMessage;
        } else if (error.response?.status === 409) {
          errorMessage = 'Friend request already exists or you are already friends.';
        }
        
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('❌ ENHANCED: Error in sendFriendRequest:', error);
    }
  };

  // Format mutual friends with names first, then count
  const formatMutualFriends = (mutualFriendsDetails, totalCount) => {
    if (!mutualFriendsDetails?.length && !totalCount) return null;
    
    if (mutualFriendsDetails && mutualFriendsDetails.length > 0) {
      const names = mutualFriendsDetails.slice(0, 2).map(f => f.displayName || f.username);
      const remaining = totalCount - names.length;
      
      if (names.length === 1) {
        return remaining > 0 ? `${names[0]} and ${remaining} more` : names[0];
      } else if (names.length === 2) {
        return remaining > 0 ? `${names[0]}, ${names[1]} and ${remaining} more` : `${names[0]} and ${names[1]}`;
      }
    }
    
    // Fallback to count only
    if (totalCount > 0) {
      return `${totalCount} mutual friend${totalCount > 1 ? 's' : ''}`;
    }
    
    return null;
  };

  // Get connection reason for why someone was suggested
  const getConnectionReason = (user) => {
    const mutualFriendsCount = user.mutualFriends || user.mutualFriendsCount || 0;
    const mutualEventsCount = user.mutualEvents || user.mutualEventsCount || user.eventCoAttendance || 0;
    
    // Prioritize showing mutual friends if they exist
    if (mutualFriendsCount > 0) {
      return formatMutualFriends(user.mutualFriendsDetails, mutualFriendsCount);
    }
    
    // Show events if no mutual friends
    if (mutualEventsCount > 0) {
      return `Attended ${mutualEventsCount} event${mutualEventsCount > 1 ? 's' : ''} together`;
    }
    
    // Other connection reasons
    if (user.reason) {
      return user.reason;
    }
    
    // Fallback
    return "Suggested for you";
  };

  // Get button configuration based on relationship status
  const getButtonConfig = (relationshipStatus) => {
    switch (relationshipStatus) {
      case 'friends':
        return { text: 'Friends', color: '#34C759', bgColor: '#F0FFF0', icon: 'checkmark-circle', disabled: true };
      case 'request-sent':
        return { text: 'Pending', color: '#FF9500', bgColor: '#FFF8F0', icon: 'time', disabled: true };
      case 'request-received':
        return { text: 'Respond', color: '#34C759', bgColor: '#F0FFF0', icon: 'person-add', disabled: false };
      case 'not-friends':
      default:
        return { text: 'Add', color: '#3797EF', bgColor: '#F0F7FF', icon: 'person-add-outline', disabled: false };
    }
  };

  // Universal User Row Component
  const UserRow = ({ user, isSearchResult = false }) => {
    const avatar = user.profilePicture
      ? `http://${API_BASE_URL}${user.profilePicture}`
      : `https://placehold.co/50x50/C7C7CC/FFFFFF?text=${user.username?.charAt(0).toUpperCase() || '?'}`;

    const relationshipStatus = user.relationshipStatus || friendStatuses[user._id] || 'not-friends';
    const connectionReason = getConnectionReason(user);
    const buttonConfig = getButtonConfig(relationshipStatus);
    const canSendRequest = !buttonConfig.disabled && relationshipStatus === 'not-friends';

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => navigation.navigate('ProfileScreen', { userId: user._id })}
        activeOpacity={0.95}
      >
        <View style={styles.userContent}>
          <Image source={{ uri: avatar }} style={styles.userAvatar} />
          
          <View style={styles.userInfo}>
            <Text style={styles.username} numberOfLines={1}>
              {user.displayName || user.username}
            </Text>
            
            <Text style={styles.handle} numberOfLines={1}>
              @{user.username}
            </Text>
            
            {connectionReason && (
              <Text style={styles.connectionReason} numberOfLines={1}>
                {connectionReason}
              </Text>
            )}
          </View>

          {/* Action button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: buttonConfig.bgColor, borderColor: buttonConfig.color }
            ]}
            onPress={(e) => {
              e.stopPropagation();
              if (relationshipStatus === 'request-received') {
                navigation.navigate('FriendsListScreen', { 
                  userId: currentUser._id, 
                  mode: 'requests' 
                });
              } else if (canSendRequest) {
                sendFriendRequest(user._id, user.username);
              }
            }}
            activeOpacity={0.7}
            disabled={buttonConfig.disabled && relationshipStatus !== 'request-received'}
          >
            <Ionicons name={buttonConfig.icon} size={16} color={buttonConfig.color} />
            <Text style={[styles.actionButtonText, { color: buttonConfig.color }]}>
              {buttonConfig.text}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };
const shouldShowCategories = () => {
  return (
    tab === 'events' && 
    query.trim() === '' && 
    results.length === 0 &&
    !loading &&
    !showSuggestions
  );
};
// ✅ NEW: Category refresh handler
const handleCategoryRefresh = () => {
  setCategoryRefreshTrigger(prev => prev + 1);
};

// ✅ NEW: Toggle show all categories
const toggleShowAllCategories = () => {
  setShowAllCategories(prev => !prev);
};
  // Render search result item (updated to use enhanced user item)
  const renderSearchResult = ({ item }) => {
    if (tab === 'users') {
      return <UserRow user={item} isSearchResult={true} />;
    } else {
      // Event rendering (existing logic)
      return (
        <TouchableOpacity 
          style={styles.eventRow}
          onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
          activeOpacity={0.95}
        >
          <View style={styles.eventContent}>
            <View style={styles.eventImageContainer}>
              {item.coverImage ? (
                <Image
                  source={{ uri: `http://${API_BASE_URL}${item.coverImage}` }}
                  style={styles.eventImage}
                />
              ) : (
                <View style={styles.eventImagePlaceholder}>
                  <Ionicons name="calendar-outline" size={24} color="#8E8E93" />
                </View>
              )}
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
              {item.location?.address && (
                <Text style={styles.eventLocation} numberOfLines={1}>
                  {item.location.address}
                </Text>
              )}
              {item.time && (
                <Text style={styles.eventTime}>
                  {new Date(item.time).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </Text>
              )}
              {item.host && (
                <Text style={styles.eventHost}>by {item.host.username}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }
  };

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Friend Suggestions View */}
      {showSuggestions ? (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>People You May Know</Text>
            <TouchableOpacity onPress={() => setShowSuggestions(false)}>
              <Text style={styles.hideSuggestions}>Search Instead</Text>
            </TouchableOpacity>
          </View>
          
          {loadingSuggestions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3797EF" />
              <Text style={styles.loadingText}>Finding people you may know...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => <UserRow user={item} />}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              refreshControl={
                <RefreshControl
                  refreshing={loadingSuggestions}
                  onRefresh={fetchFriendSuggestions}
                  tintColor="#3797EF"
                />
              }
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Suggestions Available</Text>
              <Text style={styles.emptySubtext}>
                Add more friends or attend events to get personalized suggestions
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowSuggestions(false)}
              >
                <Text style={styles.primaryButtonText}>Search for People</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        // Regular Search View
        <>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${tab}...`}
                style={styles.searchInput}
                onSubmitEditing={runEnhancedSearch}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                  <Ionicons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, tab === 'users' && styles.activeTab]}
              onPress={() => {
                setTab('users');
                setQuery(''); // Clear search
                setResults([]);
                // Force suggestions load when switching to users tab
                if (suggestions.length === 0 && !loadingSuggestions) {
                  console.log('🚀 Loading suggestions for users tab switch...');
                  fetchFriendSuggestions();
                }
              }}
            >
              <Text style={[styles.tabText, tab === 'users' && styles.activeTabText]}>
                People
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, tab === 'events' && styles.activeTab]}
              onPress={() => {
                setTab('events');
                setQuery(''); // Clear search
                setResults([]);
              }}
            >
              <Text style={[styles.tabText, tab === 'events' && styles.activeTabText]}>
                Events
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Filter (for users only) */}
          {tab === 'users' && query.length > 0 && (
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterButton, searchType === 'all' && styles.activeFilter]}
                onPress={() => setSearchType('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, searchType === 'all' && styles.activeFilterText]}>
                  All People
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, searchType === 'friends' && styles.activeFilter]}
                onPress={() => setSearchType('friends')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, searchType === 'friends' && styles.activeFilterText]}>
                  Friends Only
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search Results */}
          <FlatList 
            data={results} 
            keyExtractor={(item) => item._id} 
            renderItem={renderSearchResult}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => {
              if (loading) {
                return (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3797EF" />
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                );
              }
              
              if (query.trim()) {
                return (
                  <View style={styles.emptyState}>
                    <Ionicons 
                      name={tab === 'users' ? 'people-outline' : 'calendar-outline'} 
                      size={64} 
                      color="#C7C7CC" 
                    />
                    <Text style={styles.emptyTitle}>
                      No {tab} found
                    </Text>
                    <Text style={styles.emptySubtext}>
                      Try different keywords or check your spelling
                    </Text>
                    {tab === 'users' && searchType === 'friends' && (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setSearchType('all')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.secondaryButtonText}>Search All People</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
              
              // No search query - show appropriate content based on tab
              return (
                <View style={styles.welcomeContainer}>
                  {tab === 'users' ? (
                    // Users tab logic
                    loadingSuggestions ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#3797EF" />
                        <Text style={styles.loadingText}>Finding people you may know...</Text>
                      </View>
                    ) : suggestions.length > 0 ? (
                      <>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>People You May Know</Text>
                        </View>
                        
                        <FlatList
                          data={suggestions.slice(0, 5)}
                          keyExtractor={(item) => item._id}
                          renderItem={({ item }) => <UserRow user={item} />}
                          showsVerticalScrollIndicator={false}
                          ItemSeparatorComponent={() => <View style={styles.separator} />}
                          scrollEnabled={false}
                        />
                        
                        {suggestions.length > 5 && (
                          <TouchableOpacity
                            style={styles.seeAllButton}
                            onPress={() => setShowSuggestions(true)}
                          >
                            <Text style={styles.seeAllText}>See All {suggestions.length} Suggestions</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      // Fallback if no suggestions available
                      <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={64} color="#C7C7CC" />
                        <Text style={styles.emptyTitle}>Find Friends</Text>
                        <Text style={styles.emptySubtext}>
                          Search for people by username, name, or email
                        </Text>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => {
                            console.log('🔄 Manually loading friend suggestions...');
                            fetchFriendSuggestions();
                          }}
                        >
                          <Ionicons name="people" size={20} color="#3797EF" style={styles.buttonIcon} />
                          <Text style={styles.secondaryButtonText}>Find People You May Know</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  ) : (
                    // Events tab - show categories when empty, search results when typing
                    shouldShowCategories() ? (
                      <CategoryManager
                        navigation={navigation}
                        currentUserId={currentUser?._id}
                        refreshTrigger={categoryRefreshTrigger}
                        maxCategories={showAllCategories ? undefined : categoryLimit}
                        onRefresh={handleCategoryRefresh}
                        style={styles.categoryContainer}
                        showToggle={true}
                        onToggleShowAll={toggleShowAllCategories}
                        showAllState={showAllCategories}
                      />
                    ) : (
                      <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
                        <Text style={styles.emptyTitle}>Search Events</Text>
                        <Text style={styles.emptySubtext}>
                          Discover events by title or location
                        </Text>
                      </View>
                    )
                  )}
                </View>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  
  // Search Input Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  
  // Tab Styles
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#F8F9FA',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '600',
  },

  // Filter Styles
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  activeFilter: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  
  // Results List Styles
  resultsList: {
    paddingBottom: 20,
  },
  
  // Universal User Row Styles
  userRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25, // Perfect circle
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  handle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  connectionReason: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Event Row Styles
  eventRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventImageContainer: {
    marginRight: 12,
  },
  eventImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  eventImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  eventHost: {
    fontSize: 12,
    color: '#8E8E93',
  },
  
  // Section Styles
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  
  // Separator
  separator: {
    height: 0.5,
    backgroundColor: '#F0F0F0',
    marginLeft: 78, // Align with content after avatar
  },
  
  // Button Styles
  seeAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3797EF',
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
  },
  buttonIcon: {
    marginRight: 8,
  },
  
  // Container Styles
  suggestionsContainer: {
    flex: 1,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  hideSuggestions: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
  },
  welcomeContainer: {
    flex: 1,
  },
  
  // State Styles
  loadingContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  categoryContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});