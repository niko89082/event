// Enhanced SearchScreen.js - Improved with comprehensive search and friend request functionality
import React, { useState, useEffect, useContext } from 'react';
import {
  View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Image, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';

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
  
  // Auth context
  const { currentUser } = useContext(AuthContext);

  // Handle navigation params for friend suggestions
  useEffect(() => {
    if (route.params?.showSuggestions) {
      setShowSuggestions(true);
      fetchFriendSuggestions();
    }
  }, [route.params?.showSuggestions]);

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

  // ENHANCED: Send friend request with better UX
  const sendFriendRequest = async (userId, username) => {
    try {
      console.log(`📤 ENHANCED: Sending friend request to user: ${userId}`);
      
      // Show confirmation alert with user's name
      Alert.alert(
        'Send Friend Request',
        `Send a friend request to ${username}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Request',
            onPress: async () => {
              try {
                // Use existing friends endpoint instead of duplicate
                await api.post(`/api/friends/request/${userId}`);
                
                // Update local state immediately for better UX
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
                
                Alert.alert('Success', `Friend request sent to ${username}!`);
                console.log('✅ ENHANCED: Friend request sent successfully');
              } catch (error) {
                console.error('❌ ENHANCED: Error sending friend request:', error);
                
                let errorMessage = 'Could not send friend request. Please try again.';
                if (error.response?.status === 400) {
                  errorMessage = error.response.data.error || errorMessage;
                } else if (error.response?.status === 409) {
                  errorMessage = 'Friend request already exists or you are already friends.';
                }
                
                Alert.alert('Error', errorMessage);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ ENHANCED: Error in sendFriendRequest:', error);
    }
  };

  // ENHANCED: Get mutual friends for a user
  const getMutualFriendsText = (user) => {
    if (user.mutualFriendsCount > 0) {
      return `${user.mutualFriendsCount} mutual friend${user.mutualFriendsCount > 1 ? 's' : ''}`;
    }
    return null;
  };

  // ENHANCED: Render user item with comprehensive relationship info
  const renderEnhancedUserItem = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}${item.profilePicture}`
      : `https://placehold.co/50x50/C7C7CC/FFFFFF?text=${item.username?.charAt(0).toUpperCase() || '?'}`;

    const relationshipStatus = item.relationshipStatus || friendStatuses[item._id] || 'unknown';
    const mutualFriendsText = getMutualFriendsText(item);
    
    const getStatusInfo = (status) => {
      switch (status) {
        case 'friends':
          return { color: '#34C759', icon: 'checkmark-circle', text: 'Friends' };
        case 'request-sent':
          return { color: '#FF9500', icon: 'time', text: 'Request Sent' };
        case 'request-received':
          return { color: '#007AFF', icon: 'person-add', text: 'Respond to Request' };
        case 'not-friends':
          return { color: '#8E8E93', icon: 'person-add-outline', text: 'Add Friend' };
        default:
          return { color: '#8E8E93', icon: 'person', text: '' };
      }
    };

    const statusInfo = getStatusInfo(relationshipStatus);
    const canSendRequest = item.canAddFriend !== false && relationshipStatus === 'not-friends';

    return (
      <TouchableOpacity
        style={styles.enhancedUserItem}
        onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
        activeOpacity={0.95}
      >
        <View style={styles.userContent}>
          <Image source={{ uri: avatar }} style={styles.userAvatar} />
          
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.username} numberOfLines={1}>
                {item.username}
              </Text>
              <Ionicons 
                name={statusInfo.icon} 
                size={16} 
                color={statusInfo.color}
                style={styles.statusIcon}
              />
            </View>
            
            {item.displayName && (
              <Text style={styles.displayName} numberOfLines={1}>
                {item.displayName}
              </Text>
            )}
            
            {item.priorityReason && (
              <Text style={styles.priorityReason} numberOfLines={1}>
                {item.priorityReason}
              </Text>
            )}
            
            {mutualFriendsText && (
              <Text style={styles.mutualFriendsText}>
                {mutualFriendsText}
              </Text>
            )}
          </View>

          {/* Action button */}
          {canSendRequest && (
            <TouchableOpacity
              style={styles.addFriendButton}
              onPress={(e) => {
                e.stopPropagation();
                sendFriendRequest(item._id, item.username);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="person-add" size={18} color="#007AFF" />
              <Text style={styles.addFriendText}>Add</Text>
            </TouchableOpacity>
          )}
          
          {relationshipStatus === 'request-received' && (
            <TouchableOpacity
              style={styles.respondButton}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('FriendsListScreen', { 
                  userId: currentUser._id, 
                  mode: 'requests' 
                });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="person-add" size={18} color="#34C759" />
              <Text style={styles.respondText}>Respond</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render suggestion item (simplified to show either friends OR events)
  const renderSuggestionItem = ({ item }) => {
    // Helper function to format mutual connections display
    const getMutualConnectionsDisplay = () => {
      const mutualFriendsCount = item.mutualFriends || item.mutualFriendsCount || 0;
      const mutualEventsCount = item.mutualEvents || item.mutualEventsCount || item.eventCoAttendance || 0;
      
      // Prioritize showing mutual friends if they exist, otherwise show events
      if (mutualFriendsCount > 0) {
        // Show friend names if available, otherwise just count
        if (item.mutualFriendsDetails && item.mutualFriendsDetails.length > 0) {
          const friendNames = item.mutualFriendsDetails.slice(0, 3).map(f => f.displayName || f.username);
          const remaining = mutualFriendsCount - friendNames.length;
          
          if (friendNames.length === 1) {
            return `Friends with ${friendNames[0]}`;
          } else if (friendNames.length === 2) {
            return remaining > 0 
              ? `Friends with ${friendNames[0]}, ${friendNames[1]} and ${remaining} more`
              : `Friends with ${friendNames[0]} and ${friendNames[1]}`;
          } else if (friendNames.length === 3) {
            return remaining > 0
              ? `Friends with ${friendNames[0]}, ${friendNames[1]}, ${friendNames[2]} and ${remaining} more`
              : `Friends with ${friendNames[0]}, ${friendNames[1]} and ${friendNames[2]}`;
          }
        }
        
        // Fallback to count only
        return `${mutualFriendsCount} mutual friend${mutualFriendsCount > 1 ? 's' : ''}`;
      }
      
      // Show events if no mutual friends
      if (mutualEventsCount > 0) {
        return `${mutualEventsCount} event${mutualEventsCount > 1 ? 's' : ''} attended together`;
      }
      
      // Fallback
      return item.reason || 'Suggested for you';
    };

    const connectionDisplay = getMutualConnectionsDisplay();
    const hasStrongConnection = (item.mutualFriends || item.mutualFriendsCount || 0) > 0 || 
                               (item.mutualEvents || item.mutualEventsCount || item.eventCoAttendance || 0) > 0;

    return (
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
        activeOpacity={0.95}
      >
        <View style={styles.suggestionContent}>
          <View style={styles.suggestionLeft}>
            <Image
              source={{
                uri: item.profilePicture
                  ? `http://${API_BASE_URL}${item.profilePicture}`
                  : `https://placehold.co/50x50/C7C7CC/FFFFFF?text=${item.username?.charAt(0).toUpperCase() || '?'}`
              }}
              style={styles.suggestionAvatar}
            />
            <View style={styles.suggestionInfo}>
              <Text style={styles.suggestionUsername}>{item.username}</Text>
              {item.displayName && (
                <Text style={styles.suggestionDisplayName}>{item.displayName}</Text>
              )}
              
              {/* Single line showing either mutual friends OR mutual events */}
              <Text style={[
                styles.connectionReason, 
                hasStrongConnection && styles.strongConnectionReason
              ]} numberOfLines={2}>
                {connectionDisplay}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.addFriendButton}
            onPress={(e) => {
              e.stopPropagation();
              sendFriendRequest(item._id, item.username);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Render search result item (updated to use enhanced user item)
  const renderSearchResult = ({ item }) => {
    if (tab === 'users') {
      return renderEnhancedUserItem({ item });
    } else {
      // Event rendering (existing logic)
      return (
        <TouchableOpacity 
          style={styles.item}
          onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
          activeOpacity={0.95}
        >
          <View style={styles.eventItem}>
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
            <View style={styles.suggestionsLoading}>
              <ActivityIndicator size="large" color="#3797EF" />
              <Text style={styles.loadingText}>Finding people you may know...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item._id}
              renderItem={renderSuggestionItem}
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
            <View style={styles.emptySuggestions}>
              <Ionicons name="people-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Suggestions Available</Text>
              <Text style={styles.emptySubtext}>
                Add more friends or attend events to get personalized suggestions
              </Text>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowSuggestions(false)}
              >
                <Text style={styles.searchButtonText}>Search for People</Text>
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
                setResults([]);
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
                setResults([]);
              }}
            >
              <Text style={[styles.tabText, tab === 'events' && styles.activeTabText]}>
                Events
              </Text>
            </TouchableOpacity>
          </View>

          {/* ENHANCED: Search Filter (for users only) */}
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
                  <View style={styles.loadingState}>
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
                        style={styles.expandSearchButton}
                        onPress={() => setSearchType('all')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.expandSearchText}>Search All People</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
              
              return (
                <View style={styles.welcomeState}>
                  {/* Show friend suggestions immediately if available */}
                  {tab === 'users' && suggestions.length > 0 ? (
                    <View style={styles.suggestionsSection}>
                      <View style={styles.suggestionsHeader}>
                        <Text style={styles.suggestionsTitle}>People You May Know</Text>
                        <TouchableOpacity onPress={() => setSuggestions([])}>
                          <Text style={styles.clearSuggestions}>Clear</Text>
                        </TouchableOpacity>
                      </View>
                      
                      <FlatList
                        data={suggestions.slice(0, 5)} // Show first 5 suggestions
                        keyExtractor={(item) => item._id}
                        renderItem={renderSuggestionItem}
                        showsVerticalScrollIndicator={false}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        style={styles.suggestionsList}
                      />
                      
                      {suggestions.length > 5 && (
                        <TouchableOpacity
                          style={styles.seeAllButton}
                          onPress={() => {
                            setShowSuggestions(true);
                          }}
                        >
                          <Text style={styles.seeAllText}>See All {suggestions.length} Suggestions</Text>
                        </TouchableOpacity>
                      )}
                      
                      <View style={styles.searchPrompt}>
                        <Ionicons name="search-outline" size={32} color="#C7C7CC" />
                        <Text style={styles.searchPromptTitle}>Search for People</Text>
                        <Text style={styles.searchPromptSubtext}>
                          Type a name or username to find friends
                        </Text>
                      </View>
                    </View>
                  ) : tab === 'users' && loadingSuggestions ? (
                    // Loading state for suggestions
                    <View style={styles.loadingSuggestions}>
                      <ActivityIndicator size="large" color="#3797EF" />
                      <Text style={styles.loadingText}>Finding people you may know...</Text>
                    </View>
                  ) : (
                    // Fallback welcome state (no suggestions available)
                    <>
                      <Ionicons name="search-outline" size={64} color="#C7C7CC" />
                      <Text style={styles.welcomeTitle}>
                        Search for {tab}
                      </Text>
                      <Text style={styles.welcomeSubtext}>
                        {tab === 'users' 
                          ? 'Find friends by username, name, or email' 
                          : 'Discover events by title or location'
                        }
                      </Text>
                      {tab === 'users' && (
                        <TouchableOpacity
                          style={styles.suggestionsButton}
                          onPress={() => {
                            console.log('🔄 Manually loading friend suggestions...');
                            fetchFriendSuggestions();
                          }}
                        >
                          <Ionicons name="people" size={20} color="#3797EF" />
                          <Text style={styles.suggestionsButtonText}>Find People You May Know</Text>
                        </TouchableOpacity>
                      )}
                    </>
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

  // ENHANCED: Filter Styles
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
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  item: { 
    paddingVertical: 12,
    borderBottomWidth: 0.5, 
    borderBottomColor: '#F0F0F0',
  },
  
  // ENHANCED: User Item Styles
  enhancedUserItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  statusIcon: {
    marginLeft: 8,
  },
  displayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  priorityReason: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 2,
  },
  mutualFriendsText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 4,
  },
  addFriendText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#34C759',
    gap: 4,
  },
  respondText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  
  // Event Item Styles (unchanged)
  eventItem: {
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
  
  // Suggestions Styles (enhanced for inline display)
  suggestionsSection: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  clearSuggestions: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  suggestionsList: {
    width: '100%',
    maxHeight: 300, // Limit height for inline display
  },
  seeAllButton: {
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3797EF',
    marginVertical: 15,
  },
  seeAllText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
  },
  searchPrompt: {
    alignItems: 'center',
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    width: '100%',
  },
  searchPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: 10,
    marginBottom: 5,
  },
  searchPromptSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  // Suggestions Styles (unchanged but enhanced)
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
    color: '#1D1D1F',
  },
  hideSuggestions: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
  },
  suggestionItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  suggestionAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 2,
  },
  suggestionDisplayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  suggestionReason: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  
  // Simplified connection reason styling
  connectionReason: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 16,
  },
  strongConnectionReason: {
    color: '#3797EF',
    fontWeight: '500',
  },
  separator: {
    height: 0.5,
    backgroundColor: '#F0F0F0',
    marginLeft: 78,
  },
  
  // State Styles
  loadingState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  suggestionsLoading: {
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
  emptySuggestions: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  expandSearchButton: {
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginTop: 12,
  },
  expandSearchText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  welcomeState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  suggestionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3797EF',
  },
  suggestionsButtonText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  searchButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});