// SocialApp/screens/InviteUsersScreen.js - Updated to use friends-only search

import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, SafeAreaView, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

export default function InviteUsersScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  
  const { eventId, eventTitle, eventPrivacyLevel } = route.params;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Set up navigation header with invite button
  useEffect(() => {
    navigation.setOptions({
      title: `Invite to ${eventTitle}`,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSendInvites}
          style={[styles.headerButton, (selectedUsers.length === 0 || inviting) && styles.headerButtonDisabled]}
          activeOpacity={0.7}
          disabled={selectedUsers.length === 0 || inviting}
        >
          {inviting ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.headerButtonText, (selectedUsers.length === 0 || inviting) && styles.headerButtonTextDisabled]}>
              Invite ({selectedUsers.length})
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [selectedUsers, inviting]);

  // Search for friends with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchFriends(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // ✅ PHASE 2: Updated to use friends-only search
  const searchFriends = async (query) => {
    try {
      setSearching(true);
      console.log(`🔍 PHASE 2: Searching friends for query: "${query}"`);
      
      // Use the new friends-only search endpoint
      const response = await api.get(`/api/users/friends/search`, {
        params: { 
          q: query, 
          eventId: eventId,
          limit: 20 
        }
      });
      
      console.log(`✅ PHASE 2: Found ${response.data.length} friends`);
      setSearchResults(response.data);
      
    } catch (error) {
      console.error('Error searching friends:', error);
      
      // Show appropriate error message based on privacy level
      if (error.response?.status === 404) {
        Alert.alert('No Friends Found', 'No friends match your search query.');
      } else {
        Alert.alert('Error', 'Failed to search friends. Please try again.');
      }
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  // Send invites to selected users
  const handleSendInvites = async () => {
    if (selectedUsers.length === 0 || inviting) return;

    try {
      setInviting(true);

      const userIds = selectedUsers.map(user => user._id);
      
      const response = await api.post(`/api/events/${eventId}/invite`, {
        userIds: userIds
      });

      // Show success message with privacy context
      const privacyMessage = eventPrivacyLevel === 'friends' 
        ? 'Your friends will be notified of the invitation.'
        : eventPrivacyLevel === 'private'
        ? 'Invited users will receive private invitations.'
        : 'Invited users will be notified and can join the event.';

      Alert.alert(
        'Invites Sent!',
        `Successfully sent ${selectedUsers.length} invite${selectedUsers.length > 1 ? 's' : ''} to ${eventTitle}.\n\n${privacyMessage}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error) {
      console.error('Error sending invites:', error);
      
      // Handle specific error cases
      if (error.response?.status === 400 && error.response?.data?.message?.includes('friends')) {
        Alert.alert(
          'Friends Only Event',
          'You can only invite friends to this event. Some selected users are not in your friends list.'
        );
      } else if (error.response?.status === 403) {
        Alert.alert(
          'Permission Denied',
          error.response?.data?.message || 'You do not have permission to invite users to this event.'
        );
      } else {
        Alert.alert(
          'Error',
          error.response?.data?.message || 'Failed to send invites. Please try again.'
        );
      }
    } finally {
      setInviting(false);
    }
  };

  // Get profile picture URL
  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return null;
    
    if (profilePicture.startsWith('http')) {
      return profilePicture;
    }
    
    const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.some(u => u._id === item._id);
    
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatar}>
          {item.profilePicture ? (
            <Image
              source={{ uri: getProfilePictureUrl(item.profilePicture) }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(item.displayName || item.username || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.username}>
            {item.displayName || item.username}
          </Text>
          {item.displayName && (
            <Text style={styles.handle}>@{item.username}</Text>
          )}
        </View>
        
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#3797EF" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search your friends...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8E8E93"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching && (
            <ActivityIndicator size="small" color="#3797EF" style={styles.searchLoader} />
          )}
        </View>
        
        {/* Privacy Info */}
        <View style={styles.privacyInfo}>
          <Ionicons 
            name={eventPrivacyLevel === 'private' ? 'lock-closed' : eventPrivacyLevel === 'friends' ? 'people' : 'globe'} 
            size={16} 
            color="#8E8E93" 
          />
          <Text style={styles.privacyText}>
            {eventPrivacyLevel === 'friends' 
              ? 'You can only invite friends to this event'
              : eventPrivacyLevel === 'private'
              ? 'Private event - host controls invitations'
              : 'You can invite any of your friends'
            }
          </Text>
        </View>
      </View>

      {/* Results */}
      <View style={styles.resultsContainer}>
        {searchQuery.trim() === '' ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>Search for Friends</Text>
            <Text style={styles.emptyStateMessage}>
              Type a name to find friends you can invite to this event
            </Text>
          </View>
        ) : searchResults.length === 0 && !searching ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>No Friends Found</Text>
            <Text style={styles.emptyStateMessage}>
              No friends match your search query
            </Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            renderItem={renderUserItem}
            showsVerticalScrollIndicator={false}
            style={styles.resultsList}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },
  headerButtonTextDisabled: {
    color: '#C7C7CC',
  },

  // Search
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#1C1C1E',
  },
  searchLoader: {
    marginLeft: 8,
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privacyText: {
    fontSize: 13,
    color: '#8E8E93',
  },

  // Results
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    flex: 1,
  },
  
  // User Item
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  userItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  userAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E1E8ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  handle: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});