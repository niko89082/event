// components/events/FeaturedEventCard.js - Large featured event card
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 227; // Reduced by another 10% from 252 (total 19% from original 280)
const CARD_HEIGHT = 259; // Reduced by another 10% from 288 (total 19% from original 320)

export default function FeaturedEventCard({ event, navigation, onPress }) {
  const handlePress = () => {
    if (onPress) {
      onPress(event);
    } else if (navigation) {
      navigation.navigate('EventDetailsScreen', { eventId: event._id });
    }
  };

  const coverImage = event.coverImage 
    ? `http://${API_BASE_URL}:3000${event.coverImage}` 
    : null;

  // Format date
  const eventDate = new Date(event.time);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  
  let timeLabel = '';
  if (eventDay.getTime() === today.getTime()) {
    timeLabel = 'TONIGHT';
  } else if (eventDay.getTime() === today.getTime() + 86400000) {
    timeLabel = 'TOMORROW';
  } else {
    const daysDiff = Math.floor((eventDay - today) / 86400000);
    if (daysDiff <= 7) {
      timeLabel = 'THIS WEEK';
    } else {
      timeLabel = eventDate.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toUpperCase();
    }
  }

  const time = eventDate.toLocaleTimeString('en', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  const attendeeCount = event.attendeeCount || event.attendees?.length || 0;
  const displayAttendees = event.attendees?.slice(0, 2) || [];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.95}
    >
      {coverImage ? (
        <Image
          source={{ uri: coverImage }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.backgroundImage, styles.placeholderBackground]}>
          <Ionicons name="calendar-outline" size={48} color="#C7C7CC" />
        </View>
      )}
      
      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      />

      {/* Featured Badge */}
      <View style={styles.featuredBadge}>
        <Ionicons name="star" size={14} color="#FBBF24" style={{ marginRight: 4 }} />
        <Text style={styles.featuredText}>Featured</Text>
      </View>

      {/* Bookmark Button */}
      <TouchableOpacity 
        style={styles.bookmarkButton}
        onPress={(e) => {
          e.stopPropagation();
          // TODO: Implement bookmark functionality
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="bookmark-outline" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.timeLabel}>{timeLabel} • {time}</Text>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.location} numberOfLines={1}>
          {event.location || 'Location TBD'}
        </Text>
        
        {/* Attendees */}
        <View style={styles.attendeesContainer}>
          <View style={styles.attendeesAvatars}>
            {displayAttendees.map((attendee, index) => (
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
            {attendeeCount > 2 && (
              <View style={[styles.attendeeAvatar, styles.moreAttendees]}>
                <Text style={styles.moreAttendeesText}>+{attendeeCount - 2}</Text>
              </View>
            )}
          </View>
          <Text style={styles.goingText}>going</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  placeholderBackground: {
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(12px)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  featuredText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(12px)',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  timeLabel: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 4,
  },
  location: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 12,
  },
  attendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attendeesAvatars: {
    flexDirection: 'row',
  },
  attendeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreAttendees: {
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#FFFFFF',
  },
  moreAttendeesText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  goingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
});

