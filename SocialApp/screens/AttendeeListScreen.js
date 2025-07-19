// screens/AttendeeListScreen.js - UPDATED: Simplified UI for hosts, clean view for regular users
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  Share,
  TextInput,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AttendeeListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { eventId, mode = 'view' } = route.params;

  // State
  const [attendees, setAttendees] = useState([]);
  const [filteredAttendees, setFilteredAttendees] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [formSubmissionCount, setFormSubmissionCount] = useState(0);

  // QR Code State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrExpiry, setQrExpiry] = useState(null);

  // Form Response State
  const [showFormResponses, setShowFormResponses] = useState(false);
  const [selectedUserResponses, setSelectedUserResponses] = useState(null);
  const [formResponsesLoading, setFormResponsesLoading] = useState(false);
  const [allowNonRegistered, setAllowNonRegistered] = useState(true);  
  // Export & Analytics State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    showCheckedIn: true,
    showNotCheckedIn: true,
    showFormSubmitted: true,
    showFormNotSubmitted: true,
    showPaid: true,
    showNotPaid: true
  });

  // Bulk Operations State
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState(new Set());

  // ✅ UPDATED: Permission check logic - simplified
  const isHost = event && String(event.host?._id || event.host) === String(currentUser?._id);
  const isCoHost = event && event.coHosts?.some(c => String(c._id || c) === String(currentUser?._id));
  const canManage = (isHost || isCoHost) && mode !== 'view'; // Only manage if explicitly in manage mode

  useEffect(() => {
    fetchAttendees();
    if (canManage) {
      fetchAnalytics();
    }
    
    // ✅ UPDATED: Clean navigation header
    navigation.setOptions({
      headerTitle: canManage ? 'Manage Attendees' : 'Attendees',
      headerRight: () => (
        canManage && (
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="download" size={24} color="#3797EF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleShowQR}
            >
              <Ionicons name="qr-code" size={24} color="#3797EF" />
            </TouchableOpacity>
          </View>
        )
      ),
    });
  }, [eventId, canManage]);

  // Auto-refresh QR code every 30 seconds when modal is open
  useEffect(() => {
    let interval;
    if (showQRModal && qrData) {
      interval = setInterval(checkQRExpiry, 30000);
    }
    return () => clearInterval(interval);
  }, [showQRModal, qrData]);

  // Filter attendees based on search and filters
  useEffect(() => {
    let filtered = attendees;
    
    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(attendee => 
        attendee.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attendee.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attendee.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // ✅ UPDATED: Status filters only apply for managers
    if (canManage) {
      filtered = filtered.filter(attendee => {
        const isCheckedIn = event?.checkedIn?.includes(attendee._id);
        const hasFormSubmission = attendee.formSubmission;
        const hasPaid = attendee.hasPaid;
        
        if (!filters.showCheckedIn && isCheckedIn) return false;
        if (!filters.showNotCheckedIn && !isCheckedIn) return false;
        if (!filters.showFormSubmitted && hasFormSubmission) return false;
        if (!filters.showFormNotSubmitted && !hasFormSubmission) return false;
        if (!filters.showPaid && hasPaid) return false;
        if (!filters.showNotPaid && !hasPaid) return false;
        
        return true;
      });
    }
    
    setFilteredAttendees(filtered);
  }, [attendees, searchQuery, filters, event, canManage]);

  const fetchAttendees = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(`/api/events/${eventId}/attendees-detailed`);
      const data = response.data;

      setAttendees(data.attendees || []);
      setEvent(data.event || null);
      setCheckedInCount(data.checkedInCount || 0);
      setFormSubmissionCount(data.formSubmissionCount || 0);

    } catch (error) {
      console.error('Error fetching attendees:', error);
      
      if (error.response?.status === 404) {
        Alert.alert('Error', 'Event not found or you do not have permission to view attendees');
      } else {
        Alert.alert('Error', 'Failed to load attendees');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await api.get(`/api/events/${eventId}/analytics`);
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Export Functions
  const handleExportCSV = async () => {
    try {
      setExportLoading(true);
      const response = await api.post(`/api/events/${eventId}/export`, {
        format: 'csv',
        includeFormResponses: event?.requiresFormForCheckIn,
        filters: {
          ...filters,
          searchQuery
        }
      });

      const csvContent = response.data.csvContent;
      const fileName = `${event?.title || 'event'}_attendees_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', 'Export file saved to device');
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportGoogleSheets = async () => {
    try {
      setExportLoading(true);
      const response = await api.post(`/api/events/${eventId}/export-google-sheets`, {
        includeFormResponses: event?.requiresFormForCheckIn,
        filters: {
          ...filters,
          searchQuery
        }
      });

      const sheetsUrl = response.data.sheetsUrl;
      Alert.alert(
        'Google Sheets Export',
        'Your data has been exported to Google Sheets. Would you like to open it?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open',
            onPress: () => {
              Share.share({
                url: sheetsUrl,
                title: 'Event Attendee Data'
              });
            }
          }
        ]
      );

      setShowExportModal(false);
    } catch (error) {
      console.error('Google Sheets export error:', error);
      Alert.alert('Error', 'Failed to export to Google Sheets');
    } finally {
      setExportLoading(false);
    }
  };

  // Bulk Operations
  const handleBulkCheckIn = async () => {
    if (selectedAttendees.size === 0) {
      Alert.alert('No Selection', 'Please select attendees to check in');
      return;
    }

    try {
      const attendeeIds = Array.from(selectedAttendees);
      await api.post(`/api/events/${eventId}/bulk-checkin`, {
        attendeeIds
      });

      await fetchAttendees(true);
      setBulkMode(false);
      setSelectedAttendees(new Set());
      Alert.alert('Success', `${attendeeIds.length} attendees checked in`);
    } catch (error) {
      console.error('Bulk check-in error:', error);
      Alert.alert('Error', 'Failed to check in attendees');
    }
  };

  const handleBulkRemove = async () => {
    if (selectedAttendees.size === 0) {
      Alert.alert('No Selection', 'Please select attendees to remove');
      return;
    }

    Alert.alert(
      'Remove Attendees',
      `Are you sure you want to remove ${selectedAttendees.size} attendees?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const attendeeIds = Array.from(selectedAttendees);
              await api.post(`/api/events/${eventId}/bulk-remove`, {
                attendeeIds
              });

              await fetchAttendees(true);
              setBulkMode(false);
              setSelectedAttendees(new Set());
              Alert.alert('Success', `${attendeeIds.length} attendees removed`);
            } catch (error) {
              console.error('Bulk remove error:', error);
              Alert.alert('Error', 'Failed to remove attendees');
            }
          }
        }
      ]
    );
  };

  const toggleAttendeeSelection = (attendeeId) => {
    const newSelection = new Set(selectedAttendees);
    if (newSelection.has(attendeeId)) {
      newSelection.delete(attendeeId);
    } else {
      newSelection.add(attendeeId);
    }
    setSelectedAttendees(newSelection);
  };

  const selectAllAttendees = () => {
    if (selectedAttendees.size === filteredAttendees.length) {
      setSelectedAttendees(new Set());
    } else {
      setSelectedAttendees(new Set(filteredAttendees.map(a => a._id)));
    }
  };

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

  const handleCheckInToggle = async (userId, isCheckedIn) => {
    try {
      if (isCheckedIn) {
        await api.post(`/api/events/${eventId}/undo-checkin`, { userId });
      } else {
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
        
        await api.post(`/api/events/${eventId}/manual-checkin`, { userId });
      }
      
      await fetchAttendees(true);
    } catch (error) {
      console.error('Error toggling check-in:', error);
      Alert.alert('Error', 'Failed to update check-in status');
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

  const handleShowQR = async () => {
  try {
    setQrLoading(true);
    setShowQRModal(true);
    
    const response = await api.post(`/api/events/${eventId}/generate-mass-checkin-qr`, {
      validityHours: 24,
      allowNonRegistered: true  // ✅ Always true - anyone can check in
    });
    
    if (response.data.success) {
      setQrData(response.data.qrData);
      setQrExpiry(new Date(response.data.expiresAt));
      console.log('✅ Mass check-in QR generated (open to everyone)');
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('Error generating mass check-in QR code:', error);
    setShowQRModal(false);
    Alert.alert('Error', 'Failed to generate mass check-in QR code');
  } finally {
    setQrLoading(false);
  }
};



  const handleRefreshQR = async () => {
  try {
    setQrLoading(true);
    const response = await api.post(`/api/events/${eventId}/generate-mass-checkin-qr`, {
      validityHours: 24,
      allowNonRegistered: true  // ✅ Always true - anyone can check in
    });
    
    if (response.data.success) {
      setQrData(response.data.qrData);
      setQrExpiry(new Date(response.data.expiresAt));
      console.log('✅ Mass check-in QR refreshed (open to everyone)');
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('Error refreshing QR code:', error);
    Alert.alert('Error', 'Failed to refresh QR code');
  } finally {
    setQrLoading(false);
  }
};


  const checkQRExpiry = () => {
    if (qrExpiry && new Date() > qrExpiry) {
      Alert.alert(
        'QR Code Expired',
        'The QR code has expired. Generate a new one?',
        [
          { text: 'Close', onPress: () => setShowQRModal(false) },
          { text: 'Refresh', onPress: handleRefreshQR }
        ]
      );
    }
  };

  const handleShareQR = async () => {
  try {
    const instructions = `🎉 Join ${event?.title}!\n\n📱 Just scan this QR code when you arrive to check in instantly - no registration needed!\n\n⏰ Check-in available until: ${qrExpiry?.toLocaleString()}\n\nSee you there! 🎊`;

    await Share.share({
      message: instructions,
      title: `${event?.title} - Instant Check-in QR`
    });
  } catch (error) {
    console.error('Error sharing:', error);
  }
};

const handleDeactivateQR = async () => {
  Alert.alert(
    'Deactivate QR Code',
    'This will stop mass check-in. People will no longer be able to check themselves in using this QR code.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/api/events/${eventId}/deactivate-mass-checkin-qr`);
            setShowQRModal(false);
            Alert.alert('Success', 'Mass check-in QR code has been deactivated');
          } catch (error) {
            Alert.alert('Error', 'Failed to deactivate QR code');
          }
        }
      }
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

  const handleViewFormResponses = async (attendee) => {
    if (!event?.checkInForm) return;
    
    try {
      setFormResponsesLoading(true);
      setShowFormResponses(true);
      
      const response = await api.get(`/api/forms/${event.checkInForm._id || event.checkInForm}/submissions`, {
        params: { eventId, userId: attendee._id }
      });
      
      const submission = response.data.submissions[0];
      setSelectedUserResponses({
        user: attendee,
        submission: submission || null
      });
    } catch (error) {
      console.error('Error fetching form responses:', error);
      setShowFormResponses(false);
      Alert.alert('Error', 'Failed to load form responses');
    } finally {
      setFormResponsesLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!qrExpiry) return '';
    
    const now = new Date();
    const diff = qrExpiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  // ✅ UPDATED: Attendee item - simplified for non-managers
  const renderAttendeeItem = ({ item }) => {
    const isCheckedIn = canManage && event?.checkedIn?.includes(item._id);
    const hasFormResponse = canManage && event?.requiresFormForCheckIn && item.formSubmission;
    const isSelected = selectedAttendees.has(item._id);

    return (
      <View style={styles.attendeeItem}>
        {/* Bulk Selection Checkbox (only in manage mode) */}
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
          <Image
            source={{
              uri: item.profilePicture
                ? `http://${API_BASE_URL}:3000${item.profilePicture}`
                : 'https://placehold.co/50x50.png?text=👤'
            }}
            style={styles.profilePicture}
          />
          <View style={styles.attendeeInfo}>
            <View style={styles.attendeeNameRow}>
              <Text style={styles.username}>{item.username}</Text>
              {/* ✅ UPDATED: Only show payment badge for managers */}
              {canManage && item.hasPaid && (
                <View style={styles.paidBadge}>
                  <Ionicons name="card" size={12} color="#34C759" />
                  <Text style={styles.paidText}>Paid</Text>
                </View>
              )}
            </View>
            {item.bio && <Text style={styles.bio}>{item.bio}</Text>}
            
            {/* ✅ UPDATED: Status indicators only for managers */}
            {canManage && (
              <View style={styles.statusRow}>
                {isCheckedIn && (
                  <View style={styles.checkedInBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                    <Text style={styles.checkedInText}>Checked In</Text>
                  </View>
                )}
                {hasFormResponse && (
                  <View style={styles.formBadge}>
                    <Ionicons name="document-text" size={14} color="#3797EF" />
                    <Text style={styles.formText}>Form Done</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* ✅ UPDATED: Host actions only in manage mode and not bulk mode */}
        {canManage && !bulkMode && (
          <View style={styles.hostActions}>
            {/* Form Response Button */}
            {hasFormResponse && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleViewFormResponses(item)}
              >
                <Ionicons name="document-text" size={20} color="#3797EF" />
              </TouchableOpacity>
            )}
            
            {/* Check-in Toggle */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                isCheckedIn ? styles.checkedInButton : styles.checkInButton
              ]}
              onPress={() => handleCheckInToggle(item._id, isCheckedIn)}
            >
              <Ionicons 
                name={isCheckedIn ? "checkmark-circle" : "checkmark-circle-outline"} 
                size={20} 
                color={isCheckedIn ? "#FFFFFF" : "#34C759"} 
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ✅ UPDATED: Search and filter - simplified
  const renderSearchAndFilter = () => (
    <View style={styles.searchFilterContainer}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search attendees..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#C7C7CC"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ UPDATED: Only show management controls for managers */}
      {canManage && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="funnel" size={16} color="#3797EF" />
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bulkButton, bulkMode && styles.bulkButtonActive]}
            onPress={() => {
              setBulkMode(!bulkMode);
              setSelectedAttendees(new Set());
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={bulkMode ? "#FFFFFF" : "#3797EF"} />
            <Text style={[styles.bulkButtonText, bulkMode && styles.bulkButtonTextActive]}>
              {bulkMode ? 'Cancel' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ✅ UPDATED: Header - simplified
  const renderHeader = () => (
    <View style={styles.header}>
      {/* ✅ UPDATED: Basic stats for everyone, detailed stats only for managers */}
      <View style={styles.headerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{attendees.length}</Text>
          <Text style={styles.statLabel}>Attendees</Text>
        </View>
        
        {canManage && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.checkedInNumber]}>{checkedInCount}</Text>
              <Text style={styles.statLabel}>Checked In</Text>
            </View>
            
            {event?.requiresFormForCheckIn && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, styles.formNumber]}>{formSubmissionCount}</Text>
                  <Text style={styles.statLabel}>Forms</Text>
                </View>
              </>
            )}
          </>
        )}
        
        {searchQuery && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{filteredAttendees.length}</Text>
              <Text style={styles.statLabel}>Showing</Text>
            </View>
          </>
        )}
      </View>
      
      {/* Search and Filter */}
      {renderSearchAndFilter()}

      {/* ✅ UPDATED: Remove complex host action buttons, keep only essential bulk controls */}
      {canManage && bulkMode && selectedAttendees.size > 0 && (
        <View style={styles.bulkHeader}>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={selectAllAttendees}
          >
            <Text style={styles.selectAllText}>
              {selectedAttendees.size === filteredAttendees.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <View style={styles.bulkActionsContainer}>
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={handleBulkCheckIn}
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
        </View>
      )}
    </View>
  );

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

      {/* ✅ UPDATED: Filter Modal (only for managers) */}
      {canManage && (
        <Modal
          visible={showFilterModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFilterModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.filterModal}>
              <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>Filter Attendees</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.filterContent}>
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Check-in Status</Text>
                  <View style={styles.filterOption}>
                    <Text style={styles.filterOptionText}>Show checked in attendees</Text>
                    <Switch
                      value={filters.showCheckedIn}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, showCheckedIn: value }))}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <View style={styles.filterOption}>
                    <Text style={styles.filterOptionText}>Show not checked in attendees</Text>
                    <Switch
                      value={filters.showNotCheckedIn}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, showNotCheckedIn: value }))}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>

                {event?.requiresFormForCheckIn && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Form Status</Text>
                    <View style={styles.filterOption}>
                      <Text style={styles.filterOptionText}>Show form submitted</Text>
                      <Switch
                        value={filters.showFormSubmitted}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, showFormSubmitted: value }))}
                        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <View style={styles.filterOption}>
                      <Text style={styles.filterOptionText}>Show form not submitted</Text>
                      <Switch
                        value={filters.showFormNotSubmitted}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, showFormNotSubmitted: value }))}
                        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                )}

                {event?.pricing && !event.pricing.isFree && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Payment Status</Text>
                    <View style={styles.filterOption}>
                      <Text style={styles.filterOptionText}>Show paid attendees</Text>
                      <Switch
                        value={filters.showPaid}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, showPaid: value }))}
                        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <View style={styles.filterOption}>
                      <Text style={styles.filterOptionText}>Show unpaid attendees</Text>
                      <Switch
                        value={filters.showNotPaid}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, showNotPaid: value }))}
                        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.resetFiltersButton}
                  onPress={() => setFilters({
                    showCheckedIn: true,
                    showNotCheckedIn: true,
                    showFormSubmitted: true,
                    showFormNotSubmitted: true,
                    showPaid: true,
                    showNotPaid: true
                  })}
                >
                  <Text style={styles.resetFiltersText}>Reset All Filters</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ✅ UPDATED: Export Modal (only for managers) */}
      {canManage && (
        <Modal
          visible={showExportModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowExportModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.exportModal}>
              <View style={styles.exportHeader}>
                <Text style={styles.exportTitle}>Export Attendee Data</Text>
                <TouchableOpacity onPress={() => setShowExportModal(false)}>
                  <Ionicons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.exportContent}>
                <Text style={styles.exportDescription}>
                  Export attendee information including check-in status, payment status, and form responses.
                </Text>

                <View style={styles.exportSection}>
                  <Text style={styles.exportSectionTitle}>Export Format</Text>
                  
                  <TouchableOpacity
                    style={styles.exportOption}
                    onPress={handleExportCSV}
                    disabled={exportLoading}
                  >
                    <View style={styles.exportOptionContent}>
                      <Ionicons name="document-text" size={24} color="#34C759" />
                      <View style={styles.exportOptionText}>
                        <Text style={styles.exportOptionTitle}>CSV File</Text>
                        <Text style={styles.exportOptionDesc}>Download as spreadsheet file</Text>
                      </View>
                      <Ionicons name="download" size={20} color="#8E8E93" />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.exportOption}
                    onPress={handleExportGoogleSheets}
                    disabled={exportLoading}
                  >
                    <View style={styles.exportOptionContent}>
                      <Ionicons name="grid" size={24} color="#4285F4" />
                      <View style={styles.exportOptionText}>
                        <Text style={styles.exportOptionTitle}>Google Sheets</Text>
                        <Text style={styles.exportOptionDesc}>Export directly to Google Sheets</Text>
                      </View>
                      <Ionicons name="open" size={20} color="#8E8E93" />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.exportSection}>
                  <Text style={styles.exportSectionTitle}>Data Included</Text>
                  <View style={styles.dataIncludedList}>
                    <View style={styles.dataIncludedItem}>
                      <Ionicons name="person" size={16} color="#3797EF" />
                      <Text style={styles.dataIncludedText}>Contact information</Text>
                    </View>
                    <View style={styles.dataIncludedItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#3797EF" />
                      <Text style={styles.dataIncludedText}>Check-in status and timestamp</Text>
                    </View>
                    <View style={styles.dataIncludedItem}>
                      <Ionicons name="card" size={16} color="#3797EF" />
                      <Text style={styles.dataIncludedText}>Payment status</Text>
                    </View>
                    {event?.requiresFormForCheckIn && (
                      <View style={styles.dataIncludedItem}>
                        <Ionicons name="document-text" size={16} color="#3797EF" />
                        <Text style={styles.dataIncludedText}>Form responses</Text>
                      </View>
                    )}
                  </View>
                </View>

                {exportLoading && (
                  <View style={styles.exportLoading}>
                    <ActivityIndicator size="small" color="#3797EF" />
                    <Text style={styles.exportLoadingText}>Preparing export...</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* QR Modal */}
      <Modal
  visible={showQRModal}
  transparent={false}
  animationType="slide"
  onRequestClose={() => setShowQRModal(false)}
>
  <SafeAreaView style={styles.qrModalContainer}>
    <View style={styles.qrModalHeader}>
      <TouchableOpacity
        style={styles.qrCloseButton}
        onPress={() => setShowQRModal(false)}
      >
        <Ionicons name="close" size={28} color="#000000" />
      </TouchableOpacity>
      <Text style={styles.qrModalTitle}>Mass Check-in QR</Text>
      <TouchableOpacity
        style={styles.qrShareButton}
        onPress={handleShareQR}
      >
        <Ionicons name="share" size={24} color="#3797EF" />
      </TouchableOpacity>
    </View>

    <View style={styles.qrContentContainer}>
      {qrLoading ? (
        <View style={styles.qrLoadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.qrLoadingText}>Generating QR Code...</Text>
        </View>
      ) : qrData ? (
        <>
          <View style={styles.qrCodeContainer}>
            <QRCode
              value={JSON.stringify(qrData)} // Convert object to JSON string
              size={Math.min(SCREEN_WIDTH * 0.7, 280)}
              backgroundColor="white"
              color="black"
            />
          </View>
          
          <View style={styles.qrInfo}>
            <Text style={styles.qrEventTitle}>{event?.title}</Text>
            <Text style={styles.qrInstructions}>
              📱 Attendees: Point your camera at this QR code to check in automatically
            </Text>
            <Text style={styles.qrExpiry}>
              ⏰ {getTimeRemaining()}
            </Text>
            
            {event?.requiresFormForCheckIn && (
              <View style={styles.qrFormNotice}>
                <Ionicons name="document-text" size={16} color="#FF9500" />
                <Text style={styles.qrFormNoticeText}>Form required for check-in</Text>
              </View>
            )}
          </View>

          {/* QR Action Buttons */}
          <View style={styles.qrActionButtons}>
            <TouchableOpacity
              style={[styles.qrActionButton, styles.refreshButton]}
              onPress={handleRefreshQR}
            >
              <Ionicons name="refresh" size={20} color="#3797EF" />
              <Text style={styles.qrActionButtonText}>Refresh</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.qrActionButton, styles.fullscreenButton]}
              onPress={() => {
                setShowQRModal(false);
                navigation.navigate('EventQRDisplayScreen', {
                  eventId: eventId,
                  eventTitle: event?.title
                });
              }}
            >
              <Ionicons name="expand" size={20} color="#FFFFFF" />
              <Text style={[styles.qrActionButtonText, { color: '#FFFFFF' }]}>Full Screen</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.qrActionButton, styles.deactivateButton]}
              onPress={handleDeactivateQR}
            >
              <Ionicons name="stop-circle" size={20} color="#FFFFFF" />
              <Text style={[styles.qrActionButtonText, { color: '#FFFFFF' }]}>Stop</Text>
            </TouchableOpacity>
          </View>

          {/* Instructions for Camera App Usage */}
          <View style={styles.cameraInstructions}>
            <Text style={styles.cameraInstructionsTitle}>📷 Works with Camera App</Text>
            <Text style={styles.cameraInstructionsText}>
              This QR code works with any camera app! Attendees can:
              {'\n'}• Use their phone's camera app
              {'\n'}• Use this app's QR scanner
              {'\n'}• Scan from screenshots or printed copies
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.qrErrorContainer}>
          <Ionicons name="alert-circle" size={60} color="#FF6B6B" />
          <Text style={styles.qrErrorText}>Failed to generate QR code</Text>
          <TouchableOpacity
            style={styles.qrRetryButton}
            onPress={() => handleShowQR()}
          >
            <Text style={styles.qrRetryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </SafeAreaView>
</Modal>

      {/* Form Response Modal */}
      <Modal
        visible={showFormResponses}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFormResponses(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.formResponseModal}>
            <View style={styles.formResponseHeader}>
              <Text style={styles.formResponseTitle}>Form Responses</Text>
              <TouchableOpacity
                onPress={() => setShowFormResponses(false)}
              >
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            {formResponsesLoading ? (
              <View style={styles.formResponseLoading}>
                <ActivityIndicator size="large" color="#3797EF" />
              </View>
            ) : selectedUserResponses ? (
              <View style={styles.formResponseContent}>
                <View style={styles.formResponseUser}>
                  <Image
                    source={{
                      uri: selectedUserResponses.user.profilePicture
                        ? `http://${API_BASE_URL}:3000${selectedUserResponses.user.profilePicture}`
                        : 'https://placehold.co/40x40.png?text=👤'
                    }}
                    style={styles.formResponseUserAvatar}
                  />
                  <Text style={styles.formResponseUsername}>
                    {selectedUserResponses.user.username}
                  </Text>
                </View>

                {selectedUserResponses.submission ? (
                  <FlatList
                    data={selectedUserResponses.submission.responses}
                    keyExtractor={(item) => item.questionId}
                    renderItem={({ item }) => (
                      <View style={styles.responseItem}>
                        <Text style={styles.responseQuestion}>{item.questionText}</Text>
                        <Text style={styles.responseAnswer}>
                          {Array.isArray(item.answer) ? item.answer.join(', ') : item.answer}
                        </Text>
                      </View>
                    )}
                    style={styles.responsesList}
                  />
                ) : (
                  <View style={styles.noResponseContainer}>
                    <Ionicons name="document-outline" size={48} color="#C7C7CC" />
                    <Text style={styles.noResponseText}>No form submitted</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyList: {
    flexGrow: 1,
  },

  // Header
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  checkedInNumber: {
    color: '#34C759',
  },
  formNumber: {
    color: '#3797EF',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 16,
  },

  // Search and Filter
  searchFilterContainer: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
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
  bulkActionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkActionButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkRemoveButton: {
    backgroundColor: '#FF3B30',
  },
  bulkActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bulkRemoveText: {
    color: '#FFFFFF',
  },

  // Bulk Selection
  bulkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 8,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  selectedCount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Attendee Items
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
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
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  paidText: {
    fontSize: 10,
    color: '#34C759',
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#3797EF',
    fontWeight: '500',
  },

  // Host Actions
  hostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
  },
  checkInButton: {
    backgroundColor: '#E8F5E8',
  },
  checkedInButton: {
    backgroundColor: '#34C759',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  clearSearchButton: {
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearSearchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  // Export Modal
  exportModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  exportContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  exportDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginVertical: 16,
  },
  exportSection: {
    marginBottom: 24,
  },
  exportSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  exportOption: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  exportOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  exportOptionText: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  exportOptionDesc: {
    fontSize: 14,
    color: '#8E8E93',
  },
  dataIncludedList: {
    gap: 8,
  },
  dataIncludedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dataIncludedText: {
    fontSize: 14,
    color: '#000000',
  },
  exportLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  exportLoadingText: {
    fontSize: 14,
    color: '#3797EF',
  },

  // Filter Modal
  filterModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  filterOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  resetFiltersButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 20,
  },
  resetFiltersText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },

  // QR Modal
  qrModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  qrCloseButton: {
    padding: 4,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  qrShareButton: {
    padding: 4,
  },
  qrContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  qrLoadingContainer: {
    alignItems: 'center',
  },
  qrLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  qrCodeContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 32,
  },
  qrInfo: {
    alignItems: 'center',
  },
  qrEventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  qrInstructions: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  qrExpiry: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
    marginBottom: 16,
  },
  qrFormNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  qrFormNoticeText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  qrErrorContainer: {
    alignItems: 'center',
  },
  qrErrorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  qrModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  qrRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  qrRefreshButtonText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },

  // Form Response Modal
  formResponseModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  formResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  formResponseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  formResponseLoading: {
    padding: 40,
    alignItems: 'center',
  },
  formResponseContent: {
    flex: 1,
  },
  formResponseUser: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  formResponseUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  formResponseUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  responsesList: {
    flex: 1,
  },
  responseItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  responseQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  responseAnswer: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
  },
  noResponseContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResponseText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  qrActionButtons: {
  flexDirection: 'row',
  gap: 12,
  marginTop: 20,
  marginBottom: 20,
},
qrActionButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 12,
  gap: 6,
},
refreshButton: {
  backgroundColor: 'transparent',
  borderWidth: 2,
  borderColor: '#3797EF',
},
fullscreenButton: {
  backgroundColor: '#3797EF',
},
deactivateButton: {
  backgroundColor: '#FF6B6B',
},
qrActionButtonText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#3797EF',
},
cameraInstructions: {
  backgroundColor: '#F8F9FA',
  borderRadius: 12,
  padding: 16,
  marginTop: 10,
  maxWidth: SCREEN_WIDTH * 0.85,
},
cameraInstructionsTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  marginBottom: 8,
},
cameraInstructionsText: {
  fontSize: 14,
  color: '#666',
  lineHeight: 20,
},
qrErrorContainer: {
  alignItems: 'center',
  paddingVertical: 40,
},
qrErrorText: {
  fontSize: 18,
  color: '#333',
  marginTop: 15,
  marginBottom: 20,
},
qrRetryButton: {
  backgroundColor: '#3797EF',
  paddingHorizontal: 25,
  paddingVertical: 12,
  borderRadius: 25,
},
qrRetryButtonText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '600',
},
});