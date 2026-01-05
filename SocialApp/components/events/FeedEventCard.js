// components/events/FeedEventCard.js - Compact feed event card
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';

export default function FeedEventCard({ event, navigation, currentUserId, onPress }) {
  const handlePress = () => {
    if (onPress) {
      onPress(event);
    } else if (navigation) {
      navigation.navigate('EventDetailsScreen', { eventId: event._id });
    }
  };

  const handleMorePress = (e) => {
    e.stopPropagation();
    // TODO: Show options menu
    console.log('More options for event:', event._id);
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
  let timeColor = '#3797EF';
  
  if (eventDay.getTime() === today.getTime()) {
    timeLabel = 'Today';
    timeColor = '#3797EF';
  } else if (eventDay.getTime() === today.getTime() + 86400000) {
    timeLabel = 'Tomorrow';
    timeColor = '#3797EF';
  } else {
    const daysDiff = Math.floor((eventDay - today) / 86400000);
    if (daysDiff <= 7) {
      timeLabel = eventDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
      timeColor = '#6366F1';
    } else {
      timeLabel = eventDate.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      timeColor = '#10B981';
    }
  }

  const time = eventDate.toLocaleTimeString('en', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  // Get friends going count (if available)
  const friendsGoingCount = event.friendsGoingCount || 0;
  const displayAttendees = event.attendees?.slice(0, 2) || [];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.95}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
            <Ionicons name="calendar-outline" size={24} color="#C7C7CC" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.timeLabel, { color: timeColor }]}>
            {timeLabel} • {time}
          </Text>
          <TouchableOpacity
            onPress={handleMorePress}
            style={styles.moreButton}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.location} numberOfLines={1}>
          {event.location || 'Location TBD'}
        </Text>

        {/* Friends Going */}
        {friendsGoingCount > 0 && (
          <View style={styles.friendsContainer}>
            <View style={styles.friendsAvatars}>
              {displayAttendees.map((attendee, index) => (
                <Image
                  key={index}
                  source={{
                    uri: attendee.profilePicture
                      ? `http://${API_BASE_URL}:3000${attendee.profilePicture}`
                      : 'https://placehold.co/20x20.png?text=👤'
                  }}
                  style={[styles.friendAvatar, { marginLeft: index > 0 ? -6 : 0 }]}
                />
              ))}
              {friendsGoingCount > 2 && (
                <View style={[styles.friendAvatar, styles.moreFriends]}>
                  <Text style={styles.moreFriendsText}>+{friendsGoingCount - 2}</Text>
                </View>
              )}
            </View>
            <Text style={styles.friendsText}>
              {friendsGoingCount} friend{friendsGoingCount === 1 ? '' : 's'} {new Date(event.time) <= new Date() ? 'went' : 'going'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  imageContainer: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moreButton: {
    padding: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
    lineHeight: 20,
  },
  location: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  friendsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  friendsAvatars: {
    flexDirection: 'row',
  },
  friendAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreFriends: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#FFFFFF',
  },
  moreFriendsText: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '700',
  },
  friendsText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
});

