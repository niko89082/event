// SocialApp/components/MemoryPhotoItem.js - FIXED: Like toggle and null safety issues
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, 
  Animated, Alert, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: screenWidth } = Dimensions.get('window');

export default function MemoryPhotoItem({ 
  photo, 
  onLikeUpdate, 
  onCommentUpdate, 
  onOpenComments,
  onOpenFullscreen,
  onOpenLikes
}) {
  // ✅ FIXED: Initialize likes state with proper null safety
  const [likes, setLikes] = useState({
    count: photo?.likeCount || 0,
    userLiked: photo?.userLiked || false,
    loading: false,
    initialized: false
  });
  
  const [comments, setComments] = useState({
    count: photo?.commentCount || 0
  });

  // State for image dimensions to maintain aspect ratio
  const [imageDimensions, setImageDimensions] = useState({
    width: screenWidth - 40,
    height: 300
  });

  // Animation refs
  const heartScale = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  const DOUBLE_PRESS_DELAY = 300;

  // ✅ FIXED: Add null safety for photo ID
  useEffect(() => {
    if (photo?._id && !likes.initialized) {
      fetchLikes();
    }
  }, [photo?._id]);

  // ✅ FIXED: Update local state when props change with proper null safety
  useEffect(() => {
    if (photo?.likeCount !== undefined && photo.likeCount !== likes.count) {
      console.log('📷 Updating like count from props:', {
        photoId: photo._id,
        newCount: photo.likeCount,
        oldCount: likes.count,
        userLiked: photo.userLiked
      });
      
      setLikes(prev => ({
        ...prev,
        count: photo.likeCount || 0,
        userLiked: photo.userLiked !== undefined ? photo.userLiked : prev.userLiked
      }));
    }
  }, [photo?.likeCount, photo?.userLiked]);

  useEffect(() => {
    if (photo?.commentCount !== undefined) {
      setComments(prev => ({
        ...prev,
        count: photo.commentCount || 0
      }));
    }
  }, [photo?.commentCount]);

  // Get image dimensions to maintain aspect ratio
  useEffect(() => {
    if (!photo?.url) return;

    const photoUrl = photo.url.startsWith('http') 
      ? photo.url 
      : `http://${API_BASE_URL}:3000${photo.url}`;

    Image.getSize(photoUrl, (width, height) => {
      const containerWidth = screenWidth - 40;
      const aspectRatio = height / width;
      const calculatedHeight = Math.min(containerWidth * aspectRatio, 500);

      setImageDimensions({
        width: containerWidth,
        height: calculatedHeight
      });
    }, (error) => {
      console.warn('Failed to get image dimensions:', error);
    });
  }, [photo?.url]);

  // Helper function to get proper profile picture URL
  const getProfilePictureUrl = (profilePicture, fallbackText = '👤') => {
    if (profilePicture) {
      if (profilePicture.startsWith('http')) {
        return profilePicture;
      }
      const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
      return `http://${API_BASE_URL}:3000${cleanPath}`;
    }
    return `https://placehold.co/40x40/E1E1E1/8E8E93?text=${fallbackText}`;
  };

  const fetchLikes = async () => {
    if (!photo?._id) return;

    try {
      console.log('📷 Fetching likes for photo:', photo._id);
      const response = await api.get(`/api/memories/photos/${photo._id}/likes`);
      
      const newLikesState = {
        count: response.data.likeCount || 0,
        userLiked: response.data.userLiked || false,
        initialized: true,
        loading: false
      };
      
      console.log('📷 Likes fetched:', newLikesState);
      setLikes(newLikesState);
    } catch (error) {
      console.error('Error fetching likes:', error);
      setLikes(prev => ({ 
        ...prev, 
        initialized: true,
        loading: false 
      }));
    }
  };

  // ✅ FIXED: Enhanced like handler with better error handling and state management
  const handleLike = async () => {
    if (!photo?._id) {
      console.error('❌ No photo ID available for like toggle');
      return;
    }

    if (likes.loading) {
      console.log('⚠️ Like request already in progress');
      return;
    }

    try {
      setLikes(prev => ({ ...prev, loading: true }));

      // ✅ FIXED: Proper optimistic update
      const newLiked = !likes.userLiked;
      const newCount = newLiked ? likes.count + 1 : likes.count - 1;

      console.log('📷 Optimistic like update:', {
        photoId: photo._id,
        newLiked,
        newCount,
        previousLiked: likes.userLiked,
        previousCount: likes.count
      });

      setLikes(prev => ({
        ...prev,
        userLiked: newLiked,
        count: newCount
      }));

      // Animate heart if liking
      if (newLiked) {
        heartScale.setValue(0);
        Animated.sequence([
          Animated.spring(heartScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 5,
          }),
          Animated.timing(heartScale, {
            toValue: 0,
            duration: 300,
            delay: 500,
            useNativeDriver: true,
          }),
        ]).start();

        Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleValue, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }

      console.log('📷 Making like API request for photo:', photo._id);
      const response = await api.post(`/api/memories/photos/${photo._id}/like`);

      console.log('📷 Like API response:', response.data);

      // ✅ FIXED: Use server response to update state
      const serverLiked = response.data.liked !== undefined ? response.data.liked : response.data.userLiked || false;
      const serverCount = response.data.likeCount || 0;

      setLikes(prev => ({
        ...prev,
        userLiked: serverLiked,
        count: serverCount,
        loading: false
      }));

      // ✅ FIXED: Notify parent component with proper data structure
      if (onLikeUpdate) {
        onLikeUpdate(photo._id, {
          count: serverCount,
          likeCount: serverCount, // Also include this for compatibility
          userLiked: serverLiked
        });
      }

      console.log('✅ Like toggle completed successfully');

    } catch (error) {
      console.error('❌ Error toggling like:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // ✅ FIXED: Revert optimistic update on error
      setLikes(prev => ({
        ...prev,
        userLiked: !prev.userLiked,
        count: prev.userLiked ? prev.count + 1 : prev.count - 1,
        loading: false
      }));
      
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleImagePress = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;

    if (timeSinceLastTap < DOUBLE_PRESS_DELAY) {
      // Double tap - like the photo
      if (!likes.userLiked) {
        handleLike();
      }
    } else {
      // Single tap - open fullscreen after delay
      setTimeout(() => {
        const timeSinceThisTap = Date.now() - lastTap.current;
        if (timeSinceThisTap >= DOUBLE_PRESS_DELAY && onOpenFullscreen) {
          onOpenFullscreen(photo);
        }
      }, DOUBLE_PRESS_DELAY);
    }

    lastTap.current = now;
  };

  const handleCommentsPress = () => {
    if (onOpenComments && photo?._id) {
      onOpenComments(photo._id);
    }
  };

  const handleLikesPress = () => {
    if (likes.count > 0 && onOpenLikes && photo?._id) {
      onOpenLikes(photo._id);
    }
  };

  // ✅ FIXED: Add null safety for photo URL
  if (!photo?.url) {
    console.warn('⚠️ MemoryPhotoItem: No photo URL provided');
    return null;
  }

  const photoUrl = photo.url.startsWith('http') 
    ? photo.url 
    : `http://${API_BASE_URL}:3000${photo.url}`;

  return (
    <View style={styles.container}>
      {/* Photo with overlay interactions */}
      <Animated.View 
        style={[
          styles.imageContainer,
          { transform: [{ scale: scaleValue }] }
        ]}
      >
        <TouchableOpacity
          onPress={handleImagePress}
          activeOpacity={0.95}
        >
          <Image
            source={{ uri: photoUrl }}
            style={[
              styles.photo,
              {
                width: imageDimensions.width,
                height: imageDimensions.height
              }
            ]}
            onError={(error) => {
              console.warn('❌ Photo failed to load:', error.nativeEvent?.error);
            }}
          />
          
          {/* Floating heart animation */}
          <Animated.View 
            style={[
              styles.floatingHeart,
              {
                transform: [{ scale: heartScale }],
                opacity: heartScale
              }
            ]}
          >
            <Ionicons name="heart" size={60} color="#FF3B30" />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* Photo info section */}
      <View style={styles.photoInfo}>
        {/* ✅ FIXED: Add null safety for uploader info */}
        <View style={styles.uploaderInfo}>
          <Image
            source={{
              uri: getProfilePictureUrl(
                photo.uploadedBy?.profilePicture, 
                photo.uploadedBy?.username?.charAt(0) || 'U'
              )
            }}
            style={styles.uploaderAvatar}
            onError={(error) => {
              console.warn('❌ Profile picture failed to load:', error.nativeEvent?.error);
            }}
          />
          <View style={styles.uploaderDetails}>
            <Text style={styles.uploaderName}>
              {photo.uploadedBy?.username || photo.uploadedBy?.fullName || 'Unknown'}
            </Text>
            <Text style={styles.uploadTime}>
              {photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleDateString() : 'Unknown date'}
            </Text>
          </View>
        </View>

        {/* Caption - only show if present */}
        {photo.caption && (
          <Text style={styles.caption}>{photo.caption}</Text>
        )}

        {/* ✅ FIXED: Action buttons with proper like state display */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              likes.userLiked && styles.actionButtonActive
            ]}
            onPress={handleLike}
            disabled={likes.loading}
          >
            <Ionicons 
              name={likes.userLiked ? "heart" : "heart-outline"} 
              size={18} 
              color={likes.userLiked ? "#FF3B30" : "#8E8E93"} 
            />
            <TouchableOpacity onPress={handleLikesPress} disabled={likes.count === 0}>
              <Text style={[
                styles.actionButtonText,
                likes.userLiked && styles.actionButtonTextActive,
                likes.count > 0 && styles.clickableText
              ]}>
                {likes.count} {likes.count === 1 ? 'like' : 'likes'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCommentsPress}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#8E8E93" />
            <Text style={styles.actionButtonText}>
              {comments.count} {comments.count === 1 ? 'comment' : 'comments'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  photo: {
    backgroundColor: '#F6F6F6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  floatingHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    zIndex: 10,
  },
  photoInfo: {
    padding: 16,
  },
  uploaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  uploaderDetails: {
    marginLeft: 12,
    flex: 1,
  },
  uploaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  uploadTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  caption: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F6F6F6',
    gap: 6,
  },
  actionButtonActive: {
    backgroundColor: '#FFE5E5',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#FF3B30',
  },
  clickableText: {
    textDecorationLine: 'underline',
  },
});