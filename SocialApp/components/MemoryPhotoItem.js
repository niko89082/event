// SocialApp/components/MemoryPhotoItem.js - FIXED: Proper like handling without optimistic updates

import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, Image, TouchableOpacity, Dimensions,
  Alert, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: screenWidth } = Dimensions.get('window');
const photoWidth = screenWidth - 40; // Account for padding

export default function MemoryPhotoItem({ 
  photo, 
  onLikeUpdate, 
  onOpenComments, 
  onOpenFullscreen,
  onOpenLikes 
}) {
  const { currentUser } = useContext(AuthContext);
  
  // ✅ FIXED: Initialize state from props with proper validation
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ CRITICAL: Initialize state properly from photo props
  useEffect(() => {
    if (photo) {
      console.log('🔄 MemoryPhotoItem: Initializing state from photo props:', {
        photoId: photo._id,
        userLiked: photo.userLiked,
        likeCount: photo.likeCount,
        propsReceived: {
          userLiked: photo.userLiked,
          likeCount: photo.likeCount,
          likesArray: photo.likes
        }
      });
      
      setLiked(Boolean(photo.userLiked));
      setLikeCount(Number(photo.likeCount) || 0);
    }
  }, [photo._id, photo.userLiked, photo.likeCount]); // Re-run when these specific props change

  // ✅ FIXED: Handle like updates from parent component
  useEffect(() => {
    console.log('📷 MemoryPhotoItem: Received like update from parent:', {
      photoId: photo._id,
      newUserLiked: photo.userLiked,
      newLikeCount: photo.likeCount,
      currentState: { liked, likeCount }
    });
    
    // Update local state when parent passes new like data
    if (photo.userLiked !== undefined) {
      setLiked(Boolean(photo.userLiked));
    }
    if (photo.likeCount !== undefined) {
      setLikeCount(Number(photo.likeCount));
    }
  }, [photo.userLiked, photo.likeCount]);

  const handleLike = async () => {
    if (loading) {
      console.log('⚠️ Like request already in progress, ignoring');
      return;
    }

    if (!currentUser?._id) {
      console.error('❌ No current user, cannot like');
      Alert.alert('Error', 'You must be logged in to like photos');
      return;
    }

    console.log('🚀 === MEMORY PHOTO LIKE START ===');
    console.log('📷 Current state before like:', {
      photoId: photo._id,
      currentLiked: liked,
      currentCount: likeCount,
      userId: currentUser._id
    });

    setLoading(true);

    try {
      console.log('📡 Making like API request...');
      const response = await api.post(`/api/memories/photos/${photo._id}/like`);
      
      console.log('📥 Like API response received:', response.data);

      if (response.data && response.data.success) {
        const { userLiked, likeCount: newCount } = response.data;
        
        console.log('✅ Updating local state with API response:', {
          newUserLiked: userLiked,
          newCount: newCount,
          previousLiked: liked,
          previousCount: likeCount
        });

        // ✅ CRITICAL: Update local state from API response
        setLiked(Boolean(userLiked));
        setLikeCount(Number(newCount) || 0);

        // ✅ CRITICAL: Notify parent component of the change
        if (onLikeUpdate) {
          console.log('📢 Notifying parent component of like update');
          onLikeUpdate(photo._id, {
            userLiked: Boolean(userLiked),
            likeCount: Number(newCount) || 0,
            count: Number(newCount) || 0
          });
        }

        console.log('✅ Like operation completed successfully');
      } else {
        throw new Error('Invalid response format from server');
      }

    } catch (error) {
      console.error('🚨 === MEMORY PHOTO LIKE ERROR ===');
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        photoId: photo._id
      });

      // ✅ IMPROVED: Better error handling with user feedback
      let errorMessage = 'Failed to update like';
      
      if (error.response?.status === 404) {
        errorMessage = 'Photo not found';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to like this photo';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Error', errorMessage);

      // Don't revert state since we never optimistically updated
      
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLikes = () => {
    console.log('📋 Opening likes list for photo:', photo._id);
    if (onOpenLikes) {
      onOpenLikes(photo._id);
    }
  };

  const handleOpenComments = () => {
    console.log('💬 Opening comments for photo:', photo._id);
    if (onOpenComments) {
      onOpenComments(photo._id);
    }
  };

  const handleOpenFullscreen = () => {
    console.log('🖼️ Opening fullscreen for photo:', photo._id);
    if (onOpenFullscreen) {
      onOpenFullscreen(photo);
    }
  };

  // ✅ FIXED: Helper function for image URLs
  const getImageUrl = (url) => {
    if (!url) return null;
    
    if (url.startsWith('http')) {
      return url;
    }
    
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  // ✅ VALIDATION: Don't render if no photo data
  if (!photo || !photo._id) {
    console.warn('⚠️ MemoryPhotoItem: No photo data provided');
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Photo Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{
              uri: getImageUrl(photo.uploadedBy?.profilePicture) || 
                   `https://placehold.co/32x32/E1E1E1/8E8E93?text=${photo.uploadedBy?.username?.charAt(0) || 'U'}`
            }}
            style={styles.avatar}
          />
          <Text style={styles.username}>
            {photo.uploadedBy?.username || 'Unknown User'}
          </Text>
        </View>
        
        <Text style={styles.timestamp}>
          {photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleDateString() : ''}
        </Text>
      </View>

      {/* Photo Image */}
      <TouchableOpacity onPress={handleOpenFullscreen} activeOpacity={0.95}>
        <Image
          source={{ uri: getImageUrl(photo.url) }}
          style={styles.photo}
          resizeMode="cover"
        />
      </TouchableOpacity>

      {/* Photo Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          {/* Like Button */}
          <TouchableOpacity
            onPress={handleLike}
            disabled={loading}
            style={[styles.actionButton, loading && styles.actionButtonDisabled]}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={24}
              color={liked ? "#FF3B30" : "#000000"}
            />
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity onPress={handleOpenComments} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo Stats */}
      <View style={styles.stats}>
        {/* Like Count - Clickable to show likes list */}
        {likeCount > 0 && (
          <TouchableOpacity onPress={handleOpenLikes} style={styles.statItem}>
            <Text style={styles.likeCount}>
              {likeCount} {likeCount === 1 ? 'like' : 'likes'}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Caption */}
        {photo.caption && photo.caption.trim() && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>
              <Text style={styles.captionUsername}>
                {photo.uploadedBy?.username}
              </Text>
              {' '}
              {photo.caption}
            </Text>
          </View>
        )}
        
        {/* Comments Count */}
        {photo.commentCount > 0 && (
          <TouchableOpacity onPress={handleOpenComments} style={styles.statItem}>
            <Text style={styles.commentCount}>
              View all {photo.commentCount} comments
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
  },
  username: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  photo: {
    width: '100%',
    height: photoWidth,
    backgroundColor: '#F6F6F6',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  stats: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statItem: {
    marginBottom: 4,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  captionContainer: {
    marginTop: 4,
  },
  caption: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },
  captionUsername: {
    fontWeight: '600',
    color: '#000000',
  },
  commentCount: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
});