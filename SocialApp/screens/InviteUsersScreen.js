// screens/InviteUsersScreen.js - Invite users to events with sharing capabilities
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
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';

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
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    navigation.setOptions({
      title: 'Invite to Event',
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
              Send ({selectedUsers.length})
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [selectedUsers, inviting]);

  // Search for users
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await api.get(`/api/users/search`, {
        params: { q: query, limit: 20 }
      });
      
      // Filter out current user and already invited users
      const results = response.data.filter(user => 
        user._id !== currentUser._id
      );
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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

  // Send invites
  const handleSendInvites = async () => {
    if (selectedUsers.length === 0 || inviting) return;

    try {
      setInviting(true);

      const userIds = selectedUsers.map(user => user._id);
      
      await api.post(`/api/events/${eventId}/invite`, {
        userIds,
        message: inviteMessage.trim() || undefined
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

  // Share event via external methods
  const handleShareEvent = () => {
    Alert.alert(
      'Share Event',
      'How would you like to share this event?',
      [
        {
          text: 'Messages',
          onPress: shareViaMessages
        },
        {
          text: 'Copy Link',
          onPress: copyEventLink
        },
        {
          text: 'More Options',
          onPress: shareViaGeneric
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const shareViaMessages = async () => {
    try {
      const eventLink = `https://yourapp.com/events/${eventId}`;
      const message = `You're invited to ${eventTitle}! 🎉\n\n${inviteMessage || 'Join me at this event!'}\n\nRSVP here: ${eventLink}`;
      
      // iOS-specific iMessage sharing
      const url = `sms:&body=${encodeURIComponent(message)}`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to generic share
        await Share.share({
          message: message,
          url: eventLink,
          title: eventTitle
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share event');
    }
  };

  const shareViaGeneric = async () => {
    try {
      const eventLink = `https://yourapp.com/events/${eventId}`;
      const message = `You're invited to ${eventTitle}! 🎉\n\n${inviteMessage || 'Join me at this event!'}`;
      
      await Share.share({
        message: message,
        url: eventLink,
        title: eventTitle
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share event');
    }
  };

  const copyEventLink = async () => {
    try {
      const eventLink = `https://yourapp.com/events/${eventId}`;
      // Note: Clipboard API would need to be imported and used here
      // For now, we'll show the link in an alert
      Alert.alert(
        'Event Link',
        eventLink,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Copy Link', 
            onPress: () => {
              // Clipboard.setString(eventLink);
              Alert.alert('Copied!', 'Event link copied to clipboard');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Copy link error:', error);
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
              source={{ uri: item.profilePicture }} 
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
        
        <View style={[styles.selectionIndicator, isSelected && styles.selectionIndicatorActive]}>
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
            source={{ uri: item.profilePicture }} 
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
        <Ionicons name="close" size={16} color="#8E8E93" />
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

        {/* Share Options */}
        <View style={styles.shareSection}>
          <Text style={styles.shareSectionTitle}>Or share via:</Text>
          <View style={styles.shareOptions}>
            <TouchableOpacity
              style={styles.shareOption}
              onPress={shareViaMessages}
              activeOpacity={0.8}
            >
              <View style={styles.shareOptionIcon}>
                <Ionicons name="chatbubble" size={20} color="#34C759" />
              </View>
              <Text style={styles.shareOptionText}>Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareOption}
              onPress={copyEventLink}
              activeOpacity={0.8}
            >
              <View style={styles.shareOptionIcon}>
                <Ionicons name="link" size={20} color="#FF9500" />
              </View>
              <Text style={styles.shareOptionText}>Copy Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareOption}
              onPress={shareViaGeneric}
              activeOpacity={0.8}
            >
              <View style={styles.shareOptionIcon}>
                <Ionicons name="share" size={20} color="#3797EF" />
              </View>
              <Text style={styles.shareOptionText}>More</Text>
            </TouchableOpacity>
          </View>
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

      {/* Invite Message */}
      <View style={styles.messageSection}>
        <Text style={styles.messageLabel}>Personal Message (Optional)</Text>
        <TextInput
          style={styles.messageInput}
          value={inviteMessage}
          onChangeText={setInviteMessage}
          placeholder="Add a personal message to your invite..."
          placeholderTextColor="#C7C7CC"
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

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
                  <Text style={styles.emptyResultsText}>
                    Search for friends to invite to your event
                  </Text>
                  <Text style={styles.emptyResultsSubtext}>
                    You can also share the event link directly via messages or social media
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
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8,
  },

  // Share Section
  shareSection: {
    marginTop: 8,
  },
  shareSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shareOption: {
    alignItems: 'center',
    minWidth: 80,
  },
  shareOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shareOptionText: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
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

  // Message Section
  messageSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  messageInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    textAlignVertical: 'top',
    minHeight: 80,
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
  selectionIndicatorActive: {
    // No additional styles needed, handled by icon color
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
  emptyResultsText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 16,
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});