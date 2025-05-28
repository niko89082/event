// screens/InviteUsersScreen.js - Invite users to events
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Image, SafeAreaView, StatusBar, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const defaultPfp = 'https://placehold.co/48x48.png?text=%F0%9F%91%A4';

export default function InviteUsersScreen({ route, navigation }) {
  const { eventId } = route.params || {};
  const { currentUser } = useContext(AuthContext);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

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
      headerTitle: 'Invite to Event',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleInvite}
          style={styles.headerButton}
          activeOpacity={0.7}
          disabled={selectedUsers.length === 0 || inviting}
        >
          {inviting ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[
              styles.inviteButtonText, 
              selectedUsers.length === 0 && styles.inviteButtonDisabled
            ]}>
              Invite ({selectedUsers.length})
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, selectedUsers, inviting]);

  // Load followed users on mount
  useEffect(() => {
    loadFollowedUsers();
  }, []);

  // Search users when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const loadFollowedUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/users/following');
      setFollowedUsers(data.filter(user => user._id !== currentUser._id));
    } catch (error) {
      console.error('Error loading followed users:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const { data } = await api.get(`/api/search/users?q=${encodeURIComponent(searchQuery.trim())}`);
      // Filter out current user and prioritize followed users
      const filtered = data.filter(user => user._id !== currentUser._id);
      const followedIds = followedUsers.map(u => u._id);
      
      const prioritized = [
        ...filtered.filter(user => followedIds.includes(user._id)),
        ...filtered.filter(user => !followedIds.includes(user._id))
      ];
      
      setUsers(prioritized);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleInvite = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setInviting(true);
      
      const userIds = selectedUsers.map(u => u._id);
      await api.post(`/api/events/${eventId}/invite`, {
        userIds,
        message: `You've been invited to an event!`
      });

      Alert.alert(
        'Success!', 
        `Invited ${selectedUsers.length} ${selectedUsers.length === 1 ? 'person' : 'people'} to the event.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error inviting users:', error);
      Alert.alert('Error', 'Failed to send invitations. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const renderUser = ({ item }) => {
    const isSelected = selectedUsers.some(u => u._id === item._id);
    const isFollowed = followedUsers.some(u => u._id === item._id);
    
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
      : defaultPfp;

    return (
      <TouchableOpacity 
        style={styles.userRow}
        onPress={() => toggleUserSelection(item)}
        activeOpacity={0.95}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
            {isSelected && (
              <View style={styles.selectedOverlay}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
          
          <View style={styles.userDetails}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.fullName}>{item.displayName || item.email}</Text>
            {isFollowed && (
              <Text style={styles.followedLabel}>Following</Text>
            )}
          </View>
        </View>
        
        <View style={[styles.selectionCircle, isSelected && styles.selectedCircle]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectedUser = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
      : defaultPfp;

    return (
      <TouchableOpacity 
        style={styles.selectedUserChip}
        onPress={() => toggleUserSelection(item)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: avatar }} style={styles.selectedAvatar} />
        <Text style={styles.selectedUsername}>{item.username}</Text>
        <Ionicons name="close-circle" size={16} color="#8E8E93" style={styles.removeIcon} />
      </TouchableOpacity>
    );
  };

  const displayUsers = searchQuery.trim() ? users : followedUsers;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#8E8E93"
            autoCapitalize="none"
            autoCorrect={false}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedTitle}>Selected ({selectedUsers.length})</Text>
          <FlatList
            data={selectedUsers}
            renderItem={renderSelectedUser}
            keyExtractor={item => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedUsersList}
          />
        </View>
      )}

      <View style={styles.separator} />

      {!searchQuery.trim() && followedUsers.length > 0 && (
        <Text style={styles.sectionTitle}>People You Follow</Text>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
        </View>
      ) : (
        <FlatList
          data={displayUsers}
          renderItem={renderUser}
          keyExtractor={item => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.usersList}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              {searchQuery.trim() ? (
                <>
                  <Ionicons name="search-outline" size={64} color="#C7C7CC" />
                  <Text style={styles.emptyTitle}>No users found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try searching for a different username
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="people-outline" size={64} color="#C7C7CC" />
                  <Text style={styles.emptyTitle}>No followers</Text>
                  <Text style={styles.emptySubtitle}>
                    Follow some users to see suggestions here
                  </Text>
                </>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  inviteButtonDisabled: {
    color: '#8E8E93',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  selectedSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  selectedUsersList: {
    paddingRight: 16,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3797EF',
  },
  selectedAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  selectedUsername: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3797EF',
    marginRight: 4,
  },
  removeIcon: {
    marginLeft: 2,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#E1E1E1',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usersList: {
    paddingVertical: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(55, 151, 239, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  fullName: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followedLabel: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginTop: 2,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
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
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});