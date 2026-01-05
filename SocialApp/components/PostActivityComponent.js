// components/PostActivityComponent.js - Phase 3: Polish & Optimization
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeader from './activities/ActivityHeader';
import PhotoCarousel from './PhotoCarousel';
import { niceDate } from '../utils/helpers';
import { API_BASE_URL } from '@env';
import api from '../services/api';
import usePostsStore from '../stores/postsStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 32; // Account for card margins
const MAX_IMAGE_HEIGHT = 400;

const PostActivityComponent = ({ 
  activity, 
  currentUserId, 
  navigation,
  onCommentAdded,
  onLike 
}) => {
  const post = activity;
  const user = post.user || {};
  const isMemoryPost = post.postType === 'memory';
  
  // Get centralized post state from store
  const toggleLikeInStore = usePostsStore(state => state.toggleLike);
  
  // Get post from store - use selector that returns stable reference
  const storePost = usePostsStore(state => {
    if (!post._id) return null;
    return state.posts.get(post._id);
  });
  
  // Memoize the like state to prevent unnecessary re-renders
  const isLikedFromStore = useMemo(() => {
    if (!storePost) return null;
    return Boolean(storePost.userLiked);
  }, [storePost?.userLiked]);
  
  const likeCountFromStore = useMemo(() => {
    if (!storePost) return null;
    return storePost.likeCount || 0;
  }, [storePost?.likeCount]);
  
  // Initialize store with this post if not already there (only once per post ID)
  const initializedPostIds = useRef(new Set());
  useEffect(() => {
    if (post._id && !initializedPostIds.current.has(post._id)) {
      const existingPost = usePostsStore.getState().posts.get(post._id);
      if (!existingPost) {
        initializedPostIds.current.add(post._id);
        // Ensure userLiked is properly set from initial post data
        const postToAdd = {
          ...post,
          userLiked: Boolean(post.userLiked || (post.likes && Array.isArray(post.likes) && post.likes.includes(currentUserId))),
          likeCount: post.likeCount || (post.likes && Array.isArray(post.likes) ? post.likes.length : 0),
        };
        usePostsStore.getState().addPost(postToAdd);
      } else {
        initializedPostIds.current.add(post._id);
      }
    }
  }, [post._id, currentUserId]); // Include currentUserId to properly check like status
  
  // Use store data if available, otherwise fall back to initial post
  const currentPost = storePost || post;
  
  // State for caption expansion
  const [showFullCaption, setShowFullCaption] = useState(false);
  
  // State for comments
  const [latestComment, setLatestComment] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  
  // Phase 3: Enhanced state management
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [postLoading, setPostLoading] = useState(!post || !post._id);
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

  // Phase 3: Component mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Phase 3: Keyboard handling
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

  // Phase 3: Component entrance animation
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

  // Phase 3: Comment addition animation
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

  // Phase 3: Input focus animation
  const animateInputFocus = useCallback((focused) => {
    Animated.spring(inputScaleAnim, {
      toValue: focused ? 1.02 : 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, []);

  // Initialize comment data from post
  useEffect(() => {
    if (post && !commentsLoaded) {
      setCommentCount(post.commentCount || post.comments?.length || 0);
      
      // Get the latest comment if available
      if (post.comments && post.comments.length > 0) {
        const sortedComments = [...post.comments].sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setLatestComment(sortedComments[0]);
      }
      
      setCommentsLoaded(true);
    }
  }, [post, commentsLoaded]);

  // Phase 3: Enhanced navigation handlers with haptic feedback
  const handleImagePress = useCallback(() => {
  console.log('📱 PostActivityComponent: Image pressed, navigating to UnifiedDetails');
  
  // Add subtle haptic feedback on iOS
  if (Platform.OS === 'ios' && typeof Haptics !== 'undefined') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  
  // ✅ FIXED: Navigate to UnifiedDetailsScreen instead of PostDetailsScreen
  navigation.navigate('UnifiedDetailsScreen', { 
    postId: post._id,
    postType: isMemoryPost ? 'memory' : 'post', // Specify post type
    post: {
      ...post,
      postType: isMemoryPost ? 'memory' : 'post',
      user: user,
      createdAt: post.createdAt || post.uploadDate
    },
    source: 'activity_feed'
  });
}, [post._id, navigation, post, user, isMemoryPost]);

  const handleUserPress = useCallback(() => {
    console.log('📱 PostActivityComponent: User pressed, navigating to Profile');
    navigation.navigate('ProfileScreen', { userId: user._id });
  }, [user._id, navigation]);

  const handleEventPress = useCallback(() => {
    if (post.event?._id) {
      console.log('📱 PostActivityComponent: Event pressed, navigating to EventDetails');
      navigation.navigate('EventDetailsScreen', { eventId: post.event._id });
    }
  }, [post.event?._id, navigation]);

  const handleViewAllComments = useCallback(() => {
  console.log('📱 PostActivityComponent: View comments pressed, navigating to UnifiedDetails');
  
  // ✅ FIXED: Navigate to UnifiedDetailsScreen instead of PostDetailsScreen
  navigation.navigate('UnifiedDetailsScreen', { 
    postId: post._id,
    postType: isMemoryPost ? 'memory' : 'post', // Specify post type
    post: {
      ...post,
      postType: isMemoryPost ? 'memory' : 'post',
      user: user,
      createdAt: post.createdAt || post.uploadDate
    },
    source: 'activity_feed',
    focusComments: true,
    openKeyboard: true // Auto-focus comment input
  });
}, [post._id, navigation, post, user, isMemoryPost]);


  const handleCommentUserPress = useCallback(() => {
    if (latestComment?.user?._id) {
      console.log('📱 PostActivityComponent: Comment user pressed, navigating to Profile');
      navigation.navigate('ProfileScreen', { userId: latestComment.user._id });
    }
  }, [latestComment?.user?._id, navigation]);

  // Phase 3: Enhanced comment submission with retry logic
  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim() || !currentUserId || isSubmittingComment) {
      return;
    }

    const trimmedComment = commentText.trim();
    console.log('💬 PostActivityComponent: Submitting comment:', {
      postId: post._id,
      isMemoryPost,
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
      // Determine correct API endpoint
      const endpoint = isMemoryPost 
        ? `/api/memories/photos/${post._id}/comments`
        : `/api/photos/comment/${post._id}`;

      console.log('📡 PostActivityComponent: Using endpoint:', endpoint);

      const response = await api.post(endpoint, {
        text: trimmedComment,
        tags: []
      });

      // Only update if component is still mounted
      if (!mountedRef.current) return;

      console.log('✅ PostActivityComponent: Comment submitted successfully');

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
      console.error('❌ PostActivityComponent: Comment submission failed:', error);
      
      // Only handle error if component is still mounted
      if (!mountedRef.current) return;
      
      // Increment attempt counter
      const newAttempts = commentSubmitAttempts + 1;
      setCommentSubmitAttempts(newAttempts);
      
      // Revert optimistic update
      const originalComment = post.comments && post.comments.length > 0 
        ? [...post.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        : null;
      
      setLatestComment(originalComment);
      setCommentCount(post.commentCount || post.comments?.length || 0);
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
    post._id, 
    isMemoryPost, 
    post.commentCount, 
    post.comments, 
    commentSubmitAttempts,
    onCommentAdded,
    animateInputFocus,
    animateCommentAddition
  ]);

  // Phase 3: Input focus handlers
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
    animateInputFocus(true);
  }, [animateInputFocus]);

  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    animateInputFocus(false);
  }, [animateInputFocus]);

  // Phase 3: Enhanced image loading handlers
  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
    console.warn('📸 PostActivityComponent: Image failed to load for post:', post._id);
  }, [post._id]);

  // Image URL processing
  const hasPhotos = post.paths && post.paths.length > 0;
  const photos = post.paths || [];
  
  const imageUrl = useMemo(() => {
    if (!post.paths || !post.paths[0]) return null;
    
    const path = post.paths[0];
    if (path.startsWith('http')) return path;
    
    return `http://${API_BASE_URL}:3000${path}`;
  }, [post.paths]);

  // Caption processing with hashtag extraction
  const caption = post.caption || post.textContent || '';
  const CAPTION_LIMIT = 200;
  const shouldTruncateCaption = caption.length > CAPTION_LIMIT;
  const displayCaption = showFullCaption || !shouldTruncateCaption 
    ? caption 
    : caption.substring(0, CAPTION_LIMIT) + '...';
  
  // Extract hashtags from caption
  const hashtagRegex = /#[\w]+/g;
  const hashtags = useMemo(() => {
    const matches = caption.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  }, [caption]);
  
  // Split caption into text and hashtags for rendering
  const renderCaptionWithHashtags = () => {
    if (!displayCaption) return null;
    
    const parts = [];
    let lastIndex = 0;
    let match;
    const regex = /#[\w]+/g;
    
    while ((match = regex.exec(displayCaption)) !== null) {
      // Add text before hashtag
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: displayCaption.substring(lastIndex, match.index)
        });
      }
      // Add hashtag
      parts.push({
        type: 'hashtag',
        content: match[0]
      });
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < displayCaption.length) {
      parts.push({
        type: 'text',
        content: displayCaption.substring(lastIndex)
      });
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content: displayCaption }];
  };
  
  const captionParts = renderCaptionWithHashtags();
  
  // Check if this is a text-only post (no image)
  const isTextOnlyPost = !imageUrl && (!post.paths || post.paths.length === 0);
  
  // Check if this post has a review
  const hasReview = post.review && post.review.type && (post.review.type === 'movie' || post.review.type === 'song');
  const review = post.review;
  
  // Get engagement counts from store (always up to date)
  // Prioritize store data, then fall back to post data, then calculate from likes array
  const isLiked = isLikedFromStore !== null
    ? isLikedFromStore
    : (post.userLiked !== undefined 
        ? Boolean(post.userLiked) 
        : (post.likes && Array.isArray(post.likes) && currentUserId 
            ? post.likes.some(likeId => String(likeId) === String(currentUserId))
            : false));
  const likeCount = likeCountFromStore !== null
    ? likeCountFromStore
    : (post.likeCount || (post.likes && Array.isArray(post.likes) ? post.likes.length : 0));
  const repostCount = post.repostCount || 0;
  
  // Follow status - check if current user is following the post author
  const [isFollowing, setIsFollowing] = useState(false);
  const [isCheckingFollow, setIsCheckingFollow] = useState(false);
  
  // Check follow status on mount
  useEffect(() => {
    if (currentUserId && user._id && String(user._id) !== String(currentUserId)) {
      checkFollowStatus();
    }
  }, [currentUserId, user._id]);
  
  const checkFollowStatus = async () => {
    if (!user._id || !currentUserId) return;
    
    try {
      // Check if current user follows the post author
      // Try to get this from the post data first, otherwise fetch it
      if (post.user?.isFollowing !== undefined) {
        setIsFollowing(post.user.isFollowing);
        return;
      }
      
      // Fallback: Get the post author's profile which includes isFollowing status
      const response = await api.get(`/api/profile/${user._id}`);
      if (response.data && response.data.isFollowing !== undefined) {
        setIsFollowing(response.data.isFollowing);
      } else {
        // Last resort: Get current user's profile to check following list
        const currentUserResponse = await api.get(`/api/profile/${currentUserId}`);
        const currentUser = currentUserResponse.data;
        if (currentUser && currentUser.following) {
          const followingIds = (currentUser.following || []).map(id => String(id));
          setIsFollowing(followingIds.includes(String(user._id)));
        } else {
          setIsFollowing(false);
        }
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
      // Default to false if check fails
      setIsFollowing(false);
    }
  };
  
  const handleFollow = async () => {
    if (!user._id || !currentUserId || String(user._id) === String(currentUserId)) {
      return;
    }
    
    try {
      setIsCheckingFollow(true);
      if (isFollowing) {
        await api.delete(`/api/follow/unfollow/${user._id}`);
        setIsFollowing(false);
      } else {
        await api.post(`/api/follow/follow/${user._id}`);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsCheckingFollow(false);
    }
  };

  // Image dimensions calculation
  const getImageDimensions = () => {
    // Default aspect ratio
    const aspectRatio = 4/3;
    const height = Math.min(IMAGE_WIDTH / aspectRatio, MAX_IMAGE_HEIGHT);
    
    return {
      width: IMAGE_WIDTH,
      height: height
    };
  };

  // Helper function to get profile picture URL with caching
  const getProfilePictureUrl = useCallback((user) => {
    if (!user?.profilePicture) return null;
    
    if (user.profilePicture.startsWith('http')) {
      return user.profilePicture;
    }
    
    return `http://${API_BASE_URL}:3000${user.profilePicture}`;
  }, []);

  // Phase 3: Enhanced comment display with loading skeleton
  const renderCommentSkeleton = () => (
    <View style={styles.commentContainer}>
      <View style={[styles.commentAvatar, styles.skeletonAvatar]} />
      <View style={styles.commentContent}>
        <View style={[styles.skeletonText, { width: '60%', height: 14 }]} />
        <View style={[styles.skeletonText, { width: '40%', height: 12, marginTop: 4 }]} />
      </View>
    </View>
  );

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
          <Text style={[styles.commentText, latestComment.isTemp && styles.tempCommentText]}>
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

  // Phase 3: Enhanced comments section with improved UX
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
            placeholder={isMemoryPost ? "Share your thoughts..." : "Add a comment..."}
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
            accessibilityLabel={isMemoryPost ? "Share your thoughts about this memory" : "Add a comment to this post"}
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

  const imageDimensions = getImageDimensions();
  const renderEventReference = () => {
    if (!post.event) return null;

    return (
      <TouchableOpacity
        style={styles.eventReference}
        onPress={handleEventPress}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar" size={12} color="#3797EF" />
        <Text style={styles.eventReferenceText} numberOfLines={1}>
          {post.event.title}
        </Text>
      </TouchableOpacity>
    );
  };

  // Custom activity header with username, handle, and timestamp
  const renderCustomHeader = () => {
    const username = user.displayName || user.username || 'Unknown User';
    const userHandle = user.username ? `@${user.username}` : '';
    const isOwner = String(user._id) === String(currentUserId);
    const showFollowButton = !isOwner && currentUserId && user._id && String(user._id) !== String(currentUserId);
    
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.userSection}
          onPress={handleUserPress}
          activeOpacity={0.7}
        >
          {/* Profile Picture */}
          {user.profilePicture ? (
            <Image
              source={{ uri: user.profilePicture.startsWith('http') 
                ? user.profilePicture 
                : `http://${API_BASE_URL}:3000${user.profilePicture}` 
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={16} color="#8E8E93" />
            </View>
          )}

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.username} numberOfLines={1}>
              {username}
            </Text>
            <View style={styles.userMetaRow}>
              {userHandle && (
                <Text style={styles.userHandle} numberOfLines={1}>
                  {userHandle}
                </Text>
              )}
              {userHandle && (
                <Text style={styles.metaDot}> • </Text>
              )}
              <Text style={styles.timeAgo}>
                {niceDate(post.createdAt || post.uploadDate)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Follow Button or Three-dot menu */}
        {showFollowButton ? (
          <TouchableOpacity 
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={handleFollow}
            disabled={isCheckingFollow}
            activeOpacity={0.7}
          >
            {isCheckingFollow ? (
              <ActivityIndicator size="small" color={isFollowing ? "#000000" : "#FFFFFF"} />
            ) : (
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        ) : isOwner ? (
          <TouchableOpacity 
            style={styles.moreMenuButton}
            onPress={() => {
              Alert.alert(
                'Post Options',
                'What would you like to do?',
                [
                  { text: 'Edit', onPress: () => {} },
                  { text: 'Delete', style: 'destructive', onPress: () => {} },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#8E8E93" />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };
  
  // Like handler - use centralized store
  const [isLiking, setIsLiking] = useState(false);
  
  const handleLike = async () => {
    if (!post._id || !currentUserId || isLiking) {
      return;
    }
    
    setIsLiking(true);
    
    try {
      // Use centralized store toggleLike which handles optimistic updates and API calls
      const newLikedStatus = await toggleLikeInStore(post._id, isMemoryPost, currentUserId);
      
      // Call onLike callback if provided to sync with parent
      if (onLike) {
        const updatedPost = usePostsStore.getState().getPost(post._id);
        onLike(post._id, updatedPost?.userLiked || newLikedStatus, updatedPost?.likeCount || likeCount);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };
  
  // Render review card
  const renderReviewCard = () => {
    if (!review) return null;
    
    const renderStars = (rating) => {
      if (!rating || rating <= 0) return null;
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        stars.push(
          <Ionicons
            key={i}
            name={i <= rating ? "star" : "star-outline"}
            size={14}
            color={i <= rating ? "#FFD700" : "#E1E1E1"}
          />
        );
      }
      return stars;
    };
    
    const handleReviewPress = () => {
      if (review.externalUrl) {
        Linking.openURL(review.externalUrl);
      }
    };
    
    return (
      <TouchableOpacity
        style={styles.reviewCard}
        onPress={handleReviewPress}
        activeOpacity={0.8}
      >
        <View style={styles.reviewContent}>
          {review.poster && (
            <Image 
              source={{ uri: review.poster }} 
              style={styles.reviewPoster}
            />
          )}
          <View style={styles.reviewInfo}>
            <Text style={styles.reviewTitle} numberOfLines={1}>
              {review.title}
            </Text>
            <Text style={styles.reviewSubtitle} numberOfLines={1}>
              {review.artist || ''}
              {review.year && ` • ${review.year}`}
            </Text>
            {review.rating && review.rating > 0 && (
              <View style={styles.reviewRatingContainer}>
                <View style={styles.reviewStarsContainer}>
                  {renderStars(review.rating)}
                </View>
                <Text style={styles.reviewRatingText}>
                  {review.rating}/5
                </Text>
              </View>
            )}
            {review.genre && review.genre.length > 0 && (
              <View style={styles.reviewGenreContainer}>
                {review.genre.slice(0, 2).map((genre, index) => (
                  <View key={index} style={styles.reviewGenreTag}>
                    <Text style={styles.reviewGenreText}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {review.externalUrl && (
            <TouchableOpacity
              style={styles.reviewExternalButton}
              onPress={handleReviewPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={review.type === 'movie' ? "open-outline" : "musical-notes"}
                size={18}
                color="#3797EF"
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  // Engagement bar with likes, comments, reposts, share
  const renderEngagementBar = () => {
    return (
      <View style={styles.engagementBar}>
        <TouchableOpacity 
          style={styles.engagementButton}
          onPress={handleLike}
          disabled={isLiking}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#ED4956" : "#000000"}
          />
          {likeCount > 0 && (
            <Text style={[styles.engagementCount, isLiked && styles.engagementCountLiked]}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={handleViewAllComments}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#000000" />
          {commentCount > 0 && (
            <Text style={styles.engagementCount}>{commentCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={() => {
            // Handle repost
            console.log('Repost pressed');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="repeat-outline" size={20} color="#000000" />
          {repostCount > 0 && (
            <Text style={styles.engagementCount}>{repostCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={() => {
            // Handle share
            console.log('Share pressed');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={20} color="#000000" />
        </TouchableOpacity>
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
      {/* Custom Header with Event Reference */}
      {renderCustomHeader()}

      {/* Caption Section with Hashtags */}
      {caption ? (
        <Animated.View 
          style={[styles.captionContainer, { opacity: fadeAnim }]}
        >
          <Text style={styles.captionText}>
            {captionParts.map((part, index) => {
              if (part.type === 'hashtag') {
                return (
                  <Text key={index} style={styles.hashtagText}>
                    {part.content}
                  </Text>
                );
              }
              return <Text key={index}>{part.content}</Text>;
            })}
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

      {/* Review Card - Show if post has a review */}
      {hasReview && review && (
        <View style={styles.reviewCardContainer}>
          {renderReviewCard()}
        </View>
      )}

      {/* Enhanced Image Display - Instagram-style carousel for multiphoto posts */}
      {!isTextOnlyPost && hasPhotos && (
        <View style={styles.imageContainer}>
          <PhotoCarousel
            photos={photos}
            width={IMAGE_WIDTH}
            onPhotoPress={handleImagePress}
            showIndicators={photos.length > 1}
          />
          
          {/* Enhanced Memory Post Overlay */}
          {isMemoryPost && (
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
          )}
        </View>
      )}
      
      {/* Legacy single image support (for posts with url instead of paths) */}
      {!isTextOnlyPost && !hasPhotos && imageUrl && (
        <TouchableOpacity 
          style={styles.imageContainer}
          onPress={handleImagePress}
          activeOpacity={0.95}
          accessible={true}
          accessibilityLabel={`View full ${isMemoryPost ? 'memory' : 'post'}`}
          accessibilityRole="button"
        >
          {!imageError ? (
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
                  <ActivityIndicator size="large" color="#3797EF" />
                </View>
              )}
            </>
          ) : (
            <View style={[styles.imagePlaceholder, imageDimensions]}>
              <Ionicons 
                name="image-outline" 
                size={48} 
                color="#C7C7CC" 
              />
              <Text style={styles.placeholderText}>
                Failed to load image
              </Text>
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
            </View>
          )}

          {/* Enhanced Memory Post Overlay */}
          {isMemoryPost && (
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
          )}
        </TouchableOpacity>
      )}

      {/* Engagement Bar */}
      {renderEngagementBar()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },

  // Custom Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 20,
    marginBottom: 12,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 6,
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
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userHandle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
  },
  metaDot: {
    fontSize: 13,
    color: '#8E8E93',
  },
  timeAgo: {
    fontSize: 13,
    color: '#8E8E93',
  },
  moreMenuButton: {
    padding: 4,
  },
  moreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Event Reference Styles
  eventReference: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 120,
  },
  eventReferenceText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Caption Styles - Aligned with left side of profile photo
  captionContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    marginBottom: 12,
  },
  captionText: {
    fontSize: 17,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '500',
  },
  hashtagText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#3797EF',
    fontWeight: '400',
  },
  moreText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
  },

  // Image Styles - Enhanced with loading states and rounded corners, aligned with left side of profile photo
  imageContainer: {
    marginLeft: 20,
    marginRight: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E1E1E1',
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
    backgroundColor: '#3797EF',
    borderRadius: 6,
  },
  retryImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Memory Post Overlay
  memoryOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 105, 180, 0.9)',
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
    paddingLeft: 20,
    paddingRight: 20,
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

  // Skeleton Loading States
  skeletonAvatar: {
    backgroundColor: '#F0F0F0',
  },
  skeletonText: {
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
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
    backgroundColor: 'rgba(135, 206, 250, 0.1)',
  },
  viewAllCommentsText: {
    fontSize: 14,
    color: '#3797EF',
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
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  commentInputContainerFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#3797EF',
    shadowColor: '#3797EF',
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
    backgroundColor: '#3797EF',
    shadowColor: '#3797EF',
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

  // Phase 3: New Enhancement Styles
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
  
  // Engagement Bar Styles - Aligned with left side of profile photo
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 24,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engagementCount: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '400',
  },
  engagementCountLiked: {
    color: '#ED4956',
  },
  
  // Follow Button Styles
  followButton: {
    paddingLeft: 12,
    paddingRight: 20,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#000000',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#000000',
  },
  
  // Review Card Styles - Aligned with left side of profile photo
  reviewCardContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  reviewContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reviewPoster: {
    width: 70,
    height: 105,
    borderRadius: 8,
    backgroundColor: '#E1E1E1',
    marginRight: 12,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  reviewSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 6,
  },
  reviewRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  reviewStarsContainer: {
    flexDirection: 'row',
    marginRight: 6,
  },
  reviewRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3797EF',
  },
  reviewGenreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  reviewGenreTag: {
    backgroundColor: '#E1E8F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reviewGenreText: {
    fontSize: 11,
    color: '#3797EF',
    fontWeight: '500',
  },
  reviewExternalButton: {
    padding: 4,
    marginLeft: 4,
  },
});

export default PostActivityComponent;