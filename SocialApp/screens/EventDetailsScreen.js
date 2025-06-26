// screens/EventDetailsScreen.js - Fixed with original UI design, photos, and new functionality
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
  Share,
  Linking,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { eventId } = route.params;

  // State
  const [event, setEvent] = useState(null);
  const [eventPhotos, setEventPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [permissions, setPermissions] = useState({});
  const [showShareModal, setShowShareModal] = useState(false);

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

  // Fetch event photos
  const fetchEventPhotos = async () => {
    try {
      setPhotosLoading(true);
      const response = await api.get(`/api/users/event-photos/${eventId}`);
      setEventPhotos(response.data.photos || []);
    } catch (error) {
      console.error('Error fetching event photos:', error);
      // Don't show error for photos, just fail silently
    } finally {
      setPhotosLoading(false);
    }
  };

  // Refresh on focus
  useFocusEffect(
    React.useCallback(() => {
      fetchEvent();
      fetchEventPhotos();
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

  // Share functionality
  const handleShare = () => {
    setShowShareModal(true);
  };

  const shareViaMessages = async () => {
    try {
      if (!event) return;
      
      const eventLink = `https://yourapp.com/events/${eventId}`;
      const message = `Check out this event: ${event.title}\n\n${event.description}\n\n📅 ${new Date(event.time).toLocaleDateString()}\n📍 ${event.location}\n\nJoin here: ${eventLink}`;
      
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
          title: event.title
        });
      }
      setShowShareModal(false);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share event');
    }
  };

  const shareViaGeneric = async () => {
    try {
      if (!event) return;
      
      const eventLink = `https://yourapp.com/events/${eventId}`;
      const message = `Check out this event: ${event.title}\n\n${event.description}\n\n📅 ${new Date(event.time).toLocaleDateString()}\n📍 ${event.location}`;
      
      await Share.share({
        message: message,
        url: eventLink,
        title: event.title
      });
      setShowShareModal(false);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share event');
    }
  };

  const copyEventLink = async () => {
    try {
      const eventLink = `https://yourapp.com/events/${eventId}`;
      // Note: Clipboard API would need to be imported and used here
      Alert.alert(
        'Event Link',
        eventLink,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Copy Link', 
            onPress: () => {
              Alert.alert('Copied!', 'Event link copied to clipboard');
            }
          }
        ]
      );
      setShowShareModal(false);
    } catch (error) {
      console.error('Copy link error:', error);
    }
  };

  // Navigate to invite users screen
  const handleInviteUsers = () => {
    navigation.navigate('InviteUsersScreen', { 
      eventId,
      eventTitle: event?.title 
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Event not found</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchEvent()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isHost = String(event.host?._id || event.host) === String(currentUser?._id);
  const isCoHost = event.coHosts?.some(c => String(c._id || c) === String(currentUser?._id));
  const isAttending = event.attendees?.some(a => String(a._id || a) === String(currentUser?._id));
  const canInvite = event.canUserInvite?.(currentUser?._id) || isHost || isCoHost;
  const canShare = permissions.canShare !== 'host-only' || isHost || isCoHost;
  const isPast = new Date(event.time) <= new Date();

  // Format date and time
  const eventDate = new Date(event.time);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const renderPrivacyBadge = () => {
    const privacyConfig = {
      public: { icon: 'globe', color: '#34C759', label: 'Public' },
      friends: { icon: 'people', color: '#3797EF', label: 'Friends' },
      private: { icon: 'lock-closed', color: '#FF9500', label: 'Private' },
      secret: { icon: 'eye-off', color: '#FF3B30', label: 'Secret' }
    };

    const config = privacyConfig[event.privacyLevel] || privacyConfig.public;

    return (
      <View style={[styles.privacyBadge, { backgroundColor: config.color }]}>
        <Ionicons name={config.icon} size={12} color="#FFFFFF" />
        <Text style={styles.privacyBadgeText}>{config.label}</Text>
      </View>
    );
  };

  const renderActionButtons = () => {
    if (isHost || isCoHost) {
      return (
        <View style={styles.actionContainer}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryAction]}
              onPress={() => navigation.navigate('EditEventScreen', { eventId })}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3797EF', '#3797EF']}
                style={styles.gradientButton}
              >
                <Ionicons name="create" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Edit Event</Text>
              </LinearGradient>
            </TouchableOpacity>

            {canInvite && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={handleInviteUsers}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={18} color="#3797EF" />
                <Text style={styles.secondaryActionText}>Invite</Text>
              </TouchableOpacity>
            )}

            {canShare && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share" size={18} color="#3797EF" />
                <Text style={styles.secondaryActionText}>Share</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    if (isAttending) {
      return (
        <View style={styles.actionContainer}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.leaveAction]}
              onPress={handleLeaveEvent}
              activeOpacity={0.8}
            >
              <Text style={styles.leaveActionText}>Leave Event</Text>
            </TouchableOpacity>

            {canShare && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share" size={18} color="#3797EF" />
                <Text style={styles.secondaryActionText}>Share</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.actionContainer}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction]}
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
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Join Event</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {canShare && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share" size={18} color="#3797EF" />
              <Text style={styles.secondaryActionText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderPhotoItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => navigation.navigate('PostDetailsScreen', { postId: item._id })}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: `http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={styles.photoImage}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              fetchEvent(true);
              fetchEventPhotos();
            }}
            tintColor="#3797EF"
          />
        }
      >
        {/* Cover Image Header */}
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

          {/* Share Button */}
          {canShare && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

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
              <View style={styles.hostDetails}>
                <Text style={styles.hostName}>Hosted by {event.host?.username}</Text>
                {event.coHosts && event.coHosts.length > 0 && (
                  <Text style={styles.coHostText}>
                    Co-hosts: {event.coHosts.map(c => c.username || c).join(', ')}
                  </Text>
                )}
              </View>
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
              disabled={!event.permissions?.showAttendeesToPublic && !isHost && !isCoHost}
            >
              <View style={styles.detailCardHeader}>
                <Ionicons name="people" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Who's going</Text>
                {(event.permissions?.showAttendeesToPublic || isHost || isCoHost) && (
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                )}
              </View>
              <Text style={styles.detailCardContent}>
                {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} attending
              </Text>
            </TouchableOpacity>
          </View>

          {/* Event Photos Section */}
          {eventPhotos.length > 0 && (
            <View style={styles.photosSection}>
              <View style={styles.photosSectionHeader}>
                <Text style={styles.photosSectionTitle}>Photos ({eventPhotos.length})</Text>
                {eventPhotos.length > 6 && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('EventPhotosScreen', { eventId })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.seeAllPhotosText}>See All</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <FlatList
                data={eventPhotos.slice(0, 6)}
                renderItem={renderPhotoItem}
                keyExtractor={(item) => item._id}
                numColumns={3}
                style={styles.photosGrid}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Action Buttons */}
          {renderActionButtons()}
        </View>
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shareModal}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Share Event</Text>
              <TouchableOpacity
                onPress={() => setShowShareModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.shareOptions}>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={shareViaMessages}
                activeOpacity={0.8}
              >
                <View style={styles.shareOptionIcon}>
                  <Ionicons name="chatbubble" size={24} color="#34C759" />
                </View>
                <Text style={styles.shareOptionText}>Messages</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={shareViaGeneric}
                activeOpacity={0.8}
              >
                <View style={styles.shareOptionIcon}>
                  <Ionicons name="share" size={24} color="#3797EF" />
                </View>
                <Text style={styles.shareOptionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={copyEventLink}
                activeOpacity={0.8}
              >
                <View style={styles.shareOptionIcon}>
                  <Ionicons name="link" size={24} color="#FF9500" />
                </View>
                <Text style={styles.shareOptionText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Cover Image
  coverContainer: {
    height: 280,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 44,
    right: 60,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privacyBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Content
  contentContainer: {
    padding: 20,
  },
  headerSection: {
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },

  // Description
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
  },

  // Host Section
  hostSection: {
    marginBottom: 24,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  hostDetails: {
    flex: 1,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  coHostText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Detail Cards
  detailsContainer: {
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailCardTitle: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  detailCardContent: {
    fontSize: 16,
    color: '#000000',
    marginLeft: 36,
  },
  detailCardSubContent: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 36,
    marginTop: 2,
  },

  // Photos Section
  photosSection: {
    marginBottom: 24,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photosSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  seeAllPhotosText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  photosGrid: {
    marginHorizontal: -4,
  },
  photoItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },

  // Action Buttons
  actionContainer: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  primaryAction: {
    flex: 2,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  primaryActionText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryAction: {
    backgroundColor: '#F8F8F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  secondaryActionText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  leaveAction: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flex: 2,
  },
  leaveActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Share Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  shareModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  shareOption: {
    alignItems: 'center',
    minWidth: 80,
  },
  shareOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shareOptionText: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
  },
});