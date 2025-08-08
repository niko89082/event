// screens/UnifiedDetailsScreen.js - Updated to hide like functionality
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

  // Use store post if available, otherwise use initialPost or fetch
  const currentPost = storePost || initialPost;

  // State
  const [post, setPost] = useState(currentPost);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(!currentPost);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Like state - Keep intact but hidden from UI
  const [isLiked, setIsLiked] = useState(currentPost?.isLiked || false);
  const [likeCount, setLikeCount] = useState(currentPost?.likeCount || 0);
  const [heartScale] = useState(new Animated.Value(1));

  // Derived data
  const imgURL = currentPost?.paths?.[0] 
    ? `http://${API_BASE_URL}:3000${currentPost.paths[0]}`
    : currentPost?.url;

  const commentCount = currentPost?.commentCount || comments.length || 0;

  // Image dimensions calculation
  const [imageDimensions, setImageDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH
  });

  useEffect(() => {
    if (imgURL) {
      Image.getSize(imgURL, (width, height) => {
        const aspectRatio = width / height;
        const maxHeight = SCREEN_WIDTH * 1.25;
        
        let newWidth = SCREEN_WIDTH;
        let newHeight = SCREEN_WIDTH / aspectRatio;
        
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = maxHeight * aspectRatio;
        }
        
        setImageDimensions({ width: newWidth, height: newHeight });
      });
    }
  }, [imgURL]);

  // Keep like functionality intact but hidden
  const toggleLike = async () => {
    try {
      const newLikedState = !isLiked;
      const newLikeCount = newLikedState ? likeCount + 1 : likeCount - 1;
      
      setIsLiked(newLikedState);
      setLikeCount(newLikeCount);
      
      // Animate heart
      Animated.sequence([
        Animated.timing(heartScale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1, duration: 100, useNativeDriver: true })
      ]).start();

      await toggleLikeInStore(postId, isMemoryPost ? 'memory' : 'post');
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount + 1 : likeCount - 1);
    }
  };

  const handleLikesPress = () => {
    // Keep functionality but hidden
    console.log('Likes pressed - functionality hidden');
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
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
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
      await fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderComment = ({ item: comment }) => (
    <View style={styles.commentContainer}>
      <TouchableOpacity onPress={() => handleUserPress(comment.user._id)}>
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
        <Text style={styles.commentText}>
          <TouchableOpacity onPress={() => handleUserPress(comment.user._id)}>
            <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
          </TouchableOpacity>
          <Text> {comment.text}</Text>
        </Text>
        <Text style={styles.commentTime}>{niceDate(comment.createdAt)}</Text>
      </View>
    </View>
  );

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

        {/* Actions - UPDATED: Hide like button and like count */}
        <View style={styles.actionsContainer}>
          <View style={styles.leftActions}>
            {/* HIDDEN: Like button - keep functionality but hide from UI */}
            {false && (
              <TouchableOpacity onPress={toggleLike} style={styles.actionButton}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isLiked ? HEART : '#000'}
                  />
                </Animated.View>
              </TouchableOpacity>
            )}
            
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

        {/* HIDDEN: Like Count - keep functionality but hide from UI */}
        {false && likeCount > 0 && (
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
              <Text style={styles.commentPostButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: '#F2F2F7',
  },
  placeholderText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
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
  likeCountContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
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
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000000',
  },
  commentUsername: {
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  emptyCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
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
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 12,
  },
  commentPostButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentPostButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
});