// SocialApp/screens/AttendeeListScreen.js - Phase 1 Updates with Swipe-to-Delete

import React, { useState, useEffect, useCallback } from 'react';
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
  Switch,
  ScrollView,
  Image,
  Share,
  SafeAreaView,
  StatusBar,
  Vibration,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { API_BASE_URL } from '../services/api';
import QRCode from 'react-native-qrcode-svg';
import SwipeableRow from '../components/SwipeableRow'; // Import the SwipeableRow component

const AttendeeListScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  
  // Existing state variables...
  const [attendees, setAttendees] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // QR Code states
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  
  // Bulk selection states
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState(new Set());
  
  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    showCheckedIn: true,
    showNotCheckedIn: true,
    showWithForms: true,
    showWithoutForms: true
  });
  
  // Form response states
  const [showFormResponses, setShowFormResponses] = useState(false);
  const [selectedUserResponses, setSelectedUserResponses] = useState(null);
  const [formResponsesLoading, setFormResponsesLoading] = useState(false);
  
  // Toggle loading states - for Phase 1
  const [toggleLoadingUsers, setToggleLoadingUsers] = useState(new Set());
  
  // NEW: Removal loading states - for Phase 1
  const [removingUsers, setRemovingUsers] = useState(new Set());

  // Existing useEffect and functions...
  const fetchAttendees = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setRefreshing(false);
      } else {
        setRefreshing(true);
      }
      
      const [eventResponse, attendeesResponse, userResponse] = await Promise.all([
        api.get(`/api/events/${eventId}`),
        api.get(`/api/events/${eventId}/attendees`),
        api.get('/api/profile') // Correct endpoint for current user
      ]);

      const eventData = eventResponse.data;
      setEvent(eventData);
      setAttendees(attendeesResponse.data.attendees || []);
      setCurrentUser(userResponse.data); // Profile endpoint returns user directly
      
      const isHost = String(eventData.host?._id || eventData.host) === String(userResponse.data._id);
      const isCoHost = eventData.coHosts?.some(coHost => 
        String(coHost._id || coHost) === String(userResponse.data._id)
      );
      setCanManage(isHost || isCoHost);
      
    } catch (error) {
      console.error('Error fetching attendees:', error);
      Alert.alert('Error', 'Failed to load attendees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      fetchAttendees();
    }, [fetchAttendees])
  );

  // UPDATED: Enhanced Check-in Toggle with Better Error Handling
  const handleCheckInToggle = async (userId, isCheckedIn) => {
    try {
      // Add user to loading set
      setToggleLoadingUsers(prev => new Set(prev).add(userId));
      
      // Add haptic feedback
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Vibration.vibrate(50);
      }
      
      if (isCheckedIn) {
        // Undo check-in
        await api.post(`/api/events/${eventId}/manual-checkout`, { userId });
      } else {
        // Check-in user
        if (event?.requiresFormForCheckIn && event?.checkInForm) {
          const hasSubmitted = await checkUserFormSubmission(userId);
          if (!hasSubmitted) {
            Alert.alert(
              'Form Required',
              'This attendee must complete the check-in form first.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Form',
                  onPress: () => navigation.navigate('FormSubmissionScreen', {
                    formId: event.checkInForm._id || event.checkInForm,
                    eventId,
                    userId,
                    isCheckIn: true,
                    onSubmissionComplete: () => {
                      fetchAttendees(true);
                    }
                  })
                }
              ]
            );
            return;
          }
        }
        
        try {
          await api.post(`/api/events/${eventId}/manual-checkin`, { userId });
        } catch (checkInError) {
          // Handle specific check-in errors
          if (checkInError.response?.data?.message) {
            const errorMessage = checkInError.response.data.message;
            
            if (errorMessage.includes('Check-in opens')) {
              // Timing restriction error - show helpful message
              Alert.alert(
                'Check-in Timing',
                'This event has check-in timing restrictions, but as the host you can override this. Would you like to check them in anyway?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Check In Anyway', 
                    onPress: async () => {
                      // The backend should already handle the bypass, but if not, we could add a force flag
                      Alert.alert('Error', 'Unable to override timing restriction. Please try again or contact support.');
                    }
                  }
                ]
              );
              return;
            } else {
              // Other specific errors
              Alert.alert('Check-in Error', errorMessage);
              return;
            }
          }
          throw checkInError;
        }
      }
      
      // Optimistically update event check-in status
      setEvent(prev => {
        const updatedCheckedIn = isCheckedIn 
          ? (prev.checkedIn || []).filter(id => id !== userId)
          : [...(prev.checkedIn || []), userId];
        
        return {
          ...prev,
          checkedIn: updatedCheckedIn,
        };
      });
      
      // Refresh data to sync with server
      await fetchAttendees(true);
      
    } catch (error) {
      console.error('Error toggling check-in:', error);
      
      // Show appropriate error message
      const errorMessage = error.response?.data?.message || 'Failed to update check-in status';
      Alert.alert('Error', errorMessage);
      
      // Revert optimistic update on error
      await fetchAttendees(true);
    } finally {
      // Remove user from loading set
      setToggleLoadingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const checkUserFormSubmission = async (userId) => {
    try {
      const response = await api.get(`/api/forms/${event.checkInForm._id || event.checkInForm}/submissions`, {
        params: { eventId, userId }
      });
      return response.data.submissions.length > 0;
    } catch (error) {
      console.error('Error checking form submission:', error);
      return false;
    }
  };

  // NEW: Enhanced Remove Attendee with optimistic updates
  const handleRemoveAttendee = async (userId) => {
    try {
      setRemovingUsers(prev => new Set([...prev, userId]));

      const response = await api.post(`/api/events/${eventId}/remove-attendee`, { userId });

      if (response.data.success) {
        // Optimistic update - remove from local state
        setAttendees(prev => prev.filter(attendee => attendee._id !== userId));
        
        // Update event attendee count
        setEvent(prev => ({
          ...prev,
          attendees: prev.attendees.filter(id => id !== userId),
          checkedIn: (prev.checkedIn || []).filter(id => id !== userId),
        }));

        // Remove from selected if in bulk mode
        setSelectedAttendees(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });

        // Show success feedback
        Alert.alert('Success', 'Attendee removed and notified');
      } else {
        throw new Error(response.data.message || 'Failed to remove attendee');
      }

    } catch (error) {
      console.error('Error removing attendee:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove attendee';
      Alert.alert('Error', errorMessage);
      
      // Refresh data on error to ensure consistency
      fetchAttendees(true);
    } finally {
      setRemovingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // NEW: Swipe-to-delete handler with confirmation
  const handleSwipeRemove = async (userId) => {
    return new Promise((resolve, reject) => {
      const attendee = attendees.find(a => a._id === userId);
      const displayName = attendee?.username || 
                         `${attendee?.firstName} ${attendee?.lastName}`.trim() || 
                         'this attendee';

      Alert.alert(
        'Remove Attendee',
        `Remove ${displayName} from the event?`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => reject(new Error('Cancelled'))
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await handleRemoveAttendee(userId);
                resolve();
              } catch (error) {
                reject(error);
              }
            },
          },
        ]
      );
    });
  };

  // NEW: Bulk selection handlers
  const toggleAttendeeSelection = useCallback((attendeeId) => {
    setSelectedAttendees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(attendeeId)) {
        newSet.delete(attendeeId);
      } else {
        newSet.add(attendeeId);
      }
      return newSet;
    });
  }, []);

  // UPDATED: Permanent QR Code Handling
  const handleShowQR = async () => {
    try {
      setQrLoading(true);
      setShowQRModal(true);
      
      // GET instead of POST - permanent QR
      const response = await api.get(`/api/events/${eventId}/event-qr`);
      
      if (response.data.success) {
        setQrData(response.data.qrData);
        console.log('✅ Event QR retrieved (permanent)');
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
// ADD THIS NEW FUNCTION:
const handleBulkRemove = async () => {
  if (selectedAttendees.size === 0) return;

  const attendeeNames = Array.from(selectedAttendees)
    .map(id => {
      const attendee = attendees.find(a => a._id === id);
      return attendee?.username || `${attendee?.firstName} ${attendee?.lastName}`.trim() || 'Unknown';
    })
    .slice(0, 3)
    .join(', ');

  const displayText = selectedAttendees.size > 3 
    ? `${attendeeNames} and ${selectedAttendees.size - 3} others`
    : attendeeNames;

  Alert.alert(
    'Remove Attendees',
    `Remove ${displayText} from the event?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const removePromises = Array.from(selectedAttendees).map(userId => 
              api.post(`/api/events/${eventId}/remove-attendee`, { userId })
            );

            await Promise.all(removePromises);

            // Update local state
            setAttendees(prev => prev.filter(attendee => !selectedAttendees.has(attendee._id)));
            setEvent(prev => ({
              ...prev,
              attendees: prev.attendees.filter(id => !selectedAttendees.has(id)),
              checkedIn: (prev.checkedIn || []).filter(id => !selectedAttendees.has(id)),
            }));

            setSelectedAttendees(new Set());
            setBulkMode(false);

            Alert.alert('Success', `${selectedAttendees.size} attendees removed and notified`);
          } catch (error) {
            console.error('Error bulk removing attendees:', error);
            Alert.alert('Error', 'Failed to remove some attendees');
            fetchAttendees(true); // Refresh on error
          }
        },
      },
    ]
  );
};
  const handleOpenScanner = () => {
    navigation.navigate('QrScanScreen', { 
      eventId: eventId,
      eventTitle: event?.title,
      mode: 'checkin'
    });
  };

  // Filter attendees based on search and filters
  const filteredAttendees = attendees.filter(attendee => {
  const matchesSearch = attendee.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       attendee.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       attendee.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
  
  return matchesSearch;
});

  // UPDATED: Enhanced Attendee Item Rendering with SwipeableRow Integration
  const renderAttendeeItem = ({ item }) => {
    const isCheckedIn = canManage && event?.checkedIn?.includes(item._id);
    const hasFormResponse = canManage && event?.requiresFormForCheckIn && item.formSubmission;
    const isSelected = selectedAttendees.has(item._id);
    const isToggleLoading = toggleLoadingUsers.has(item._id);
    const isRemoving = removingUsers.has(item._id);

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
        {/* Bulk Selection Checkbox */}
        {bulkMode && canManage && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleAttendeeSelection(item._id)}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.attendeeContent}
          onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
          activeOpacity={0.8}
        >
          {/* UPDATED: Square Profile Photo with Curved Corners */}
          <Image
            source={{
              uri: item.profilePicture
                ? `http://${API_BASE_URL}:3000${item.profilePicture}`
                : 'https://placehold.co/50x50.png?text=👤'
            }}
            style={styles.profilePicture}
          />
          
          <View style={styles.attendeeInfo}>
            <Text style={styles.attendeeName}>
              {item.firstName && item.lastName 
                ? `${item.firstName} ${item.lastName}`
                : item.username || 'Unknown User'
              }
            </Text>
            <View style={styles.statusRow}>
              {isCheckedIn && (
                <View style={styles.checkedInBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.checkedInText}>Checked In</Text>
                </View>
              )}
              {hasFormResponse && (
                <View style={styles.formBadge}>
                  <Ionicons name="document-text" size={14} color="#FF9500" />
                  <Text style={styles.formText}>Form Complete</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>


        {/* UPDATED: Enhanced Check-in Toggle - Only show if not in bulk mode */}
        {canManage && !bulkMode && (
  <TouchableOpacity
    style={[
      styles.checkInButton,
      isCheckedIn && styles.checkedInButton,
      isToggleLoading && styles.loadingButton
    ]}
    onPress={() => handleCheckInToggle(item._id, isCheckedIn)}
    disabled={isToggleLoading}
    activeOpacity={0.7}
  >
    {isToggleLoading ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <>
        <Ionicons 
          name={isCheckedIn ? "checkmark-circle" : "radio-button-off"} 
          size={20} 
          color="#FFFFFF" 
        />
        <Text style={styles.checkInButtonText}>
          {isCheckedIn ? 'Undo' : 'Check In'}
        </Text>
      </>
    )}
  </TouchableOpacity>
)}
      </View>
    );

    // NEW: Wrap with SwipeableRow only if user can manage and not in bulk mode
    if (canManage && !bulkMode) {
      return (
        <SwipeableRow
          onDelete={() => handleSwipeRemove(item._id)}
          deleteText="Remove"
          deleteColor="#FF3B30"
          disabled={bulkMode || isRemoving}
        >
          {renderAttendeeContent()}
        </SwipeableRow>
      );
    }

    // Return plain content for non-managers or bulk mode
    return renderAttendeeContent();
  };

  // Header component with search and controls
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          Attendees ({filteredAttendees.length})
        </Text>
        {canManage && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.qrButton}
              onPress={handleShowQR}
              activeOpacity={0.7}
            >
              <Ionicons name="qr-code" size={24} color="#3797EF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleOpenScanner}
              activeOpacity={0.7}
            >
              <Ionicons name="scan" size={24} color="#3797EF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search attendees..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8E8E93"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter and Bulk Actions */}
      {canManage && (
        <View style={styles.controlsRow}>
          
          <TouchableOpacity
            style={[styles.bulkButton, bulkMode && styles.bulkButtonActive]}
            onPress={() => {
              setBulkMode(!bulkMode);
              setSelectedAttendees(new Set());
            }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={bulkMode ? "checkmark-circle" : "ellipsis-horizontal"} 
              size={16} 
              color={bulkMode ? "#FFFFFF" : "#3797EF"} 
            />
            <Text style={[styles.bulkButtonText, bulkMode && styles.bulkButtonTextActive]}>
              {bulkMode ? 'Done' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk Actions Bar */}
      {bulkMode && canManage && (
        <View style={styles.bulkActionsBar}>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={() => {
              if (selectedAttendees.size === filteredAttendees.length) {
                setSelectedAttendees(new Set());
              } else {
                setSelectedAttendees(new Set(filteredAttendees.map(a => a._id)));
              }
            }}
          >
            <Text style={styles.selectAllText}>
              {selectedAttendees.size === filteredAttendees.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          {selectedAttendees.size > 0 && (
            <View style={styles.bulkActionsContainer}>
              <TouchableOpacity
                style={styles.bulkActionButton}
                onPress={() => {/* handleBulkCheckIn */}}
              >
                <Text style={styles.bulkActionText}>Check In ({selectedAttendees.size})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkActionButton, styles.bulkRemoveButton]}
                onPress={handleBulkRemove}
              >
                <Text style={[styles.bulkActionText, styles.bulkRemoveText]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
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
      
      <FlatList
        data={filteredAttendees}
        keyExtractor={item => item._id}
        renderItem={renderAttendeeItem}
        ListHeaderComponent={renderHeader}
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
        // NEW: Performance optimizations for Phase 1
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={10}
        getItemLayout={(data, index) => ({
          length: 85, // Approximate height of each item
          offset: 85 * index,
          index,
        })}
      />

      {/* UPDATED: Simplified QR Modal (Permanent QR) */}
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

      {/* Filter Modal - existing implementation */}
      {/* Form Responses Modal - existing implementation */}
    </SafeAreaView>
  );
};

// UPDATED: Enhanced Styles for Phase 1
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  qrButton: {
    padding: 8,
  },
  scanButton: {
    padding: 8,
  },

  // Search Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  clearButton: {
    marginLeft: 8,
  },

  // Controls Row
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    gap: 4,
  },
  bulkButtonActive: {
    backgroundColor: '#3797EF',
  },
  bulkButtonText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  bulkButtonTextActive: {
    color: '#FFFFFF',
  },

  // Bulk Actions Bar
  bulkActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  selectAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  selectAllText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  bulkActionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#3797EF',
    borderRadius: 8,
  },
  bulkRemoveButton: {
    backgroundColor: '#FF3B30',
  },
  bulkActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bulkRemoveText: {
    color: '#FFFFFF',
  },

  // UPDATED: Attendee Item Styles
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    backgroundColor: '#FFFFFF',
    minHeight: 85, // For getItemLayout optimization
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  attendeeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // UPDATED: Square Profile Photo with Curved Corners
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 12, // Changed from circular to curved square
    marginRight: 12,
    backgroundColor: '#F2F2F7',
  },
  
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkedInText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  formBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },

  // UPDATED: Enhanced Check-in Button
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 8,
    gap: 4,
    minWidth: 80,
    justifyContent: 'center',
  },
  checkedInButton: {
    backgroundColor: '#34C759',
  },
  loadingButton: {
    backgroundColor: '#8E8E93',
  },
  checkInButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // NEW: Removing Item Styles
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

  // UPDATED: QR Modal Styles (Simplified for Permanent QR)
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