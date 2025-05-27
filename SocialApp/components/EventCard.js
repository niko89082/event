import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventCard({ event, currentUserId, navigation, onAttend }) {
  const past = Date.now() > new Date(event.time).getTime();
  const attending = event.attendees?.includes(currentUserId);

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

  return (
    <TouchableOpacity style={styles.card} onPress={openDetail} activeOpacity={0.95}>
      {/* Cover Image with Gradient Overlay */}
      <View style={styles.imageContainer}>
        {cover ? (
          <>
            <Image source={{ uri: cover }} style={styles.coverImage} />
            <View style={styles.gradient} />
          </>
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="calendar-outline" size={40} color="#C7C7CC" />
          </View>
        )}
        
        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.monthText}>{month}</Text>
          <Text style={styles.dayText}>{day}</Text>
        </View>

        {/* Private Event Badge */}
        {!event.isPublic && (
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
            <Text style={styles.privateText}>Private</Text>
          </View>
        )}

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
      </View>

      {/* Event Info */}
      <View style={styles.infoContainer}>
        {/* Title and Category */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
          {event.category && (
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
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#8E8E93" />
            <Text style={styles.detailText} numberOfLines={1}>{event.location}</Text>
          </View>
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
              {spotsLeft !== null && (
                <Text style={styles.spotsLeft}> • {spotsLeft} spots left</Text>
              )}
            </Text>
          </View>

          {event.price > 0 && (
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>${event.price}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {!past && (
            <TouchableOpacity
              style={[
                styles.attendButton,
                attending ? styles.attendingButton : styles.notAttendingButton
              ]}
              onPress={() => onAttend?.(event)}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={attending ? "checkmark" : "add"} 
                size={16} 
                color={attending ? "#34C759" : "#FFFFFF"} 
              />
              <Text style={[
                styles.attendButtonText,
                attending ? styles.attendingButtonText : styles.notAttendingButtonText
              ]}>
                {attending ? 'Going' : 'Attend'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={share} style={styles.shareButton} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={18} color="#3797EF" />
          </TouchableOpacity>
        </View>
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },

  // Image Container
  imageContainer: {
    height: 200,
    position: 'relative',
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

  // Private Badge
  privateBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  privateText: {
    color: '#FFFFFF',
    fontSize: 12,
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
    borderRadius: 12,
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
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    marginRight: 12,
  },
  notAttendingButton: {
    backgroundColor: '#3797EF',
  },
  attendingButton: {
    backgroundColor: '#F0F9F0',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  attendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  notAttendingButtonText: {
    color: '#FFFFFF',
  },
  attendingButtonText: {
    color: '#34C759',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});