import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with padding

const COLORS = {
  primary: '#607AFB',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  surface: '#FFFFFF',
  border: '#E5E7EB',
};

// Gradient colors for different categories
const CATEGORY_GRADIENTS = {
  'Music & Nightlife': ['#8B5CF6', '#6366F1'],
  'Food & Drink': ['#F97316', '#EC4899'],
  'Tech & Business': ['#3B82F6', '#1E40AF'],
  'Arts & Culture': ['#10B981', '#059669'],
  default: ['#6366F1', '#8B5CF6'],
};

export default function SearchEventCard({ event, onPress, API_BASE_URL, horizontal = false }) {
  const eventDate = event.time ? new Date(event.time) : null;
  const month = eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
  const day = eventDate ? eventDate.getDate() : '';
  
  const category = event.category || 'default';
  const gradientColors = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.default;
  
  const coverImage = event.coverImage 
    ? `http://${API_BASE_URL}${event.coverImage}`
    : null;

  // Get first few attendees for avatars
  const attendees = event.attendees || [];
  const firstAttendees = attendees.slice(0, 2);
  const attendeeCount = attendees.length;

  return (
    <TouchableOpacity 
      style={horizontal ? styles.containerHorizontal : styles.container}
      onPress={() => onPress(event)}
      activeOpacity={0.95}
    >
      {/* Event Card with Gradient Background */}
      <View style={styles.cardContainer}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.cardImage} />
        ) : (
          <LinearGradient
            colors={gradientColors}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        
        {/* Date Badge - Top Right */}
        {eventDate && (
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{month} {day}</Text>
          </View>
        )}
        
        {/* Location Tag - Bottom Left */}
        {event.location?.address && (
          <View style={styles.locationTag}>
            <Text style={styles.locationText} numberOfLines={1}>
              {event.location.address.split(',')[0]}
            </Text>
          </View>
        )}
      </View>
      
      {/* Event Title */}
      <Text style={styles.title} numberOfLines={1}>
        {event.title}
      </Text>
      
      {/* Social Context */}
      {attendeeCount > 0 && (
        <View style={styles.socialContext}>
          <View style={styles.avatarGroup}>
            {firstAttendees.map((attendee, idx) => (
              <Image
                key={idx}
                source={{ 
                  uri: attendee.profilePicture 
                    ? `http://${API_BASE_URL}${attendee.profilePicture}`
                    : `https://placehold.co/20x20/C7C7CC/FFFFFF?text=${attendee.username?.charAt(0) || '?'}`
                }}
                style={[styles.avatar, { marginLeft: idx > 0 ? -8 : 0 }]}
              />
            ))}
          </View>
          <Text style={styles.socialText}>
            {firstAttendees.length > 0 && firstAttendees[0].username 
              ? `${firstAttendees[0].username}${attendeeCount > 1 ? ` & ${attendeeCount - 1} other${attendeeCount > 2 ? 's' : ''}` : ''} going`
              : `${attendeeCount} going`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginBottom: 16,
    marginRight: 12,
  },
  containerHorizontal: {
    width: CARD_WIDTH,
    marginBottom: 0,
    marginRight: 12,
  },
  cardContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardGradient: {
    width: '100%',
    height: '100%',
  },
  dateBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '70%',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.surface,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  socialContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  socialText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

