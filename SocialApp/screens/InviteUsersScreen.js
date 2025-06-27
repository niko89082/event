// screens/InviteUsersScreen.js - Simplified invite users to events
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
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
  const { eventId, eventTitle } = route.params;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'Invite Friends',
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
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSendInvites}
          style={[styles.headerButton, (selectedUsers.length === 0 || inviting) && styles.headerButtonDisabled]}
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

  // Search for users with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchUsers = async (query) => {
    try {
      setSearching(true);
      const response = await api.get(`/api/users/search`, {
        params: { q: query, limit: 20 }
      });
      
      // Filter out current user
      const results = response.data.filter(user => 
        user._id !== currentUser._id
      );
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
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

      Alert.alert(
        'Invites Sent!',
        `Successfully sent ${selectedUsers.length} invite${selectedUsers.length > 1 ? 's' : ''} to ${eventTitle}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error) {
      console.error('Error sending invites:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to send invites. Please try again.'
      );
    } finally {
      setInviting(false);
    }
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
              source={{ uri: `${API_BASE_URL}${item.profilePicture}` }} 
              style={styles.userAvatarImage} 
            />
          ) : (
            <View style={styles.userAvatarPlaceholder}>
              <Text style={styles.userAvatarText}>
                {item.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.username}</Text>
          {item.displayName && (
            <Text style={styles.userDisplayName}>{item.displayName}</Text>
          )}
        </View>
        
        <View style={styles.selectionIndicator}>
          <Ionicons 
            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
            size={24} 
            color={isSelected ? "#34C759" : "#C7C7CC"} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectedUser = ({ item }) => (
    <View style={styles.selectedUserChip}>
      <View style={styles.selectedUserAvatar}>
        {item.profilePicture ? (
          <Image 
            source={{ uri: `${API_BASE_URL}${item.profilePicture}` }} 
            style={styles.selectedUserAvatarImage} 
          />
        ) : (
          <View style={styles.selectedUserAvatarPlaceholder}>
            <Text style={styles.selectedUserAvatarText}>
              {item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.selectedUserName}>{item.username}</Text>
      <TouchableOpacity
        onPress={() => toggleUserSelection(item)}
        style={styles.removeSelectedUser}
      >
        <Ionicons name="close" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for friends to invite..."
            placeholderTextColor="#C7C7CC"
            autoFocus
          />
          {searching && (
            <ActivityIndicator size="small" color="#8E8E93" />
          )}
        </View>
      </View>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <View style={styles.selectedUsersSection}>
          <Text style={styles.selectedUsersTitle}>
            Selected ({selectedUsers.length})
          </Text>
          <FlatList
            data={selectedUsers}
            keyExtractor={(item) => item._id}
            renderItem={renderSelectedUser}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedUsersList}
          />
        </View>
      )}

      {/* Search Results */}
      <View style={styles.resultsSection}>
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id}
          renderItem={renderUserItem}
          ListEmptyComponent={() => (
            <View style={styles.emptyResults}>
              {searchQuery ? (
                <Text style={styles.emptyResultsText}>
                  {searching ? 'Searching...' : 'No users found'}
                </Text>
              ) : (
                <View style={styles.emptyResultsContent}>
                  <Ionicons name="people-outline" size={48} color="#C7C7CC" />
                  <Text style={styles.emptyResultsTitle}>Invite Friends</Text>
                  <Text style={styles.emptyResultsText}>
                    Search for friends to invite to your event
                  </Text>
                  <Text style={styles.emptyResultsSubtext}>
                    You can also share the event using the share button in the event details
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  headerButtonTextDisabled: {
    color: '#C7C7CC',
  },

  // Search Section
  searchSection: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8,
  },

  // Selected Users
  selectedUsersSection: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  selectedUsersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  selectedUsersList: {
    flexGrow: 0,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  selectedUserAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  selectedUserAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  selectedUserAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedUserAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3797EF',
  },
  selectedUserName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 6,
  },
  removeSelectedUser: {
    padding: 2,
  },

  // Results Section
  resultsSection: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  userItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  userDisplayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  selectionIndicator: {
    padding: 4,
  },

  // Empty Results
  emptyResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyResultsContent: {
    alignItems: 'center',
  },
  emptyResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    lineHeight: 20,
  },
});