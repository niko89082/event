// screens/UnifiedDetailsScreen.js - Updated with fixed API routes and UI improvements
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, FlatList, SafeAreaView,
  StatusBar, KeyboardAvoidingView, Platform, Dimensions, Animated,
  Modal
} from 'react-native';
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
    if (currentPost?.memoryInfo?.memoryId) {
      navigation.navigate('MemoryDetailsScreen', { 
        memoryId: currentPost.memoryInfo.memoryId 
      });
    }
  };

  const handleEventPress = () => {
    if (currentPost?.event?._id) {
      navigation.navigate('EventDetailsScreen', { 
        eventId: currentPost.event._id 
      });
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

  useEffect(() => {
    if (!currentPost && postId) {
      fetchPostDetails();
    } else if (currentPost) {
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
          const transformedPost = {
            ...photoData,
            _id: postId,
            postType: 'memory',
            user: photoData.uploadedBy || photoData.user,
            createdAt: photoData.uploadedAt || photoData.createdAt,
            paths: photoData.url ? [photoData.url] : (photoData.paths || [])
          };
          
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
              paths: currentPost.url ? [currentPost.url] : (currentPost.paths || [])
            };
            setPost(transformedPost);
            usePostsStore.getState().addPost(transformedPost);
          } else {
            // Last resort: Try to get likes data to confirm photo exists
            try {
              const photoResponse = await api.get(`/api/memories/photos/${postId}/likes`);
              console.log('Photo exists, creating minimal post object');
              const minimalPost = {
                _id: postId,
                postType: 'memory',
                url: '', // Will be empty until we find more data
                user: { username: 'Unknown', _id: '' },
                createdAt: new Date().toISOString(),
                caption: '',
                userLiked: photoResponse.data?.userLiked || false,
                likeCount: photoResponse.data?.likeCount || 0,
                commentCount: 0
              };
              setPost(minimalPost);
            } catch (likesError) {
              throw new Error('Memory photo not found and no fallback data available');
            }
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

  const renderComment = React.useCallback(({ item: comment }) => (
    <View style={styles.commentContainer}>
      <TouchableOpacity 
        onPress={() => handleUserPress(comment.user._id)}
        style={styles.commentAvatarContainer}
      >
        <Image
          source={{
            uri: comment.user?.profilePicture
              ? `http://${API_BASE_URL}:3000${comment.user.profilePicture}`
              : 'https://via.placeholder.com/32/CCCCCC/666666?text=U'
          }}
          style={styles.commentAvatar}
        />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentTextContainer}>
          <TouchableOpacity onPress={() => handleUserPress(comment.user._id)}>
            <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
          </TouchableOpacity>
          <Text style={styles.commentTextContent}>{comment.text}</Text>
        </View>
        <View style={styles.commentMeta}>
          <Text style={styles.commentTime}>{niceDate(comment.createdAt)}</Text>
          {comment.user._id === currentUser?._id && (
            <TouchableOpacity 
              onPress={() => handleCommentActions(comment)}
              style={styles.commentActionsButton}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  ), [currentUser?._id, handleCommentActions]);

  const renderHeader = () => {
    if (!currentPost) return null;

    const memoryMood = isMemoryPost ? getMemoryMood(currentPost.createdAt || currentPost.uploadedAt) : null;

    return (
      <View style={styles.postContainer}>
        {/* Author Info */}
        <View style={styles.authorContainer}>
          <TouchableOpacity 
            onPress={() => handleUserPress(currentPost.user?._id)}
            style={styles.authorInfo}
          >
            <Image
              source={{
                uri: currentPost.user?.profilePicture
                  ? `http://${API_BASE_URL}:3000${currentPost.user.profilePicture}`
                  : 'https://via.placeholder.com/40/CCCCCC/666666?text=U'
              }}
              style={styles.authorAvatar}
            />
            <View style={styles.authorTextContainer}>
              <View style={styles.usernameRow}>
                <Text style={styles.authorUsername}>{currentPost.user?.username || 'Unknown'}</Text>
                
                {/* Context Links */}
                {isMemoryPost && currentPost.memoryInfo?.memoryTitle && (
                  <>
                    <Text style={styles.contextText}> in </Text>
                    <TouchableOpacity onPress={handleMemoryPress}>
                      <Text style={styles.memoryLink}>{currentPost.memoryInfo.memoryTitle}</Text>
                    </TouchableOpacity>
                  </>
                )}
                
                {!isMemoryPost && currentPost.event && (
                  <>
                    <Text style={styles.contextText}> at </Text>
                    <TouchableOpacity onPress={handleEventPress}>
                      <Text style={styles.eventLink}>{currentPost.event.title}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              
              <Text style={styles.postTime}>
                {formatDate(currentPost.createdAt || currentPost.uploadedAt)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Image with tap to zoom and loading states */}
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
              // Prevent re-rendering when modal state changes
              key={`image-${imgURL}`}
            />
          )}
          
          {!imgURL && !imageLoading && (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image" size={50} color="#C7C7CC" />
              <Text style={styles.placeholderText}>No image</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Actions - Removed like, share, and comment icons */}
        <View style={styles.actionsContainer}>
          {/* Memory explore button */}
          {isMemoryPost && (
            <TouchableOpacity onPress={handleMemoryPress} style={styles.memoryExploreBtn}>
              <Text style={styles.memoryExploreBtnText}>Explore Memory</Text>
              <Ionicons name="arrow-forward" size={16} color={MEMORY_BLUE} />
            </TouchableOpacity>
          )}
        </View>

        {/* Caption */}
        {currentPost.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>
              <Text style={styles.captionUsername}>{currentPost.user?.username || 'Unknown'}</Text>{' '}
              {currentPost.caption}
            </Text>
          </View>
        )}

        {/* Comments Header */}
        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>
            Comments ({commentCount})
          </Text>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <Image
            source={{ 
              uri: currentUser?.profilePicture 
                ? `http://${API_BASE_URL}:3000${currentUser.profilePicture}`
                : 'https://via.placeholder.com/32/CCCCCC/666666?text=U'
            }}
            style={styles.commentInputAvatar}
          />
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
              <ActivityIndicator size="small" color="#3797EF" />
            ) : (
              <Text style={styles.commentPostButtonText}>Post</Text>
            )}
          </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    paddingVertical: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  authorTextContainer: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  authorUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
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
  captionContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000000',
  },
  captionUsername: {
    fontWeight: '600',
  },
  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
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
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentContent: {
    flex: 1,
    paddingRight: 8,
  },
  commentTextContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  commentTextContent: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000000',
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 12,
    marginTop: 2,
  },
  commentTime: {
    fontSize: 11,
    color: '#8E8E93',
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
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
    minHeight: 64,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    marginRight: 8,
    backgroundColor: '#F8F8F8',
  },
  commentPostButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  commentPostButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
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
});