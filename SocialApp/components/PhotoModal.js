// components/PhotoModal.js - Reusable photo modal with likes and comments
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Share,
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config/api';
import memoryService from '../services/memoryService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const PhotoModal = ({
  visible,
  photo,
  onClose,
  onPhotoUpdate,
}) => {
  // State management
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);

  // Animation refs
  const likeAnimation = useRef(new Animated.Value(1)).current;
  const commentInputRef = useRef(null);

  // ✅ Load photo details when modal opens
  useEffect(() => {
    if (visible && photo) {
      loadPhotoDetails();
    } else {
      resetState();
    }
  }, [visible, photo]);

  // ✅ Reset state when modal closes
  const resetState = () => {
    setComments([]);
    setLikes([]);
    setIsLiked(false);
    setCommentText('');
    setShowComments(false);
    setCommentsPage(1);
    setHasMoreComments(true);
  };

  // ✅ Load photo details with likes and comments
  const loadPhotoDetails = async () => {
    try {
      setLoading(true);
      const response = await memoryService.getPhotoDetails(photo._id);
      const photoData = response.photo;

      setComments(photoData.comments || []);
      setLikes(photoData.likes || []);
      setIsLiked(photoData.isLikedByUser || false);
    } catch (error) {
      console.error('❌ Error loading photo details:', error);
      Alert.alert('Error', 'Failed to load photo details');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Toggle like with animation
  const toggleLike = async () => {
    try {
      // Optimistic update
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);

      // Animate like button
      Animated.sequence([
        Animated.timing(likeAnimation, {
          toValue: 1.4,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(likeAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      const response = await memoryService.togglePhotoLike(photo._id);
      setIsLiked(response.liked);

      // Update parent component
      if (onPhotoUpdate) {
        onPhotoUpdate(photo._id, {
          likeCount: response.likeCount,
          isLikedByUser: response.liked,
        });
      }

    } catch (error) {
      console.error('❌ Error toggling like:', error);
      setIsLiked(!isLiked); // Revert optimistic update
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // ✅ Add comment
  const addComment = async () => {
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      const response = await memoryService.addPhotoComment(photo._id, commentText.trim());
      
      setComments(prev => [response.comment, ...prev]);
      setCommentText('');

      // Update parent component
      if (onPhotoUpdate) {
        onPhotoUpdate(photo._id, {
          commentCount: response.commentCount,
        });
      }

      // Dismiss keyboard
      if (commentInputRef.current) {
        commentInputRef.current.blur();
      }

    } catch (error) {
      console.error('❌ Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ✅ Delete comment
  const deleteComment = (commentId) => {
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
              await memoryService.deletePhotoComment(photo._id, commentId);
              setComments(prev => prev.filter(comment => comment._id !== commentId));

              // Update parent component
              if (onPhotoUpdate) {
                onPhotoUpdate(photo._id, {
                  commentCount: comments.length - 1,
                });
              }
            } catch (error) {
              console.error('❌ Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  // ✅ Load more comments
  const loadMoreComments = async () => {
    if (!hasMoreComments || loadingMoreComments) return;

    try {
      setLoadingMoreComments(true);
      const response = await memoryService.getPhotoComments(
        photo._id,
        commentsPage + 1,
        20
      );

      setComments(prev => [...prev, ...response.comments]);
      setCommentsPage(prev => prev + 1);
      setHasMoreComments(response.pagination.hasMore);
    } catch (error) {
      console.error('❌ Error loading more comments:', error);
    } finally {
      setLoadingMoreComments(false);
    }
  };

  // ✅ Share photo
  const sharePhoto = async () => {
    try {
      const shareUrl = `${API_BASE_URL}/memory-photos/${photo._id}`;
      await Share.share({
        message: `Check out this memory photo${photo.caption ? `: ${photo.caption}` : ''}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('❌ Error sharing photo:', error);
    }
  };

  // ✅ Report photo
  const reportPhoto = () => {
    Alert.alert(
      'Report Photo',
      'Why are you reporting this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Inappropriate Content', onPress: () => submitReport('inappropriate') },
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Harassment', onPress: () => submitReport('harassment') },
        { text: 'Other', onPress: () => submitReport('other') },
      ]
    );
  };

  const submitReport = async (reason) => {
    try {
      await memoryService.reportPhoto(photo._id, reason);
      Alert.alert('Thank You', 'Your report has been submitted and will be reviewed.');
    } catch (error) {
      console.error('❌ Error reporting photo:', error);
      Alert.alert('Error', 'Failed to submit report');
    }
  };

  // ✅ Render comment item
  const renderComment = ({ item: comment }) => (
    <View style={styles.commentItem}>
      <Image
        source={{
          uri: comment.user.profilePicture
            ? `http://${API_BASE_URL}:3000${comment.user.profilePicture}`
            : 'https://placehold.co/32x32/C7C7CC/FFFFFF?text=' + 
              comment.user.username.charAt(0).toUpperCase()
        }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{comment.user.username}</Text>
          <Text style={styles.commentTime}>
            {new Date(comment.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
        {comment.isEdited && (
          <Text style={styles.editedLabel}>Edited</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.commentOptions}
        onPress={() => deleteComment(comment._id)}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );

  if (!visible || !photo) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            {photo.uploadedBy && (
              <Text style={styles.username}>{photo.uploadedBy.username}</Text>
            )}
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={sharePhoto}>
              <Ionicons name="share-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={reportPhoto}>
              <Ionicons name="flag-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo */}
        <View style={styles.photoContainer}>
          <Image
            source={{ uri: `http://${API_BASE_URL}:3000${photo.url}` }}
            style={styles.photo}
            resizeMode="contain"
          />
        </View>

        {/* Actions and Info */}
        <View style={styles.actionsContainer}>
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={toggleLike}>
              <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? "#FF3B30" : "#FFFFFF"}
                />
              </Animated.View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowComments(!showComments)}
            >
              <Ionicons
                name={showComments ? "chatbubble" : "chatbubble-outline"}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            {likes.length > 0 && (
              <Text style={styles.likesText}>
                {likes.length} {likes.length === 1 ? 'like' : 'likes'}
              </Text>
            )}
            
            {photo.caption && (
              <View style={styles.captionContainer}>
                <Text style={styles.captionUsername}>{photo.uploadedBy?.username}</Text>
                <Text style={styles.captionText}>{photo.caption}</Text>
              </View>
            )}
          </View>

          {/* Comments Section */}
          {showComments && (
            <KeyboardAvoidingView
              style={styles.commentsSection}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <Text style={styles.commentsTitle}>
                Comments ({comments.length})
              </Text>
              
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.loader} />
              ) : (
                <FlatList
                  data={comments}
                  renderItem={renderComment}
                  keyExtractor={(item) => item._id}
                  style={styles.commentsList}
                  showsVerticalScrollIndicator={false}
                  onEndReached={loadMoreComments}
                  onEndReachedThreshold={0.3}
                  ListFooterComponent={() => (
                    loadingMoreComments ? (
                      <ActivityIndicator size="small" color="#8E8E93" style={styles.loader} />
                    ) : null
                  )}
                />
              )}

              {/* Add Comment */}
              <View style={styles.addCommentContainer}>
                <TextInput
                  ref={commentInputRef}
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#8E8E93"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    { opacity: commentText.trim() ? 1 : 0.5 }
                  ]}
                  onPress={addComment}
                  disabled={!commentText.trim() || submittingComment}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Ionicons name="send" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  closeButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  actionsContainer: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  actionButton: {
    marginRight: 20,
    padding: 8,
  },
  stats: {
    marginBottom: 16,
  },
  likesText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  captionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  captionUsername: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  commentsSection: {
    maxHeight: screenHeight * 0.4,
  },
  commentsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  commentsList: {
    maxHeight: screenHeight * 0.25,
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 12,
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
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  commentTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  commentText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
  },
  editedLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  commentOptions: {
    padding: 8,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#3C3C43',
    paddingTop: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
  },
  loader: {
    paddingVertical: 16,
  },
};

export default PhotoModal;