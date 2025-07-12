// components/CommentsModal.js - Optimized Comments Modal Component
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  RefreshControl,
  Pressable,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { niceDate } from '../utils/helpers';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  // Keyboard handling
  useEffect(() => {
    const keyboardWillShow = (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    
    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    if (Platform.OS === 'ios') {
      const showListener = Keyboard.addListener('keyboardWillShow', keyboardWillShow);
      const hideListener = Keyboard.addListener('keyboardWillHide', keyboardWillHide);
      
      return () => {
        showListener?.remove();
        hideListener?.remove();
      };
    }
  }, []);

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

  const fetchComments = useCallback(async () => {
    if (!post?._id) return;
    
    setLoading(true);
    try {
      const endpoint = isMemoryPost 
        ? `/api/memories/photos/${post._id}/comments`
        : `/api/photos/${post._id}/comments`;
      
      const response = await api.get(endpoint);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [post?._id, isMemoryPost]);

  const submitComment = useCallback(async () => {
    if (!newComment.trim() || submitting) return;
    
    // Add haptic feedback
    if (Platform.OS === 'ios') {
      // Haptic feedback for iOS - using Expo Haptics if available
      try {
        const { Haptics } = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Haptics not available, continue without feedback
      }
    }
    
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
    
    setComments(prev => [...prev, tempComment]);
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
      
      // Remove temp comment and add real one
      setComments(prev => {
        const filtered = prev.filter(c => c._id !== tempComment._id);
        if (isMemoryPost) {
          return [...filtered, response.data.comment];
        } else {
          return response.data.comments || filtered;
        }
      });
      
      onCommentAdded?.(response.data);
      
    } catch (error) {
      console.error('Error submitting comment:', error);
      // Remove temp comment on error
      setComments(prev => prev.filter(c => c._id !== tempComment._id));
      setNewComment(commentText); // Restore text
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }, [newComment, submitting, post._id, isMemoryPost, currentUserId, onCommentAdded]);

  const handleClose = useCallback(() => {
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
  }, [onClose]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchComments();
    setRefreshing(false);
  }, [fetchComments]);

  const handleBackgroundPress = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const renderComment = useCallback((comment, index) => (
    <View key={comment._id || index} style={[
      styles.commentItem,
      comment.isTemp && styles.tempComment
    ]}>
      <TouchableOpacity 
        style={styles.commentAvatar}
        disabled={comment.isTemp}
      >
        <Image
          source={{ 
            uri: comment.user?.profilePicture || 'https://via.placeholder.com/40/CCCCCC/666666?text=U'
          }}
          style={styles.avatarImage}
        />
      </TouchableOpacity>
      
      <View style={styles.commentContent}>
        <Text style={styles.commentAuthor}>
          {comment.user?.username || 'Unknown User'}
        </Text>
        <Text style={[
          styles.commentText,
          comment.isTemp && styles.tempCommentText
        ]}>
          {comment.text}
        </Text>
        <Text style={styles.commentTime}>
          {comment.isTemp ? 'Sending...' : niceDate(comment.createdAt)}
        </Text>
      </View>
      
      {comment.isTemp && (
        <ActivityIndicator size="small" color="#666" style={styles.tempIndicator} />
      )}
    </View>
  ), []);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyText}>No comments yet</Text>
      <Text style={styles.emptySubtext}>
        {isMemoryPost ? 'Share your thoughts about this memory!' : 'Be the first to comment!'}
      </Text>
    </View>
  ), [isMemoryPost]);

  const renderLoadingState = useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading comments...</Text>
    </View>
  ), []);

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
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.5)" />
        
        <Pressable 
          style={styles.backgroundPressable}
          onPress={handleBackgroundPress}
        >
          <Animated.View 
            style={[
              styles.modalContainer,
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
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
              {loading ? renderLoadingState() : 
               comments.length === 0 ? renderEmptyState() :
               comments.map(renderComment)}
            </ScrollView>

            {/* Comment Input */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.inputContainer}
            >
              <View style={styles.inputRow}>
                <TouchableOpacity style={styles.userAvatar}>
                  <Image
                    source={{ 
                      uri: 'https://via.placeholder.com/36/CCCCCC/666666?text=Y'
                    }}
                    style={styles.userAvatarImage}
                  />
                </TouchableOpacity>
                
                <TextInput
                  ref={textInputRef}
                  style={styles.commentInput}
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
                    styles.sendButton,
                    (!newComment.trim() || submitting) && styles.sendButtonDisabled
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backgroundPressable: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
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
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  tempComment: {
    opacity: 0.7,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  commentContent: {
    flex: 1,
    paddingRight: 8,
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
    marginBottom: 6,
  },
  tempCommentText: {
    color: '#8E8E93',
  },
  commentTime: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
  },
  tempIndicator: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  userAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
  },
  commentInput: {
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
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  sendButtonDisabled: {
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
});

export default CommentsModal;