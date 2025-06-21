// components/UserSelector.js - Reusable user selection component
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const defaultPfp = require('../assets/default-pfp.png');

export default function UserSelector({
  selectedUsers = [],
  onSelectionChange,
  maxSelection = 15,
  placeholder = "Search for people...",
  showSelected = true,
  excludeCurrentUser = true,
}) {
  const { currentUser } = useContext(AuthContext);
  
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [followedUsers, setFollowedUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchFollowedUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const delayedSearch = setTimeout(() => {
        fetchUsers();
      }, 300);
      return () => clearTimeout(delayedSearch);
    } else if (searchQuery.length === 0) {
      fetchUsers();
    }
  }, [searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/search', {
        params: { 
          q: searchQuery, 
          limit: 50 
        }
      });
      
      let filtered = response.data.users || [];
      
      // Filter out current user if specified
      if (excludeCurrentUser) {
        filtered = filtered.filter(user => user._id !== currentUser._id);
      }
      
      // Prioritize followed users
      const followedIds = followedUsers.map(u => u._id);
      const prioritized = [
        ...filtered.filter(user => followedIds.includes(user._id)),
        ...filtered.filter(user => !followedIds.includes(user._id))
      ];
      
      setUsers(prioritized);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowedUsers = async () => {
    try {
      const response = await api.get(`/api/users/${currentUser._id}/following`);
      setFollowedUsers(response.data.following || []);
    } catch (error) {
      console.error('Error fetching followed users:', error);
    }
  };

  const toggleUserSelection = (user) => {
    const isSelected = selectedUsers.some(u => u._id === user._id);
    
    if (isSelected) {
      const updated = selectedUsers.filter(u => u._id !== user._id);
      onSelectionChange(updated);
    } else {
      if (selectedUsers.length >= maxSelection) {
        return; // Silently ignore if max reached
      }
      const updated = [...selectedUsers, user];
      onSelectionChange(updated);
    }
  };

  const removeSelectedUser = (user) => {
    const updated = selectedUsers.filter(u => u._id !== user._id);
    onSelectionChange(updated);
  };

  const renderSelectedUser = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
      : Image.resolveAssetSource(defaultPfp).uri;

    return (
      <TouchableOpacity
        style={styles.selectedUser}
        onPress={() => removeSelectedUser(item)}
      >
        <Image source={{ uri: avatar }} style={styles.selectedUserAvatar} />
        <View style={styles.removeIcon}>
          <Ionicons name="close" size={12} color="#FFFFFF" />
        </View>
        <Text style={styles.selectedUserName} numberOfLines={1}>
          {item.username}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderUser = ({ item }) => {
    const isSelected = selectedUsers.some(u => u._id === item._id);
    const isFollowed = followedUsers.some(u => u._id === item._id);
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
      : Image.resolveAssetSource(defaultPfp).uri;

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => toggleUserSelection(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          <Image source={{ uri: avatar }} style={styles.userAvatar} />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.fullName}>{item.fullName || item.email}</Text>
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

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
        />
        {loading && <ActivityIndicator size="small" color="#3797EF" />}
      </View>

      {/* Selected Users */}
      {showSelected && selectedUsers.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedTitle}>
            Selected ({selectedUsers.length}/{maxSelection})
          </Text>
          <FlatList
            data={selectedUsers}
            horizontal
            keyExtractor={(item) => item._id}
            renderItem={renderSelectedUser}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedList}
          />
        </View>
      )}

      {/* User List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderUser}
        refreshing={loading}
        onRefresh={fetchUsers}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>
              {searchQuery.length > 0 ? 'No users found' : 'Search for people'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.length > 0 
                ? 'Try a different search term' 
                : 'Type to search for friends'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={users.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  selectedSection: {
    marginBottom: 16,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  selectedList: {
    paddingHorizontal: 4,
  },
  selectedUser: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 64,
  },
  selectedUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  removeIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedUserName: {
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
    textAlign: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
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
    borderColor: '#E5E5E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
});