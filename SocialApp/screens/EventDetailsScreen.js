// screens/EventDetailsScreen.js - Updated with host edit functionality and scan features
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { eventId } = route.params;

  // State
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [permissions, setPermissions] = useState({});

  // Fetch event details
  const fetchEvent = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(`/api/events/${eventId}`);
      const eventData = response.data;
      
      setEvent(eventData);
      setAttendeeCount(eventData.attendees?.length || 0);
      setPermissions(eventData.permissions || {});

    } catch (error) {
      console.error('Error fetching event:', error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh on focus
  useFocusEffect(
    React.useCallback(() => {
      fetchEvent();
    }, [eventId])
  );

  // Handle join request
  const handleJoinRequest = async () => {
    if (!event) return;

    try {
      setRequestLoading(true);

      if (event.permissions?.canJoin === 'approval-required') {
        setShowRequestModal(true);
      } else {
        await api.post(`/api/events/attend/${eventId}`);
        Alert.alert('Success', 'You\'re now attending this event!');
        fetchEvent(); // Refresh to show updated state
      }
    } catch (error) {
      console.error('Join request error:', error);
      const message = error.response?.data?.message || 'Failed to join event';
      Alert.alert('Error', message);
    } finally {
      setRequestLoading(false);
    }
  };

  // Handle leave event
  const handleLeaveEvent = async () => {
    Alert.alert(
      'Leave Event',
      'Are you sure you want to leave this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/events/attend/${eventId}`);
              Alert.alert('Success', 'You have left the event');
              fetchEvent();
            } catch (error) {
              Alert.alert('Error', 'Failed to leave event');
            }
          }
        }
      ]
    );
  };

  // Send join request with approval
  const sendJoinRequest = async () => {
    try {
      await api.post(`/api/events/join-request/${eventId}`, {
        message: 'Would like to join this event'
      });
      setShowRequestModal(false);
      Alert.alert('Request Sent', 'Your join request has been sent to the host');
    } catch (error) {
      Alert.alert('Error', 'Failed to send join request');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Helper functions for formatting
  const formattedDate = new Date(event.time).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(event.time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Check user relationships
  const isHost = event.userRelation?.isHost || String(event.host?._id) === String(currentUser?._id);
  const isCoHost = event.userRelation?.isCoHost;
  const isAttending = event.userRelation?.isAttending;
  
  // Event is considered over 3 hours after start time
  const eventEndTime = new Date(event.time).getTime() + (3 * 60 * 60 * 1000); // 3 hours after start
  const isPast = Date.now() > eventEndTime;

  // Join Request Modal Component
  const RequestModal = () => (
    <Modal
      visible={showRequestModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowRequestModal(false)}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Request to Join</Text>
          <Text style={styles.modalText}>
            This event requires approval from the host.
            Your request will be sent to the event host.
          </Text>
          
          <View style={styles.eventPreview}>
            <Text style={styles.eventPreviewTitle}>{event?.title}</Text>
            <Text style={styles.eventPreviewDate}>
              {new Date(event?.time).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowRequestModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSendButton}
              onPress={sendJoinRequest}
            >
              <Text style={styles.modalSendText}>Send Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Privacy Badge Component
  const renderPrivacyBadge = () => {
    if (!event?.privacyLevel || event.privacyLevel === 'public') return null;

    const badges = {
      friends: { icon: 'people', text: 'Friends Only', color: '#34C759' },
      private: { icon: 'lock-closed', text: 'Private', color: '#FF9500' },
      secret: { icon: 'eye-off', text: 'Secret', color: '#FF3B30' }
    };

    const badge = badges[event.privacyLevel];
    if (!badge) return null;

    return (
      <View style={[styles.privacyBadge, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon} size={12} color="#FFFFFF" />
        <Text style={styles.privacyBadgeText}>{badge.text}</Text>
      </View>
    );
  };

  // Action Button Component
  const renderActionButton = () => {
    if (!event) return null;

    if (isPast) {
      return (
        <View style={styles.actionContainer}>
          <Text style={styles.pastEventText}>This event has ended</Text>
        </View>
      );
    }

    if (isHost || isCoHost) {
      return (
        <View style={styles.actionContainer}>
          <View style={styles.hostActions}>
            {/* Check-In Button - Only for Hosts */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('QrScanScreen', { eventId })}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3797EF', '#3797EF']}
                style={styles.gradientButton}
              >
                <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Scan Check-In</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Invite Button */}
            {permissions.invite && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('InviteUsersScreen', { eventId })}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={20} color="#3797EF" />
                <Text style={styles.secondaryButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Regular attendee actions
    if (isAttending) {
      return (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveEvent}
            activeOpacity={0.8}
          >
            <Text style={styles.leaveButtonText}>Leave Event</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Non-attendee actions
    return (
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={handleJoinRequest}
          disabled={requestLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#3797EF', '#3797EF']}
            style={styles.gradientButton}
          >
            {requestLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.joinButtonText}>Join Event</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchEvent(true)}
            tintColor="#3797EF"
          />
        }
      >
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          {event.coverImage ? (
            <Image
              source={{ uri: `http://${API_BASE_URL}:3000${event.coverImage}` }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.coverImage}
            />
          )}
          
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Edit Button for Host (Top Right) */}
          {(isHost || isCoHost) && !isPast && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditEventScreen', { eventId })}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Privacy Badge */}
          {renderPrivacyBadge()}
        </View>

        {/* Event Information */}
        <View style={styles.contentContainer}>
          {/* Title and Category */}
          <View style={styles.headerSection}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          )}

          {/* Host Information */}
          <View style={styles.hostSection}>
            <TouchableOpacity
              style={styles.hostInfo}
              onPress={() => navigation.navigate('ProfileScreen', { userId: event.host?._id })}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri: event.host?.profilePicture
                    ? `http://${API_BASE_URL}:3000${event.host.profilePicture}`
                    : 'https://placehold.co/32x32.png?text=👤'
                }}
                style={styles.hostAvatar}
              />
              <Text style={styles.hostName}>Hosted by {event.host?.username}</Text>
            </TouchableOpacity>
          </View>

          {/* Event Details Cards */}
          <View style={styles.detailsContainer}>
            {/* Date & Time Card */}
            <View style={styles.detailCard}>
              <View style={styles.detailCardHeader}>
                <Ionicons name="calendar" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>When</Text>
              </View>
              <Text style={styles.detailCardContent}>{formattedDate}</Text>
              <Text style={styles.detailCardSubContent}>{formattedTime}</Text>
            </View>

            {/* Location Card */}
            <View style={styles.detailCard}>
              <View style={styles.detailCardHeader}>
                <Ionicons name="location" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Where</Text>
              </View>
              <Text style={styles.detailCardContent}>{event.location}</Text>
            </View>

            {/* Attendees Card */}
            <TouchableOpacity 
              style={styles.detailCard}
              onPress={() => navigation.navigate('AttendeeListScreen', { eventId })}
              activeOpacity={0.8}
              disabled={!event.permissions?.showAttendeesToPublic && !isHost}
            >
              <View style={styles.detailCardHeader}>
                <Ionicons name="people" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Who's going</Text>
                {(event.permissions?.showAttendeesToPublic || isHost) && (
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                )}
              </View>
              <Text style={styles.detailCardContent}>
                {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} attending
              </Text>
              {event.maxAttendees && (
                <Text style={styles.detailCardSubContent}>
                  {event.maxAttendees - attendeeCount} spots remaining
                </Text>
              )}
            </TouchableOpacity>

            {/* Price Card (if event has price) */}
            {event.price > 0 && (
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="card" size={24} color="#3797EF" />
                  <Text style={styles.detailCardTitle}>Price</Text>
                </View>
                <Text style={styles.detailCardContent}>
                  ${event.price}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      {renderActionButton()}

      {/* Request Modal */}
      <RequestModal />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  goBackText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
  },
  coverContainer: {
    position: 'relative',
    height: 300,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyBadge: {
    position: 'absolute',
    top: 100,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  editButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100,
  },
  headerSection: {
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    lineHeight: 34,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  descriptionSection: {
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  hostSection: {
    marginBottom: 24,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8, // Square with curved edges
    marginRight: 12,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  detailsContainer: {
    gap: 16,
  },
  detailCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },
  detailCardContent: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  detailCardSubContent: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 34,
  },
  hostActions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '500',
  },
  joinButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  pastEventText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 34,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  eventPreview: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  eventPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  eventPreviewDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
  },
  modalSendButton: {
    flex: 1,
    backgroundColor: '#3797EF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSendText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});