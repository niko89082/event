// Replace your entire MinimalEventCard.js with this fixed version:

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.55; // ~55% of screen = shows 1.8 cards per screen

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

  // Check if user is attending
  const isUserAttending = event.attendees && event.attendees.some(
    attendee => (typeof attendee === 'string' ? attendee : attendee._id) === currentUserId
  );

  // Get image URL with proper IP configuration
  const getImageUrl = () => {
    if (!event.coverImage) {
      console.log(`No coverImage for event: ${event.title}`);
      return null;
    }
    
    console.log(`Original coverImage: ${event.coverImage}`);
    
    // If coverImage already has full URL, use it
    if (event.coverImage.startsWith('http')) {
      console.log(`Using full URL: ${event.coverImage}`);
      return event.coverImage;
    }
    
    // Use environment API URL or fallback
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 
                         process.env.API_BASE_URL || 
                         '192.168.1.100:3000'; // Replace with your actual IP
    
    const baseUrl = API_BASE_URL.includes(':') ? API_BASE_URL : `${API_BASE_URL}:3000`;
    const imagePath = event.coverImage.startsWith('/') ? event.coverImage : `/${event.coverImage}`;
    const finalUrl = `http://${baseUrl}${imagePath}`;
    
    console.log(`Final image URL: ${finalUrl}`);
    return finalUrl;
  };

  const imageUrl = getImageUrl();

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onPress(event)}
      activeOpacity={0.7}
    >
      {/* ✅ FIXED: Image First (Top) - Larger Size */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.eventImage}
            resizeMode="cover"
            onError={(error) => {
              console.log('Image load error:', error.nativeEvent.error);
              console.log('Failed URL:', imageUrl);
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', imageUrl);
            }}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons 
              name="calendar-outline" 
              size={28} 
              color="#8E8E93" 
            />
          </View>
        )}
        
        {/* Attending Badge */}
        {isUserAttending && (
          <View style={styles.attendingBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* ✅ FIXED: Text Content Second (Bottom) - Compact */}
      <View style={styles.textContent}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>

        {/* Date & Time */}
        <Text style={styles.dateTime} numberOfLines={1}>
          {formatDateTime(event.time)}
        </Text>

        {/* Location */}
        <Text style={styles.location} numberOfLines={1}>
          {truncateText(event.location || 'Location TBD', 25)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: 170, // Increased from 160 to 170 for better spacing
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginRight: 12,
    marginBottom: 0, // ✅ REMOVED: No bottom margin for seamless category flow
    // ✅ IMPROVED: Enhanced shadow and border for better separation
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    // ✅ Add subtle bottom border emphasis
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  
  // ✅ FIXED: Image section (top) - Slightly smaller to give text more room
  imageContainer: {
    flex: 0.60, // Adjusted from 65% to 60% to give text more space
    position: 'relative',
    width: '100%',
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
  
  // ✅ FIXED: Text content section (bottom) - More space, better padding
  textContent: {
    flex: 0.40, // Increased from 30% to 40% for more text space
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10, // Extra bottom padding to prevent cutoff
    justifyContent: 'space-between',
  },
  
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 16,
  },
  
  dateTime: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 1,
  },
  
  location: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 1,
  },
});