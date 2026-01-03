// components/activities/FriendEventActivityRedesignedNew.js - Redesigned with new header
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
import ActivityHeaderRedesigned from './ActivityHeaderRedesigned';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FriendEventActivityRedesignedNew = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Activity data unavailable</Text>
      </View>
    );
  }
  
  const { event, friends, groupCount, isGrouped } = data;
  
  if (!event || !friends || friends.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityHeaderRedesigned
          users={friends || []}
          user={activity.user}
          timestamp={timestamp}
          activityType="friend_event_join"
          onUserPress={(userId) => navigation.navigate('ProfileScreen', { userId })}
          onUsersPress={(users) => {
            // Could navigate to users list
            console.log('View friends:', users);
          }}
        />
        <Text style={styles.errorText}>Event information unavailable</Text>
      </View>
    );
  }

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  const handleViewEvent = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleViewProfile = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  const formatEventTime = (eventTime) => {
    const date = new Date(eventTime);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays > 0) {
      return `In ${diffDays} days`;
    } else {
      return 'Past event';
    }
  };

  const getActivityText = () => {
    if (isGrouped && groupCount > 1) {
      const firstName = friends[0].username;
      const secondName = friends.length > 1 ? friends[1].username : null;
      const remainingCount = groupCount - 2;

      if (groupCount === 2) {
        return (
          <Text style={styles.activityText}>
            <Text style={styles.boldText}>{firstName}</Text>
            <Text> and </Text>
            <Text style={styles.boldText}>{secondName}</Text>
            <Text> are going</Text>
          </Text>
        );
      }

      return (
        <Text style={styles.activityText}>
          <Text style={styles.boldText}>{firstName}</Text>
          {secondName && (
            <>
              <Text>, </Text>
              <Text style={styles.boldText}>{secondName}</Text>
            </>
          )}
          <Text> and </Text>
          <Text style={styles.boldText}>{remainingCount} other{remainingCount > 1 ? 's' : ''}</Text>
          <Text> are going</Text>
        </Text>
      );
    }

    return (
      <Text style={styles.activityText}>
        <Text style={styles.boldText}>{friends[0].username}</Text>
        <Text> is going</Text>
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {/* Activity Header with Bulk Grouping */}
      <ActivityHeaderRedesigned
        users={friends}
        user={friends[0]}
        timestamp={timestamp}
        activityType="friend_event_join"
        onUserPress={handleViewProfile}
        onUsersPress={(users) => {
          console.log('View friends:', users);
        }}
      />

      {/* Activity Text */}
      <View style={styles.activityTextContainer}>
        {getActivityText()}
      </View>

      {/* Event Card - Horizontal Layout */}
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={handleViewEvent}
        activeOpacity={0.95}
      >
        {/* Event Image - Left Side */}
        <View style={styles.eventImageContainer}>
          {event.coverImage ? (
            <Image
              source={{ uri: getImageUrl(event.coverImage) }}
              style={styles.eventImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.eventImage, styles.placeholderImage]}>
              <Ionicons name="calendar" size={32} color="#C7C7CC" />
            </View>
          )}
        </View>

        {/* Event Info - Right Side */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          <View style={styles.eventDetails}>
            <View style={styles.eventDetailRow}>
              <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventDetailText}>
                {formatEventTime(event.time)}
              </Text>
            </View>
            
            {event.location && (
              <View style={styles.eventDetailRow}>
                <Ionicons name="location-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventDetailText} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  activityTextContainer: {
    paddingLeft: 68, // Match PostActivityComponent alignment
    paddingRight: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  activityText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#000000',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginLeft: 68, // Match PostActivityComponent alignment
    marginRight: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventImageContainer: {
    width: 120,
    height: 120,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  placeholderImage: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    lineHeight: 20,
  },
  eventDetails: {
    gap: 6,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventDetailText: {
    fontSize: 13,
    color: '#8E8E93',
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
});

export default FriendEventActivityRedesignedNew;

