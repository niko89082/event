// SocialApp/components/EventCard.js - FIXED: Make entire card tappable
import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventCard({
  event,
  currentUserId,
  navigation,
  onAttend,
  compact = false,
  showRecommendationReason = false,
}) {
  const [localAttending, setLocalAttending] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);

  // Event details
  const cover = event.coverImage ? `http://${API_BASE_URL}:3000${event.coverImage}` : null;
  const past = new Date(event.time) <= new Date();
  const isAttending = event.attendees?.some(a => 
    (typeof a === 'string' ? a : a._id) === currentUserId
  ) || localAttending;
  const isHost = (event.host?._id || event.host) === currentUserId;
  const canAttend = !past && !isHost && !isAttending && !joinRequestSent;

  // FIXED: Main card press handler - navigate to event details
  const handleCardPress = () => {
    // Navigate to EventDetailsScreen with the correct route name
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  // FIXED: Separate handler for attend button to prevent event bubbling
  const handleAttendPress = async (e) => {
    e.stopPropagation(); // Prevent card press when tapping attend button
    
    if (!onAttend) return;

    try {
      if (event.permissions?.canJoin === 'approval-required') {
        // Join request flow
        await onAttend({
          type: 'request',
          eventId: event._id,
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

  // FIXED: Separate handler for share button
  const handleSharePress = (e) => {
    e.stopPropagation(); // Prevent card press when sharing
    // Add share functionality here
    Alert.alert('Share', 'Share functionality coming soon!');
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
      onPress={handleCardPress} 
      activeOpacity={0.95}
    >
      {/* Cover Image with Gradient Overlay */}
      <View style={[styles.imageContainer, compact && styles.compactImageContainer]}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.coverImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="calendar-outline" size={40} color="#C7C7CC" />
          </View>
        )}
        
        {/* Gradient overlay for better text visibility */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          style={styles.gradient}
        />

        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.monthText}>{month}</Text>
          <Text style={styles.dayText}>{day}</Text>
        </View>

        {/* Privacy Badge */}
        {renderPrivacyBadge()}

        {/* Recommendation Badge */}
        {renderRecommendationBadge()}

        {/* Weather Badge */}
        {renderWeatherIndicator()}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title and Category */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={compact ? 1 : 2}>
            {event.title}
          </Text>
          {event.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <Text style={styles.detailText}>{time}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#8E8E93" />
            <Text style={styles.detailText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        </View>

        {/* Attendees and Price */}
        <View style={styles.statsRow}>
          <View style={styles.attendeesInfo}>
            <View style={styles.attendeesAvatars}>
              {/* Show first few attendee avatars */}
              {event.attendees?.slice(0, 3).map((attendee, index) => (
                <Image
                  key={index}
                  source={{
                    uri: attendee.profilePicture
                      ? `http://${API_BASE_URL}:3000${attendee.profilePicture}`
                      : 'https://placehold.co/24x24.png?text=👤'
                  }}
                  style={[styles.attendeeAvatar, { marginLeft: index > 0 ? -6 : 0 }]}
                />
              ))}
            </View>
            <Text style={styles.attendeesText}>
              {attendeesCount} going
              {spotsLeft && <Text style={styles.spotsLeft}> • {spotsLeft} spots left</Text>}
            </Text>
          </View>

          {/* Price */}
          {event.price > 0 && (
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>
                ${event.price}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {!past && (
          <View style={styles.actionRow}>
            {canAttend ? (
              <TouchableOpacity
                style={styles.attendButton}
                onPress={handleAttendPress}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3797EF', '#3797EF']}
                  style={styles.attendButtonGradient}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.attendButtonText}>
                    {event.permissions?.canJoin === 'approval-required' ? 'Request' : 'Join'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : isAttending ? (
              <View style={styles.attendingBadge}>
                <Ionicons name="checkmark" size={16} color="#34C759" />
                <Text style={styles.attendingText}>Attending</Text>
              </View>
            ) : isHost ? (
              <View style={styles.hostBadge}>
                <Ionicons name="star" size={16} color="#FF9500" />
                <Text style={styles.hostText}>Hosting</Text>
              </View>
            ) : (
              <View style={styles.privateEventBadge}>
                <Ionicons name="lock-closed" size={16} color="#8E8E93" />
                <Text style={styles.privateEventText}>Private</Text>
              </View>
            )}

            <TouchableOpacity 
              onPress={handleSharePress} 
              style={styles.shareButton} 
              activeOpacity={0.8}
            >
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
  },
  dayText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },

  // Badges
  privacyBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 4,
  },
  weatherBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherText: {
    fontSize: 10,
    color: '#FF9500',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Content
  content: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginRight: 8,
    lineHeight: 22,
  },
  categoryBadge: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
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

  // Actions
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendButton: {
    flex: 1,
    marginRight: 12,
  },
  attendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  attendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  attendingBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginRight: 12,
  },
  attendingText: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  hostBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    marginRight: 12,
  },
  hostText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  privateEventBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    marginRight: 12,
  },
  privateEventText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pastEventIndicator: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pastEventText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
});