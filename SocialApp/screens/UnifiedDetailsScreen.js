// screens/UnifiedDetailsScreen.js - Fixed with proper image dimensions
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, FlatList, SafeAreaView,
  StatusBar, KeyboardAvoidingView, Platform, Dimensions, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import usePostsStore from '../stores/postsStore';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEART = '#ED4956';
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
  const toggleLikeInStore = usePostsStore(state => state.toggleLike);
  const addCommentInStore = usePostsStore(state => state.addComment);

  const currentPost = storePost || initialPost;

  // Initialize store with this post if not already there
  useEffect(() => {
    if (!storePost && initialPost) {
      usePostsStore.getState().addPost(initialPost);
    }
  }, [postId, storePost, initialPost]);

  const currentUserId = currentUser?._id;

  // CENTRALIZED STATE - Get state from store
  const isLiked = currentPost?.userLiked || false;
  const likeCount = currentPost?.likeCount || 0;
  const commentCount = currentPost?.commentCount || 0;

  // Local state for UI only
  const [post, setPost] = useState(initialPost || null);
  const [loading, setLoading] = useState(!initialPost);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // ADD: Image dimensions state for proper aspect ratio
  const [imageDimensions, setImageDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH, // Default to square
    loading: true
  });

  // Animation for like button
  const heartScale = useRef(new Animated.Value(1)).current;

  // ADD: Calculate image dimensions
  useEffect(() => {
    if (!currentPost) return;

    const imgURL = isMemoryPost 
      ? (currentPost.url ? `http://${API_BASE_URL}:3000${currentPost.url}` : null)
      : (currentPost.paths?.[0] ? `http://${API_BASE_URL}:3000/${currentPost.paths[0].replace(/^\/?/, '')}` : null);

    if (!imgURL) {
      setImageDimensions(prev => ({ ...prev, loading: false }));
      return;
    }

    Image.getSize(
      imgURL,
      (width, height) => {
        const aspectRatio = height / width;
        const maxHeight = 600; // Adjust this as needed
        const calculatedHeight = Math.min(SCREEN_WIDTH * aspectRatio, maxHeight);

        setImageDimensions({
          width: SCREEN_WIDTH,
          height: calculatedHeight,
          loading: false,
          aspectRatio
        });
      },
      (error) => {
        console.warn('Failed to get image dimensions:', error);
        setImageDimensions(prev => ({ ...prev, loading: false }));
      }
    );
  }, [currentPost, isMemoryPost]);

  // Set custom header with back button only
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: '',
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={{ marginLeft: 16, padding: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      ),
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowColor: 'transparent',
        elevation: 0,
      },
    });
  }, [navigation]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
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
        response = await api.get(`/api/memories/photos/${postId}`);
        const memoryPhoto = response.data;
        const transformedPost = {
          ...memoryPhoto,
          postType: 'memory',
          user: memoryPhoto.uploadedBy,
          createdAt: memoryPhoto.uploadedAt,
          paths: [memoryPhoto.url],
        };
        setPost(transformedPost);
        usePostsStore.getState().addPost(transformedPost);
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
        response = await api.get(`/api/memories/photos/${postId}/comments`);
        setComments(response.data.comments || []);
      } else {
        response = await api.get(`/api/photos/${postId}`);
        setComments(response.data.comments || []);
        usePostsStore.getState().updatePost(postId, {
          commentCount: response.data.commentCount || response.data.comments?.length || 0
        });
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      if (currentPost?.comments) {
        setComments(currentPost.comments);
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleLike = async () => {
    if (!currentPost?._id || !currentUser?._id) return;

    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      await toggleLikeInStore(currentPost._id, isMemoryPost, currentUser._id);
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || commentsLoading) return;

    try {
      setCommentsLoading(true);
      const commentText = newComment.trim();
      setNewComment('');

      const response = await addCommentInStore(currentPost._id, commentText, isMemoryPost);
      
      if (isMemoryPost) {
        setComments(prev => [...prev, response.comment]);
      } else {
        setComments(response.comments || []);
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Error posting comment:', error);
      setNewComment(commentText);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleLikesPress = () => {
    if (likeCount > 0) {
      navigation.navigate('PostLikesScreen', {
        postId: currentPost._id,
        postType: isMemoryPost ? 'memory' : 'post',
        likeCount: likeCount
      });
    }
  };

  const handleEventPress = () => {
    if (currentPost?.event?._id) {
      navigation.navigate('EventDetailsScreen', { eventId: currentPost.event._id });
    }
  };

  const handleMemoryPress = () => {
    if (isMemoryPost && currentPost?.memoryInfo?.memoryId) {
      navigation.navigate('MemoryDetailsScreen', { memoryId: currentPost.memoryInfo.memoryId });
    }
  };

  const renderComment = ({ item: comment }) => (
    <View style={styles.commentItem}>
      <TouchableOpacity onPress={() => handleUserPress(comment.user?._id)}>
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
        <View style={styles.commentBubble}>
          <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
          <Text style={styles.commentText}>{comment.text}</Text>
        </View>
        <View style={styles.commentMeta}>
          <Text style={styles.commentTime}>{niceDate(comment.createdAt)}</Text>
        </View>
      </View>
    </View>
  );

  const renderHeader = () => {
    if (!currentPost) return null;

    const memoryMood = isMemoryPost ? getMemoryMood(currentPost.createdAt || currentPost.uploadedAt) : null;
    const memoryTimeText = isMemoryPost ? formatMemoryTime(currentPost.createdAt || currentPost.uploadedAt) : null;
    
    const imgURL = isMemoryPost 
      ? (currentPost.url ? `http://${API_BASE_URL}:3000${currentPost.url}` : null)
      : (currentPost.paths?.[0] ? `http://${API_BASE_URL}:3000/${currentPost.paths[0].replace(/^\/?/, '')}` : null);

    return (
      <View style={styles.headerContainer}>
        {/* Memory Story Header */}
        {isMemoryPost && (
          <View style={styles.memoryStoryHeader}>
            <View style={styles.memoryIndicator}>
              <Text style={styles.memoryEmoji}>{memoryMood?.emoji}</Text>
              <Text style={styles.memoryStoryText}>
                A memory {memoryTimeText}
              </Text>
            </View>
            <View style={[styles.memoryMoodBadge, { backgroundColor: getMoodColor(memoryMood?.mood) }]}>
              <Text style={styles.memoryMoodText}>{memoryMood?.mood}</Text>
            </View>
          </View>
        )}

        {/* Author Section */}
        <View style={styles.authorContainer}>
          <TouchableOpacity onPress={() => handleUserPress(currentPost.user?._id)} style={styles.authorInfo}>
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

        {/* FIXED: Image with dynamic dimensions */}
        <View style={[
          styles.imageContainer,
          {
            width: imageDimensions.width,
            height: imageDimensions.height
          }
        ]}>
          {imgURL ? (
            <Image
              source={{ uri: imgURL }}
              style={styles.postImage}
              resizeMode={isMemoryPost ? "contain" : "cover"}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image" size={50} color="#C7C7CC" />
              <Text style={styles.placeholderText}>No image</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={toggleLike} style={styles.actionButton}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isLiked ? HEART : '#000'}
                />
              </Animated.View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => textInputRef.current?.focus()} 
              style={styles.actionButton}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#000" />
            </TouchableOpacity>

            {!isMemoryPost && (
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="paper-plane-outline" size={24} color="#000" />
              </TouchableOpacity>
            )}
          </View>

          {/* Memory explore button */}
          {isMemoryPost && (
            <TouchableOpacity onPress={handleMemoryPress} style={styles.memoryExploreBtn}>
              <Text style={styles.memoryExploreBtnText}>Explore Memory</Text>
              <Ionicons name="arrow-forward" size={16} color={MEMORY_BLUE} />
            </TouchableOpacity>
          )}
        </View>

        {/* Like Count */}
        {likeCount > 0 && (
          <TouchableOpacity onPress={handleLikesPress} style={styles.likeCountContainer}>
            <Text style={styles.likeCount}>
              {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
            </Text>
          </TouchableOpacity>
        )}

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
              <Text style={styles.commentPostText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// Helper function for memory mood colors
const getMoodColor = (mood) => {
  switch (mood) {
    case 'fresh': return 'rgba(52, 199, 89, 0.1)';
    case 'recent': return 'rgba(55, 151, 239, 0.1)';
    case 'nostalgic': return 'rgba(255, 149, 0, 0.1)';
    case 'vintage': return 'rgba(142, 68, 173, 0.1)';
    default: return 'rgba(142, 142, 147, 0.1)';
  }
};

// FIXED: Styles with proper imageContainer definition
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  commentsList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
  },

  // Memory Story Header
  memoryStoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(55, 151, 239, 0.1)',
    borderRadius: 12,
    margin: 16,
    marginBottom: 8,
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

  // Author section
  authorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F6F6F6',
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
    color: '#666666',
    fontWeight: '400',
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

  // FIXED: Image container without static dimensions
  imageContainer: {
    backgroundColor: '#F6F6F6',
    position: 'relative',
    alignSelf: 'center',
    // Width and height will be set dynamically in JSX
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },

  // Actions
  actionsContainer: {
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
    padding: 4,
    marginRight: 16,
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

  // Like count
  likeCountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  captionText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },
  captionUsername: {
    fontWeight: '600',
  },

  // Comments Header
  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  // Empty comments
  emptyCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCommentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCommentsSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Comments
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#F6F6F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Comment Input
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
    backgroundColor: '#FFFFFF',
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: '#000000',
  },
  commentPostButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#3797EF',
  },
  commentPostText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});