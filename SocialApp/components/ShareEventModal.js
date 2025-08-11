// SocialApp/components/ShareEventModal.js - Universal Event Sharing Component

import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, 
  TextInput, FlatList, Alert, Share,
  ActivityIndicator, SafeAreaView, ScrollView, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import api from '../services/api';
import { getProfilePictureUrl, getUserDisplayName, getUserInitials } from '../utils/profileUtils';
import { getShareUrl } from '../config/appConfig';

const ShareEventModal = ({ 
  visible, 
  onClose, 
  event, 
  currentUser,
  onInviteSuccess 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch permissions when modal opens
  useEffect(() => {
    if (visible && event?._id) {
      fetchEventPermissions();
    }
  }, [visible, event?._id]);

  const fetchEventPermissions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/events/${event._id}/can-invite`);
      setPermissions(response.data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      Alert.alert('Error', 'Failed to load sharing options');
    } finally {
      setLoading(false);
    }
  };

  // Search friends with debouncing
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        searchFriends(searchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchFriends = async (query) => {
    if (!permissions?.canInvite) return;
    
    try {
      setSearching(true);
      console.log(`🔍 ShareEventModal: Searching friends for query: "${query}"`);
      
      // Use the friends search endpoint from routes/users.js
      const response = await api.get(`/api/users/friends/search`, {
        params: { 
          q: query,
          eventId: event._id,
          limit: 20
        }
      });
      
      console.log(`✅ ShareEventModal: API response:`, response.data);
      
      // The endpoint returns an array directly
      const searchResults = Array.isArray(response.data) ? response.data : [];
      
      console.log(`✅ ShareEventModal: Found ${searchResults.length} friends`);
      setSearchResults(searchResults);
      
    } catch (error) {
      console.error('❌ ShareEventModal search error:', error);
      console.error('❌ Error details:', error.response?.data);
      
      if (error.response?.status === 404) {
        console.log('No friends found for search query');
        setSearchResults([]);
      } else {
        console.warn('Failed to search friends:', error.response?.data?.message || error.message);
        setSearchResults([]);
        
        // Only show alert for actual server errors
        if (error.response?.status >= 500) {
          Alert.alert('Search Error', 'Failed to search for friends. Please try again.');
        }
      }
    } finally {
      setSearching(false);
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

  const handleCopyLink = async () => {
    try {
      const shareLink = getShareUrl(event._id);
      await Clipboard.setStringAsync(shareLink);
      Alert.alert('Link Copied!', 'Event link has been copied to your clipboard');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    try {
      const shareLink = getShareUrl(event._id);
      const result = await Share.share({
        message: `Check out this event: ${event.title}`,
        url: shareLink,
        title: event.title
      });

      if (result.action === Share.sharedAction) {
        // Track sharing analytics
        await api.post(`/api/events/${event._id}/share`, {
          shareType: 'native_share',
          platform: result.activityType || 'unknown'
        });
      }
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to share event');
    }
  };

  const handleSendInvites = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('No Users Selected', 'Please select at least one person to invite');
      return;
    }

    try {
      setSending(true);
      
      const response = await api.post(`/api/events/${event._id}/invite`, {
        userIds: selectedUsers.map(u => u._id),
        message: `Check out this ${event.privacyLevel} event!`
      });

      const { invitationsSent, alreadyConnected } = response.data.data;
      
      let message = `Successfully sent ${invitationsSent} invitation${invitationsSent === 1 ? '' : 's'}!`;
      if (alreadyConnected > 0) {
        message += ` (${alreadyConnected} ${alreadyConnected === 1 ? 'person was' : 'people were'} already invited)`;
      }

      Alert.alert('Invites Sent!', message);
      
      // Reset state and close
      setSelectedUsers([]);
      setSearchQuery('');
      setSearchResults([]);
      
      // Call success callback
      if (onInviteSuccess) {
        onInviteSuccess(response.data);
      }
      
      onClose();
      
    } catch (error) {
      console.error('Invite error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send invitations';
      Alert.alert('Error', errorMessage);
    } finally {
      setSending(false);
    }
  };

  const renderUserItem = (user) => {
    const isSelected = selectedUsers.some(u => u._id === user._id);
    const isAttending = user.attendanceStatus === 'attending' || user.isAttending;
    const isInvited = user.attendanceStatus === 'invited' || user.isInvited;
    const isUnavailable = isAttending || isInvited;
    
    return (
      <TouchableOpacity 
        style={[styles.userItem, isUnavailable && styles.userItemDisabled]} 
        onPress={() => !isUnavailable && toggleUserSelection(user)}
        disabled={isUnavailable}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {getProfilePictureUrl(user.profilePicture) ? (
              <Image 
                source={{ uri: getProfilePictureUrl(user.profilePicture) }} 
                style={[styles.avatarImage, isUnavailable && styles.avatarDisabled]} 
              />
            ) : (
              <View style={[styles.avatarPlaceholder, isUnavailable && styles.avatarDisabled]}>
                <Text style={styles.avatarText}>
                  {getUserInitials(user)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, isUnavailable && styles.userNameDisabled]}>
                {getUserDisplayName(user)}
              </Text>
              {isAttending && (
                <Text style={styles.attendingLabel}>Already attending</Text>
              )}
              {isInvited && !isAttending && (
                <Text style={styles.invitedLabel}>Already invited</Text>
              )}
            </View>
            {user.displayName && (
              <Text style={[styles.userHandle, isUnavailable && styles.userHandleDisabled]}>@{user.username}</Text>
            )}
          </View>
        </View>
        
        {isAttending ? (
          <Ionicons name="checkmark-circle" size={24} color="#34C759" />
        ) : isInvited ? (
          <Ionicons name="paper-plane" size={24} color="#FF9500" />
        ) : isSelected ? (
          <Ionicons name="checkmark-circle" size={24} color="#3797EF" />
        ) : (
          <View style={styles.unselectedCircle} />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (searching) return null;
    
    if (!permissions?.canInvite) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={48} color="#C7C7CC" />
          <Text style={styles.emptyStateTitle}>Cannot Invite</Text>
          <Text style={styles.emptyStateMessage}>
            {permissions?.explanations?.invite || 'You cannot invite others to this event'}
          </Text>
        </View>
      );
    }
    
    if (searchQuery.trim() === '') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={48} color="#C7C7CC" />
          <Text style={styles.emptyStateTitle}>Search for People</Text>
          <Text style={styles.emptyStateMessage}>
            {getEmptyStateMessage()}
          </Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyState}>
        <Ionicons name="person-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyStateTitle}>No Results</Text>
        <Text style={styles.emptyStateMessage}>
          No {event.privacyLevel === 'friends' ? 'friends' : 'people'} found for "{searchQuery}"
        </Text>
      </View>
    );
  };

  // Helper functions
  const getSearchPlaceholder = () => {
    if (!permissions?.canInvite) {
      return 'Inviting not available for this event';
    }
    
    switch (event.privacyLevel) {
      case 'friends':
        return 'Search friends to invite...';
      case 'private':
        return 'Search people to invite...';
      case 'public':
        return 'Search people to invite...';
      default:
        return 'Search people...';
    }
  };

  const getPrivacyIcon = () => {
    switch (event.privacyLevel) {
      case 'public': return 'globe';
      case 'friends': return 'people';
      case 'private': return 'lock-closed';
      default: return 'calendar';
    }
  };

  const getPrivacyMessage = () => {
    switch (event.privacyLevel) {
      case 'public':
        return 'Anyone can join this public event';
      case 'friends':
        return 'Only your friends can be invited to this event';
      case 'private':
        return 'This is a private event - invitations required';
      default:
        return 'Event privacy settings apply';
    }
  };

  const getEmptyStateMessage = () => {
    switch (event.privacyLevel) {
      case 'friends':
        return 'Type a name to search your friends and connections';
      case 'private':
        return 'Type a name to find people to invite';
      case 'public':
        return 'Type a name to find people to invite';
      default:
        return 'Type a name to search for people';
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3797EF" />
            <Text style={styles.loadingText}>Loading sharing options...</Text>
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Share Event</Text>
              {selectedUsers.length > 0 && permissions?.canInvite && (
                <TouchableOpacity 
                  onPress={handleSendInvites}
                  disabled={sending}
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendButtonText}>
                      Send ({selectedUsers.length})
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {selectedUsers.length === 0 && (
                <View style={styles.placeholder} />
              )}
            </View>

            {/* Share Buttons Row */}
            <View style={styles.shareButtonsRow}>
              <TouchableOpacity style={styles.shareButton} onPress={handleCopyLink}>
                <View style={styles.shareButtonIcon}>
                  <Ionicons name="link" size={24} color="#3797EF" />
                </View>
                <Text style={styles.shareButtonText}>Copy Link</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.shareButton} onPress={handleNativeShare}>
                <View style={styles.shareButtonIcon}>
                  <Ionicons name="share" size={24} color="#3797EF" />
                </View>
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, !permissions?.canInvite && styles.searchInputDisabled]}
                placeholder={getSearchPlaceholder()}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#8E8E93"
                autoCapitalize="none"
                autoCorrect={false}
                editable={permissions?.canInvite}
              />
              {searching && (
                <ActivityIndicator size="small" color="#3797EF" style={styles.searchLoader} />
              )}
            </View>

            {/* Privacy info */}
            <View style={styles.privacyInfo}>
              <Ionicons 
                name={getPrivacyIcon()} 
                size={16} 
                color="#8E8E93" 
              />
              <Text style={styles.privacyText}>
                {getPrivacyMessage()}
              </Text>
            </View>

            {/* Results */}
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => renderUserItem(item)}
              style={styles.resultsList}
              ListEmptyComponent={renderEmptyState()}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 60, // Same width as send button to keep title centered
  },
  sendButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  shareButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  searchInputDisabled: {
    color: '#8E8E93',
  },
  searchLoader: {
    marginLeft: 8,
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  privacyText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    backgroundColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  attendingLabel: {
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#34C759',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  invitedLabel: {
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#FF9500',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  userItemDisabled: {
    opacity: 0.6,
  },
  avatarDisabled: {
    opacity: 0.7,
  },
  userNameDisabled: {
    color: '#8E8E93',
  },
  userHandleDisabled: {
    color: '#C7C7CC',
  },
  userHandle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  unselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});

export default ShareEventModal;