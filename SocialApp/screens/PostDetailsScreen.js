// screens/PostDetailsScreen.js - Fixed Implementation with Likes Functionality









/*

THIS WAS PRETTY MUCH DEPRICATED


 */
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, FlatList,
  SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
  Dimensions, ActionSheetIOS, ScrollView, Share, Linking
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
  const hasReview = post?.review && post.review.type;
  const review = post?.review;
  const commentCount = post?.comments?.length || 0;
  const repostCount = post?.repostCount || 0;

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
    
    // ✅ FIX: Properly set like status from API response
    setIsLiked(data.userLiked || false); // Use userLiked from enhanced API
    setLikeCount(data.likeCount || 0);   // Use likeCount from enhanced API
    
    console.log('❤️ Like status loaded:', {
      userLiked: data.userLiked,
      likeCount: data.likeCount,
      likesArray: data.likes?.length
    });
    
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
    console.log('🔄 Toggling like in PostDetailsScreen for:', postId);
    
    // Optimistic update
    const newLiked = !isLiked;
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;
    setIsLiked(newLiked);
    setLikeCount(newCount);
    
    // ✅ FIX: Use correct API endpoint
    const response = await api.post(`/api/photos/like/${postId}`);
    
    // Update with server response
    setIsLiked(response.data.userLiked || response.data.likes.includes(currentUser._id));
    setLikeCount(response.data.likeCount);
    
    // Update the post state with new likes data for the likes viewer
    setPost(prev => ({
      ...prev,
      likes: response.data.likes,
      likeCount: response.data.likeCount,
      userLiked: response.data.userLiked || response.data.likes.includes(currentUser._id)
    }));
    
    console.log('✅ Like toggled successfully in PostDetailsScreen');
    
  } catch (e) {
    console.error('❌ Like error in PostDetailsScreen:', e.response?.data || e);
    // Revert optimistic update
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount + 1 : likeCount - 1);
  }
};

  // FIXED: Navigate to likes screen
  const viewLikes = () => {
  if (likeCount > 0) {
    navigation.navigate('PostLikesScreen', { 
      postId: postId,
      likeCount: likeCount,
      isMemoryPost: false // Add this for regular posts
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
      <TouchableOpacity 
        style={styles.commentItem}
        activeOpacity={0.7}
      >
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
          <View style={styles.commentHeaderRow}>
            <View style={styles.commentNameRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProfileScreen', { userId: comment.user?._id })}
              >
                <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
              </TouchableOpacity>
              <Text style={styles.commentHandle}>@{comment.user?.username || 'unknown'}</Text>
              <Text style={styles.commentTimeDot}>•</Text>
              <Text style={styles.commentTime}>{getTimeAgo(comment.createdAt)}</Text>
            </View>
            {canDelete && (
              <TouchableOpacity
                onPress={() => handleCommentOptions(comment)}
                style={styles.commentOptionsButton}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
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
  };

  const renderEmptyComments = () => (
    <View style={styles.emptyCommentsContainer}>
      <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
      <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
      <Text style={styles.emptyCommentsSubtitle}>Be the first to share your thoughts! 💭</Text>
    </View>
  );

  // Helper to format time ago
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

  const renderHeader = () =>{ (
    <View style={styles.headerContainer}>
      {/* Author Info - Twitter Style */}
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
            <View style={styles.authorNameRow}>
              <Text style={styles.authorUsername}>{post.user?.username || 'Unknown'}</Text>
              {/* TODO: Add verified badge if user is verified */}
            </View>
            <View style={styles.authorMetaRow}>
              <Text style={styles.authorHandle}>@{post.user?.username || 'unknown'}</Text>
              <Text style={styles.authorMetaDot}>•</Text>
              <Text style={styles.authorTime}>{getTimeAgo(post.uploadDate)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Review Card - Only show if review exists */}
      {hasReview && (
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

      {/* Image Section - Only show if image exists and no review */}
      {!hasReview && imgURL && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imgURL }} style={styles.postImage} />
        </View>
      )}

      {/* Rating Stars - Only show if review has rating */}
      {hasReview && review.rating && review.rating > 0 && (
        <View style={styles.ratingContainer}>
          <View style={styles.starsContainer}>
            {renderStars(review.rating)}
          </View>
          <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
        </View>
      )}

      {/* Review Text / Caption */}
      <View style={styles.captionContainer}>
        {post.caption && (
          <Text style={styles.captionText}>{post.caption}</Text>
        )}
      </View>

      {/* Timestamp Detail - Twitter Style */}
      <View style={styles.timestampContainer}>
        <Text style={styles.timestampText}>
          {new Date(post.uploadDate).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}{' • '}
          {new Date(post.uploadDate).toLocaleDateString('en-US', {
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
            onPress={handleLike} 
            style={styles.engagementButton}
            activeOpacity={0.7}
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
        <TouchableOpacity onPress={sharePost} style={styles.shareButton} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={22} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Comments Header */}
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>Comments</Text>
      </View>
    </View>
  );}

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
        <Text style={styles.headerTitle}>{hasReview ? 'Review' : 'Post'}</Text>
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

        {/* Comment Input - Twitter Style */}
        <View style={styles.commentInputContainer}>
          <Image
            source={{ uri: getProfilePictureUrl(currentUser) }}
            style={styles.commentInputAvatar}
          />
          <View style={styles.commentInputWrapper}>
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
                <ActivityIndicator size="small" color="#3994EF" />
              ) : (
                <Text style={styles.commentPostText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
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

  // Author section styles - Twitter Style
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
    backgroundColor: '#F6F6F6',
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

  // Image Container (for non-review posts)
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    paddingVertical: 12,
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
  
  // Legacy styles for backward compatibility
  actionBtn: {
    padding: 4,
  },
  likesContainer: {
    marginLeft: 8,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  captionText: {
    fontSize: 16,
    color: '#0D141B',
    lineHeight: 24,
  },

  // Comments Header
  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D141B',
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

  // Comments - Twitter Style
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentAvatarContainer: {
    marginRight: 12,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F6F6F6',
  },
  commentContent: {
    flex: 1,
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
  commentText: {
    fontSize: 14,
    color: '#0D141B',
    lineHeight: 20,
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

  // Comment Input - Twitter Style
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  commentInputAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
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
    paddingVertical: 4,
  },
  commentPostButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentPostText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3994EF',
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