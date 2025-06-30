// SocialApp/components/MemoryPhotoItem.js - FIXED: Natural photo aspect ratios
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
  onOpenFullscreen 
}) {
  const [likes, setLikes] = useState({
    count: photo.likeCount || 0,
    userLiked: false,
    loading: false,
    initialized: false
  });
  
  const [comments, setComments] = useState({
    count: photo.commentCount || 0
  });

  // ✅ NEW: State for image dimensions to maintain aspect ratio
  const [imageDimensions, setImageDimensions] = useState({
    width: screenWidth - 40, // Default width (container padding)
    height: 300 // Default height
  });

  // Animation refs
  const heartScale = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  const DOUBLE_PRESS_DELAY = 300;

  useEffect(() => {
    if (!likes.initialized) {
      fetchLikes();
    }
  }, [photo._id]);

  useEffect(() => {
    if (photo.likeCount !== undefined) {
      setLikes(prev => ({
        ...prev,
        count: photo.likeCount
      }));
    }
    if (photo.commentCount !== undefined) {
      setComments(prev => ({
        ...prev,
        count: photo.commentCount
      }));
    }
  }, [photo.likeCount, photo.commentCount]);

  // ✅ NEW: Get image dimensions to maintain aspect ratio
  useEffect(() => {
    const photoUrl = photo.url?.startsWith('http') 
      ? photo.url 
      : `http://${API_BASE_URL}:3000${photo.url}`;

    Image.getSize(
      photoUrl,
      (width, height) => {
        // Calculate height to maintain aspect ratio
        // Maximum width is container width minus padding
        const maxWidth = screenWidth - 40;
        const aspectRatio = height / width;
        
        // Set reasonable height limits
        const minHeight = 200;
        const maxHeight = 500;
        
        let newHeight = maxWidth * aspectRatio;
        newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
        
        setImageDimensions({
          width: maxWidth,
          height: newHeight
        });
      },
      (error) => {
        console.log('Error getting image size:', error);
        // Keep default dimensions if we can't get image size
      }
    );
  }, [photo.url]);

  const fetchLikes = async () => {
    if (likes.loading || likes.initialized) return;
    
    try {
      setLikes(prev => ({ ...prev, loading: true }));
      console.log('🔍 Fetching likes for photo:', photo._id);
      
      const response = await api.get(`/api/memories/photos/${photo._id}/likes`);
      
      setLikes({
        count: response.data.likeCount,
        userLiked: response.data.userLiked,
        loading: false,
        initialized: true
      });
      
      if (onLikeUpdate) {
        onLikeUpdate(photo._id, {
          count: response.data.likeCount,
          userLiked: response.data.userLiked
        });
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
      setLikes(prev => ({ 
        ...prev, 
        loading: false, 
        initialized: true 
      }));
    }
  };
console.log(photo.uploadedBy?.profilePicture);
  const handleLike = async () => {
    if (likes.loading) return;

    try {
      setLikes(prev => ({ ...prev, loading: true }));

      const newLiked = !likes.userLiked;
      const newCount = newLiked ? likes.count + 1 : likes.count - 1;

      setLikes(prev => ({
        ...prev,
        userLiked: newLiked,
        count: newCount
      }));

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

      console.log('❤️ Toggling like for photo:', photo._id);
      const response = await api.post(`/api/memories/photos/${photo._id}/like`);

      setLikes(prev => ({
        ...prev,
        userLiked: response.data.liked,
        count: response.data.likeCount,
        loading: false
      }));

      if (onLikeUpdate) {
        onLikeUpdate(photo._id, {
          count: response.data.likeCount,
          userLiked: response.data.liked
        });
      }

    } catch (error) {
      console.error('Error toggling like:', error);
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
      if (!likes.userLiked) {
        handleLike();
      }
    } else {
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
    if (onOpenComments) {
      onOpenComments(photo._id);
    }
  };

  const photoUrl = photo.url?.startsWith('http') 
    ? photo.url 
    : `http://${API_BASE_URL}:3000${photo.url}`;

  return (
    <View style={styles.container}>
      {/* Photo */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleImagePress}
        style={styles.imageContainer}
      >
        <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
          <Image
            source={{ uri: photoUrl }}
            style={[
              styles.photo,
              {
                width: imageDimensions.width,
                height: imageDimensions.height, // ✅ FIXED: Use calculated height to maintain aspect ratio
              }
            ]}
            resizeMode="cover" // ✅ FIXED: Use 'cover' to maintain aspect ratio without distortion
          />
        </Animated.View>

        {/* Floating heart animation */}
        <Animated.View 
          style={[
            styles.floatingHeart,
            { transform: [{ scale: heartScale }] }
          ]}
        >
          <Ionicons name="heart" size={60} color="#FF3B30" />
        </Animated.View>

        {/* Photo overlay with quick actions */}
        <View style={styles.photoOverlay}>
          <View style={styles.overlayActions}>
            <TouchableOpacity
              style={styles.overlayAction}
              onPress={handleLike}
              disabled={likes.loading}
            >
              <Ionicons 
                name={likes.userLiked ? "heart" : "heart-outline"} 
                size={20} 
                color={likes.userLiked ? "#FF3B30" : "#FFFFFF"} 
              />
              <Text style={styles.overlayText}>{likes.count}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.overlayAction}
              onPress={handleCommentsPress}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
              <Text style={styles.overlayText}>{comments.count}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Photo info */}
      <View style={styles.photoInfo}>
        {/* Uploader info */}
        <View style={styles.uploaderInfo}>
          <Image
            source={{
              uri: photo.uploadedBy?.profilePicture || 'https://placehold.co/40x40/E1E1E1/8E8E93?text=U'
            }}
            style={styles.uploaderAvatar}
          />
          <View style={styles.uploaderDetails}>
            <Text style={styles.uploaderName}>
              {photo.uploadedBy?.username || 'Unknown'}
            </Text>
            <Text style={styles.uploadTime}>
              {new Date(photo.uploadedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Caption */}
        {photo.caption && (
          <Text style={styles.caption}>{photo.caption}</Text>
        )}

        {/* Action buttons */}
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
            <Text style={[
              styles.actionButtonText,
              likes.userLiked && styles.actionButtonTextActive
            ]}>
              {likes.count} {likes.count === 1 ? 'like' : 'likes'}
            </Text>
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
    alignItems: 'center', // Center the image
  },
  photo: {
    backgroundColor: '#F6F6F6',
    borderRadius: 16, // ✅ FIXED: Add border radius to the image itself
    // ✅ REMOVED: Fixed height and width - now calculated dynamically
  },
  floatingHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    zIndex: 10,
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'flex-end',
    padding: 16,
    borderRadius: 16, // Match the image border radius
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 12,
  },
  overlayAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 12, // ✅ FIXED: Square with curved edges (was 20 for circle)
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
});