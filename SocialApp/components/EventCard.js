// components/EventCard.js - Enhanced with Privacy System Integration
import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventCard({ 
  event, 
  currentUserId, 
  navigation, 
  onAttend,
  compact = false,
  showRecommendationReason = false
}) {
  const [localAttending, setLocalAttending] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    if (event && currentUserId) {
      setLocalAttending(event.attendees?.includes(currentUserId) || false);
      setJoinRequestSent(event.joinRequests?.some(jr => jr.user === currentUserId) || false);
      checkPermissions();
    }
  }, [event, currentUserId]);

  const checkPermissions = async () => {
    try {
      const { data } = await api.get(`/api/events/${event._id}/permissions/join`);
      setPermissions({ canJoin: data.allowed });
    } catch (error) {
      console.log('Permission check failed:', error);
      setPermissions({ canJoin: false });
    }
  };

  const past = Date.now() > new Date(event.time).getTime();
  const isHost = String(event.host?._id) === String(currentUserId);

  const cover = event.coverImage
    ? (event.coverImage.startsWith('http')
        ? event.coverImage
        : `http://${API_BASE_URL}:3000${event.coverImage}`)
    : null;

  const openDetail = () =>
    navigation.navigate('EventDetailsScreen', { eventId: event._id });

  const share = () =>
    navigation.navigate('SelectChatScreen', { 
      shareType: 'event', 
      shareId: event._id 
    });

  const handleAttendPress = async () => {
    if (past) return;
    
    try {
      if (event.permissions?.canJoin === 'approval-required') {
        // Send join request
        await api.post(`/api/events/join-request/${event._id}`, { 
          message: 'I would like to join this event.' 
        });
        setJoinRequestSent(true);
        Alert.alert('Request Sent', 'Your join request has been sent to the event host.');
      } else {
        // Direct attendance
        await onAttend(event);
        setLocalAttending(true);
      }
    } catch (error) {
      console.error('Attend error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Unable to join event');
    }
  };

  // Format date
  const eventDate = new Date(event.time);
  const month = eventDate.toLocaleDateString('en', { month: 'short' }).toUpperCase();
  const day = eventDate.getDate();
  const time = eventDate.toLocaleTimeString('en', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  // Calculate attendees info
  const attendeesCount = event.attendees?.length || 0;
  const maxAttendees = event.maxAttendees;
  const spotsLeft = maxAttendees ? maxAttendees - attendeesCount : null;

  // Privacy badge
  const renderPrivacyBadge = () => {
    if (!event.privacyLevel || event.privacyLevel === 'public') return null;

    const badges = {
      friends: { icon: 'people', color: '#34C759' },
      private: { icon: 'lock-closed', color: '#FF9500' },
      secret: { icon: 'eye-off', color: '#FF3B30' }
    };

    const badge = badges[event.privacyLevel];
    if (!badge) return null;

    return (
      <View style={[styles.privacyBadge, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon} size={12} color="#FFFFFF" />
      </View>
    );
  };

  // Recommendation reason badge
  const renderRecommendationBadge = () => {
    if (!showRecommendationReason || !event.recommendationReason) return null;

    const getReasonIcon = (reason) => {
      if (reason.includes('interest')) return 'heart';
      if (reason.includes('location')) return 'location';
      if (reason.includes('weather')) return 'partly-sunny';
      if (reason.includes('friend')) return 'people';
      return 'star';
    };

    return (
      <View style={styles.recommendationBadge}>
        <Ionicons 
          name={getReasonIcon(event.recommendationReason)} 
          size={12} 
          color="#3797EF" 
        />
        <Text style={styles.recommendationText}>
          {event.recommendationReason}
        </Text>
      </View>
    );
  };

  // Weather indicator
  const renderWeatherIndicator = () => {
    if (!event.weatherDependent) return null;

    return (
      <View style={styles.weatherBadge}>
        <Ionicons name="partly-sunny-outline" size={12} color="#FF9500" />
        <Text style={styles.weatherText}>Weather Dependent</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={[styles.card, compact && styles.compactCard]} 
      onPress={openDetail} 
      activeOpacity={0.95}
    >
      {/* Cover Image with Gradient Overlay */}
      <View style={[styles.imageContainer, compact && styles.compactImageContainer]}>
        {cover ? (
          <>
            <Image source={{ uri: cover }} style={styles.coverImage} />
            <View style={styles.gradient} />
          </>
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="calendar-outline" size={compact ? 30 : 40} color="#C7C7CC" />
          </View>
        )}
        
        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.monthText}>{month}</Text>
          <Text style={styles.dayText}>{day}</Text>
        </View>

        {/* Privacy Badge */}
        {renderPrivacyBadge()}

        {/* Weather Indicator */}
        {renderWeatherIndicator()}

        {/* Host Info Overlay */}
        <View style={styles.hostOverlay}>
          <Image
            source={{ 
              uri: event.host?.profilePicture 
                ? `http://${API_BASE_URL}:3000${event.host.profilePicture}`
                : 'https://placehold.co/24x24.png?text=👤'
            }}
            style={styles.hostAvatar}
          />
          <Text style={styles.hostName}>by {event.host?.username}</Text>
        </View>

        {/* Recommendation Badge */}
        {renderRecommendationBadge()}
      </View>

      {/* Event Info */}
      <View style={[styles.infoContainer, compact && styles.compactInfoContainer]}>
        {/* Title and Category */}
        <View style={styles.titleRow}>
          <Text 
            style={[styles.title, compact && styles.compactTitle]} 
            numberOfLines={compact ? 1 : 2}
          >
            {event.title}
          </Text>
          {event.category && !compact && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
          )}
        </View>

        {/* Time and Location */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <Text style={styles.detailText}>{time}</Text>
          </View>
          {!compact && (
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={16} color="#8E8E93" />
              <Text style={styles.detailText} numberOfLines={1}>{event.location}</Text>
            </View>
          )}
        </View>

        {/* Attendees and Price Info */}
        <View style={styles.statsRow}>
          <View style={styles.attendeesInfo}>
            <View style={styles.attendeesAvatars}>
              {/* Show up to 3 attendee avatars */}
              {event.attendees?.slice(0, 3).map((attendeeId, index) => (
                <View key={attendeeId} style={[styles.attendeeAvatar, { marginLeft: index * -8 }]}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>👤</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.attendeesText}>
              {attendeesCount} going
              {spotsLeft !== null && spotsLeft < 10 && (
                <Text style={styles.spotsLeft}> • {spotsLeft} left</Text>
              )}
            </Text>
          </View>

          {event.price > 0 && (
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>${event.price}</Text>
            </View>
          )}
        </View>

        {/* Tags (for compact view) */}
        {compact && event.tags && event.tags.length > 0 && (
          <View style={styles.compactTagsContainer}>
            {event.tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.compactTag}>
                <Text style={styles.compactTagText}>#{tag}</Text>
              </View>
            ))}
            {event.tags.length > 2 && (
              <Text style={styles.moreTagsText}>+{event.tags.length - 2}</Text>
            )}
          </View>
        )}

        {/* Action Buttons */}
        {!past && (
          <View style={styles.actionRow}>
            {isHost ? (
              <View style={styles.hostBadge}>
                <Ionicons name="star" size={16} color="#FF9500" />
                <Text style={styles.hostBadgeText}>Host</Text>
              </View>
            ) : joinRequestSent ? (
              <View style={styles.requestSentBadge}>
                <Ionicons name="time" size={16} color="#FF9500" />
                <Text style={styles.requestSentBadgeText}>Requested</Text>
              </View>
            ) : localAttending ? (
              <View style={styles.attendingBadge}>
                <Ionicons name="checkmark" size={16} color="#34C759" />
                <Text style={styles.attendingBadgeText}>Going</Text>
              </View>
            ) : permissions.canJoin !== false ? (
              <TouchableOpacity
                style={styles.attendButton}
                onPress={handleAttendPress}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.attendButtonText}>
                  {event.permissions?.canJoin === 'approval-required' ? 'Request' : 'Join'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.privateEventBadge}>
                <Ionicons name="lock-closed" size={16} color="#8E8E93" />
                <Text style={styles.privateEventText}>Private</Text>
              </View>
            )}

            <TouchableOpacity onPress={share} style={styles.shareButton} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={18} color="#3797EF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Past event indicator */}
        {past && (
          <View style={styles.pastEventIndicator}>
            <Text style={styles.pastEventText}>Event ended</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  compactCard: {
    marginHorizontal: 8,
    marginBottom: 12,
    width: SCREEN_WIDTH * 0.8,
  },

  // Image Container
  imageContainer: {
    height: 200,
    position: 'relative',
  },
  compactImageContainer: {
    height: 140,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Date Badge
  dateBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  monthText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 2,
  },

  // Privacy Badge
  privacyBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  // Weather Badge
  weatherBadge: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  weatherText: {
    fontSize: 10,
    color: '#FF9500',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Recommendation Badge
  recommendationBadge: {
    position: 'absolute',
    top: 16,
    left: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recommendationText: {
    fontSize: 10,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Host Info
  hostOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hostName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Info Container
  infoContainer: {
    padding: 16,
  },
  compactInfoContainer: {
    padding: 12,
  },

  // Title
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    marginRight: 12,
    lineHeight: 22,
  },
  compactTitle: {
    fontSize: 16,
    lineHeight: 20,
  },
  categoryBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },

  // Details
  detailsRow: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  attendeesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attendeesAvatars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  attendeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 10,
  },
  attendeesText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  spotsLeft: {
    color: '#8E8E93',
    fontWeight: '400',
  },
  priceContainer: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Compact Tags
  compactTagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactTag: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  compactTagText: {
    fontSize: 10,
    color: '#3797EF',
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#3797EF',
    marginRight: 12,
  },
  attendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  attendingBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F0F9F0',
    borderWidth: 1,
    borderColor: '#34C759',
    marginRight: 12,
  },
  attendingBadgeText: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  requestSentBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FF9500',
    marginRight: 12,
  },
  requestSentBadgeText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  hostBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FF9500',
    marginRight: 12,
  },
  hostBadgeText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  privateEventBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    marginRight: 12,
  },
  privateEventText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pastEventIndicator: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  pastEventText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});