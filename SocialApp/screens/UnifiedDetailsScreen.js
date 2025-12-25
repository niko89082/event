// screens/UnifiedDetailsScreen.js - Updated with fixed API routes and UI improvements
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, FlatList,
  StatusBar, KeyboardAvoidingView, Platform, Dimensions, Animated,
  Modal, ActionSheetIOS, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import usePostsStore from '../stores/postsStore';
import { useCommentManager } from '../hooks/useCommentManager';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MEMORY_BLUE = '#3797EF';
const EVENT_BLUE = '#3797EF';

// Utility functions
const niceDate = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins || 1}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
};

const getTimeAgo = (date) => {
  const now = new Date();
  const postDate = new Date(date);
  const diffInSeconds = Math.floor((now - postDate) / 1000);
  
  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMemoryTime = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) return 'captured today';
  if (diffDays <= 7) return `captured ${diffDays} days ago`;
  if (diffDays <= 30) return `captured ${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays <= 365) return `captured ${Math.ceil(diffDays / 30)} months ago`;
  return `captured ${Math.ceil(diffDays / 365)} years ago`;
};

const getMemoryMood = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) return { emoji: '✨', mood: 'fresh' };
  if (diffDays <= 30) return { emoji: '🌟', mood: 'recent' };
  if (diffDays <= 365) return { emoji: '💫', mood: 'nostalgic' };
  return { emoji: '🕰️', mood: 'vintage' };
};

export default function UnifiedDetailsScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const scrollViewRef = useRef();
  const textInputRef = useRef();

  // Extract params
  const { postId, postType, post: initialPost, openKeyboard = false } = params;
  const isMemoryPost = postType === 'memory';

  // CENTRALIZED STATE MANAGEMENT
  const storePost = usePostsStore(state => state.getPost(postId));
  const addCommentInStore = usePostsStore(state => state.addComment);

  // Use store post if available, otherwise use initialPost or fetch
  const currentPost = storePost || initialPost;

  // State
  const [post, setPost] = useState(currentPost);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(!currentPost);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Comment management with global sync
  const {
    commentCount,
    addComment: incrementCommentCount,
    removeComment: decrementCommentCount,
    updateCount: updateCommentCount
  } = useCommentManager(postId, currentPost?.commentCount || 0, isMemoryPost);

  // Image zoom state - Instagram/Reddit style
  const [showImageModal, setShowImageModal] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Image loading state
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Comment actions
  const [selectedComment, setSelectedComment] = useState(null);
  const [showCommentActions, setShowCommentActions] = useState(false);

  // Derived data
  const imgURL = currentPost?.url 
    ? `http://${API_BASE_URL}:3000${currentPost.url}`
    : currentPost?.paths?.[0] 
    ? `http://${API_BASE_URL}:3000${currentPost.paths[0]}`
    : null;
  const hasReview = currentPost?.review && currentPost.review.type;
  const review = currentPost?.review;
  const repostCount = currentPost?.repostCount || 0;
  const [likeCountState, setLikeCountState] = useState(currentPost?.likeCount || currentPost?.likes?.length || 0);
  const [isLikedState, setIsLikedState] = useState(currentPost?.userLiked || (currentPost?.likes?.includes && currentPost.likes.includes(currentUser?._id)) || false);
  
  // Use state if available, otherwise use post data
  const likeCount = likeCountState;
  const isLiked = isLikedState;
  
  // Update like state when post changes
  useEffect(() => {
    if (currentPost) {
      setLikeCountState(currentPost?.likeCount || currentPost?.likes?.length || 0);
      setIsLikedState(currentPost?.userLiked || (currentPost?.likes?.includes && currentPost.likes.includes(currentUser?._id)) || false);
    }
  }, [currentPost, currentUser?._id]);

  // Use the managed comment count instead of static count
  // const commentCount = currentPost?.commentCount || comments.length || 0;

  // Image dimensions calculation - memoized to prevent recalculation
  const [imageDimensions, setImageDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    calculated: false
  });

  useEffect(() => {
    if (imgURL && !imageDimensions.calculated) {
      setImageLoading(true);
      setImageError(false);
      
      Image.getSize(
        imgURL, 
        (width, height) => {
          const aspectRatio = width / height;
          const maxHeight = SCREEN_WIDTH * 1.25;
          
          let newWidth = SCREEN_WIDTH;
          let newHeight = SCREEN_WIDTH / aspectRatio;
          
          if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = maxHeight * aspectRatio;
          }
          
          setImageDimensions({ 
            width: newWidth, 
            height: newHeight, 
            calculated: true 
          });
          setImageLoading(false);
        },
        (error) => {
          console.error('Error getting image size:', error);
          setImageError(true);
          setImageLoading(false);
          // Use default dimensions
          setImageDimensions({ 
            width: SCREEN_WIDTH, 
            height: SCREEN_WIDTH, 
            calculated: true 
          });
        }
      );
    }
  }, [imgURL]);

  // Instagram/Reddit style zoom handlers
  let baseScale = 1;
  let lastScale = 1;
  let baseTranslateX = 0;
  let baseTranslateY = 0;
  let lastTranslateX = 0;
  let lastTranslateY = 0;

  const onPinchEvent = (event) => {
    const { scale: gestureScale, focalX, focalY } = event.nativeEvent;
    
    // Calculate new scale
    const newScale = baseScale * gestureScale;
    
    // Limit zoom (0.5x to 4x like Instagram)
    const constrainedScale = Math.max(0.5, Math.min(4, newScale));
    
    if (constrainedScale >= 1) {
      // Calculate translation to zoom towards focal point
      const screenCenterX = SCREEN_WIDTH / 2;
      const screenCenterY = SCREEN_HEIGHT / 2;
      
      const deltaX = (focalX - screenCenterX) * (constrainedScale - 1);
      const deltaY = (focalY - screenCenterY) * (constrainedScale - 1);
      
      scale.setValue(constrainedScale);
      translateX.setValue(baseTranslateX - deltaX);
      translateY.setValue(baseTranslateY - deltaY);
    }
  };

  const onPinchStateChange = (event) => {
    if (event.nativeEvent.state === State.BEGAN) {
      baseScale = lastScale;
      baseTranslateX = lastTranslateX;
      baseTranslateY = lastTranslateY;
    } else if (event.nativeEvent.state === State.END) {
      const { scale: gestureScale } = event.nativeEvent;
      const finalScale = Math.max(0.5, Math.min(4, baseScale * gestureScale));
      
      if (finalScale < 1) {
        // Reset to normal if zoomed out too much
        resetZoom();
      } else {
        lastScale = finalScale;
        lastTranslateX = translateX._value;
        lastTranslateY = translateY._value;
      }
    }
  };

  const onPanEvent = (event) => {
    if (lastScale > 1) {
      const { translationX, translationY } = event.nativeEvent;
      
      // Apply constraints to prevent panning too far
      const maxTranslateX = (SCREEN_WIDTH * (lastScale - 1)) / 2;
      const maxTranslateY = (SCREEN_HEIGHT * (lastScale - 1)) / 2;
      
      const newTranslateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, baseTranslateX + translationX));
      const newTranslateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, baseTranslateY + translationY));
      
      translateX.setValue(newTranslateX);
      translateY.setValue(newTranslateY);
    }
  };

  const onPanStateChange = (event) => {
    if (event.nativeEvent.state === State.BEGAN) {
      baseTranslateX = lastTranslateX;
      baseTranslateY = lastTranslateY;
    } else if (event.nativeEvent.state === State.END) {
      lastTranslateX = translateX._value;
      lastTranslateY = translateY._value;
    }
  };

  const resetZoom = () => {
    baseScale = 1;
    lastScale = 1;
    baseTranslateX = 0;
    baseTranslateY = 0;
    lastTranslateX = 0;
    lastTranslateY = 0;
    
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start();
  };

  // Double tap to zoom
  const handleDoubleTap = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    
    if (lastScale > 1) {
      resetZoom();
    } else {
      // Zoom to 2x at tap location
      const targetScale = 2;
      const screenCenterX = SCREEN_WIDTH / 2;
      const screenCenterY = SCREEN_HEIGHT / 2;
      
      const deltaX = (locationX - screenCenterX) * (targetScale - 1);
      const deltaY = (locationY - screenCenterY) * (targetScale - 1);
      
      lastScale = targetScale;
      lastTranslateX = -deltaX;
      lastTranslateY = -deltaY;
      
      Animated.parallel([
        Animated.timing(scale, { toValue: targetScale, duration: 200, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -deltaX, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -deltaY, duration: 200, useNativeDriver: true })
      ]).start();
    }
  };

  const handleMemoryPress = () => {
  console.log('🐛 DEBUG: handleMemoryPress called with:', {
    memoryInfo: currentPost?.memoryInfo,
    memoryId: currentPost?.memoryInfo?.memoryId,
    hasMemoryInfo: !!currentPost?.memoryInfo
  });
  
  // ✅ FIXED: Check for memory info and navigate properly
  if (currentPost?.memoryInfo?.memoryId) {
    navigation.navigate('MemoryDetailsScreen', { 
      memoryId: currentPost.memoryInfo.memoryId 
    });
  } else if (isMemoryPost && currentPost?.memoryId) {
    // Fallback: use direct memoryId if available
    navigation.navigate('MemoryDetailsScreen', { 
      memoryId: currentPost.memoryId 
    });
  } else {
    console.warn('No memory ID available for navigation');
    Alert.alert('Error', 'Unable to navigate to memory details');
  }};
  
  const handleEventPress = () => {
    if (currentPost?.event?._id) {
      navigation.navigate('EventDetailsScreen', { 
        eventId: currentPost.event._id 
      });
    }
  };

  const handleLike = async () => {
    if (!postId || !currentUser) return;
    
    try {
      // Optimistic update
      const newLiked = !isLiked;
      const newCount = newLiked ? likeCount + 1 : likeCount - 1;
      setIsLikedState(newLiked);
      setLikeCountState(newCount);
      
      // Determine API endpoint based on post type
      let endpoint;
      if (isMemoryPost) {
        endpoint = `/api/memories/photos/like/${postId}`;
      } else {
        endpoint = `/api/photos/like/${postId}`;
      }
      
      const response = await api.post(endpoint);
      
      // Update with server response
      setIsLikedState(response.data.userLiked || (response.data.likes?.includes && response.data.likes.includes(currentUser._id)) || false);
      setLikeCountState(response.data.likeCount || response.data.likes?.length || 0);
      
      // Update post state
      setPost(prev => ({
        ...prev,
        likes: response.data.likes,
        likeCount: response.data.likeCount,
        userLiked: response.data.userLiked || (response.data.likes?.includes && response.data.likes.includes(currentUser._id))
      }));
      
      // Update store
      usePostsStore.getState().updatePost(postId, {
        likes: response.data.likes,
        likeCount: response.data.likeCount,
        userLiked: response.data.userLiked || (response.data.likes?.includes && response.data.likes.includes(currentUser._id))
      });
      
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update
      setIsLikedState(!isLiked);
      setLikeCountState(isLiked ? likeCount + 1 : likeCount - 1);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleCommentActions = React.useCallback((comment) => {
    setSelectedComment(comment);
    setShowCommentActions(true);
  }, []);

  const deleteComment = React.useCallback(async () => {
    if (!selectedComment) return;
    
    try {
      // Use the correct API endpoints based on the routes found
      let endpoint;
      
      if (isMemoryPost) {
        // For memory photos: DELETE /api/memories/photos/comments/:commentId
        endpoint = `/api/memories/photos/comments/${selectedComment._id}`;
      } else {
        // For regular posts: DELETE /api/photos/comment/:photoId/:commentId
        endpoint = `/api/photos/comment/${postId}/${selectedComment._id}`;
      }
      
      console.log('Deleting comment via:', endpoint);
      await api.delete(endpoint);
      
      // Remove from local state
      setComments(prev => prev.filter(c => c._id !== selectedComment._id));
      
      // Decrement comment count in global store
      decrementCommentCount();
      
      setShowCommentActions(false);
      setSelectedComment(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  }, [selectedComment, isMemoryPost, postId, decrementCommentCount]);
const handlePostActions = React.useCallback(() => {
  const userId = typeof currentPost?.user === 'string' ? currentPost?.user : currentPost?.user?._id;
  const uploadedById = typeof currentPost?.uploadedBy === 'string' ? currentPost?.uploadedBy : currentPost?.uploadedBy?._id;
  const isOwner = userId === currentUser?._id;
  const isUploader = uploadedById === currentUser?._id;
  const canEdit = isOwner || isUploader;
  
  if (!canEdit) return;
  
  // ✅ FIXED: Memory photos should not allow caption editing
  if (isMemoryPost) {
    // For memory photos, only show delete option
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete Photo'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleDeletePost();
          }
        }
      );
    } else {
      Alert.alert(
        'Photo Options',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Photo', style: 'destructive', onPress: handleDeletePost },
        ]
      );
    }
  } else {
    // For regular posts, show both edit and delete options
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit Caption', 'Delete Post'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEditPost();
          } else if (buttonIndex === 2) {
            handleDeletePost();
          }
        }
      );
    } else {
      Alert.alert(
        'Post Options',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Caption', onPress: handleEditPost },
          { text: 'Delete Post', style: 'destructive', onPress: handleDeletePost },
        ]
      );
    }
  }
}, [currentPost, currentUser, isMemoryPost]);

const handleEditPost = () => {
  // Navigate to edit screen or show inline editor
  Alert.prompt(
    'Edit Caption',
    'Enter new caption:',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: updateCaption },
    ],
    'plain-text',
    currentPost?.caption || ''
  );
};

const updateCaption = async (newCaption) => {
  try {
    const endpoint = isMemoryPost 
      ? `/api/memories/photos/${postId}`
      : `/api/photos/${postId}`;
    
    await api.put(endpoint, { caption: newCaption });
    
    // Update local state
    setPost(prev => ({ ...prev, caption: newCaption }));
    
    // Update store
    usePostsStore.getState().updatePost(postId, { caption: newCaption });
    
    Alert.alert('Success', 'Caption updated successfully!');
  } catch (error) {
    console.error('Error updating caption:', error);
    Alert.alert('Error', 'Failed to update caption');
  }
};

const handleDeletePost = () => {
  Alert.alert(
    'Delete Post',
    'Are you sure you want to delete this post? This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: confirmDeletePost 
      },
    ]
  );
};

const confirmDeletePost = async () => {
  try {
    let endpoint;
    
    // ✅ FIXED: Use correct API endpoints for deletion
    if (isMemoryPost) {
      // For memory photos: DELETE /api/memories/:memoryId/photos/:photoId
      // Need to get the memory ID from the post data
      const memoryId = currentPost?.memoryInfo?.memoryId || 
                       currentPost?.memoryId || 
                       currentPost?.memory?._id || 
                       currentPost?.memory;
      
      if (!memoryId) {
        throw new Error('Memory ID not found - cannot delete photo');
      }
      
      endpoint = `/api/memories/${memoryId}/photos/${postId}`;
    } else {
      // For regular posts: DELETE /api/photos/:photoId
      endpoint = `/api/photos/${postId}`;
    }
    
    console.log('Deleting post via:', endpoint);
    await api.delete(endpoint);
    
    // Remove from store
    usePostsStore.getState().removePost(postId);
    
    const successMessage = isMemoryPost ? 'Photo deleted successfully!' : 'Post deleted successfully!';
    Alert.alert('Success', successMessage, [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  } catch (error) {
    console.error('Error deleting post:', error);
    
    // Provide more specific error messages
    let errorMessage = isMemoryPost ? 'Failed to delete photo' : 'Failed to delete post';
    
    if (error.message?.includes('Memory ID not found')) {
      errorMessage = 'Cannot delete photo: Memory information is missing';
    } else if (error.response?.status === 404) {
      errorMessage = isMemoryPost ? 'Photo not found' : 'Post not found';
    } else if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to delete this item';
    }
    
    Alert.alert('Error', errorMessage);
  }
};

  const formatDate = (iso) => {
    try {
      if (isMemoryPost) {
        return formatMemoryTime(iso);
      }
      
      const date = new Date(iso);
      const now = new Date();
      const diffDays = Math.ceil((now - date) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) return 'today';
      if (diffDays <= 7) return `${diffDays} days ago`;
      if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} months ago`;
      return `${Math.ceil(diffDays / 365)} years ago`;
    } catch (error) {
      console.error('Date formatting error:', error);
      return '';
    }
  };

  const handleUserPress = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  // Replace the existing useEffect around line 580:
useEffect(() => {
  console.log('🐛 DEBUG: useEffect triggered with:', {
    hasCurrentPost: !!currentPost,
    hasPostId: !!postId,
    currentPostUser: currentPost?.user,
    currentPostUploadedBy: currentPost?.uploadedBy,
    initialPostUser: initialPost?.user,
    initialPostUploadedBy: initialPost?.uploadedBy,
    currentUserId: currentUser?._id,
    currentUserName: currentUser?.username
  });
  
  if (!currentPost && postId) {
    console.log('🐛 DEBUG: Fetching post details because no currentPost');
    fetchPostDetails();
  } else if (currentPost) {
    console.log('🐛 DEBUG: Setting post from currentPost:', currentPost.user);
    setPost(currentPost);
  }
}, [postId, currentPost]);

  useEffect(() => {
    if (postId) {
      fetchComments();
    }
  }, [postId]);

  useEffect(() => {
    if (openKeyboard && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current.focus();
      }, 500);
    }
  }, [openKeyboard]);

  const fetchPostDetails = async () => {
  console.log('🐛 DEBUG: fetchPostDetails called with:', {
    postId,
    isMemoryPost,
    hasCurrentPost: !!currentPost,
    hasInitialPost: !!initialPost,
    currentUser: currentUser
  });
  
  try {
    setLoading(true);
    let response;
      
    if (isMemoryPost) {
      try {
        console.log('Fetching memory photo details for:', postId);
        
        // Try the new endpoint for individual memory photos
        response = await api.get(`/api/memories/photos/${postId}`);
        console.log('Memory photo details fetched successfully');
        
        const photoData = response.data.photo || response.data;
        
        // ✅ FIXED: Properly transform memory photo data with correct structure
        const transformedPost = {
          ...photoData,
          _id: postId,
          postType: 'memory',
          user: photoData.uploadedBy || photoData.user || currentPost?.user || {
            username: currentUser?.username || 'You',
            _id: currentUser?._id || '',
            profilePicture: currentUser?.profilePicture
          },
          createdAt: photoData.uploadedAt || photoData.createdAt,
          paths: photoData.url ? [photoData.url] : (photoData.paths || []),
          // ✅ FIXED: Ensure memory info is properly structured for navigation
          memoryInfo: photoData.memoryInfo || {
            memoryId: photoData.memoryId,
            memoryTitle: photoData.memoryTitle || 'Memory'
          },
          // Preserve existing memory data if available
          memoryId: photoData.memoryId || currentPost?.memoryId,
          memoryTitle: photoData.memoryTitle || currentPost?.memoryTitle
        };

        console.log('🐛 DEBUG: Created transformedPost with memoryInfo:', transformedPost.memoryInfo);
        
        setPost(transformedPost);
        usePostsStore.getState().addPost(transformedPost);
        
      } catch (apiError) {
        console.log('Individual photo endpoint not available, using fallback...');
        
        // Fallback: Use existing post data if available
        if (currentPost) {
          console.log('Using existing post data for memory photo');
          const transformedPost = {
            ...currentPost,
            _id: postId,
            postType: 'memory',
            user: currentPost.uploadedBy || currentPost.user,
            createdAt: currentPost.uploadedAt || currentPost.createdAt,
            url: currentPost.url,
            paths: currentPost.url ? [currentPost.url] : (currentPost.paths || []),
            // ✅ FIXED: Preserve memory navigation data
            memoryInfo: currentPost.memoryInfo || {
              memoryId: currentPost.memoryId,
              memoryTitle: currentPost.memoryTitle || 'Memory'
            }
          };
          setPost(transformedPost);
          usePostsStore.getState().addPost(transformedPost);
        } else {
          throw new Error('Memory photo not found and no fallback data available');
        }
      }
    } else {
      response = await api.get(`/api/photos/${postId}`);
      setPost(response.data);
      usePostsStore.getState().addPost(response.data);
    }
      
  } catch (error) {
    console.error('Error fetching post details:', error);
    Alert.alert('Error', 'Failed to load post details');
    navigation.goBack();
  } finally {
    setLoading(false);
  }
};


  const fetchComments = async () => {
    try {
      setCommentsLoading(true);
      let response;
      
      if (isMemoryPost) {
        // For memory photos, use the correct endpoint that exists
        response = await api.get(`/api/memories/photos/${postId}/comments`);
        setComments(response.data.comments || []);
        // Update comment count in global store
        updateCommentCount((response.data.comments || []).length);
      } else {
        // For regular posts, get the full photo data which includes comments
        response = await api.get(`/api/photos/${postId}`);
        setComments(response.data.comments || []);
        // Update comment count in global store
        updateCommentCount((response.data.comments || []).length);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      // Don't show error alert for comments, just log it
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      await addCommentInStore(postId, newComment.trim(), isMemoryPost);
      setNewComment('');
      
      // Increment comment count in global store
      incrementCommentCount();
      
      // Refresh comments to get the latest data
      await fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderComment = React.useCallback(({ item: comment }) => {
    const isCommentOwner = comment.user?._id === currentUser?._id;
    const userId = typeof currentPost?.user === 'string' ? currentPost?.user : currentPost?.user?._id;
    const isPostOwner = userId === currentUser?._id;
    const canDelete = isCommentOwner || isPostOwner;
    
    return (
      <TouchableOpacity 
        style={styles.commentContainer}
        activeOpacity={0.7}
      >
        <TouchableOpacity 
          onPress={() => handleUserPress(comment.user._id)}
          style={styles.commentAvatarContainer}
        >
          <Image
            source={{
              uri: comment.user?.profilePicture
                ? `http://${API_BASE_URL}:3000${comment.user.profilePicture}`
                : 'https://via.placeholder.com/40/CCCCCC/666666?text=U'
            }}
            style={styles.commentAvatar}
          />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeaderRow}>
            <View style={styles.commentNameRow}>
              <TouchableOpacity onPress={() => handleUserPress(comment.user._id)}>
                <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
              </TouchableOpacity>
              <Text style={styles.commentHandle}>@{comment.user?.username?.toLowerCase().replace(/\s+/g, '') || 'unknown'}</Text>
              <Text style={styles.commentTimeDot}>•</Text>
              <Text style={styles.commentTime}>{getTimeAgo(comment.createdAt)}</Text>
            </View>
            {canDelete && (
              <TouchableOpacity
                onPress={() => handleCommentActions(comment)}
                style={styles.commentOptionsButton}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.commentTextContent}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity style={styles.commentActionButton}>
              <Ionicons name="heart-outline" size={16} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.commentActionButton}>
              <Ionicons name="chatbubble-outline" size={16} color="#8E8E93" />
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [currentUser?._id, handleCommentActions, currentPost]);

  // Helper to render stars for rating
  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={20}
          color={i <= rating ? "#FBBF24" : "#E5E7EB"}
          style={styles.starIcon}
        />
      );
    }
    return stars;
  };

  // Add this at the beginning of renderHeader function:
const renderHeader = () => {
  if (!currentPost) return null;

  // ✅ FIXED: Handle both string ID and object user for ownership
  const userId = typeof currentPost.user === 'string' ? currentPost.user : currentPost.user?._id;
  const isOwner = userId === currentUser?._id;
  
  // Also check uploadedBy for memory photos
  const uploadedById = typeof currentPost.uploadedBy === 'string' ? currentPost.uploadedBy : currentPost.uploadedBy?._id;
  const isUploader = uploadedById === currentUser?._id;
  
  // Owner is either the user or the uploader (for memory photos)
  const canEdit = isOwner || isUploader;
  
  const memoryMood = isMemoryPost ? getMemoryMood(currentPost.createdAt || currentPost.uploadedAt) : null;
  
  const username = typeof currentPost.user === 'string' 
    ? (currentUser?.username || 'Unknown') 
    : (currentPost.user?.username || currentPost.uploadedBy?.username || 'Unknown');
  
  return (
    <View style={styles.postContainer}>
      {/* Author Info - Twitter Style */}
      <View style={styles.authorContainer}>
        <TouchableOpacity 
          onPress={() => handleUserPress(currentPost.user?._id || currentPost.uploadedBy?._id)}
          style={styles.authorInfo}
        >
          <Image
            source={{
              uri: (currentPost.user?.profilePicture || currentPost.uploadedBy?.profilePicture)
                ? `http://${API_BASE_URL}:3000${currentPost.user?.profilePicture || currentPost.uploadedBy?.profilePicture}`
                : 'https://via.placeholder.com/48/CCCCCC/666666?text=U'
            }}
            style={styles.authorAvatar}
          />
          <View style={styles.authorTextContainer}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorUsername}>{username}</Text>
            </View>
            <View style={styles.authorMetaRow}>
              <Text style={styles.authorHandle}>@{username.toLowerCase().replace(/\s+/g, '')}</Text>
              <Text style={styles.authorMetaDot}>•</Text>
              <Text style={styles.authorTime}>{getTimeAgo(currentPost.createdAt || currentPost.uploadedAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Review Card - Only show if review exists */}
      {hasReview && review && (
        <View style={styles.reviewCardContainer}>
          <View style={styles.reviewCard}>
            {review.poster && (
              <TouchableOpacity 
                style={styles.reviewPosterContainer}
                onPress={() => review.externalUrl && Linking.openURL(review.externalUrl)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: review.poster }} style={styles.reviewPoster} />
                {review.type === 'song' && (
                  <View style={styles.playButtonOverlay}>
                    <Ionicons name="play-circle" size={32} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.reviewInfo}>
              <Text style={styles.reviewTitle} numberOfLines={1}>{review.title}</Text>
              <Text style={styles.reviewSubtitle} numberOfLines={1}>
                {review.type === 'song' 
                  ? `${review.artist || ''}${review.year ? ` • ${review.year}` : ''}`
                  : `${review.artist || ''}${review.year ? ` • ${review.year}` : ''}`
                }
              </Text>
              {review.genre && review.genre.length > 0 && (
                <View style={styles.genreContainer}>
                  {review.genre.slice(0, 2).map((genre, index) => (
                    <View key={index} style={styles.genreTag}>
                      <Text style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            {review.externalUrl && (
              <TouchableOpacity 
                style={styles.bookmarkButton}
                onPress={() => Linking.openURL(review.externalUrl)}
              >
                <Ionicons name="bookmark-outline" size={20} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Rating Stars - Only show if review has rating */}
      {hasReview && review && review.rating && review.rating > 0 && (
        <View style={styles.ratingContainer}>
          <View style={styles.starsContainer}>
            {renderStars(review.rating)}
          </View>
          <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
        </View>
      )}

      {/* Image with tap to zoom - Show if image exists (even for review posts) */}
      {imgURL && (
        <TouchableOpacity 
          onPress={() => setShowImageModal(true)}
          style={[
            styles.imageContainer,
            {
              width: imageDimensions.width,
              height: imageDimensions.height
            }
          ]}
          disabled={imageLoading || imageError}
        >
          {imageLoading && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="large" color="#3797EF" />
              <Text style={styles.imageLoadingText}>Loading image...</Text>
            </View>
          )}
          
          {imageError && (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image" size={50} color="#C7C7CC" />
              <Text style={styles.placeholderText}>Failed to load image</Text>
            </View>
          )}
          
          {imgURL && !imageError && (
            <Image
              source={{ uri: imgURL }}
              style={[
                styles.postImage,
                { opacity: imageLoading ? 0 : 1 }
              ]}
              resizeMode={isMemoryPost ? "contain" : "cover"}
              onLoad={() => {
                if (imageLoading) {
                  setImageLoading(false);
                }
              }}
              onError={() => {
                if (!imageError) {
                  setImageError(true);
                  setImageLoading(false);
                }
              }}
              key={`image-${imgURL}`}
            />
          )}
        </TouchableOpacity>
      )}

      {/* Caption / Review Text */}
      {currentPost.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>{currentPost.caption}</Text>
        </View>
      )}

      {/* Timestamp Detail - Twitter Style */}
      <View style={styles.timestampContainer}>
        <Text style={styles.timestampText}>
          {new Date(currentPost.createdAt || currentPost.uploadedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}{' • '}
          {new Date(currentPost.createdAt || currentPost.uploadedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>
      </View>

      {/* Engagement Stats - Twitter Style */}
      <View style={styles.engagementContainer}>
        <View style={styles.engagementRow}>
          <TouchableOpacity 
            style={styles.engagementButton} 
            activeOpacity={0.7}
            onPress={handleLike}
          >
            <View style={[styles.engagementIconContainer, isLiked && styles.engagementIconLiked]}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={isLiked ? '#EF4444' : '#8E8E93'}
              />
            </View>
            {likeCount > 0 && (
              <Text style={[styles.engagementText, isLiked && styles.engagementTextLiked]}>
                {likeCount.toLocaleString()}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.engagementButton} activeOpacity={0.7}>
            <View style={styles.engagementIconContainer}>
              <Ionicons name="chatbubble-outline" size={22} color="#8E8E93" />
            </View>
            {commentCount > 0 && (
              <Text style={styles.engagementText}>{commentCount.toLocaleString()}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.engagementButton} activeOpacity={0.7}>
            <View style={styles.engagementIconContainer}>
              <Ionicons name="repeat-outline" size={22} color="#8E8E93" />
            </View>
            {repostCount > 0 && (
              <Text style={styles.engagementText}>{repostCount.toLocaleString()}</Text>
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={22} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Comments Header */}
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>Comments</Text>
      </View>
    </View>
  );
};

  const renderEmptyComments = () => (
    <View style={styles.emptyCommentsContainer}>
      <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
      <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
      <Text style={styles.emptyCommentsSubtitle}>
        {isMemoryPost 
          ? 'Share your thoughts about this memory!' 
          : 'Be the first to comment!'
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!currentPost) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate ownership for header
  const userId = typeof currentPost?.user === 'string' ? currentPost?.user : currentPost?.user?._id;
  const isOwner = userId === currentUser?._id;
  const uploadedById = typeof currentPost?.uploadedBy === 'string' ? currentPost?.uploadedBy : currentPost?.uploadedBy?._id;
  const isUploader = uploadedById === currentUser?._id;
  const canEditHeader = isOwner || isUploader;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={28} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{hasReview ? 'Review' : 'Post'}</Text>
        <View style={styles.headerRight}>
          {canEditHeader && (
            <TouchableOpacity
              onPress={handlePostActions}
              style={styles.headerButton}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={scrollViewRef}
          style={styles.commentsList}
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={commentCount === 0 ? renderEmptyComments : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        {/* Comment Input - Twitter Style */}
        <View style={styles.commentInputContainer}>
          <Image
            source={{ 
              uri: currentUser?.profilePicture 
                ? `http://${API_BASE_URL}:3000${currentUser.profilePicture}`
                : 'https://via.placeholder.com/40/CCCCCC/666666?text=U'
            }}
            style={styles.commentInputAvatar}
          />
          <View style={styles.commentInputWrapper}>
            <TextInput
              ref={textInputRef}
              style={styles.commentInput}
              placeholder={isMemoryPost ? "Share your thoughts..." : "Add a comment..."}
              placeholderTextColor="#8E8E93"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={postComment}
              style={[
                styles.commentPostButton,
                { opacity: newComment.trim() ? 1 : 0.5 }
              ]}
              disabled={!newComment.trim() || commentsLoading}
            >
              {commentsLoading ? (
                <ActivityIndicator size="small" color="#3994EF" />
              ) : (
                <Text style={styles.commentPostButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Image Zoom Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImageModal(false);
          resetZoom();
        }}
      >
        <View style={styles.modalBackground}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => {
              setShowImageModal(false);
              resetZoom();
            }}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          
          <PanGestureHandler
            onGestureEvent={onPanEvent}
            onHandlerStateChange={onPanStateChange}
            simultaneousHandlers={['pinch']}
          >
            <Animated.View style={styles.modalImageContainer}>
              <PinchGestureHandler
                id="pinch"
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={onPinchStateChange}
              >
                <Animated.View
                  style={[
                    styles.modalImageWrapper,
                    {
                      transform: [
                        { scale: scale },
                        { translateX: translateX },
                        { translateY: translateY }
                      ]
                    }
                  ]}
                >
                  <TouchableOpacity 
                    onPress={handleDoubleTap}
                    activeOpacity={1}
                    style={styles.doubleTapArea}
                  >
                    <Image
                      source={{ uri: imgURL }}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
          
          {/* Double tap to reset zoom */}
          <View style={styles.modalHints}>
            <Text style={styles.modalHintText}>Double tap to zoom • Pinch to zoom • Drag to move</Text>
          </View>
        </View>
      </Modal>

      {/* Comment Actions Modal */}
      {showCommentActions && (
        <Modal
          visible={showCommentActions}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCommentActions(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCommentActions(false)}
          >
            <View style={styles.commentActionsModal}>
              <TouchableOpacity 
                style={styles.commentActionButton}
                onPress={deleteComment}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={styles.commentActionText}>Delete Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.commentActionButton, styles.cancelButton]}
                onPress={() => setShowCommentActions(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  headerRight: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#8E8E93',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  commentsList: {
    flex: 1,
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
  },
  authorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  authorTextContainer: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorUsername: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D141B',
  },
  authorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  authorHandle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  authorMetaDot: {
    fontSize: 14,
    color: '#8E8E93',
    marginHorizontal: 4,
  },
  authorTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  contextText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  memoryLink: {
    fontSize: 16,
    color: MEMORY_BLUE,
    fontWeight: '500',
  },
  eventLink: {
    fontSize: 16,
    color: EVENT_BLUE,
    fontWeight: '500',
  },
  postTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  imageContainer: {
    alignSelf: 'center',
    marginBottom: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  imageLoadingText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  placeholderText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  memoryExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  memoryExploreBtnText: {
    fontSize: 14,
    color: MEMORY_BLUE,
    fontWeight: '500',
    marginRight: 4,
  },
  // Review Card Styles
  reviewCardContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewPosterContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
    position: 'relative',
  },
  reviewPoster: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewInfo: {
    flex: 1,
    minWidth: 0,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D141B',
    marginBottom: 4,
  },
  reviewSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  genreText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  bookmarkButton: {
    padding: 8,
    marginLeft: 8,
  },
  
  // Rating Styles
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D141B',
  },

  // Timestamp Styles
  timestampContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  timestampText: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Engagement Stats - Twitter Style
  engagementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementIconContainer: {
    padding: 8,
    borderRadius: 20,
  },
  engagementIconLiked: {
    // No background color - just red icon
  },
  engagementText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  engagementTextLiked: {
    color: '#EF4444',
  },
  shareButton: {
    padding: 8,
    borderRadius: 20,
  },

  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  captionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#0D141B',
  },
  captionUsername: {
    fontWeight: '600',
  },
  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D141B',
  },
  commentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  commentAvatarContainer: {
    marginRight: 12,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentContent: {
    flex: 1,
    paddingRight: 8,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D141B',
    marginRight: 4,
  },
  commentHandle: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 4,
  },
  commentTimeDot: {
    fontSize: 14,
    color: '#8E8E93',
    marginHorizontal: 4,
  },
  commentTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  commentTextContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0D141B',
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  commentOptionsButton: {
    padding: 4,
  },
  commentTextContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 12,
    marginTop: 2,
  },
  commentActionsButton: {
    padding: 4,
    borderRadius: 12,
  },
  emptyCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyCommentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyCommentsSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    minHeight: 64,
  },
  commentInputAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#0D141B',
    maxHeight: 100,
    paddingVertical: Platform.OS === 'ios' ? 8 : 10,
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 20,
  },
  commentPostButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentPostButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3994EF',
  },
  // Modal styles for image zoom
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  doubleTapArea: {
    width: '100%',
    height: '100%',
  },
  modalHints: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalHintText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  // Comment Actions Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentActionsModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  commentActionText: {
    fontSize: 16,
    color: '#FF3B30',
    marginLeft: 12,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
    textAlign: 'center',
  },
  postMenuButton: {
  padding: 8,
  marginLeft: 8,
},
});