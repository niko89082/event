// components/MemoryPostActivityComponent.js - Memory Photo Upload with PostActivityComponent Design
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { niceDate } from '../utils/helpers';
import { API_BASE_URL } from '@env';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 32; // Account for card margins
const MAX_IMAGE_HEIGHT = 400;

const MemoryPostActivityComponent = ({ 
  activity, 
  currentUserId, 
  navigation,
  onCommentAdded 
}) => {
  const { data, metadata, timestamp } = activity;
  const { photo, memory, uploader } = data;
  
  // State for caption expansion
  const [showFullCaption, setShowFullCaption] = useState(false);
  
  // State for comments
  const [latestComment, setLatestComment] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  
  // Enhanced state management
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [commentSubmitAttempts, setCommentSubmitAttempts] = useState(0);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const commentAddAnim = useRef(new Animated.Value(0)).current;
  const inputScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Component refs
  const commentInputRef = useRef(null);
  const mountedRef = useRef(true);

  // Component mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keyboard handling
  useEffect(() => {
    const keyboardWillShow = (event) => {
      if (isInputFocused) {
        setKeyboardHeight(event.endCoordinates.height);
      }
    };
    
    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    let keyboardDidShowListener, keyboardDidHideListener;
    
    if (Platform.OS === 'ios') {
      keyboardDidShowListener = Keyboard.addListener('keyboardWillShow', keyboardWillShow);
      keyboardDidHideListener = Keyboard.addListener('keyboardWillHide', keyboardWillHide);
    } else {
      keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', keyboardWillShow);
      keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', keyboardWillHide);
    }

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [isInputFocused]);

  // Component entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Comment addition animation
  const animateCommentAddition = useCallback(() => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    
    Animated.sequence([
      Animated.timing(commentAddAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(commentAddAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Input focus animation
  const animateInputFocus = useCallback((focused) => {
    Animated.spring(inputScaleAnim, {
      toValue: focused ? 1.02 : 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, []);

  // Initialize comment data from photo
  useEffect(() => {
    if (photo && !commentsLoaded) {
      setCommentCount(photo.commentCount || photo.comments?.length || 0);
      
      // Get the latest comment if available
      if (photo.comments && photo.comments.length > 0) {
        const sortedComments = [...photo.comments].sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setLatestComment(sortedComments[0]);
      }
      
      setCommentsLoaded(true);
    }
  }, [photo, commentsLoaded]);

  // Enhanced navigation handlers
  const handleImagePress = useCallback(() => {
    console.log('📱 MemoryPostActivityComponent: Image pressed, navigating to UnifiedDetails');
    
    // Navigate to UnifiedDetailsScreen for memory photos, not PostDetailsScreen
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'memory',
      post: {
        ...photo,
        postType: 'memory',
        user: uploader,
        createdAt: timestamp,
        memoryInfo: {
          memoryId: memory._id,
          memoryTitle: memory.title
        }
      }
    });
  }, [photo._id, navigation, photo, uploader, timestamp, memory]);

  const handleUserPress = useCallback(() => {
    console.log('📱 MemoryPostActivityComponent: User pressed, navigating to Profile');
    navigation.navigate('ProfileScreen', { userId: uploader._id });
  }, [uploader._id, navigation]);

  const handleMemoryPress = useCallback(() => {
    console.log('📱 MemoryPostActivityComponent: Memory pressed, navigating to MemoryDetails');
    navigation.navigate('MemoryDetailsScreen', { memoryId: memory._id });
  }, [memory._id, navigation]);

  const handleViewAllComments = useCallback(() => {
    console.log('📱 MemoryPostActivityComponent: View comments pressed, navigating to UnifiedDetails');
    
    // Navigate to UnifiedDetailsScreen for memory photos with comment focus
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'memory',
      openKeyboard: true, // Focus on comments
      post: {
        ...photo,
        postType: 'memory',
        user: uploader,
        createdAt: timestamp,
        memoryInfo: {
          memoryId: memory._id,
          memoryTitle: memory.title
        }
      }
    });
  }, [photo._id, navigation, photo, uploader, timestamp, memory]);

  const handleCommentUserPress = useCallback(() => {
    if (latestComment?.user?._id) {
      console.log('📱 MemoryPostActivityComponent: Comment user pressed, navigating to Profile');
      navigation.navigate('ProfileScreen', { userId: latestComment.user._id });
    }
  }, [latestComment?.user?._id, navigation]);

  // Enhanced comment submission with retry logic
  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim() || !currentUserId || isSubmittingComment) {
      return;
    }

    const trimmedComment = commentText.trim();
    console.log('💬 MemoryPostActivityComponent: Submitting comment:', {
      photoId: photo._id,
      isMemoryPhoto: true,
      commentLength: trimmedComment.length,
      attempt: commentSubmitAttempts + 1
    });

    setIsSubmittingComment(true);
    animateInputFocus(false);

    // Create optimistic comment for immediate UI feedback
    const optimisticComment = {
      _id: `temp-${Date.now()}`,
      text: trimmedComment,
      user: {
        _id: currentUserId,
        username: 'You',
        profilePicture: null
      },
      createdAt: new Date().toISOString(),
      isTemp: true
    };

    // Update UI immediately with animation
    setLatestComment(optimisticComment);
    setCommentCount(prev => prev + 1);
    setCommentText('');
    animateCommentAddition();

    try {
      // Use memory photo comment endpoint
      const endpoint = `/api/memories/photos/${photo._id}/comments`;

      console.log('📡 MemoryPostActivityComponent: Using endpoint:', endpoint);

      const response = await api.post(endpoint, {
        text: trimmedComment,
        tags: []
      });

      // Only update if component is still mounted
      if (!mountedRef.current) return;

      console.log('✅ MemoryPostActivityComponent: Comment submitted successfully');

      // Update with real comment data
      let realComment = null;
      if (response.data.comment) {
        realComment = response.data.comment;
      } else if (response.data.comments && response.data.comments.length > 0) {
        const comments = response.data.comments;
        realComment = comments[comments.length - 1];
      }

      if (realComment) {
        setLatestComment(realComment);
        console.log('💬 Updated with real comment data:', realComment);
      }

      // Reset submit attempts on success
      setCommentSubmitAttempts(0);

      // Notify parent component
      if (onCommentAdded) {
        onCommentAdded(realComment || optimisticComment);
      }

      // Blur input and dismiss keyboard
      commentInputRef.current?.blur();

    } catch (error) {
      console.error('❌ MemoryPostActivityComponent: Comment submission failed:', error);
      
      // Only handle error if component is still mounted
      if (!mountedRef.current) return;
      
      // Increment attempt counter
      const newAttempts = commentSubmitAttempts + 1;
      setCommentSubmitAttempts(newAttempts);
      
      // Revert optimistic update
      const originalComment = photo.comments && photo.comments.length > 0 
        ? [...photo.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        : null;
      
      setLatestComment(originalComment);
      setCommentCount(photo.commentCount || photo.comments?.length || 0);
      setCommentText(trimmedComment);
      
      // Show different error messages based on attempts
      let errorMessage = 'Failed to post comment. Please try again.';
      if (newAttempts >= 3) {
        errorMessage = 'Multiple failures detected. Please check your connection and try again later.';
      } else if (newAttempts >= 2) {
        errorMessage = 'Still having trouble posting your comment. Check your internet connection.';
      }
      
      Alert.alert('Error', errorMessage);
      
    } finally {
      if (mountedRef.current) {
        setIsSubmittingComment(false);
      }
    }
  }, [
    commentText, 
    currentUserId, 
    isSubmittingComment, 
    photo._id, 
    photo.commentCount, 
    photo.comments, 
    commentSubmitAttempts,
    onCommentAdded,
    animateInputFocus,
    animateCommentAddition
  ]);

  // Input focus handlers
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
    animateInputFocus(true);
  }, [animateInputFocus]);

  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    animateInputFocus(false);
  }, [animateInputFocus]);

  // Enhanced image loading handlers
  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
    console.warn('📸 MemoryPostActivityComponent: Image failed to load for photo:', photo._id);
  }, [photo._id]);

  // Image URL processing
  const imageUrl = useMemo(() => {
    if (!photo.url) return null;
    
    if (photo.url.startsWith('http')) return photo.url;
    
    const cleanPath = photo.url.startsWith('/') ? photo.url : `/${photo.url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  }, [photo.url]);

  // Caption processing
  const caption = photo.caption || '';
  const CAPTION_LIMIT = 200;
  const shouldTruncateCaption = caption.length > CAPTION_LIMIT;
  const displayCaption = showFullCaption || !shouldTruncateCaption 
    ? caption 
    : caption.substring(0, CAPTION_LIMIT) + '...';

  // Image dimensions calculation
  const getImageDimensions = () => {
    // Default aspect ratio for memory photos
    const aspectRatio = 4/3;
    const height = Math.min(IMAGE_WIDTH / aspectRatio, MAX_IMAGE_HEIGHT);
    
    return {
      width: IMAGE_WIDTH,
      height: height
    };
  };

  const imageDimensions = getImageDimensions();

  // Helper function to get profile picture URL
  const getProfilePictureUrl = useCallback((user) => {
    if (!user?.profilePicture) return null;
    
    if (user.profilePicture.startsWith('http')) {
      return user.profilePicture;
    }
    
    return `http://${API_BASE_URL}:3000${user.profilePicture}`;
  }, []);

  // Enhanced comment display component
  const renderLatestComment = () => {
    if (!latestComment) return null;

    return (
      <Animated.View 
        style={[
          styles.commentContainer,
          {
            opacity: fadeAnim,
            transform: [
              { 
                scale: commentAddAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05]
                })
              }
            ]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.commentAvatarContainer}
          onPress={handleCommentUserPress}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel={`View ${latestComment.user?.username}'s profile`}
          accessibilityRole="button"
        >
          {getProfilePictureUrl(latestComment.user) ? (
            <Image
              source={{ uri: getProfilePictureUrl(latestComment.user) }}
              style={styles.commentAvatar}
            />
          ) : (
            <View style={[styles.commentAvatar, styles.placeholderCommentAvatar]}>
              <Ionicons name="person" size={12} color="#8E8E93" />
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.commentContent}>
          <Text style={[styles.commentText, latestComment.isTemp && styles.tempCommentText]} numberOfLines={1}>
            <Text style={styles.commentUsername}>
              {latestComment.user?.username || 'Unknown'}
            </Text>
            {' '}
            {latestComment.text}
          </Text>
          <Text style={styles.commentTime}>
            {latestComment.isTemp ? 'Posting...' : niceDate(latestComment.createdAt)}
          </Text>
        </View>
        
        {latestComment.isTemp && (
          <View style={styles.tempIndicator}>
            <ActivityIndicator size="small" color="#3797EF" />
          </View>
        )}
      </Animated.View>
    );
  };

  // Enhanced comments section
  const renderCommentsSection = () => {
    return (
      <View style={styles.commentsSection}>
        {/* Latest Comment with Animation */}
        {renderLatestComment()}
        
        {/* View All Comments Link with Animation */}
        {commentCount > 1 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity 
              style={styles.viewAllCommentsButton}
              onPress={handleViewAllComments}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel={`View all ${commentCount} comments`}
              accessibilityRole="button"
            >
              <Text style={styles.viewAllCommentsText}>
                View all {commentCount} comment{commentCount === 1 ? '' : 's'}
              </Text>
              <Ionicons 
                name="chevron-forward" 
                size={14} 
                color="#8E8E93" 
                style={styles.viewAllCommentsIcon}
              />
            </TouchableOpacity>
          </Animated.View>
        )}
        
        {/* Enhanced Comment Input */}
        <Animated.View 
          style={[
            styles.commentInputContainer,
            {
              transform: [
                { scale: inputScaleAnim },
                { translateY: keyboardHeight > 0 ? -keyboardHeight / 4 : 0 }
              ]
            },
            isInputFocused && styles.commentInputContainerFocused
          ]}
        >
          <View style={styles.currentUserAvatarContainer}>
            {getProfilePictureUrl({ profilePicture: null }) ? (
              <Image
                source={{ uri: getProfilePictureUrl({ profilePicture: null }) }}
                style={styles.commentInputAvatar}
              />
            ) : (
              <View style={[styles.commentInputAvatar, styles.placeholderInputAvatar]}>
                <Ionicons name="person" size={12} color="#8E8E93" />
              </View>
            )}
          </View>
          
          <TextInput
            ref={commentInputRef}
            style={[
              styles.commentInput,
              isInputFocused && styles.commentInputFocused,
              commentSubmitAttempts > 0 && styles.commentInputError
            ]}
            placeholder="Share your thoughts about this memory..."
            placeholderTextColor="#8E8E93"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSubmitComment}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            editable={!isSubmittingComment}
            accessible={true}
            accessibilityLabel="Share your thoughts about this memory"
          />
          
          <TouchableOpacity
            style={[
              styles.commentSubmitButton,
              (!commentText.trim() || isSubmittingComment) && styles.commentSubmitButtonDisabled,
              commentText.trim() && styles.commentSubmitButtonActive
            ]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || isSubmittingComment}
            activeOpacity={0.7}
            accessible={true}
            accessibilityLabel="Post comment"
            accessibilityRole="button"
          >
            {isSubmittingComment ? (
              <ActivityIndicator size="small" color="#3797EF" />
            ) : (
              <Ionicons 
                name="send" 
                size={16} 
                color={commentText.trim() ? "#FFFFFF" : "#C7C7CC"} 
              />
            )}
          </TouchableOpacity>
        </Animated.View>
        
        {/* Character count indicator for long comments */}
        {commentText.length > 400 && (
          <Animated.View 
            style={[
              styles.characterCountContainer,
              { opacity: fadeAnim }
            ]}
          >
            <Text style={[
              styles.characterCountText,
              commentText.length >= 500 && styles.characterCountWarning
            ]}>
              {500 - commentText.length} characters remaining
            </Text>
          </Animated.View>
        )}
        
        {/* Network retry indicator */}
        {commentSubmitAttempts > 0 && (
          <View style={styles.retryIndicator}>
            <Ionicons name="warning" size={14} color="#FF6B6B" />
            <Text style={styles.retryText}>
              {commentSubmitAttempts === 1 ? 'Retrying...' : `${commentSubmitAttempts} attempts failed`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Memory-specific header
  const renderMemoryHeader = () => {
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.userSection}
          onPress={handleUserPress}
          activeOpacity={0.7}
        >
          {/* Profile Picture */}
          {getProfilePictureUrl(uploader) ? (
            <Image
              source={{ uri: getProfilePictureUrl(uploader) }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={16} color="#8E8E93" />
            </View>
          )}

          {/* User Info */}
          <View style={styles.userInfo}>
            <View style={styles.usernameRow}>
              <Text style={styles.username} numberOfLines={1}>
                {uploader.displayName || uploader.username || 'Unknown User'}
              </Text>
              <Text style={styles.actionText}> added a photo to </Text>
            </View>
            <TouchableOpacity onPress={handleMemoryPress} activeOpacity={0.7}>
              <Text style={styles.memoryTitle} numberOfLines={1}>
                {memory.title}
              </Text>
            </TouchableOpacity>
            <Text style={styles.timeAgo}>
              {niceDate(timestamp)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Memory Icon */}
        <View style={styles.memoryActivityIcon}>
          <Ionicons 
            name="heart" 
            size={16} 
            color="#FF9500" 
          />
        </View>
      </View>
    );
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      {/* Memory-specific Header */}
      {renderMemoryHeader()}

      {/* Caption Section */}
      {caption ? (
        <Animated.View 
          style={[styles.captionContainer, { opacity: fadeAnim }]}
        >
          <Text style={styles.captionText}>
            {displayCaption}
          </Text>
          {shouldTruncateCaption && !showFullCaption && (
            <TouchableOpacity 
              onPress={() => setShowFullCaption(true)}
              style={styles.moreButton}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Show full caption"
              accessibilityRole="button"
            >
              <Text style={styles.moreText}>more</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : null}

      {/* Enhanced Image Display with Loading States */}
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={handleImagePress}
        activeOpacity={0.95}
        accessible={true}
        accessibilityLabel="View full memory photo"
        accessibilityRole="button"
      >
        {imageUrl && !imageError ? (
          <>
            <Image
              source={{ uri: imageUrl }}
              style={[styles.postImage, imageDimensions]}
              resizeMode="cover"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            
            {/* Loading overlay */}
            {imageLoading && (
              <View style={[styles.imageLoadingOverlay, imageDimensions]}>
                <ActivityIndicator size="large" color="#FF9500" />
              </View>
            )}
          </>
        ) : (
          <View style={[styles.imagePlaceholder, imageDimensions]}>
            <Ionicons 
              name={imageError ? "image-outline" : "image-outline"} 
              size={48} 
              color="#C7C7CC" 
            />
            <Text style={styles.placeholderText}>
              {imageError ? 'Failed to load image' : 'No image'}
            </Text>
            {imageError && (
              <TouchableOpacity 
                style={styles.retryImageButton}
                onPress={() => {
                  setImageError(false);
                  setImageLoading(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.retryImageText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Memory Badge Overlay */}
        <Animated.View 
          style={[
            styles.memoryOverlay,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.memoryBadge}>
            <Ionicons name="heart" size={14} color="#FFFFFF" />
            <Text style={styles.memoryBadgeText}>Memory</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Enhanced Comments Section */}
      {renderCommentsSection()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },

  // Memory-specific Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    marginTop: 2,
  },
  placeholderAvatar: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  actionText: {
    fontSize: 15,
    color: '#1C1C1E',
  },
  memoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 2,
  },
  timeAgo: {
    fontSize: 13,
    color: '#8E8E93',
  },
  memoryActivityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF950020',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },

  // Caption Styles
  captionContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  captionText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1C1C1E',
  },
  moreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  moreText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
  },

  // Image Styles - Enhanced with loading states
  imageContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postImage: {
    backgroundColor: '#F6F6F6',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(246, 246, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
  },
  retryImageButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF9500',
    borderRadius: 6,
  },
  retryImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Memory Badge Overlay
  memoryOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  memoryBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Enhanced Comments Section
  commentsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Latest Comment Styles - Enhanced
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingVertical: 2,
  },
  commentAvatarContainer: {
    marginRight: 8,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  placeholderCommentAvatar: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#1C1C1E',
  },
  commentUsername: {
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  tempCommentText: {
    opacity: 0.7,
  },
  tempIndicator: {
    marginLeft: 8,
    marginTop: 2,
  },

  // View All Comments Button - Enhanced
  viewAllCommentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  viewAllCommentsText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  viewAllCommentsIcon: {
    marginLeft: 4,
  },

  // Enhanced Comment Input Styles
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF8F0',
    borderRadius: 20,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  commentInputContainerFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF9500',
    shadowColor: '#FF9500',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  currentUserAvatarContainer: {
    marginRight: 8,
  },
  commentInputAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  placeholderInputAvatar: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    maxHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  commentInputFocused: {
    color: '#000000',
  },
  commentInputError: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  commentSubmitButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  commentSubmitButtonActive: {
    backgroundColor: '#FF9500',
    shadowColor: '#FF9500',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#F2F2F7',
    opacity: 0.6,
  },

  // Enhancement Styles
  characterCountContainer: {
    alignItems: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  characterCountWarning: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  retryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginLeft: 6,
    fontWeight: '500',
  },
});

export default MemoryPostActivityComponent;