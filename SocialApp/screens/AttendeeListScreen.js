// SocialApp/screens/AttendeeListScreen.js - Simplified Version

import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Share,
  SafeAreaView,
  StatusBar,
  Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import apiConfig from '../config/apiConfig';
import QRCode from 'react-native-qrcode-svg';
import SwipeableRow from '../components/SwipeableRow'; // Enhanced Apple-style swipe component
import { AuthContext } from '../services/AuthContext';
import { useFriendRequestManager } from '../hooks/useFriendRequestManager';

const AttendeeListScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { currentUser } = useContext(AuthContext);
  
  // Core state variables
  const [attendees, setAttendees] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [canManage, setCanManage] = useState(false);
  
  // QR Code states
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  
  // Loading states
  const [toggleLoadingUsers, setToggleLoadingUsers] = useState(new Set());
  const [removingUsers, setRemovingUsers] = useState(new Set());
  
  // Friendship states
  const [friendshipStatuses, setFriendshipStatuses] = useState({});
  const [friendActionLoading, setFriendActionLoading] = useState(new Set());
  
  // Friend request manager
  const friendRequestManager = useFriendRequestManager('AttendeeListScreen', {
    showSuccessAlerts: true,
    onAcceptSuccess: (data) => {
      console.log('Friend request accepted:', data);
      // Update friendship status locally
      setFriendshipStatuses(prev => ({
        ...prev,
        [data.requesterId]: 'friends'
      }));
    },
    onRejectSuccess: (data) => {
      console.log('Friend request rejected:', data);
      setFriendshipStatuses(prev => ({
        ...prev,
        [data.requesterId]: 'not-friends'
      }));
    },
    onSendSuccess: (data) => {
      console.log('Friend request sent:', data);
      setFriendshipStatuses(prev => ({
        ...prev,
        [data.targetUserId]: 'request-sent'
      }));
    },
    onCancelSuccess: (data) => {
      console.log('Friend request cancelled:', data);
      setFriendshipStatuses(prev => ({
        ...prev,
        [data.targetUserId]: 'not-friends'
      }));
    },
    onRemoveSuccess: (data) => {
      console.log('Friend removed:', data);
      setFriendshipStatuses(prev => ({
        ...prev,
        [data.targetUserId]: 'not-friends'
      }));
    }
  });

  // Fetch attendees and event data
  const fetchAttendees = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      // Get event and attendees data
      const [eventResponse, attendeesResponse] = await Promise.all([
        api.get(`/api/events/${eventId}`),
        api.get(`/api/events/${eventId}/attendees`)
      ]);

      const eventData = eventResponse.data;
      const attendeesData = attendeesResponse.data;

      setEvent(eventData);
      setAttendees(attendeesData.attendees || []);
      
      // Get current user ID from the attendees response (it includes canManage)
      // Or we can get it from the event data
      setCanManage(attendeesData.canManage || false);
      
      // Fetch friendship statuses for all attendees (except current user)
      if (currentUser && attendeesData.attendees) {
        const friendshipPromises = attendeesData.attendees
          .filter(attendee => attendee._id !== currentUser._id)
          .map(async (attendee) => {
            try {
              const response = await api.get(`/api/friends/status/${attendee._id}`);
              return { userId: attendee._id, status: response.data.status };
            } catch (error) {
              console.log(`Could not fetch friendship status for ${attendee.username}:`, error);
              return { userId: attendee._id, status: 'not-friends' };
            }
          });
        
        const friendshipResults = await Promise.all(friendshipPromises);
        const statusMap = {};
        friendshipResults.forEach(result => {
          statusMap[result.userId] = result.status;
        });
        setFriendshipStatuses(statusMap);
      }
      
    } catch (error) {
      console.error('Error fetching attendees:', error);
      Alert.alert('Error', 'Failed to load attendees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, currentUser]);

  useFocusEffect(
    useCallback(() => {
      fetchAttendees();
    }, [fetchAttendees])
  );

  // FIXED: Handle check-in toggle with proper debugging and correct endpoints
  const handleCheckInToggle = async (userId, isCheckedIn) => {
    console.log('🔄 Check-in toggle started:', { userId, isCheckedIn, eventId });
    
    try {
      setToggleLoadingUsers(prev => new Set(prev).add(userId));
      
      // Add minimal haptic feedback
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Vibration.vibrate(25);
      }
      
      if (isCheckedIn) {
        // FIXED: Use the correct undo-checkin endpoint
        console.log('🔙 Undoing check-in using /undo-checkin endpoint');
        
        const response = await api.post(`/api/events/${eventId}/undo-checkin`, { userId });
        
        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to undo check-in');
        }
        
        console.log('✅ Successfully undid check-in');
      } else {
        // Check-in user
        console.log('✅ Checking in user using /manual-checkin endpoint');
        
        const response = await api.post(`/api/events/${eventId}/manual-checkin`, { userId });
        
        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to check in user');
        }
        
        console.log('✅ Successfully checked in user');
      }
      
      // Refresh data to sync with server
      console.log('🔄 Refreshing attendee data...');
      await fetchAttendees(true);
      
      // IMPORTANT: Return success for SwipeableRow
      return Promise.resolve();
      
    } catch (error) {
      console.error('❌ Error toggling check-in:', error);
      console.error('📍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      const errorMessage = error.response?.data?.message || 'Failed to update check-in status';
      Alert.alert('Error', errorMessage);
      
      // Refresh data on error to ensure consistency
      await fetchAttendees(true);
      
      // IMPORTANT: Re-throw error for SwipeableRow to handle
      throw error;
    } finally {
      setToggleLoadingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // ENHANCED: Handle remove attendee with detailed debugging
  const handleRemoveAttendee = async (userId) => {
    console.log('🚀 Starting attendee removal process:', { userId, eventId });
    
    try {
      setRemovingUsers(prev => new Set([...prev, userId]));
      console.log('⏳ Added user to removing state');

      const response = await api.post(`/api/events/${eventId}/remove-attendee`, { userId });
      console.log('📡 Remove attendee API response:', response.data);

      if (response.data.success) {
        console.log('✅ Backend confirmed removal, updating UI...');
        
        // Optimistically update local state
        setAttendees(prev => {
          const filtered = prev.filter(attendee => attendee._id !== userId);
          console.log(`📊 Attendees updated: ${prev.length} → ${filtered.length}`);
          return filtered;
        });
        
        // Update event data
        setEvent(prev => ({
          ...prev,
          attendees: prev.attendees.filter(id => id !== userId),
          checkedIn: (prev.checkedIn || []).filter(id => id !== userId),
        }));

        console.log('🎉 UI updated successfully');
        Alert.alert('Success', 'Attendee removed and notified');
      } else {
        throw new Error(response.data.message || 'Failed to remove attendee');
      }

    } catch (error) {
      console.error('❌ Error removing attendee:', error);
      console.error('📍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove attendee';
      Alert.alert('Error', errorMessage);
      
      // Refresh data on error to ensure consistency
      console.log('🔄 Refreshing data due to error...');
      fetchAttendees(true);
    } finally {
      setRemovingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        console.log('🧹 Removed user from removing state');
        return newSet;
      });
    }
  };

  // ENHANCED: Swipe-to-delete handler with detailed debugging and confirmation
  const handleSwipeRemove = async (userId) => {
    console.log('🗑️ Swipe remove initiated for user:', userId);
    
    return new Promise((resolve, reject) => {
      const attendee = attendees.find(a => a._id === userId);
      const displayName = attendee?.username || 'this attendee';
      
      console.log('👤 Found attendee for removal:', { 
        id: userId, 
        username: attendee?.username, 
        displayName 
      });

      Alert.alert(
        'Remove Attendee',
        `Remove ${displayName} from the event?`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              console.log('❌ User cancelled removal');
              reject(new Error('Cancelled'));
            }
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              console.log('✅ User confirmed removal, proceeding...');
              try {
                await handleRemoveAttendee(userId);
                console.log('🎉 Swipe removal completed successfully');
                resolve();
              } catch (error) {
                console.error('❌ Swipe removal failed:', error);
                reject(error);
              }
            },
          },
        ]
      );
    });
  };

  // Handle QR code display
  const handleShowQR = async () => {
    try {
      setQrLoading(true);
      setShowQRModal(true);
      
      const response = await api.get(`/api/events/${eventId}/event-qr`);
      
      if (response.data.success) {
        setQrData(response.data.qrData);
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('Error getting event QR code:', error);
      setShowQRModal(false);
      Alert.alert('Error', 'Failed to get event QR code');
    } finally {
      setQrLoading(false);
    }
  };

  const handleShareQR = async () => {
    try {
      const instructions = `🎉 Join ${event?.title}!\n\n📱 Just scan this QR code when you arrive to check in instantly - no registration needed!\n\nSee you there! 🎊`;

      await Share.share({
        message: instructions,
        title: `${event?.title} - Event Check-in QR`
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleOpenScanner = () => {
    navigation.navigate('QrScanScreen', { 
      eventId: eventId,
      eventTitle: event?.title,
      mode: 'checkin'
    });
  };

  // Friend action handlers
  const handleFriendAction = async (attendeeId, currentStatus) => {
    if (friendRequestManager.isProcessing() || friendActionLoading.has(attendeeId)) {
      return;
    }

    try {
      setFriendActionLoading(prev => new Set(prev).add(attendeeId));

      switch (currentStatus) {
        case 'not-friends':
          await friendRequestManager.sendRequest(attendeeId, 'I would like to add you as a friend.');
          break;
          
        case 'request-sent':
          Alert.alert(
            'Cancel Friend Request',
            'Cancel your friend request?',
            [
              { text: 'Keep Request', style: 'cancel' },
              { 
                text: 'Cancel Request', 
                style: 'destructive',
                onPress: async () => {
                  try {
                    await friendRequestManager.cancelSentRequest(attendeeId);
                  } catch (error) {
                    console.error('Cancel request failed:', error);
                  }
                }
              }
            ]
          );
          break;
          
        case 'request-received':
          Alert.alert(
            'Friend Request',
            'Accept this friend request?',
            [
              {
                text: 'Decline',
                style: 'cancel',
                onPress: async () => {
                  try {
                    await friendRequestManager.rejectRequest(attendeeId);
                  } catch (error) {
                    console.error('Reject request failed:', error);
                  }
                }
              },
              {
                text: 'Accept',
                onPress: async () => {
                  try {
                    await friendRequestManager.acceptRequest(attendeeId);
                  } catch (error) {
                    console.error('Accept request failed:', error);
                  }
                }
              }
            ]
          );
          break;
          
        case 'friends':
          Alert.alert(
            'Unfriend',
            'Are you sure you want to unfriend this person?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unfriend',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await friendRequestManager.removeFriend(attendeeId);
                  } catch (error) {
                    console.error('Remove friend failed:', error);
                  }
                }
              }
            ]
          );
          break;
          
        default:
          console.log('Unknown friendship status:', currentStatus);
      }
    } catch (error) {
      console.error('Friend action failed:', error);
      Alert.alert('Error', 'Failed to perform friend action. Please try again.');
    } finally {
      setFriendActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(attendeeId);
        return newSet;
      });
    }
  };

  // Filter attendees based on search only
  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = attendee.username?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get user display name
  const getUserDisplayName = (user) => {
    if (!user) return 'Unknown User';
    if (user.fullName) return user.fullName;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.username || 'Unknown User';
  };

  // Render attendee item
  const renderAttendeeItem = ({ item }) => {
    const isCheckedIn = event?.checkedIn?.includes(item._id);
    const isToggleLoading = toggleLoadingUsers.has(item._id);
    const isRemoving = removingUsers.has(item._id);
    const isCurrentUser = currentUser && item._id === currentUser._id;
    const friendshipStatus = friendshipStatuses[item._id] || 'not-friends';
    const isFriendActionLoading = friendActionLoading.has(item._id);
    const displayName = getUserDisplayName(item);
    const username = item.username || '';

    // Show loading state for removing users
    if (isRemoving) {
      return (
        <View style={styles.removingItem}>
          <ActivityIndicator size="small" color="#FF3B30" />
          <Text style={styles.removingText}>Removing...</Text>
        </View>
      );
    }

    const renderAttendeeContent = () => (
      <View style={styles.attendeeItem}>
        <TouchableOpacity
          style={styles.attendeeContent}
          onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
          activeOpacity={0.8}
        >
          {/* Circular Profile Photo with Checkmark Overlay */}
          <View style={styles.profilePictureContainer}>
            {item.profilePicture ? (
              <Image
                source={{
                  uri: `${apiConfig.BASE_URL}${item.profilePicture}`
                }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={[styles.profilePicture, styles.profilePicturePlaceholder]}>
                <Text style={styles.profilePictureInitials}>
                  {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
            )}
            {/* Checkmark Overlay - Always show for hosts (gray/green), only green for others if checked in */}
            {canManage && !isCurrentUser ? (
              // Hosts: Always show checkmark (gray if not checked in, green if checked in) - tappable
              <TouchableOpacity
                style={styles.checkmarkOverlay}
                onPress={() => handleCheckInToggle(item._id, isCheckedIn)}
                disabled={isToggleLoading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={isCheckedIn ? "#22c55e" : "#9ca3af"}
                  style={styles.checkmarkIcon}
                />
              </TouchableOpacity>
            ) : isCheckedIn ? (
              // Non-hosts: Only show green checkmark if checked in
              <View style={styles.checkmarkOverlay}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color="#22c55e"
                  style={styles.checkmarkIcon}
                />
              </View>
            ) : null}
          </View>
          
          <View style={styles.attendeeInfo}>
            <Text style={styles.attendeeName} numberOfLines={1}>
              {displayName}
            </Text>
            {username && (
              <Text style={styles.attendeeUsername} numberOfLines={1}>
                {username}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Friend Action Button (for non-current users) */}
          {!isCurrentUser && (
            <TouchableOpacity
              style={[
                styles.friendButton,
                friendshipStatus === 'friends' && styles.friendsButton,
                isFriendActionLoading && styles.loadingButton
              ]}
              onPress={() => handleFriendAction(item._id, friendshipStatus)}
              disabled={isFriendActionLoading}
              activeOpacity={0.7}
            >
              {isFriendActionLoading ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <Text style={styles.friendButtonText}>
                  {friendshipStatus === 'friends' 
                    ? 'Following' 
                    : friendshipStatus === 'request-sent'
                    ? 'Pending'
                    : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );

    // ENHANCED: Wrap with SwipeableRow only if user can manage and not current user
    if (canManage && !isCurrentUser) {
      console.log('🔧 Rendering swipeable row for attendee:', item.username);
      return (
        <SwipeableRow
          onDelete={() => {
            console.log('🗑️ SwipeableRow onDelete triggered for:', item.username);
            return handleSwipeRemove(item._id);
          }}
          onCheckIn={() => {
            console.log('✅ SwipeableRow onCheckIn triggered for:', item.username);
            return handleCheckInToggle(item._id, isCheckedIn);
          }}
          deleteText="Remove"
          checkInText={isCheckedIn ? "Undo Check-in" : "Check In"}
          deleteColor="#FF3B30"
          checkInColor="#34C759"
          disabled={isRemoving}
          isCheckedIn={isCheckedIn}
          isCheckInLoading={isToggleLoading}
          style={{ backgroundColor: '#FFFFFF' }}
        >
          {renderAttendeeContent()}
        </SwipeableRow>
      );
    }

    console.log('👁️ Rendering non-swipeable row for attendee:', item.username);

    return renderAttendeeContent();
  };

  // Header component
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Top Row: Back Button, Title, Spacer */}
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Attendees</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Empty state component
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No matching attendees' : 'No attendees yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try adjusting your search' : 'People who join this event will appear here'}
      </Text>
      {searchQuery && (
        <TouchableOpacity
          style={styles.clearSearchButton}
          onPress={() => setSearchQuery('')}
        >
          <Text style={styles.clearSearchText}>Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading attendees...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        {renderHeader()}
      </View>
      
      <FlatList
        data={filteredAttendees}
        keyExtractor={item => item._id}
        renderItem={renderAttendeeItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAttendees(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredAttendees.length === 0 ? styles.emptyList : undefined}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={10}
      />

      {/* QR Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Event Check-in QR</Text>
              <TouchableOpacity
                onPress={() => setShowQRModal(false)}
                style={styles.qrCloseButton}
              >
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            {qrLoading ? (
              <View style={styles.qrLoadingContainer}>
                <ActivityIndicator size="large" color="#3797EF" />
                <Text style={styles.qrLoadingText}>Loading QR code...</Text>
              </View>
            ) : qrData ? (
              <View style={styles.qrContent}>
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={JSON.stringify(qrData)}
                    size={250}
                    backgroundColor="#FFFFFF"
                    color="#000000"
                  />
                </View>
                
                <Text style={styles.qrInstructions}>
                  Event Check-in QR Code
                </Text>
                <Text style={styles.qrSubInstructions}>
                  Attendees scan this to check themselves in, or hosts scan user QR codes here
                </Text>

                <View style={styles.qrActions}>
                  <TouchableOpacity
                    style={styles.shareQRButton}
                    onPress={handleShareQR}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.shareQRText}>Share QR</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.projectionButton}
                    onPress={() => {
                      setShowQRModal(false);
                      navigation.navigate('EventQrDisplayScreen', { 
                        eventId, 
                        eventTitle: event?.title,
                        qrData: qrData
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="tv-outline" size={20} color="#3797EF" />
                    <Text style={styles.projectionText}>Projection Mode</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.qrErrorContainer}>
                <Text style={styles.qrErrorText}>Failed to load QR code</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleShowQR}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Simplified Styles
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Header Styles
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSpacer: {
    width: 32,
  },
  // Search Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginHorizontal: 16,
    marginTop: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  clearButton: {
    marginLeft: 8,
  },

  // Attendee Item Styles
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    backgroundColor: '#FFFFFF',
  },
  attendeeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Profile Picture Container with Checkmark
  profilePictureContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profilePicturePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
  },
  profilePictureInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  checkmarkOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  checkmarkIcon: {
    // Icon styling handled by Ionicons component
  },
  
  attendeeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  attendeeUsername: {
    fontSize: 12,
    color: '#6b7280',
  },

  // Friend Button Styles
  friendButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  friendsButton: {
    backgroundColor: '#f3f4f6',
  },
  friendButtonText: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
  },
  loadingButton: {
    opacity: 0.7,
  },

  // Removing Item Styles
  removingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    gap: 12,
  },
  removingText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#C7C7CC',
    textAlign: 'center',
    lineHeight: 22,
  },
  clearSearchButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3797EF',
    borderRadius: 8,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // QR Modal Styles
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxWidth: 350,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  qrCloseButton: {
    padding: 4,
  },
  qrContent: {
    alignItems: 'center',
  },
  qrCodeContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  qrInstructions: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  qrSubInstructions: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  qrActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  shareQRButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  shareQRText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  projectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  projectionText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },
  qrLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  qrLoadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  qrErrorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  qrErrorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
};

export default AttendeeListScreen;