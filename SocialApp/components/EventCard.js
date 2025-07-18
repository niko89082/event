// components/EventCard.js - Updated with centralized state management
import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '@env';
import useEventStore from '../stores/eventStore'; // Import centralized store

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventCard({
  event: initialEvent,
  currentUserId,
  navigation,
  compact = false,
  showRecommendationReason = false,
  onAttend, // Keep for backward compatibility but won't use
}) {
  // Get event data and actions from centralized store
  const storeEvent = useEventStore(state => state.getEvent(initialEvent._id));
  const toggleRSVP = useEventStore(state => state.toggleRSVP);
  const confirmEventPayment = useEventStore(state => state.confirmEventPayment);

  // Use store data if available, otherwise fall back to initial event
  const event = storeEvent || initialEvent;

  // Initialize store with this event if not already there
  useEffect(() => {
    if (!storeEvent) {
      useEventStore.getState().addEvent(initialEvent, currentUserId);
    }
  }, [initialEvent._id, storeEvent, currentUserId]);

  // Local UI state for join request feedback
  const [joinRequestSent, setJoinRequestSent] = useState(
    event.joinRequestSent || false
  );
  const [processing, setProcessing] = useState(false);

  // Get current RSVP state from store (always up to date)
  const isAttending = event.isAttending || false;
  const attendeeCount = event.attendeeCount || 0;

  // Event details
  const cover = event.coverImage ? `http://${API_BASE_URL}:3000${event.coverImage}` : null;
  const past = new Date(event.time) <= new Date();
  const isHost = (event.host?._id || event.host) === currentUserId;
  const canAttend = !past && !isHost && !isAttending && !joinRequestSent;

  // CENTRALIZED RSVP HANDLING
  const handleAttendPress = async (e) => {
    e.stopPropagation(); // Prevent card press when tapping attend button
    
    if (!currentUserId) {
      Alert.alert('Error', 'Please log in to join events');
      return;
    }

    if (processing) return; // Prevent double taps

    try {
      setProcessing(true);
      const result = await toggleRSVP(event._id, currentUserId, event);
      
      if (result.type === 'request') {
        // Join request sent for approval-required events
        setJoinRequestSent(true);
        Alert.alert('Request Sent', 'Your join request has been sent to the event host.');
      } else if (result.type === 'payment_required') {
        // Handle payment required
        Alert.alert(
          'Payment Required', 
          `This event costs ${getFormattedPrice()}. You'll be redirected to payment.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: () => {
                // Navigate to event details for payment
                navigation.navigate('EventDetailsScreen', { eventId: event._id });
              }
            }
          ]
        );
      } else if (result.type === 'permission_denied') {
        Alert.alert('Access Denied', result.error);
      } else if (result.type === 'attend' && result.success) {
        // Successfully joined/left - no need for alert, UI already updated
        const message = result.attending ? 'Successfully joined the event!' : 'You have left the event.';
        console.log('✅ RSVP success:', message);
      } else if (!result.success) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('❌ RSVP error:', error);
      const errorMessage = error.response?.data?.message || 'Unable to join event';
      Alert.alert('Error', errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  // FIXED: Main card press handler - navigate to event details
  const handleCardPress = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  // FIXED: Separate handler for share button
  const handleSharePress = (e) => {
    e.stopPropagation(); // Prevent card press when sharing
    Alert.alert('Share', 'Share functionality coming soon!');
  };

  // Helper function to get formatted price
  const getFormattedPrice = () => {
    if (!event.pricing || event.pricing.isFree) return 'Free';
    
    // Check if early bird pricing is active
    if (event.pricing.earlyBirdPricing?.enabled && 
        event.pricing.earlyBirdPricing?.deadline && 
        new Date() < new Date(event.pricing.earlyBirdPricing.deadline)) {
      const earlyPrice = (event.pricing.earlyBirdPricing.amount / 100).toFixed(2);
      return `$${earlyPrice}`;
    }
    
    const regularPrice = (event.pricing.amount / 100).toFixed(2);
    return `$${regularPrice}`;
  };

  // Check if user has paid for this event
  const hasUserPaid = () => {
    if (!event.paymentHistory || !currentUserId) return false;
    
    return event.paymentHistory.some(payment => 
      payment.user && 
      String(payment.user) === String(currentUserId) && 
      payment.status === 'succeeded'
    );
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

  // Calculate attendees info - use store data
  const maxAttendees = event.maxAttendees;
  const spotsLeft = maxAttendees ? maxAttendees - attendeeCount : null;

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

  // Get button state for paid events
  const getAttendButtonInfo = () => {
    if (event.pricing && !event.pricing.isFree && !hasUserPaid()) {
      return {
        text: getFormattedPrice(),
        isPaid: true
      };
    }
    
    if (event.permissions?.canJoin === 'approval-required') {
      return {
        text: 'Request',
        isPaid: false
      };
    }
    
    return {
      text: 'Join',
      isPaid: false
    };
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
          <View style={styles.detailItem}>
          <Ionicons name="person-outline" size={16} color="#8E8E93" />
          <Text style={styles.detailText} numberOfLines={1}>
            {event.host?.username || 'Unknown Host'}
            {event.coHosts && event.coHosts.length > 0 && (
              <Text style={styles.coHostsText}> +{event.coHosts.length} cohost{event.coHosts.length > 1 ? 's' : ''}</Text>
            )}
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
              {attendeeCount} going
              {spotsLeft && <Text style={styles.spotsLeft}> • {spotsLeft} spots left</Text>}
            </Text>
          </View>

          {/* Price */}
          {event.pricing && !event.pricing.isFree && (
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>
                {getFormattedPrice()}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {!past && (
          <View style={styles.actionRow}>
            {canAttend ? (
              <TouchableOpacity
                style={[styles.attendButton, processing && styles.attendButtonDisabled]}
                onPress={handleAttendPress}
                activeOpacity={0.8}
                disabled={processing}
              >
                <LinearGradient
                  colors={['#3797EF', '#3797EF']}
                  style={styles.attendButtonGradient}
                >
                  {processing ? (
                    <ActivityIndicator size={16} color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.attendButtonText}>
                        {getAttendButtonInfo().text}
                      </Text>
                    </>
                  )}
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
            ) : joinRequestSent ? (
              <View style={styles.requestSentBadge}>
                <Ionicons name="time" size={16} color="#FF9500" />
                <Text style={styles.requestSentText}>Request Sent</Text>
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
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
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
  attendButtonDisabled: {
    opacity: 0.6,
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
  requestSentBadge: {
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
  requestSentText: {
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
  coHostsText: {
  color: '#8E8E93',
  fontWeight: '400',
  fontSize: 13,
},
});