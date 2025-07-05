// screens/PostDetailsScreen.js - Fixed Implementation with Likes Functionality
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, FlatList,
  SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
  Dimensions, ActionSheetIOS, ScrollView, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostDetailsScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);

  const postId = params?.postId;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);

  /* ─── edit modal state ───────────────────────────────────── */
  const [showEdit, setShowEdit] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [userEvents, setUserEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  /* ─── comment state ──────────────────────────────────────── */
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  /* ─── computed values ────────────────────────────────────── */
  const isOwner = post?.user?._id === currentUser?._id;
  const imgURL = post?.paths?.[0] 
    ? `http://${API_BASE_URL}:3000${post.paths[0]}` 
    : null;

  // Helper function to get profile picture URL with better error handling
  const getProfilePictureUrl = (user) => {
    if (!user) {
      return 'https://placehold.co/40x40.png?text=👤';
    }

    if (!user.profilePicture) {
      return 'https://placehold.co/40x40.png?text=👤';
    }
    
    // Handle both relative and absolute URLs
    if (user.profilePicture.startsWith('http')) {
      return user.profilePicture;
    }
    
    // Ensure the path starts with /
    const path = user.profilePicture.startsWith('/') 
      ? user.profilePicture 
      : `/${user.profilePicture}`;
    
    return `http://${API_BASE_URL}:3000${path}`;
  };

  /* ─── FIXED: Remove duplicate header by setting navigation options ─── */
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // This removes the MainApp header
    });
  }, [navigation]);

  /* ─── fetch post ─────────────────────────────────────────── */
  useEffect(() => { 
    if (postId) fetchPost(); 
  }, [postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      console.log('🟡 Fetching post:', postId);
      const { data } = await api.get(`/api/photos/${postId}`);
      console.log('🟢 Post data received:', data);
      setPost(data);
      setCaption(data.caption || '');
      setSelectedEvent(data.event?._id || null);
      setIsLiked(data.likes?.includes(currentUser?._id) || false);
      setLikeCount(data.likes?.length || 0);
    } catch (e) {
      console.error('❌ Post fetch error:', e.response?.data || e);
      Alert.alert('Error', 'Unable to load post.');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Use correct API endpoint for user events
  const fetchUserEvents = async () => {
    try {
      setEventsLoading(true);
      // FIXED: Use the correct endpoint from ProfileScreen
      const { data } = await api.get(`/api/users/${currentUser._id}/events`, {
        params: {
          includePast: 'false', // Only upcoming events for editing
          limit: 50,
          type: 'hosted' // Only show events user is hosting
        }
      });
      setUserEvents(data.events || []);
    } catch (e) {
      console.error('Events fetch error:', e);
      Alert.alert('Error', 'Failed to load your events');
    } finally {
      setEventsLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      const response = await api.post(`/api/photos/like/${postId}`);
      setIsLiked(!isLiked);
      setLikeCount(response.data.likeCount);
      
      // Update the post state with new likes data for the likes viewer
      setPost(prev => ({
        ...prev,
        likes: response.data.likes,
        likeCount: response.data.likeCount
      }));
    } catch (e) {
      console.error('Like error:', e.response?.data || e);
    }
  };

  // FIXED: Navigate to likes screen
  const viewLikes = () => {
    if (likeCount > 0) {
      navigation.navigate('PostLikesScreen', { 
        postId: postId,
        likeCount: likeCount 
      });
    }
  };

  // FIXED: Updated sharePost function - no longer navigates to chat screens
  const sharePost = async () => {
    try {
      const result = await Share.share({
        message: `Check out this post: ${post.caption || 'Awesome moment!'} - Share on your social app!`,
        url: `https://yourapp.com/posts/${postId}`, // Replace with your app's URL scheme
        title: 'Check out this post!',
      });
      
      if (result.action === Share.sharedAction) {
        console.log('Post shared successfully');
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share post');
    }
  };

  const showPostOptions = () => {
    if (!isOwner) return;

    const options = ['Edit Post', 'Delete Post', 'Cancel'];
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            setShowEdit(true);
            fetchUserEvents();
          } else if (buttonIndex === 1) {
            handleDeletePost();
          }
        }
      );
    } else {
      Alert.alert(
        'Post Options',
        'Choose an action',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Post', onPress: () => { setShowEdit(true); fetchUserEvents(); } },
          { text: 'Delete Post', style: 'destructive', onPress: handleDeletePost }
        ]
      );
    }
  };

  const saveEdit = async () => {
    try {
      await api.put(`/api/photos/${postId}`, { 
        caption, 
        eventId: selectedEvent 
      });
      
      // Update local state
      setPost(prev => ({ 
        ...prev, 
        caption, 
        event: selectedEvent ? { _id: selectedEvent } : null 
      }));
      
      setShowEdit(false);
      Alert.alert('Success', 'Post updated successfully');
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', 'Could not update post.');
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Delete Post',
      'This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/photos/${postId}`);
              Alert.alert('Success', 'Post deleted successfully');
              navigation.goBack();
            } catch (e) {
              console.error(e.response?.data || e);
              Alert.alert('Error', 'Delete failed.');
            }
          }
        },
      ]
    );
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      setCommentsLoading(true);
      const { data } = await api.post(`/api/photos/comment/${postId}`, { 
        text: newComment.trim() 
      });
      setPost(data);
      setNewComment('');
    } catch (e) { 
      console.error('Comment error:', e.response?.data || e);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/photos/comment/${postId}/${commentId}`);
              // Update local state
              setPost(prevPost => ({
                ...prevPost,
                comments: prevPost.comments.filter(c => c._id !== commentId)
              }));
            } catch (e) {
              console.error('Delete comment error:', e);
              Alert.alert('Error', 'Failed to delete comment');
            }
          }
        },
      ]
    );
  };

  const handleCommentOptions = (comment) => {
    const isCommentOwner = comment.user?._id === currentUser?._id;
    const options = [];
    
    if (isCommentOwner || isOwner) {
      options.push('Delete Comment');
    }
    
    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          destructiveButtonIndex: options.length - 2 >= 0 ? options.length - 2 : -1,
          cancelButtonIndex: options.length - 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 0 && options[0] === 'Delete Comment') {
            handleDeleteComment(comment._id);
          }
        }
      );
    } else {
      Alert.alert(
        'Comment Options',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete Comment', 
            style: 'destructive',
            onPress: () => handleDeleteComment(comment._id)
          }
        ]
      );
    }
  };

  const renderComment = ({ item: comment }) => {
    const isCommentOwner = comment.user?._id === currentUser?._id;
    const canDelete = isCommentOwner || isOwner;
    
    return (
      <View style={styles.commentItem}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ProfileScreen', { userId: comment.user?._id })}
          style={styles.commentAvatarContainer}
        >
          <Image
            source={{ uri: getProfilePictureUrl(comment.user) }}
            style={styles.commentAvatar}
            onError={(error) => {
              console.log('Comment avatar load error:', error);
            }}
          />
        </TouchableOpacity>
        
        <View style={styles.commentContent}>
          <View style={styles.commentBubble}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileScreen', { userId: comment.user?._id })}
            >
              <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
            </TouchableOpacity>
            <Text style={styles.commentText}>{comment.text}</Text>
          </View>
          
          <View style={styles.commentMeta}>
            <Text style={styles.commentTime}>
              {new Date(comment.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
            
            {canDelete && (
              <TouchableOpacity
                onPress={() => handleCommentOptions(comment)}
                style={styles.commentOptionsButton}
              >
                <Text style={styles.commentOptionsText}>•••</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyComments = () => (
    <View style={styles.emptyCommentsContainer}>
      <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
      <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
      <Text style={styles.emptyCommentsSubtitle}>Be the first to share your thoughts! 💭</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* FIXED: User info with event below username (like PostCard) */}
      <View style={styles.authorContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ProfileScreen', { userId: post.user?._id })}
          style={styles.authorInfo}
        >
          <Image
            source={{ uri: getProfilePictureUrl(post.user) }}
            style={styles.authorAvatar}
            onError={(error) => {
              console.log('Author avatar load error:', error);
            }}
          />
          <View style={styles.authorTextContainer}>
            <Text style={styles.authorUsername}>{post.user?.username || 'Unknown'}</Text>
            {/* FIXED: Event context below username like PostCard */}
            {post.event && (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('EventDetailsScreen', { eventId: post.event._id })
                }
                style={styles.eventContext}
              >
                <Ionicons name="calendar-outline" size={12} color="#3797EF" />
                <Text style={styles.eventContextText}>from {post.event.title}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Image Section */}
      <View style={styles.imageContainer}>
        {imgURL ? (
          <Image source={{ uri: imgURL }} style={styles.postImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={64} color="#C7C7CC" />
          </View>
        )}
      </View>

      {/* Post Actions */}
      <View style={styles.actionsContainer}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={24} 
              color={isLiked ? "#FF3B30" : "#000000"} 
            />
          </TouchableOpacity>
          
          {/* FIXED: Like count much closer to heart and clickable */}
          {likeCount > 0 && (
            <TouchableOpacity onPress={viewLikes}>
              <Text style={styles.likeCount}>{likeCount}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={sharePost} style={styles.actionButton}>
            <Ionicons name="share-outline" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* FIXED: Upload date below like and share */}
      <View style={styles.postDateContainer}>
        <Text style={styles.postDate}>
          {new Date(post.uploadDate).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>
      </View>

      {/* Caption */}
      <View style={styles.captionContainer}>
        {post.caption && (
          <Text style={styles.captionText}>{post.caption}</Text>
        )}
      </View>

      {/* Comments Header */}
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>
          Comments ({post.comments?.length || 0})
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="image-outline" size={80} color="#C7C7CC" />
        <Text style={styles.errorTitle}>Post not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* FIXED: Custom header to prevent MainApp header showing */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={28} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerRight}>
          {isOwner && (
            <TouchableOpacity
              onPress={showPostOptions}
              style={styles.headerButton}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          style={styles.commentsList}
          data={post.comments || []}
          keyExtractor={(item) => item._id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={post.comments?.length === 0 ? renderEmptyComments : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <Image
            source={{ uri: getProfilePictureUrl(currentUser) }}
            style={styles.commentInputAvatar}
          />
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#8E8E93"
            value={newComment}
            onChangeText={setNewComment}
            multiline
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

      {/* FIXED: Edit Modal with proper functionality */}
      <Modal
        visible={showEdit}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEdit(false)}
      >
        <SafeAreaView style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setShowEdit(false)}>
              <Text style={styles.editModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Post</Text>
            <TouchableOpacity onPress={saveEdit}>
              <Text style={styles.editModalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editModalContent}>
            {/* Caption */}
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Caption</Text>
              <TextInput
                style={styles.editCaptionInput}
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a caption..."
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Event Selection */}
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Event (Optional)</Text>
              {eventsLoading ? (
                <ActivityIndicator size="small" color="#3797EF" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[
                      styles.eventOption,
                      !selectedEvent && styles.eventOptionSelected
                    ]}
                    onPress={() => setSelectedEvent(null)}
                  >
                    <Text style={[
                      styles.eventOptionText,
                      !selectedEvent && styles.eventOptionSelectedText
                    ]}>None</Text>
                  </TouchableOpacity>
                  {userEvents.map((event) => (
                    <TouchableOpacity
                      key={event._id}
                      style={[
                        styles.eventOption,
                        selectedEvent === event._id && styles.eventOptionSelected
                      ]}
                      onPress={() => setSelectedEvent(event._id)}
                    >
                      <Text style={[
                        styles.eventOptionText,
                        selectedEvent === event._id && styles.eventOptionSelectedText
                      ]}>{event.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // FIXED: Custom header to prevent MainApp header
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

  // Content
  keyboardContainer: {
    flex: 1,
  },
  commentsList: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
  },

  // FIXED: Author section styles - now includes event context below username
  authorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  authorTextContainer: {
    flex: 1,
  },
  authorUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  
  // FIXED: Event context styles (like PostCard)
  eventContext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  eventContextText: {
    fontSize: 12,
    color: '#3797EF',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Image
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F6F6F6',
    position: 'relative',
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

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
  },
  // FIXED: Like count much closer to heart and clickable
  likeCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 4,
    marginRight: 16,
  },

  // FIXED: Post date below actions
  postDateContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  postDate: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  captionText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },

  // Comments Header
  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  // FIXED: Empty comments state
  emptyCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyCommentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
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
  commentAvatarContainer: {
    marginRight: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
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
  commentOptionsButton: {
    marginLeft: 12,
    padding: 4,
  },
  commentOptionsText: {
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
  },
  commentPostText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Edit Modal
  editModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  editModalCancel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  editModalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  editModalContent: {
    flex: 1,
    padding: 16,
  },
  editSection: {
    marginBottom: 24,
  },
  editSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  editCaptionInput: {
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    color: '#000000',
  },
  eventOption: {
    backgroundColor: '#F6F6F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  eventOptionSelected: {
    backgroundColor: '#3797EF',
  },
  eventOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  eventOptionSelectedText: {
    color: '#FFFFFF',
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  goBackButton: {
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  goBackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});