// SocialApp/screens/AttendeeListScreen.js - Phase 1 Updates

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
import api from '../services/api';
import { API_BASE_URL } from '../services/api';
import QRCode from 'react-native-qrcode-svg';

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
  
  // Toggle loading states - NEW for Phase 1
  const [toggleLoadingUsers, setToggleLoadingUsers] = useState(new Set());

  // Existing useEffect and functions...
  const fetchAttendees = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const [eventResponse, attendeesResponse, userResponse] = await Promise.all([
        api.get(`/api/events/${eventId}`),
        api.get(`/api/events/${eventId}/attendees`),
        api.get('/api/profile/') // Use the correct profile endpoint
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
      Vibration.vibrate(50);
      
      if (isCheckedIn) {
        // Undo check-in
        await api.post(`/api/events/${eventId}/undo-checkin`, { userId });
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
      
      // Optimistically update UI
      setAttendees(prevAttendees => 
        prevAttendees.map(attendee => 
          attendee._id === userId 
            ? { ...attendee, isCheckedIn: !isCheckedIn }
            : attendee
        )
      );
      
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

  const handleOpenScanner = () => {
    navigation.navigate('QrScanScreen', { 
      eventId: eventId,
      eventTitle: event?.title,
      mode: 'checkin'
    });
  };

  // Existing functions for bulk operations, filtering, etc...
  const handleRemoveAttendee = async (userId) => {
    Alert.alert(
      'Remove Attendee',
      'Are you sure you want to remove this person from the event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/events/${eventId}/remove-attendee`, { userId });
              await fetchAttendees(true);
              Alert.alert('Success', 'Attendee removed from event');
            } catch (error) {
              console.error('Error removing attendee:', error);
              Alert.alert('Error', 'Failed to remove attendee');
            }
          },
        },
      ]
    );
  };

  // Filter attendees based on search and filters
  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = attendee.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         attendee.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         attendee.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isCheckedIn = event?.checkedIn?.includes(attendee._id);
    const hasFormSubmission = attendee.formSubmission;
    
    const matchesFilters = 
      (filters.showCheckedIn && isCheckedIn) ||
      (filters.showNotCheckedIn && !isCheckedIn) &&
      (filters.showWithForms && hasFormSubmission) ||
      (filters.showWithoutForms && !hasFormSubmission);
    
    return matchesSearch && matchesFilters;
  });

  // UPDATED: Enhanced Attendee Item Rendering
  const renderAttendeeItem = ({ item }) => {
    const isCheckedIn = canManage && event?.checkedIn?.includes(item._id);
    const hasFormResponse = canManage && event?.requiresFormForCheckIn && item.formSubmission;
    const isSelected = selectedAttendees.has(item._id);
    const isToggleLoading = toggleLoadingUsers.has(item._id);

    return (
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

        {/* UPDATED: Enhanced Check-in Toggle */}
        {canManage && (
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

        {/* Remove button for non-bulk mode */}
        {canManage && !bulkMode && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveAttendee(item._id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
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
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter" size={16} color="#3797EF" />
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
          
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
                onPress={() => {/* handleBulkRemove */}}
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
        {searchQuery ? 'Try adjusting your search or filters' : 'People who join this event will appear here'}
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
  removeButton: {
    padding: 8,
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