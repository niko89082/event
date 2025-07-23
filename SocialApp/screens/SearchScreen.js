// screens/SearchScreen.js - Complete implementation with Phase 2 friend suggestions
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

  // Fetch friend suggestions using Phase 2 API
  const fetchFriendSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      console.log('🎯 Fetching friend suggestions...');
      
      const { data } = await api.get('/api/friends/suggestions?limit=15'); // Hard limit at 15
      
      if (data.success) {
        setSuggestions(data.suggestions || []);
        console.log(`📱 Loaded ${data.suggestions?.length || 0} friend suggestions`);
        console.log('🔍 Algorithm version:', data.metadata?.algorithmVersion);
      } else {
        console.warn('⚠️ Friend suggestions API returned unsuccessful response');
        setSuggestions([]);
      }
    } catch (error) {
      console.error('❌ Error fetching friend suggestions:', error);
      Alert.alert('Error', 'Could not load friend suggestions. Please try again.');
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Enhanced search with friend prioritization
  const runSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      console.log(`🔍 Searching for ${tab}: "${query}"`);
      
      if (tab === 'users') {
        // Search users with friend prioritization
        const response = await api.get(`/api/search/users?q=${encodeURIComponent(query)}`);
        let searchResults = response.data || [];
        
        // ENHANCEMENT: Prioritize friends and mutual friends in search results
        if (searchResults.length > 0) {
          const prioritizedResults = await prioritizeSearchResults(searchResults);
          setResults(prioritizedResults);
        } else {
          setResults([]);
        }
      } else {
        // Search events
        const response = await api.get(`/api/search/events?q=${encodeURIComponent(query)}`);
        setResults(response.data || []);
      }
      
      console.log(`✅ Found ${results.length} ${tab} results`);
    } catch (error) {
      console.error('❌ Search error:', error);
      setResults([]);
      Alert.alert('Search Error', 'Could not complete search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Prioritize search results based on friendship status
  const prioritizeSearchResults = async (searchResults) => {
    try {
      // Get current user's friends for prioritization
      const { data: friendsData } = await api.get('/api/friends/list?limit=1000');
      const friendIds = (friendsData.friends || []).map(f => f._id);
      
      // Categorize results
      const friends = [];
      const mutualFriendUsers = [];
      const otherUsers = [];
      
      for (const user of searchResults) {
        if (friendIds.includes(user._id)) {
          friends.push({ ...user, priorityReason: 'Your friend' });
        } else {
          // Check for mutual friends
          try {
            const { data: mutualData } = await api.get(`/api/friends/mutual/${user._id}`);
            if (mutualData.count > 0) {
              mutualFriendUsers.push({ 
                ...user, 
                priorityReason: `${mutualData.count} mutual friend${mutualData.count > 1 ? 's' : ''}`,
                mutualFriendsCount: mutualData.count
              });
            } else {
              otherUsers.push(user);
            }
          } catch (mutualError) {
            // If mutual friends check fails, just add to other users
            otherUsers.push(user);
          }
        }
      }
      
      // Sort mutual friend users by count (highest first)
      mutualFriendUsers.sort((a, b) => (b.mutualFriendsCount || 0) - (a.mutualFriendsCount || 0));
      
      // Return prioritized results: friends first, then mutual friends, then others
      return [...friends, ...mutualFriendUsers, ...otherUsers];
    } catch (error) {
      console.error('❌ Error prioritizing search results:', error);
      return searchResults; // Return original results if prioritization fails
    }
  };

  // Send friend request
  const sendFriendRequest = async (userId) => {
    try {
      console.log(`📤 Sending friend request to user: ${userId}`);
      
      await api.post(`/api/friends/request/${userId}`);
      
      // Remove from suggestions list
      setSuggestions(prev => prev.filter(user => user._id !== userId));
      
      Alert.alert('Success', 'Friend request sent!');
      console.log('✅ Friend request sent successfully');
    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      if (error.response?.status === 400) {
        Alert.alert('Info', error.response.data.message || 'Could not send friend request');
      } else {
        Alert.alert('Error', 'Could not send friend request. Please try again.');
      }
    }
  };

  // Render suggestion item
  const renderSuggestionItem = ({ item }) => (
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
            <Text style={styles.suggestionReason} numberOfLines={1}>
              {item.reason}
            </Text>
            {item.mutualFriends > 0 && (
              <Text style={styles.mutualFriendsCount}>
                {item.mutualFriends} mutual friend{item.mutualFriends > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.addFriendButton}
          onPress={(e) => {
            e.stopPropagation();
            sendFriendRequest(item._id);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Render search result item
  const renderSearchResult = ({ item }) => {
    if (tab === 'users') {
      return (
        <TouchableOpacity 
          style={styles.item}
          onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
          activeOpacity={0.95}
        >
          <View style={styles.userItem}>
            <Image
              source={{
                uri: item.profilePicture
                  ? `http://${API_BASE_URL}${item.profilePicture}`
                  : `https://placehold.co/40x40/C7C7CC/FFFFFF?text=${item.username?.charAt(0).toUpperCase() || '?'}`
              }}
              style={styles.userAvatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.username}>{item.username}</Text>
              {item.displayName && (
                <Text style={styles.displayName}>{item.displayName}</Text>
              )}
              {item.priorityReason && (
                <Text style={styles.priorityReason}>{item.priorityReason}</Text>
              )}
            </View>
            {item.priorityReason && (
              <View style={styles.priorityBadge}>
                <Ionicons 
                  name={item.priorityReason.includes('friend') ? 'people' : 'person'} 
                  size={16} 
                  color="#3797EF" 
                />
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    } else {
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
                onSubmitEditing={runSearch}
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
                      Try searching for something else or check your spelling
                    </Text>
                  </View>
                );
              }
              
              return (
                <View style={styles.welcomeState}>
                  <Ionicons name="search-outline" size={64} color="#C7C7CC" />
                  <Text style={styles.welcomeTitle}>
                    Search for {tab}
                  </Text>
                  <Text style={styles.welcomeSubtext}>
                    {tab === 'users' 
                      ? 'Find friends by username or name' 
                      : 'Discover events by title or location'
                    }
                  </Text>
                  {tab === 'users' && (
                    <TouchableOpacity
                      style={styles.suggestionsButton}
                      onPress={() => {
                        setShowSuggestions(true);
                        fetchFriendSuggestions();
                      }}
                    >
                      <Ionicons name="people" size={20} color="#3797EF" />
                      <Text style={styles.suggestionsButtonText}>Show Suggestions</Text>
                    </TouchableOpacity>
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
  
  // User Item Styles
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  displayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  priorityReason: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginTop: 2,
  },
  priorityBadge: {
    marginLeft: 8,
  },
  
  // Event Item Styles
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
  
  // Suggestions Styles
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
  mutualFriendsCount: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
  },
  addFriendButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
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