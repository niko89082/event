// screens/PostDetailsScreen.js - Updated with better UI and comment management
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, Image, StyleSheet, Button, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, FlatList,
  SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
  Dimensions, ActionSheetIOS
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
  const [events, setEvents] = useState([]);
  const [evPage, setEvPage] = useState(1);
  const [evEnd, setEvEnd] = useState(false);
  const [selEvent, setSelEv] = useState(null);

  /* ─── comment state ──────────────────────────────────────── */
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  /* ─── fetch post ─────────────────────────────────────────── */
  useEffect(() => { if (postId) fetchPost(); }, [postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/photos/${postId}`);
      setPost(data);
      setCaption(data.caption || '');
      setSelEv(data.event?._id || null);
      setIsLiked(data.likes?.includes(currentUser?._id) || false);
      setLikeCount(data.likes?.length || 0);
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', 'Unable to load post.');
      navigation.goBack();
    } finally { 
      setLoading(false); 
    }
  };

  /* ─── fetch attended events (last-10-days first) ─────────── */
  const fetchEvents = async (page = 1) => {
    try {
      const { data } = await api.get(`/api/events/my-photo-events?page=${page}`);
      if (page === 1) setEvents(data || []);
      else setEvents(p => [...p, ...(data || [])]);

      if (!data || data.length < 10) setEvEnd(true);
      setEvPage(page);
    } catch (e) {
      console.error('fetch events:', e.response?.data || e);
    }
  };

  /* ─── helpers ────────────────────────────────────────────── */
  const isOwner = post?.user?._id === currentUser?._id;
  const imgPath = post?.paths?.[0] || null;
  const imgURL = imgPath ? `http://${API_BASE_URL}:3000${imgPath}` : null;

  const handleLike = async () => {
    try {
      const response = await api.post(`/api/photos/like/${postId}`);
      setIsLiked(!isLiked);
      setLikeCount(response.data.likeCount);
    } catch (e) {
      console.error('Like error:', e.response?.data || e);
    }
  };

  const sharePost = () => navigation.navigate('SelectChatScreen', {
    shareType: 'post',
    shareId: postId,
  });

  const saveEdit = async () => {
    try {
      await api.put(`/api/photos/${postId}`, { caption, eventId: selEvent });
      setPost(p => ({ ...p, caption, event: selEvent ? { _id: selEvent } : null }));
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
    
    if (isCommentOwner) {
      options.push('Delete Comment');
    }
    
    if (isOwner && !isCommentOwner) {
      options.push('Delete Comment');
    }
    
    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          destructiveButtonIndex: options.length - 2,
          cancelButtonIndex: options.length - 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 0 && options[0] === 'Delete Comment') {
            handleDeleteComment(comment._id);
          }
        }
      );
    } else {
      // For Android, show Alert
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
          style={styles.commentAvatar}
        >
          <Image
            source={{
              uri: comment.user?.profilePicture
                ? `http://${API_BASE_URL}:3000${comment.user.profilePicture}`
                : 'https://placehold.co/32x32.png?text=👤'
            }}
            style={styles.avatarImage}
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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
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
          
          <TouchableOpacity onPress={sharePost} style={styles.actionButton}>
            <Ionicons name="share-outline" size={24} color="#000000" />
          </TouchableOpacity>
        </View>

        {isOwner && (
          <TouchableOpacity 
            onPress={() => { setShowEdit(true); fetchEvents(1); }}
            style={styles.actionButton}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
          </TouchableOpacity>
        )}
      </View>

      {/* Like Count */}
      {likeCount > 0 && (
        <TouchableOpacity style={styles.likesContainer}>
          <Text style={styles.likesText}>
            {likeCount} {likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Caption and Meta */}
      <View style={styles.captionContainer}>
        <View style={styles.authorContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileScreen', { userId: post.user?._id })}
            style={styles.authorInfo}
          >
            <Image
              source={{
                uri: post.user?.profilePicture
                  ? `http://${API_BASE_URL}:3000${post.user.profilePicture}`
                  : 'https://placehold.co/32x32.png?text=👤'
              }}
              style={styles.authorAvatar}
            />
            <Text style={styles.authorUsername}>{post.user?.username || 'Unknown'}</Text>
          </TouchableOpacity>
          
          <Text style={styles.postTime}>
            {new Date(post.uploadDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {post.caption && (
          <Text style={styles.captionText}>{post.caption}</Text>
        )}

        {post.event && (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('EventDetailsScreen', { eventId: post.event._id })
            }
            style={styles.eventLink}
          >
            <Ionicons name="calendar-outline" size={16} color="#3797EF" />
            <Text style={styles.eventLinkText}>View Event</Text>
          </TouchableOpacity>
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
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={28} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={post.comments || []}
          keyExtractor={(comment, index) => `${comment._id}-${index}`}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          style={styles.commentsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.noCommentsContainer}>
              <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
              <Text style={styles.noCommentsText}>No comments yet</Text>
              <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
            </View>
          )}
        />

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <Image
            source={{
              uri: currentUser?.profilePicture
                ? `http://${API_BASE_URL}:3000${currentUser.profilePicture}`
                : 'https://placehold.co/32x32.png?text=👤'
            }}
            style={styles.inputAvatar}
          />
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a comment..."
            style={styles.commentInput}
            multiline
            maxLength={500}
            textAlignVertical="center"
          />
          <TouchableOpacity
            onPress={postComment}
            disabled={!newComment.trim() || commentsLoading}
            style={[
              styles.sendButton,
              (!newComment.trim() || commentsLoading) && styles.sendButtonDisabled
            ]}
          >
            {commentsLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons 
                name="send" 
                size={18} 
                color={newComment.trim() ? "#FFFFFF" : "#C7C7CC"} 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Edit Modal */}
      <Modal transparent visible={showEdit} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={saveEdit}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>Caption</Text>
              <TextInput
                multiline
                value={caption}
                onChangeText={setCaption}
                style={styles.modalInput}
                placeholder="Write a caption..."
                maxLength={2000}
              />

              <Text style={styles.modalLabel}>Link to Event</Text>
              {events.length === 0 ? (
                <Text style={styles.noEventsText}>
                  No events available to link
                </Text>
              ) : (
                <FlatList
                  data={events}
                  keyExtractor={e => e._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.eventOption}
                      onPress={() => setSelEv(selEvent === item._id ? null : item._id)}
                    >
                      <Ionicons
                        name={selEvent === item._id ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color="#3797EF"
                      />
                      <View style={styles.eventOptionContent}>
                        <Text style={styles.eventOptionTitle}>{item.title}</Text>
                        <Text style={styles.eventOptionDate}>
                          {new Date(item.time).toLocaleDateString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  style={styles.eventsList}
                  maxHeight={200}
                />
              )}

              {!evEnd && events.length > 0 && (
                <TouchableOpacity
                  onPress={() => fetchEvents(evPage + 1)}
                  style={styles.loadMoreButton}
                >
                  <Text style={styles.loadMoreText}>Load More Events</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleDeletePost}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={styles.deleteButtonText}>Delete Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 32,
  },
  goBackButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  goBackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
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

  // Image
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F6F6F6',
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
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
  },

  // Likes
  likesContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  postTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  captionText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
    marginBottom: 8,
  },
  eventLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  eventLinkText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 6,
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

  // Comments
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '85%',
  },
  commentUsername: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3797EF',
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
    paddingLeft: 12,
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
    fontWeight: '600',
  },

  // No Comments
  noCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCommentsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 12,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
  },

  // Comment Input
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  modalCancel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  modalContent: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  noEventsText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  eventsList: {
    maxHeight: 200,
    marginBottom: 12,
  },
  eventOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  eventOptionContent: {
    marginLeft: 12,
    flex: 1,
  },
  eventOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  eventOptionDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 20,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 20,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
});