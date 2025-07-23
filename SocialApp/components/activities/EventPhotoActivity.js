// components/activities/EventPhotoActivity.js - Event Photo Upload Activity
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
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = SCREEN_WIDTH - 32;

const EventPhotoActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { photo, event, uploader, canAddFriend } = data;

  const handleAddFriend = () => {
    onAction(activity._id, 'send_friend_request', { 
      targetUserId: uploader._id 
    });
  };

  const handleViewPhoto = () => {
    navigation.navigate('PostDetailsScreen', { 
      postId: photo._id,
      fromEventPhoto: true 
    });
  };

  const handleViewEvent = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: uploader._id });
  };

  const shouldShowAddFriend = canAddFriend && !data.friendRequestSent;

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={uploader}
        timestamp={timestamp}
        activityType="event_photo_upload"
        onUserPress={handleViewProfile}
      />

      {/* Activity Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{uploader.username}</Text>
          <Text> uploaded a photo to </Text>
          <TouchableOpacity onPress={handleViewEvent}>
            <Text style={[styles.boldText, styles.eventLink]}>{event.title}</Text>
          </TouchableOpacity>
        </Text>
      </View>

      {/* Photo Preview */}
      <TouchableOpacity 
        style={styles.photoContainer}
        onPress={handleViewPhoto}
        activeOpacity={0.95}
      >
        <Image
          source={{ uri: photo.url }}
          style={styles.photo}
          resizeMode="cover"
        />
        
        {/* Photo Overlay */}
        <View style={styles.photoOverlay}>
          <View style={styles.overlayContent}>
            {/* View Full Size Button */}
            <TouchableOpacity style={styles.viewButton}>
              <Ionicons name="expand-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo Caption */}
        {photo.caption && (
          <View style={styles.captionOverlay}>
            <Text style={styles.captionText} numberOfLines={2}>
              {photo.caption}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Event Context */}
      <TouchableOpacity 
        style={styles.eventContext}
        onPress={handleViewEvent}
        activeOpacity={0.7}
      >
        <View style={styles.eventInfo}>
          <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
          <Text style={styles.eventContextText} numberOfLines={1}>
            From <Text style={styles.boldText}>{event.title}</Text>
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
      </TouchableOpacity>

      {/* Add Friend Action */}
      {shouldShowAddFriend && (
        <View style={styles.actionContainer}>
          <ActivityActionButton
            title={data.friendRequestSent ? "Request Sent" : "Add Friend"}
            onPress={handleAddFriend}
            icon="person-add-outline"
            variant={data.friendRequestSent ? "outline" : "primary"}
            size="medium"
            fullWidth={true}
            loading={metadata?.actionProcessing && metadata?.actionLabel?.includes('Sending')}
            disabled={metadata?.actionProcessing || data.friendRequestSent}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },
  
  // Message
  messageContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '600',
  },
  eventLink: {
    color: '#3797EF',
  },

  // Photo
  photoContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 0.75, // 4:3 aspect ratio
  },

  // Photo Overlay
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  overlayContent: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  viewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Caption
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
  },
  captionText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
  },

  // Event Context
  eventContext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    borderRadius: 8,
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  eventContextText: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
  },

  // Action
  actionContainer: {
    paddingHorizontal: 16,
  },
});

export default EventPhotoActivity;