// components/MinimalEventCard.js - Phase 1: Minimal event card for category search
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MinimalEventCard({ event, onPress, currentUserId }) {
  // Format date and time
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const timeString = date.toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    // If today, just show time
    if (eventDate.getTime() === today.getTime()) {
      return `Today, ${timeString}`;
    }
    
    // If tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (eventDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow, ${timeString}`;
    }
    
    // If this week
    const daysDiff = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 0 && daysDiff < 7) {
      const dayName = date.toLocaleDateString([], { weekday: 'short' });
      return `${dayName}, ${timeString}`;
    }
    
    // Otherwise show month and day
    const monthDay = date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${monthDay}, ${timeString}`;
  };

  // Truncate text helper
  const truncateText = (text, maxLength) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Get privacy indicator
  const getPrivacyIndicator = () => {
    if (event.privacyLevel === 'private') {
      return <Ionicons name="lock-closed" size={14} color="#8E8E93" style={styles.privacyIcon} />;
    }
    if (event.privacyLevel === 'friends') {
      return <Ionicons name="people" size={14} color="#8E8E93" style={styles.privacyIcon} />;
    }
    return null;
  };

  // Check if user is attending
  const isUserAttending = event.attendees && event.attendees.some(
    attendee => (typeof attendee === 'string' ? attendee : attendee._id) === currentUserId
  );

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onPress(event)}
      activeOpacity={0.7}
    >
      {/* Event Image or Category Icon */}
      <View style={styles.imageContainer}>
        {event.coverImage ? (
          <Image 
            source={{ uri: event.coverImage }} 
            style={styles.eventImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons 
              name="calendar-outline" 
              size={24} 
              color="#8E8E93" 
            />
          </View>
        )}
        
        {/* Attending Indicator */}
        {isUserAttending && (
          <View style={styles.attendingBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Event Details */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Date & Time */}
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#8E8E93" />
          <Text style={styles.detailText}>
            {formatDateTime(event.time)}
          </Text>
          {getPrivacyIndicator()}
        </View>

        {/* Location */}
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#8E8E93" />
          <Text style={styles.detailText} numberOfLines={1}>
            {truncateText(event.location, 30)}
          </Text>
        </View>

        {/* Category Tag */}
        {event.category && event.category !== 'General' && (
          <View style={styles.categoryContainer}>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  imageContainer: {
    width: 80,
    height: '100%',
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#34C759',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
    flex: 1,
  },
  privacyIcon: {
    marginLeft: 4,
  },
  categoryContainer: {
    marginTop: 4,
  },
  categoryTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
});