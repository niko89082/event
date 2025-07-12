/* ================================================================== */
/*                        COMPLETE STYLES                            */
/* ================================================================== */

const styles = StyleSheet.create({
  // Container
  postContainer: {
    backgroundColor: '#FFF',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  
  memoryPostContainer: {
    backgroundColor: 'rgba(248, 249, 250, 0.5)',
  },
  
  vintagePostContainer: {
    backgroundColor: 'rgba(251, 250, 248, 0.8)',
  },

  // Memory Story Header
  memoryStoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  memoryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  memoryStoryText: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  memoryMoodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memoryMoodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'capitalize',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  // Enhanced avatar with memory effects
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  memoryAvatarContainer: {
    // Additional styling for memory avatars
  },
  vintageAvatarGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8, // Curved corners instead of circle
    backgroundColor: '#F6F6F6',
  },
  vintageAvatar: {
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderRadius: 8, // Keep consistent
  },
  
  userText: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
  },
  
  // Context text for both memory and event
  contextText: {
    fontSize: 14,
    color: '#000',
  },
  memoryLink: {
    fontSize: 14,
    color: MEMORY_BLUE,
    fontWeight: '500',
  },
  eventLink: {
    fontSize: 14,
    color: EVENT_BLUE, // Changed to blue
    fontWeight: '500',
  },

  dots: {
    padding: 5,
  },

  // Image with memory effects
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  
  // Memory sparkle overlay
  memorySparkleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  sparkleGradient: {
    flex: 1,
  },
  sparkleParticles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 16,
    opacity: 0.8,
  },
  
  postImage: {
    width: '100%',
    height: '100%',
  },
  vintageImage: {
    opacity: 0.95,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    opacity: 0.9,
  },

  // Enhanced Actions with Memory Features
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    marginRight: 15,
    padding: 2,
  },
  
  // Memory explore button
  memoryExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 151, 239, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(55, 151, 239, 0.2)',
  },
  memoryExploreBtnText: {
    fontSize: 12,
    color: MEMORY_BLUE,
    fontWeight: '600',
    marginRight: 4,
  },

  // Enhanced Likes
  likesContainer: {
    paddingHorizontal: 15,
    paddingVertical: 2,
  },
  likesText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
  },
  captionUsername: {
    fontWeight: '600',
  },
  moreText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 2,
  },

  // Enhanced Comments Section
  commentsSection: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  viewAllCommentsBtn: {
    marginTop: 8,
  },
  viewAllCommentsText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 6, // Curved corners instead of circle
    backgroundColor: '#F6F6F6',
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
  },
  commentUsername: {
    fontWeight: '600', // Bold usernames as requested
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Timestamp
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    paddingHorizontal: 15,
    paddingBottom: 5,
    paddingTop: 5,
  },
  memoryTimestamp: {
    fontStyle: 'italic',
    color: '#666',
  },

  // Inline Comment Input Container
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    marginBottom: 4,
  },
  
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: '#F8F9FA',
    color: '#000000',
  },
  
  commentSubmitBtn: {
    marginLeft: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#BBDEFB',
    minWidth: 50,
    alignItems: 'center',
  },
  
  commentSubmitBtnDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  
  commentSubmitText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 13,
  },
  
  commentSubmitTextDisabled: {
    color: '#9E9E9E',
  },

  // Delete Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalCancel: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Comments Modal Styles
  backgroundPressable: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  commentsModalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: SCREEN_HEIGHT * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#C7C7CC',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 8,
  },
  commentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  commentsModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#C7C7CC',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalCommentItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  tempComment: {
    opacity: 0.7,
  },
  modalCommentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  modalAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  modalCommentContent: {
    flex: 1,
    paddingRight: 8,
  },
  modalCommentAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  modalCommentText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
    marginBottom: 6,
  },
  tempCommentText: {
    color: '#8E8E93',
  },
  modalCommentTime: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
  },
  tempIndicator: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  modalInputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFF',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  modalUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  modalUserAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
  },
  modalCommentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    lineHeight: 20,
  },
  modalSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  modalSendButtonDisabled: {
    opacity: 0.5,
  },
  characterCount: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
  },
  characterCountWarning: {
    color: '#FF3B30',
  },
});// components/PostItem.js - Updated with Modal Comments System
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet,
  TouchableOpacity, Pressable, Modal, Dimensions, Animated,
  TextInput, KeyboardAvoidingView, Platform, Alert, FlatList,
  ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '@env';
import api from '../services/api';

/* ------------------------------------------------------------------ */
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEART = '#ED4956';
const MEMORY_BLUE = '#3797EF';
const EVENT_BLUE = '#3797EF'; // Changed to blue as requested

/** util – relative "x ago" or absolute date */
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

/** Memory time formatter with nostalgic feel */
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

/** Get memory mood based on time */
const getMemoryMood = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) return { emoji: '✨', mood: 'fresh' };
  if (diffDays <= 30) return { emoji: '🌟', mood: 'recent' };
  if (diffDays <= 365) return { emoji: '💫', mood: 'nostalgic' };
  return { emoji: '🕰️', mood: 'vintage' };
};

/** Get upload date display */
const getUploadDate = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
};

/* ================================================================== */
/*                      COMMENTS MODAL COMPONENT                     */
/* ================================================================== */

const CommentsModal = ({ 
  visible, 
  onClose, 
  post, 
  isMemoryPost, 
  currentUserId,
  onCommentAdded 
}) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef();
  const textInputRef = useRef();

  // Modal animation logic
  useEffect(() => {
    if (visible) {
      fetchComments();
      // Animate modal in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(backgroundOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // Animate modal out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  const fetchComments = async () => {
    if (!post?._id) {
      console.error('❌ No post ID available for fetching comments');
      return;
    }
    
    console.log('🔄 Fetching comments for:', {
      postId: post._id,
      isMemoryPost,
      endpoint: isMemoryPost 
        ? `/api/memories/photos/${post._id}/comments`
        : `/api/photos/${post._id}/comments`
    });
    
    setLoading(true);
    try {
      const endpoint = isMemoryPost 
        ? `/api/memories/photos/${post._id}/comments`
        : `/api/photos/${post._id}/comments`;
      
      const response = await api.get(endpoint);
      console.log('📝 Comments fetch response:', {
        status: response.status,
        data: response.data,
        commentsCount: response.data.comments?.length || 0
      });
      
      const fetchedComments = response.data.comments || [];
      setComments(fetchedComments);
      console.log('📝 Comments set to state:', fetchedComments);
      
    } catch (error) {
      console.error('❌ Error fetching comments:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim()) {
      console.warn('⚠️ Cannot submit empty comment');
      return;
    }
    
    if (submitting) {
      console.warn('⚠️ Already submitting comment, skipping');
      return;
    }
    
    console.log('🔄 Submitting comment:', {
      postId: post._id,
      isMemoryPost,
      commentText: newComment.trim(),
      endpoint: isMemoryPost
        ? `/api/memories/photos/${post._id}/comments`
        : `/api/photos/comment/${post._id}`
    });
    
    setSubmitting(true);
    const commentText = newComment.trim();
    
    // Optimistic update
    const tempComment = {
      _id: Date.now().toString(),
      text: commentText,
      user: {
        _id: currentUserId,
        username: 'You',
        profilePicture: null
      },
      createdAt: new Date().toISOString(),
      isTemp: true
    };
    
    console.log('📝 Adding temporary comment to state:', tempComment);
    setComments(prev => {
      const updated = [...prev, tempComment];
      console.log('📝 Updated comments state:', updated);
      return updated;
    });
    setNewComment('');
    
    // Scroll to bottom immediately
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
    
    try {
      const endpoint = isMemoryPost
        ? `/api/memories/photos/${post._id}/comments`
        : `/api/photos/comment/${post._id}`;
      
      const response = await api.post(endpoint, {
        text: commentText,
        tags: []
      });
      
      console.log('📝 Comment submit response:', {
        status: response.status,
        data: response.data,
        isMemoryPost
      });
      
      // Remove temp comment and add real one
      setComments(prev => {
        const filtered = prev.filter(c => c._id !== tempComment._id);
        console.log('📝 Filtered out temp comment, remaining:', filtered.length);
        
        if (isMemoryPost) {
          const updated = [...filtered, response.data.comment];
          console.log('📝 Added new memory comment:', response.data.comment);
          console.log('📝 Final memory comments:', updated);
          return updated;
        } else {
          const updated = response.data.comments || filtered;
          console.log('📝 Updated regular post comments:', updated);
          return updated;
        }
      });
      
      onCommentAdded?.(response.data);
      console.log('✅ Comment submitted successfully');
      
    } catch (error) {
      console.error('❌ Error submitting comment:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Remove temp comment on error
      setComments(prev => {
        const filtered = prev.filter(c => c._id !== tempComment._id);
        console.log('📝 Removed temp comment due to error, remaining:', filtered.length);
        return filtered;
      });
      setNewComment(commentText); // Restore text
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    textInputRef.current?.blur();
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backgroundOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchComments();
    setRefreshing(false);
  };

  const renderComment = (comment, index) => (
    <View key={comment._id || index} style={[
      styles.modalCommentItem,
      comment.isTemp && styles.tempComment
    ]}>
      <TouchableOpacity style={styles.modalCommentAvatar}>
        <Image
          source={{ 
            uri: comment.user?.profilePicture 
              ? `http://${API_BASE_URL}:3000${comment.user.profilePicture}`
              : 'https://via.placeholder.com/40/CCCCCC/666666?text=U'
          }}
          style={styles.modalAvatarImage}
        />
      </TouchableOpacity>
      
      <View style={styles.modalCommentContent}>
        <Text style={styles.modalCommentAuthor}>
          {comment.user?.username || 'Unknown User'}
        </Text>
        <Text style={[
          styles.modalCommentText,
          comment.isTemp && styles.tempCommentText
        ]}>
          {comment.text}
        </Text>
        <Text style={styles.modalCommentTime}>
          {comment.isTemp ? 'Sending...' : niceDate(comment.createdAt)}
        </Text>
      </View>
      
      {comment.isTemp && (
        <ActivityIndicator size="small" color="#666" style={styles.tempIndicator} />
      )}
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <Animated.View 
        style={[
          styles.modalOverlay,
          { opacity: backgroundOpacity }
        ]}
      >
        <Pressable 
          style={styles.backgroundPressable}
          onPress={handleClose}
        >
          <Animated.View 
            style={[
              styles.commentsModalContainer,
              {
                transform: [{ translateY: slideAnim }],
                marginBottom: keyboardHeight,
              }
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Modal Handle */}
            <View style={styles.modalHandle} />
            
            {/* Header */}
            <View style={styles.commentsModalHeader}>
              <Text style={styles.commentsModalTitle}>
                {isMemoryPost ? 'Memory Comments' : 'Comments'}
              </Text>
              <TouchableOpacity 
                onPress={handleClose} 
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.commentsList}
              contentContainerStyle={[
                styles.commentsContent,
                comments.length === 0 && !loading && styles.emptyContent
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#666"
                  progressBackgroundColor="#FFF"
                />
              }
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Loading comments...</Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
                  </View>
                  <Text style={styles.emptyText}>No comments yet</Text>
                  <Text style={styles.emptySubtext}>
                    {isMemoryPost ? 'Share your thoughts about this memory!' : 'Be the first to comment!'}
                  </Text>
                </View>
              ) : (
                comments.map(renderComment)
              )}
            </ScrollView>

            {/* Comment Input */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalInputContainer}
            >
              <View style={styles.modalInputRow}>
                <TouchableOpacity style={styles.modalUserAvatar}>
                  <Image
                    source={{ 
                      uri: 'https://via.placeholder.com/36/CCCCCC/666666?text=Y'
                    }}
                    style={styles.modalUserAvatarImage}
                  />
                </TouchableOpacity>
                
                <TextInput
                  ref={textInputRef}
                  style={styles.modalCommentInput}
                  placeholder={isMemoryPost ? "Share your thoughts..." : "Add a comment..."}
                  placeholderTextColor="#8E8E93"
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={submitComment}
                  editable={!submitting}
                  blurOnSubmit={false}
                />
                
                <TouchableOpacity
                  style={[
                    styles.modalSendButton,
                    (!newComment.trim() || submitting) && styles.modalSendButtonDisabled
                  ]}
                  onPress={submitComment}
                  disabled={!newComment.trim() || submitting}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Ionicons 
                      name="send" 
                      size={20} 
                      color={newComment.trim() ? "#007AFF" : "#C7C7CC"} 
                    />
                  )}
                </TouchableOpacity>
              </View>
              
              {/* Character count */}
              {newComment.length > 400 && (
                <View style={styles.characterCount}>
                  <Text style={[
                    styles.characterCountText,
                    newComment.length >= 500 && styles.characterCountWarning
                  ]}>
                    {500 - newComment.length} characters remaining
                  </Text>
                </View>
              )}
            </KeyboardAvoidingView>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */

export default function CompletePostItem({
  post,
  currentUserId,
  hideUserInfo = false,
  navigation,
  onDeletePost,
  disableEventLink = false,
  showEventContext = false,
  eventContextSource = null,
  onPostUpdate, // Callback for post updates
}) {
  // Debug currentUserId immediately
  console.log('🎯 PostItem initialized with currentUserId:', currentUserId);
  
  // Detect if this is a memory post
  const isMemoryPost = post.postType === 'memory';
  const memoryInfo = post.memoryInfo || {};

  // Memory storytelling data
  const memoryMood = useMemo(() => 
    isMemoryPost ? getMemoryMood(post.createdAt || post.uploadDate) : null, 
    [isMemoryPost, post.createdAt, post.uploadDate]
  );
  
  const memoryTimeText = useMemo(() => 
    isMemoryPost ? formatMemoryTime(post.createdAt || post.uploadDate) : null,
    [isMemoryPost, post.createdAt, post.uploadDate]
  );

  // State for memory photo dimensions
  const [memoryImageDimensions, setMemoryImageDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  });

  /* ---- Enhanced state initialization from props ------- */
  const [liked, setLiked] = useState(post.userLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [modal, setModal] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);

  // Comments modal state - UPDATED
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Loading states
  const [initialLoading, setInitialLoading] = useState(false);

  // Animation refs
  const heartScale = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const memorySparkle = useRef(new Animated.Value(0)).current;
  const memoryGlow = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const DOUBLE_PRESS_DELAY = 300;

  /* ---- Load initial data (likes and comments) on mount with debugging -------- */
  useEffect(() => {
    console.log('🎯 PostItem useEffect triggered:', {
      postId: post._id,
      hasPostId: !!post._id,
      initialLoading,
      shouldLoad: post._id && !initialLoading
    });
    
    if (post._id && !initialLoading) {
      loadInitialData();
    }
  }, [post._id]);

  const loadInitialData = async () => {
    console.log('🔄 Loading initial data for post:', {
      postId: post._id,
      isMemoryPost,
      hasInitialData: {
        userLiked: post.userLiked,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        hasComments: post.comments?.length > 0
      }
    });

    try {
      setInitialLoading(true);
      
      // For regular posts, get full post data with likes and comments
      if (!isMemoryPost) {
        console.log('📸 Fetching regular post data from:', `/api/photos/${post._id}`);
        
        const response = await api.get(`/api/photos/${post._id}`);
        const postData = response.data;
        
        console.log('📸 Regular post data received:', {
          userLiked: postData.userLiked,
          likeCount: postData.likeCount,
          commentCount: postData.commentCount,
          hasComments: postData.comments?.length > 0,
          likesArray: postData.likes
        });
        
        // Set state with proper fallbacks
        const userLiked = postData.userLiked || false;
        const likeCountValue = postData.likeCount || 0;
        const commentsArray = postData.comments || [];
        const commentCountValue = postData.commentCount || commentsArray.length || 0;
        
        console.log('📸 Setting regular post state:', {
          userLiked,
          likeCountValue,
          commentCountValue,
          commentsLength: commentsArray.length
        });
        
        setLiked(userLiked);
        setLikeCount(likeCountValue);
        setComments(commentsArray);
        setCommentCount(commentCountValue);
        
      } else {
        // For memory posts, get the specific photo data
        console.log('📷 Fetching memory post data from:', `/api/memories/photos/${post._id}/likes`);
        
        try {
          const response = await api.get(`/api/memories/photos/${post._id}/likes`);
          console.log('📷 Memory likes data received:', response.data);
          
          setLiked(response.data.userLiked || false);
          setLikeCount(response.data.likeCount || 0);
          
          // Load comments for memory posts if available
          try {
            console.log('📷 Fetching memory comments from:', `/api/memories/photos/${post._id}/comments`);
            const commentsResponse = await api.get(`/api/memories/photos/${post._id}/comments`);
            console.log('📷 Memory comments data received:', commentsResponse.data);
            
            if (commentsResponse.data.comments) {
              setComments(commentsResponse.data.comments);
              setCommentCount(commentsResponse.data.comments.length);
            }
          } catch (commentError) {
            console.log('⚠️ Comments not available for memory photos yet:', commentError.message);
          }
        } catch (error) {
          console.error('❌ Error loading memory post data:', error);
          console.error('❌ Memory post error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading initial post data:', error);
      console.error('❌ Initial data error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Use the data from props as fallback
      console.log('📊 Using fallback data from props:', {
        userLiked: post.userLiked || false,
        likeCount: post.likeCount || 0,
        commentCount: post.commentCount || 0,
        hasComments: post.comments?.length > 0
      });
      
      setLiked(post.userLiked || false);
      setLikeCount(post.likeCount || 0);
      setComments(post.comments || []);
      setCommentCount(post.commentCount || 0);
    } finally {
      setInitialLoading(false);
      console.log('✅ Initial data loading completed');
    }
  };

  /* ---- image url -------------------------------------------------- */
  let imgURL = null;
  if (isMemoryPost) {
    imgURL = post.url ? `http://${API_BASE_URL}:3000${post.url}` : null;
  } else {
    const first = post.paths?.[0] ? `/${post.paths[0].replace(/^\/?/, '')}` : '';
    imgURL = first ? `http://${API_BASE_URL}:3000${first}` : null;
  }

  // Calculate memory photo dimensions
  useEffect(() => {
    if (isMemoryPost && imgURL) {
      Image.getSize(imgURL, (width, height) => {
        const containerWidth = SCREEN_WIDTH;
        const aspectRatio = height / width;
        const calculatedHeight = Math.min(containerWidth * aspectRatio, SCREEN_WIDTH * 1.5);

        setMemoryImageDimensions({
          width: containerWidth,
          height: calculatedHeight
        });
      }, (error) => {
        console.warn('Failed to get memory image dimensions:', error);
        setMemoryImageDimensions({
          width: SCREEN_WIDTH,
          height: SCREEN_WIDTH
        });
      });
    }
  }, [isMemoryPost, imgURL]);

  // Memory sparkle animation for nostalgic effect
  useEffect(() => {
    if (isMemoryPost && memoryMood?.mood === 'nostalgic') {
      const sparkleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(memorySparkle, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(memorySparkle, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      sparkleAnimation.start();
      return () => sparkleAnimation.stop();
    }
  }, [isMemoryPost, memoryMood]);

  // Vintage glow for old memories
  useEffect(() => {
    if (isMemoryPost && memoryMood?.mood === 'vintage') {
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(memoryGlow, {
            toValue: 0.3,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(memoryGlow, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      );
      glowAnimation.start();
      return () => glowAnimation.stop();
    }
  }, [isMemoryPost, memoryMood]);

  /* ---- FIXED like toggle with proper API endpoint handling and debugging ------- */
  const toggleLike = async () => {
    if (!post?._id) {
      console.error('❌ No post ID available for like toggle');
      return;
    }

    if (!currentUserId) {
      console.error('❌ No currentUserId available for like toggle');
      Alert.alert('Error', 'User not authenticated');
      return;
    }
    
    console.log('🔄 Starting like toggle:', {
      postId: post._id,
      isMemoryPost,
      currentLiked: liked,
      currentLikeCount: likeCount,
      currentUserId: currentUserId
    });
    
    try {
      const newLiked = !liked;
      const newCount = newLiked ? likeCount + 1 : likeCount - 1;
      
      console.log('📊 Optimistic update:', {
        newLiked,
        newCount,
        previousLiked: liked,
        previousCount: likeCount
      });
      
      // Optimistic update
      setLiked(newLiked);
      setLikeCount(newCount);

      let response;
      if (isMemoryPost) {
        console.log('📷 Making memory photo like request to:', `/api/memories/photos/${post._id}/like`);
        response = await api.post(`/api/memories/photos/${post._id}/like`);
        console.log('📷 Memory like response:', response.data);
        
        // For memory posts, use the response directly
        if (response.data.liked !== undefined) {
          console.log('📷 Setting memory liked state to:', response.data.liked);
          setLiked(response.data.liked);
        }
        if (response.data.likeCount !== undefined) {
          console.log('📷 Setting memory like count to:', response.data.likeCount);
          setLikeCount(response.data.likeCount);
        }
      } else {
        console.log('📸 Making regular post like request to:', `/api/photos/like/${post._id}`);
        response = await api.post(`/api/photos/like/${post._id}`);
        console.log('📸 Regular post like response:', response.data);
        
        // FIXED: Handle different response formats
        let userLiked = false;
        let responseCount = 0;
        
        // Check if response has userLiked field (preferred)
        if (response.data.userLiked !== undefined) {
          userLiked = response.data.userLiked;
          console.log('📸 Using userLiked field from response:', userLiked);
        } 
        // Fallback: check if user is in likes array
        else if (Array.isArray(response.data.likes)) {
          userLiked = response.data.likes.includes(currentUserId);
          console.log('📸 Checking likes array for currentUserId:', {
            currentUserId,
            likesArray: response.data.likes,
            userLiked
          });
        }
        
        // Get like count
        if (response.data.likeCount !== undefined) {
          responseCount = response.data.likeCount;
        } else if (response.data.likes) {
          responseCount = response.data.likes.length;
        }
        
        console.log('📸 Final regular post like analysis:', {
          userLiked,
          responseCount,
          currentUserId
        });
        
        setLiked(userLiked);
        setLikeCount(responseCount);
      }

      // Notify parent component of update
      if (onPostUpdate) {
        onPostUpdate(post._id, { 
          liked: newLiked,
          likeCount: newCount
        });
      }

      console.log('✅ Like toggle completed successfully');
      
    } catch (err) {
      console.error('❌ Toggle like error:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      // Revert optimistic update on error
      setLiked(liked);
      setLikeCount(likeCount);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  /* ---- NEW: Open comments modal instead of navigation ----- */
  const openComments = () => {
    console.log('🟡 PostItem: Opening comments modal for:', isMemoryPost ? 'memory' : 'post', post._id);
    setShowCommentsModal(true);
  };

  /* ---- Handle comment added from modal ----- */
  const handleCommentAdded = (newCommentData) => {
    if (isMemoryPost) {
      setCommentCount(prev => prev + 1);
    } else {
      setCommentCount(newCommentData?.comments?.length || commentCount + 1);
    }
    
    if (onPostUpdate) {
      onPostUpdate(post._id, { 
        commentCount: commentCount + 1 
      });
    }
  };

  /* ---- Submit comment (inline) with enhanced debugging --------------------------------------- */
  const submitComment = async () => {
    if (!commentText.trim()) {
      console.warn('⚠️ Cannot submit empty inline comment');
      return;
    }
    
    if (submittingComment) {
      console.warn('⚠️ Already submitting inline comment, skipping');
      return;
    }

    console.log('🔄 Submitting inline comment:', {
      postId: post._id,
      isMemoryPost,
      commentText: commentText.trim(),
      endpoint: isMemoryPost
        ? `/api/memories/photos/${post._id}/comments`
        : `/api/photos/comment/${post._id}`
    });

    try {
      setSubmittingComment(true);

      let response;
      if (isMemoryPost) {
        response = await api.post(`/api/memories/photos/${post._id}/comments`, {
          text: commentText.trim(),
          tags: []
        });
        
        console.log('📝 Memory comment submit response:', response.data);
        
        // Add the new comment to local state
        setComments(prev => {
          const updated = [...prev, response.data.comment];
          console.log('📝 Updated memory comments state:', updated);
          return updated;
        });
        setCommentCount(prev => {
          const newCount = prev + 1;
          console.log('📝 Updated memory comment count:', newCount);
          return newCount;
        });
      } else {
        response = await api.post(`/api/photos/comment/${post._id}`, {
          text: commentText.trim(),
          tags: []
        });
        
        console.log('📝 Regular post comment submit response:', response.data);
        
        // For regular posts, the response includes the full updated photo
        const newComments = response.data.comments || [];
        const newCount = response.data.comments?.length || 0;
        
        console.log('📝 Setting regular post comments:', {
          newComments,
          newCount
        });
        
        setComments(newComments);
        setCommentCount(newCount);
      }

      setCommentText('');
      console.log('✅ Inline comment submitted successfully');

      // Notify parent component
      if (onPostUpdate) {
        const updateData = {
          commentCount: isMemoryPost ? commentCount + 1 : response.data.comments?.length || 0
        };
        console.log('📝 Notifying parent component with:', updateData);
        onPostUpdate(post._id, updateData);
      }

    } catch (error) {
      console.error('❌ Error submitting inline comment:', error);
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

  /* ---- Fetch likes list for modal or navigate to screen ----- */
  const openLikesScreen = () => {
    if (likeCount > 0) {
      // Navigate to the existing PostLikesScreen
      navigation.navigate('PostLikesScreen', { 
        postId: post._id,
        likeCount: likeCount,
        isMemoryPost: isMemoryPost
      });
    }
  };

  /* ---- double tap handling --------------------------------------- */
  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSince = now - lastTap.current;

    if (timeSince < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (!liked) {
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

        toggleLike();
      }
    } else {
      // Single tap
      setTimeout(() => {
        const timeSinceLastTap = Date.now() - lastTap.current;
        if (timeSinceLastTap >= DOUBLE_PRESS_DELAY) {
          if (isMemoryPost) {
            openMemory();
          } else {
            openComments();
          }
        }
      }, DOUBLE_PRESS_DELAY);
    }

    lastTap.current = now;
  };

  /* ---- navigation helpers ---------------------------------------- */
  const openUser = (userId) => {
    console.log('🟡 PostItem: Opening user profile:', userId);
    navigation.navigate('ProfileScreen', { userId });
  };

  const openEvent = () => {
    console.log('🟡 PostItem: Opening event:', post.event?._id);
    navigation.navigate('EventDetailsScreen', { eventId: post.event._id });
  };

  const openMemory = () => {
    console.log('🟡 PostItem: Opening memory:', memoryInfo.memoryId);
    navigation.navigate('MemoryDetailsScreen', { memoryId: memoryInfo.memoryId });
  };

  /* ---- derived helpers ------------------------------------------- */
  const stamp = useMemo(() => niceDate(post.createdAt || post.uploadDate), [post]);
  const uploadDate = useMemo(() => getUploadDate(post.createdAt || post.uploadDate), [post]);
  const isOwner = String(post.user?._id) === String(currentUserId);

  // Caption handling
  const caption = post.caption || '';
  const shouldTruncate = caption.length > 100;
  const displayCaption = showFullCaption || !shouldTruncate
    ? caption
    : caption.slice(0, 100) + '...';

  // Comment display logic - show 2 comments max
  const displayComments = comments.slice(0, 2); // Show up to 2 comments
  const hasMoreComments = comments.length > 2;

  /* ================================================================== */
  /*                      MAIN RENDER                                  */
  /* ================================================================== */

  return (
    <View style={[
      styles.postContainer,
      isMemoryPost && styles.memoryPostContainer,
      isMemoryPost && memoryMood?.mood === 'vintage' && styles.vintagePostContainer
    ]}>

      {/* Memory Story Header */}
      {isMemoryPost && (
        <View style={styles.memoryStoryHeader}>
          <View style={styles.memoryIndicator}>
            <Text style={styles.memoryEmoji}>{memoryMood?.emoji}</Text>
            <Text style={styles.memoryStoryText}>
              A memory {memoryTimeText}
            </Text>
          </View>
          
          {/* Memory mood indicator */}
          <View style={[
            styles.memoryMoodBadge,
            { backgroundColor: getMoodColor(memoryMood?.mood) }
          ]}>
            <Text style={styles.memoryMoodText}>{memoryMood?.mood}</Text>
          </View>
        </View>
      )}

      {/* ---------- ENHANCED user info header (REMOVED "from") ---------- */}
      {!hideUserInfo && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => openUser(post.user?._id)} style={styles.userRow} activeOpacity={0.8}>
            <View style={[
              styles.avatarContainer,
              isMemoryPost && styles.memoryAvatarContainer
            ]}>
              {/* Vintage glow effect for old memories */}
              {isMemoryPost && memoryMood?.mood === 'vintage' && (
                <Animated.View 
                  style={[
                    styles.vintageAvatarGlow,
                    { opacity: memoryGlow }
                  ]} 
                />
              )}
              
              <Image
                source={{ uri: `http://${API_BASE_URL}:3000${post.user?.profilePicture || ''}` }}
                style={[
                  styles.avatar,
                  isMemoryPost && memoryMood?.mood === 'vintage' && styles.vintageAvatar
                ]}
                onError={(e) => console.log('Avatar error:', e.nativeEvent?.error)}
              />
            </View>
            
            <View style={styles.userText}>
              <View style={styles.usernameRow}>
                <Text style={styles.username}>{post.user?.username || 'Unknown'}</Text>
                
                {/* Memory context inline with username */}
                {isMemoryPost && (
                  <>
                    <Text style={styles.contextText}> in </Text>
                    <TouchableOpacity onPress={openMemory}>
                      <Text style={styles.memoryLink}>
                        {memoryInfo.memoryTitle || 'Memory'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* EVENT context inline with username (BLUE COLOR) */}
                {!isMemoryPost && post.event && (
                  <>
                    <Text style={styles.contextText}> at </Text>
                    <TouchableOpacity onPress={openEvent}>
                      <Text style={styles.eventLink}>
                        {post.event.title}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* owner dots */}
          {isOwner && (
            <TouchableOpacity onPress={() => setModal(true)} style={styles.dots} activeOpacity={0.8}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ---------- main image with memory effects ---------- */}
      <Pressable onPress={handleDoubleTap} style={[
        styles.imageContainer,
        isMemoryPost && {
          width: memoryImageDimensions.width,
          height: memoryImageDimensions.height,
          aspectRatio: memoryImageDimensions.width / memoryImageDimensions.height
        }
      ]}>
        
        {/* Memory sparkle overlay for nostalgic photos */}
        {isMemoryPost && memoryMood?.mood === 'nostalgic' && (
          <Animated.View 
            style={[
              styles.memorySparkleOverlay,
              { opacity: memorySparkle }
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.8)', 'transparent', 'rgba(255,255,255,0.6)']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.sparkleGradient}
            />
            <View style={styles.sparkleParticles}>
              <Text style={[styles.sparkle, { top: '20%', left: '15%' }]}>✨</Text>
              <Text style={[styles.sparkle, { top: '60%', right: '20%' }]}>⭐</Text>
              <Text style={[styles.sparkle, { top: '80%', left: '70%' }]}>💫</Text>
            </View>
          </Animated.View>
        )}

        <Animated.View style={{ 
          transform: [{ scale: scaleValue }],
          width: '100%',
          height: '100%'
        }}>
          {imgURL ? (
            <Image
              source={{ uri: imgURL }}
              style={[
                styles.postImage,
                isMemoryPost && memoryMood?.mood === 'vintage' && styles.vintageImage
              ]}
              resizeMode={isMemoryPost ? "contain" : "cover"}
              onError={(e) => console.log('Image error:', e.nativeEvent?.error)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image" size={50} color="#C7C7CC" />
              <Text style={styles.placeholderText}>No image</Text>
            </View>
          )}

          {/* Animated heart for double tap */}
          <Animated.View
            style={[
              styles.heartOverlay,
              {
                opacity: heartScale,
                transform: [{ scale: heartScale }]
              }
            ]}
            pointerEvents="none"
          >
            <Ionicons name="heart" size={80} color={HEART} />
          </Animated.View>
        </Animated.View>
      </Pressable>

      {/* ---------- action row (NO TIMESTAMP HERE) ---------- */}
      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={toggleLike} style={styles.actionBtn} activeOpacity={0.8}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? HEART : '#000'}
            />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={openComments} 
            style={styles.actionBtn} 
            activeOpacity={0.8}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={24} 
              color="#000" 
            />
          </TouchableOpacity>

          {/* Only show share for regular posts */}
          {!isMemoryPost && (
            <TouchableOpacity onPress={() => {}} style={styles.actionBtn} activeOpacity={0.8}>
              <Ionicons name="paper-plane-outline" size={24} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {/* Memory explore button */}
        {isMemoryPost && (
          <TouchableOpacity onPress={openMemory} style={styles.memoryExploreBtn}>
            <Text style={styles.memoryExploreBtnText}>Explore Memory</Text>
            <Ionicons name="arrow-forward" size={16} color={MEMORY_BLUE} />
          </TouchableOpacity>
        )}
      </View>

      {/* ---------- ENHANCED likes count with tap to view ---------- */}
      {likeCount > 0 && (
        <TouchableOpacity onPress={openLikesScreen} style={styles.likesContainer}>
          <Text style={styles.likesText}>
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ---------- caption ---------- */}
      {caption ? (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>{post.user?.username || 'Unknown'}</Text>{' '}
            {displayCaption}
          </Text>
          {shouldTruncate && !showFullCaption && (
            <TouchableOpacity onPress={() => setShowFullCaption(true)}>
              <Text style={styles.moreText}>more</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* ---------- ENHANCED comments section with proper order ---------- */}
      {commentCount > 0 && (
        <View style={styles.commentsSection}>
          {/* Display comments FIRST (1-2 recent comments) */}
          {displayComments.map((comment, index) => (
            <View key={`comment-${comment._id || index}`} style={styles.commentItem}>
              <TouchableOpacity onPress={() => openUser(comment.user?._id)}>
                <Image
                  source={{ uri: `http://${API_BASE_URL}:3000${comment.user?.profilePicture || ''}` }}
                  style={styles.commentAvatar}
                />
              </TouchableOpacity>
              <View style={styles.commentContent}>
                <Text style={styles.commentText}>
                  <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
                  {' '}
                  {comment.text}
                </Text>
                <Text style={styles.commentTime}>
                  {niceDate(comment.createdAt)}
                </Text>
              </View>
            </View>
          ))}

          {/* View all comments link BELOW the displayed comments */}
          <TouchableOpacity 
            onPress={openComments} 
            style={styles.viewAllCommentsBtn}
          >
            <Text style={styles.viewAllCommentsText}>
              View all {commentCount} comment{commentCount === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---------- timestamp (moved above comment input) ---------- */}
      <Text style={[
        styles.timestamp,
        isMemoryPost && styles.memoryTimestamp
      ]}>
        {stamp}
      </Text>

      {/* ---------- IMPROVED: Inline comment input (NO PROFILE PHOTO) ---------- */}
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

      {/* ---------- delete modal ---------- */}
      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setModal(false);
                onDeletePost?.(post._id);
              }}
            >
              <Text style={styles.modalOptionText}>Delete {isMemoryPost ? 'Memory Photo' : 'Post'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => setModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------- COMMENTS MODAL ---------- */}
      <CommentsModal
        visible={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        post={post}
        isMemoryPost={isMemoryPost}
        currentUserId={currentUserId}
        onCommentAdded={handleCommentAdded}
      />
    </View>
  );
}

/* ================================================================== */
/*                      MEMORY HELPER FUNCTIONS                      */
/* ================================================================== */

const getMoodColor = (mood) => {
  switch (mood) {
    case 'fresh': return 'rgba(52, 199, 89, 0.1)';
    case 'recent': return 'rgba(55, 151, 239, 0.1)';
    case 'nostalgic': return 'rgba(255, 149, 0, 0.1)';
    case 'vintage': return 'rgba(142, 68, 173, 0.1)';
    default: return 'rgba(142, 142, 147, 0.1)';
  }
};