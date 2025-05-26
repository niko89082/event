import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Image, SafeAreaView, StatusBar, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const defaultPfp = 'https://placehold.co/48x48.png?text=%F0%9F%91%A4';

export default function NewChatScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

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
      headerTitle: 'New Message',
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
          onPress={handleNext}
          style={styles.headerButton}
          activeOpacity={0.7}
          disabled={selectedUsers.length === 0}
        >
          <Text style={[
            styles.nextButtonText, 
            selectedUsers.length === 0 && styles.nextButtonDisabled
          ]}>
            Next
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, selectedUsers]);

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
      // Assuming you have an endpoint to get followed users
      const { data } = await api.get('/users/following');
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
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
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

  const handleNext = async () => {
    if (selectedUsers.length === 0) return;

    try {
      if (selectedUsers.length === 1) {
        // Direct message
        const recipient = selectedUsers[0];
        navigation.navigate('ChatScreen', {
          recipientId: recipient._id,
          headerUser: recipient
        });
      } else {
        // Group chat - you'll need to implement group creation
        Alert.alert('Group Chat', 'Group chat creation not implemented yet');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to create chat');
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
        <Text style={styles.toLabel}>To:</Text>
        
        {selectedUsers.length > 0 && (
          <FlatList
            data={selectedUsers}
            renderItem={renderSelectedUser}
            keyExtractor={item => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedUsersList}
            contentContainerStyle={styles.selectedUsersContent}
          />
        )}
        
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.separator} />

      {!searchQuery.trim() && followedUsers.length > 0 && (
        <Text style={styles.sectionTitle}>Suggested</Text>
      )}

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
                <Text style={styles.emptyTitle}>No users found</Text>
                <Text style={styles.emptySubtitle}>
                  Try searching for a different username
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>No suggestions</Text>
                <Text style={styles.emptySubtitle}>
                  Follow some users to see suggestions here
                </Text>
              </>
            )}
          </View>
        )}
      />
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
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  nextButtonDisabled: {
    color: '#8E8E93',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  selectedUsersList: {
    flexGrow: 0,
    marginRight: 8,
  },
  selectedUsersContent: {
    alignItems: 'center',
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginVertical: 2,
  },
  selectedAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 4,
  },
  selectedUsername: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginRight: 4,
  },
  removeIcon: {
    marginLeft: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8,
    minWidth: 120,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F6F6F6',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
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
    color: '#007AFF',
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});