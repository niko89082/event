// SocialApp/components/MemoryPhotoItem.js - Fixed with centralized state management
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, 
  Animated, Alert, Dimensions, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import usePostsStore from '../stores/postsStore';
import { API_BASE_URL } from '@env';

const { width: screenWidth } = Dimensions.get('window');

export default function MemoryPhotoItem({ 
  photo, 
  onCommentUpdate, 
  onOpenComments,
  onOpenFullscreen
}) {
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  
  // ✅ FIXED: Use centralized store for post data
  const { 
    getPost, 
    updatePost, 
    toggleLike, 
    addComment 
  } = usePostsStore();

  // Get post data from store (fallback to prop data)
  const storePost = getPost(photo._id);
  const postData = storePost || photo;

  // Local state for UI interactions only
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  // State for image dimensions to maintain aspect ratio
  const [imageDimensions, setImageDimensions] = useState({
    width: screenWidth - 40,
    height: 300
  });

  // Animation refs for heart double-tap
  const heartScale = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  const DOUBLE_PRESS_DELAY = 300;

  // ✅ FIXED: Initialize post in store if not present
  useEffect(() => {
    if (!storePost && photo._id) {
      updatePost(photo._id, {
        ...photo,
        userLiked: Boolean(photo.userLiked),
        likeCount: photo.likeCount || 0,
        commentCount: photo.commentCount || 0,
        postType: 'memory'
      });
    }
  }, [photo._id, storePost]);

  // Get image dimensions to maintain aspect ratio
  useEffect(() => {
    const photoUrl = getImageUrl(photo.url);
    if (photoUrl) {
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

  // ✅ FIXED: Simplified like handler using centralized store
  const handleLike = async () => {
    if (isLiking) {
      console.log('⚠️ Like request already in progress, ignoring');
      return;
    }

    if (!currentUser?._id) {
      Alert.alert('Error', 'You must be logged in to like photos');
      return;
    }

    console.log('🚀 === MEMORY PHOTO LIKE START ===');
    console.log('📷 Current state before like:', {
      photoId: photo._id,
      currentLiked: postData.userLiked,
      currentCount: postData.likeCount,
      timestamp: new Date().toISOString()
    });

    setIsLiking(true);

    try {
      const newLikedState = await toggleLike(
        photo._id, 
        true, // isMemoryPost = true
        currentUser._id
      );

      // Animate heart if liking
      if (newLikedState && !postData.userLiked) {
        triggerHeartAnimation();
      }

      console.log('✅ Memory photo like completed successfully');

    } catch (error) {
      console.error('❌ Memory photo like error:', error);
      
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
    } finally {
      setIsLiking(false);
    }
  };

  // ✅ NEW: Separate heart animation function
  const triggerHeartAnimation = () => {
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
  };

  // ✅ FIXED: Simplified comment submission using centralized store
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
      commentText: commentText.trim()
    });

    try {
      setSubmittingComment(true);

      await addComment(
        photo._id, 
        commentText.trim(), 
        true // isMemoryPost = true
      );
      
      setCommentText('');
      console.log('✅ Inline memory comment submitted successfully');

      // Notify parent component if callback provided
      if (onCommentUpdate) {
        onCommentUpdate(photo._id, {
          commentCount: postData.commentCount + 1
        });
      }

    } catch (error) {
      console.error('❌ Error submitting inline memory comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleImagePress = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;

    if (timeSinceLastTap < DOUBLE_PRESS_DELAY) {
      // Double tap - like the photo
      if (!postData.userLiked) {
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

  // Navigate to dedicated likes screen
  const handleLikesPress = () => {
    if (postData.likeCount > 0) {
      navigation.navigate('PostLikesScreen', { 
        postId: photo._id,
        likeCount: postData.likeCount,
        isMemoryPost: true
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
            disabled={isLiking}
            style={styles.actionButton}
          >
            <Ionicons 
              name={postData.userLiked ? "heart" : "heart-outline"} 
              size={28} 
              color={postData.userLiked ? "#FF3B30" : "#000000"} 
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
        {postData.likeCount > 0 && (
          <TouchableOpacity onPress={handleLikesPress} style={styles.likesContainer}>
            <Text style={styles.likesText}>
              {postData.likeCount.toLocaleString()} {postData.likeCount === 1 ? 'like' : 'likes'}
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
        {postData.commentCount > 0 && (
          <TouchableOpacity onPress={handleCommentsPress} style={styles.viewCommentsContainer}>
            <Text style={styles.viewCommentsText}>
              View all {postData.commentCount} comment{postData.commentCount === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Inline Comment Input */}
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },

  // Header styles
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    padding: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
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
    paddingVertical: 8,
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
    marginBottom: 4,
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

  // Inline Comment Input Container
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    marginBottom: 4,
  },
  
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: '#F6F6F6',
    color: '#000000',
  },
  
  commentSubmitBtn: {
    marginLeft: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#E0EBF8',
    borderWidth: 1,
    borderColor: '#B8D4F1',
    minWidth: 50,
    alignItems: 'center',
  },
  
  commentSubmitBtnDisabled: {
    backgroundColor: '#F2F2F2',
    borderColor: '#DDDDDD',
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