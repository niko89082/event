// SocialApp/components/MemoryPhotoItem.js - Enhanced with whimsical UI and better like handling
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, 
  Animated, Alert, Dimensions, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
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
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  
  const [likes, setLikes] = useState({
    count: photo.likeCount || 0,
    userLiked: Boolean(photo.userLiked),
    loading: false,
    initialized: false
  });
  
  const [comments, setComments] = useState({
    count: photo.commentCount || 0
  });

  // Comment input state (like PostItem)
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // State for image dimensions to maintain aspect ratio
  const [imageDimensions, setImageDimensions] = useState({
    width: screenWidth - 40, // Default width (container padding)
    height: 300 // Default height
  });

  // Animation refs for heart double-tap
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
        count: photo.likeCount,
        userLiked: Boolean(photo.userLiked)
      }));
    }
    if (photo.commentCount !== undefined) {
      setComments(prev => ({
        ...prev,
        count: photo.commentCount
      }));
    }
  }, [photo.likeCount, photo.commentCount, photo.userLiked]);

  // Get image dimensions to maintain aspect ratio
  useEffect(() => {
    const photoUrl = getImageUrl(photo.url);
    if (photoUrl) {
      Image.getSize(photoUrl, (width, height) => {
        const containerWidth = screenWidth - 40; // Account for container padding
        const aspectRatio = height / width;
        const calculatedHeight = Math.min(containerWidth * aspectRatio, 500); // Max height 500

        setImageDimensions({
          width: containerWidth,
          height: calculatedHeight
        });
      }, (error) => {
        console.warn('Failed to get image dimensions:', error);
        // Keep default dimensions if image sizing fails
      });
    }
  }, [photo.url]);

  // Helper function to get proper image URL
  const getImageUrl = (url) => {
    if (!url) return null;
    
    if (url.startsWith('http')) {
      return url;
    }
    
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

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

  // Helper function for relative time
  const getRelativeTime = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now - date;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const fetchLikes = async () => {
    try {
      const response = await api.get(`/api/memories/photos/${photo._id}/likes`);
      setLikes(prev => ({
        ...prev,
        count: response.data.likeCount,
        userLiked: response.data.userLiked,
        initialized: true
      }));
    } catch (error) {
      console.error('Error fetching likes:', error);
      setLikes(prev => ({ ...prev, initialized: true }));
    }
  };

  // Submit inline comment (matching PostItem's implementation)
  const submitComment = async () => {
    if (!commentText.trim()) {
      console.warn('⚠️ Cannot submit empty inline comment');
      return;
    }
    
    if (submittingComment) {
      console.warn('⚠️ Already submitting inline comment, skipping');
      return;
    }

    if (!currentUser?._id) {
      Alert.alert('Error', 'You must be logged in to comment');
      return;
    }

    console.log('🔄 Submitting inline memory comment:', {
      photoId: photo._id,
      commentText: commentText.trim(),
      endpoint: `/api/memories/photos/${photo._id}/comments`
    });

    try {
      setSubmittingComment(true);

      const response = await api.post(`/api/memories/photos/${photo._id}/comments`, {
        text: commentText.trim(),
        tags: []
      });
      
      console.log('📝 Memory comment submit response:', response.data);
      
      // Update comment count
      setComments(prev => ({
        ...prev,
        count: prev.count + 1
      }));

      setCommentText('');
      console.log('✅ Inline memory comment submitted successfully');

      // Notify parent component
      if (onCommentUpdate) {
        onCommentUpdate(photo._id, {
          commentCount: comments.count + 1
        });
      }

    } catch (error) {
      console.error('❌ Error submitting inline memory comment:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLike = async () => {
    if (likes.loading) {
      console.log('⚠️ Like request already in progress, ignoring');
      return;
    }

    console.log('🚀 === MEMORY PHOTO LIKE START ===');
    console.log('📷 Current state before like:', {
      photoId: photo._id,
      currentLiked: likes.userLiked,
      currentCount: likes.count,
      timestamp: new Date().toISOString()
    });

    setLikes(prev => ({ ...prev, loading: true }));

    try {
      console.log('📡 Making like API request to:', `/api/memories/photos/${photo._id}/like`);
      const response = await api.post(`/api/memories/photos/${photo._id}/like`);
      
      console.log('📥 Like API response received:', {
        success: response.data?.success,
        liked: response.data?.liked,
        userLiked: response.data?.userLiked,
        likeCount: response.data?.likeCount,
        fullResponse: response.data
      });

      if (response.data && response.data.success) {
        const apiUserLiked = response.data.userLiked !== undefined ? 
          response.data.userLiked : response.data.liked;
        const apiLikeCount = response.data.likeCount !== undefined ? 
          response.data.likeCount : response.data.likesCount;
        
        console.log('✅ Extracted values from API response:', {
          apiUserLiked,
          apiLikeCount,
          originalLiked: likes.userLiked,
          originalCount: likes.count
        });

        // ✅ CRITICAL: Update local state IMMEDIATELY from API response
        setLikes(prev => ({
          ...prev,
          userLiked: Boolean(apiUserLiked),
          count: Number(apiLikeCount) || 0,
          loading: false
        }));

        // Animate heart if liking
        if (apiUserLiked && !likes.userLiked) {
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

        // ✅ CRITICAL: Notify parent component immediately
        if (onLikeUpdate) {
          console.log('📢 Notifying parent component of like update...');
          const updateData = {
            userLiked: Boolean(apiUserLiked),
            likeCount: Number(apiLikeCount) || 0,
            liked: Boolean(apiUserLiked),
            count: Number(apiLikeCount) || 0,
            timestamp: new Date().toISOString()
          };
          
          console.log('📤 Sending update data to parent:', updateData);
          onLikeUpdate(photo._id, updateData);
          console.log('✅ Parent notification completed');
        }

        console.log('🎉 Like operation completed successfully');
      } else {
        throw new Error(response.data?.message || 'Invalid response format from server');
      }

    } catch (error) {
      console.error('🚨 === MEMORY PHOTO LIKE ERROR ===');
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        photoId: photo._id
      });

      let errorMessage = 'Failed to update like';
      
      if (error.response?.status === 404) {
        errorMessage = 'Photo not found';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to like this photo';
      } else if (error.response?.status === 401) {
        errorMessage = 'Please log in to like photos';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Error', errorMessage);
      
      setLikes(prev => ({ ...prev, loading: false }));
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
      // Single tap - open fullscreen after delay to check for double tap
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

  // NEW: Navigate to dedicated likes screen instead of modal
  const handleLikesPress = () => {
    if (likes.count > 0) {
      navigation.navigate('PostLikesScreen', { 
        postId: photo._id,
        likeCount: likes.count,
        isMemoryPost: true // This will help the screen handle memory photos correctly
      });
    }
  };

  const photoUrl = getImageUrl(photo.url);

  return (
    <View style={styles.container}>
      {/* User Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: getProfilePictureUrl(
                  photo.uploadedBy?.profilePicture, 
                  photo.uploadedBy?.username?.charAt(0) || 'U'
                )
              }}
              style={styles.avatar}
              onError={(error) => {
                console.warn('❌ Profile picture failed to load:', error.nativeEvent?.error);
              }}
            />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>
              {photo.uploadedBy?.username || photo.uploadedBy?.fullName || 'Unknown User'}
            </Text>
            <Text style={styles.timeAgo}>
              {getRelativeTime(photo.uploadedAt)}
            </Text>
          </View>
        </View>
      </View>

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

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          {/* Like Button */}
          <TouchableOpacity
            onPress={handleLike}
            disabled={likes.loading}
            style={styles.actionButton}
          >
            <Ionicons 
              name={likes.userLiked ? "heart" : "heart-outline"} 
              size={28} 
              color={likes.userLiked ? "#FF3B30" : "#000000"} 
            />
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity
            onPress={handleCommentsPress}
            style={styles.actionButton}
          >
            <Ionicons name="chatbubble-outline" size={28} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        {/* Like Count - Clickable */}
        {likes.count > 0 && (
          <TouchableOpacity onPress={handleLikesPress} style={styles.likesContainer}>
            <Text style={styles.likesText}>
              {likes.count.toLocaleString()} {likes.count === 1 ? 'like' : 'likes'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Caption - only show if present */}
        {photo.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>
              <Text style={styles.captionUsername}>{photo.uploadedBy?.username} </Text>
              {photo.caption}
            </Text>
          </View>
        )}

        {/* View Comments Link */}
        {comments.count > 0 && (
          <TouchableOpacity onPress={handleCommentsPress} style={styles.viewCommentsContainer}>
            <Text style={styles.viewCommentsText}>
              View all {comments.count} comment{comments.count === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Inline Comment Input (matching PostItem exactly) */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.commentInputContainer}
      >
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="#8E8E93"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          onSubmitEditing={submitComment}
          returnKeyType="send"
        />
        <TouchableOpacity 
          onPress={submitComment}
          disabled={!commentText.trim() || submittingComment}
          style={[
            styles.commentSubmitBtn,
            (!commentText.trim() || submittingComment) && styles.commentSubmitBtnDisabled
          ]}
        >
          <Text style={[
            styles.commentSubmitText,
            (!commentText.trim() || submittingComment) && styles.commentSubmitTextDisabled
          ]}>
            {submittingComment ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    borderRadius: 20, // More curved edges
    borderWidth: 1, // Subtle border around component
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08, // Softer shadow
    shadowRadius: 12,
    elevation: 6,
  },

  // Header styles
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA', // Slightly different background for whimsy
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    borderRadius: 14, // More curved
    borderWidth: 2, // Subtle border around profile picture
    borderColor: '#E8E8E8',
    padding: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12, // More curved corners instead of circle
    backgroundColor: '#F6F6F6',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700', // Bolder for more personality
    color: '#000000',
  },
  timeAgo: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
    fontWeight: '500',
  },

  // Image styles
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  photo: {
    backgroundColor: '#F6F6F6',
  },
  floatingHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    zIndex: 10,
  },

  // Actions styles
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8, // Reduced padding
    backgroundColor: '#FFFFFF',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
  },

  // Stats styles
  statsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  likesContainer: {
    marginBottom: 4, // Much closer to heart button
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  captionContainer: {
    marginTop: 8,
  },
  captionText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },
  captionUsername: {
    fontWeight: '600',
  },
  viewCommentsContainer: {
    marginTop: 4,
  },
  viewCommentsText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Inline Comment Input Container (matching PostItem exactly)
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8, // Reduced from 12 to move comment up
    paddingBottom: 12, // Reduced from 16 to move comment up
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    marginBottom: 4,
  },
  
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EEEEEE', // Very slightly darker gray
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: '#F6F6F6', // Very slightly darker gray
    color: '#000000',
  },
  
  commentSubmitBtn: {
    marginLeft: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#E0EBF8', // Very slightly darker blue-gray
    borderWidth: 1,
    borderColor: '#B8D4F1', // Very slightly darker border
    minWidth: 50,
    alignItems: 'center',
  },
  
  commentSubmitBtnDisabled: {
    backgroundColor: '#F2F2F2', // Very slightly darker disabled state
    borderColor: '#DDDDDD', // Very slightly darker border
  },
  
  commentSubmitText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 13,
  },
  
  commentSubmitTextDisabled: {
    color: '#9E9E9E',
  },
});