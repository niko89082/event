// components/activities/PhotoCommentActivity.js - IMPROVED: Regular Photo Comment Activity
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
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 32; // Account for horizontal padding
const MAX_IMAGE_HEIGHT = 300;

const PhotoCommentActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  
  // Safety checks
  if (!data) {
    console.error('❌ PhotoCommentActivity: No data found', { activity });
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Activity data unavailable</Text>
      </View>
    );
  }
  
  const { comment, photo, commenter, photoOwner } = data;
  
  // Safety check for required fields
  if (!comment || !photo || !commenter || !photoOwner) {
    console.error('❌ PhotoCommentActivity: Missing required data', { comment, photo, commenter, photoOwner });
    return (
      <View style={styles.container}>
        <ActivityHeader
          user={commenter || activity.user}
          timestamp={timestamp}
          activityType="photo_comment"
          onUserPress={() => {}}
        />
        <Text style={styles.errorText}>Comment data incomplete</Text>
      </View>
    );
  }

  // Helper function to get proper image URL - consistent with app
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  // Debug logging
  console.log('🖼️ PhotoCommentActivity - Photo data:', {
    photoId: photo?._id,
    photoUrl: photo?.url,
    processedUrl: getImageUrl(photo?.url)
  });

  // Calculate image dimensions for consistent formatting
  const getImageDimensions = () => {
    const aspectRatio = 4/3; // Default aspect ratio consistent with app
    const height = Math.min(IMAGE_WIDTH / aspectRatio, MAX_IMAGE_HEIGHT);
    
    return {
      width: IMAGE_WIDTH,
      height: height
    };
  };

  const imageDimensions = getImageDimensions();

  const handleViewPhoto = () => {
    console.log('🎯 Navigating to photo details:', photo._id);
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'regular',
      openKeyboard: false
    });
  };

  const handleViewCommenter = () => {
    console.log('🎯 Navigating to commenter profile:', commenter._id);
    navigation.navigate('ProfileScreen', { userId: commenter._id });
  };

  const handleViewPhotoOwner = () => {
    console.log('🎯 Navigating to photo owner profile:', photoOwner._id);
    navigation.navigate('ProfileScreen', { userId: photoOwner._id });
  };

  const formatCommentTime = (createdAt) => {
    const now = new Date();
    const commentTime = new Date(createdAt);
    const diffMinutes = Math.floor((now - commentTime) / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
    return `${Math.floor(diffMinutes / 1440)}d`;
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={commenter}
        timestamp={timestamp}
        activityType="photo_comment"
        onUserPress={handleViewCommenter}
        customIcon={{ name: 'chatbubble-outline', color: '#007AFF' }}
      />

      {/* Comment Message with Proper Inline Text */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text 
            style={styles.commenterName}
            onPress={handleViewCommenter}
          >
            {commenter.username}
          </Text>
          <Text> commented "</Text>
          <Text style={styles.commentInlineText}>{comment.text}</Text>
          <Text>" on </Text>
          <Text 
            style={styles.photoOwnerName}
            onPress={handleViewPhotoOwner}
          >
            {photoOwner._id === currentUserId ? 'your' : `${photoOwner.username}'s`}
          </Text>
          <Text> photo</Text>
        </Text>
      </View>

      {/* Photo Display - Clean Photo Only */}
      <TouchableOpacity 
        style={[styles.photoContainer, { height: imageDimensions.height }]}
        onPress={handleViewPhoto}
        activeOpacity={0.95}
      >
        {photo?.url ? (
          <Image
            source={{ uri: getImageUrl(photo.url) }}
            style={[styles.photoImage, imageDimensions]}
            resizeMode="cover"
            onError={(error) => {
              console.error('🖼️ Image load error:', error.nativeEvent.error);
            }}
            onLoad={() => {
              console.log('🖼️ Image loaded successfully:', getImageUrl(photo.url));
            }}
          />
        ) : (
          <View style={[styles.photoPlaceholder, imageDimensions]}>
            <Ionicons name="image-outline" size={50} color="#CCCCCC" />
            <Text style={styles.placeholderText}>Photo not available</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Photo Caption Context (if available) */}
      {photo.caption && (
        <View style={styles.photoCaptionContainer}>
          <Text style={styles.photoCaption} numberOfLines={2}>
            "{photo.caption}"
          </Text>
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
  messageContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
  },
  usernameContainer: {
    // Remove any default TouchableOpacity styling that might cause misalignment
  },
  commenterName: {
    fontWeight: '700',
    color: '#20B2AA', // Teal color
    fontSize: 16,
    // No textDecorationLine - removes underline
  },
  photoOwnerName: {
    fontWeight: '700',
    color: '#20B2AA', // Teal color  
    fontSize: 16,
    // No textDecorationLine - removes underline
  },
  commentInlineText: {
    fontStyle: 'italic',
    color: '#555555',
    fontSize: 16,
  },
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
    position: 'relative',
    width: IMAGE_WIDTH,
    alignSelf: 'center',
  },
  photoImage: {
    backgroundColor: '#E1E4E8',
    borderRadius: 12,
  },
  photoPlaceholder: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999999',
  },
  commentOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  commentBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    padding: 12,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  commentText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 4,
    fontWeight: '500',
  },
  commentTime: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '400',
  },
  photoCaptionContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginTop: 4,
  },
  photoCaption: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
});

export default PhotoCommentActivity;