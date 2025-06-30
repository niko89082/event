// SocialApp/screens/MemoryDetailsScreen.js - Enhanced with likes and comments
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Share,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const MemoryDetailsScreen = ({ route, navigation }) => {
  const { memoryId, memory: initialMemory } = route.params;

  // State management
  const [memory, setMemory] = useState(initialMemory || null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Photo interaction states
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoComments, setPhotoComments] = useState([]);
  const [photoLikes, setPhotoLikes] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Animation
  const likeAnimation = useRef(new Animated.Value(1)).current;

  // ✅ Fetch memory details
  const fetchMemoryDetails = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.replace('LoginScreen');
        return;
      }

      const response = await fetch(`http://${API_BASE_URL}:3000/api/memories/${memoryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMemory(data.memory);
      setPhotos(data.memory.photos || []);

    } catch (error) {
      console.error('❌ Error fetching memory details:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memoryId, navigation]);

  // ✅ Fetch photo details with likes and comments
  const fetchPhotoDetails = async (photoId) => {
    try {
      setLoadingComments(true);
      const token = await AsyncStorage.getItem('token');

      const response = await fetch(`http://${API_BASE_URL}:3000/api/memory-photos/${photoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photo details');
      }

      const data = await response.json();
      const photo = data.photo;

      setPhotoComments(photo.comments || []);
      setPhotoLikes(photo.likes || []);
      setIsLiked(photo.isLikedByUser || false);

    } catch (error) {
      console.error('❌ Error fetching photo details:', error);
      Alert.alert('Error', 'Failed to load photo details');
    } finally {
      setLoadingComments(false);
    }
  };

  // ✅ Toggle like on photo
  const toggleLike = async (photoId) => {
    try {
      // Optimistic update
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);

      // Animate like button
      Animated.sequence([
        Animated.timing(likeAnimation, {
          toValue: 1.3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(likeAnimation, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`http://${API_BASE_URL}:3000/api/memory-photos/${photoId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }

      const data = await response.json();
      setIsLiked(data.liked);

      // Update photo in photos array
      setPhotos(prevPhotos => 
        prevPhotos.map(photo => 
          photo._id === photoId 
            ? { ...photo, likeCount: data.likeCount, isLikedByUser: data.liked }
            : photo
        )
      );

    } catch (error) {
      console.error('❌ Error toggling like:', error);
      setIsLiked(!isLiked); // Revert optimistic update
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // ✅ Add comment to photo
  const addComment = async (photoId) => {
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      const token = await AsyncStorage.getItem('token');

      const response = await fetch(`http://${API_BASE_URL}:3000/api/memory-photos/${photoId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: commentText.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const data = await response.json();
      setPhotoComments(prev => [data.comment, ...prev]);
      setCommentText('');

      // Update photo in photos array
      setPhotos(prevPhotos => 
        prevPhotos.map(photo => 
          photo._id === photoId 
            ? { ...photo, commentCount: data.commentCount }
            : photo
        )
      );

    } catch (error) {
      console.error('❌ Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ✅ Delete comment
  const deleteComment = async (photoId, commentId) => {
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
              const token = await AsyncStorage.getItem('token');
              const response = await fetch(
                `http://${API_BASE_URL}:3000/api/memory-photos/${photoId}/comments/${commentId}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (!response.ok) {
                throw new Error('Failed to delete comment');
              }

              setPhotoComments(prev => prev.filter(comment => comment._id !== commentId));

            } catch (error) {
              console.error('❌ Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  // ✅ Open photo modal
  const openPhotoModal = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
    fetchPhotoDetails(photo._id);
  };

  // ✅ Close photo modal
  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setPhotoComments([]);
    setPhotoLikes([]);
    setIsLiked(false);
    setCommentText('');
    setShowComments(false);
    setEditingCommentId(null);
    setEditCommentText('');
  };

  // ✅ Share photo
  const sharePhoto = async (photo) => {
    try {
      const shareUrl = `http://${API_BASE_URL}:3000/memory-photos/${photo._id}`;
      await Share.share({
        message: `Check out this memory photo: ${photo.caption || 'Shared from our memories'}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('❌ Error sharing photo:', error);
    }
  };

  // ✅ Initial load
  useEffect(() => {
    fetchMemoryDetails();
  }, [fetchMemoryDetails]);

  // ✅ Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMemoryDetails(false);
  }, [fetchMemoryDetails]);

  // ✅ Render photo grid item
  const renderPhotoItem = ({ item: photo, index }) => {
    const imageUrl = photo.url 
      ? `http://${API_BASE_URL}:3000${photo.url}`
      : 'https://placehold.co/300x300/E1E1E1/8E8E93?text=Photo';

    return (
      <TouchableOpacity
        style={styles.photoGridItem}
        onPress={() => openPhotoModal(photo)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.photoThumbnail}
          resizeMode="cover"
        />
        
        {/* Photo stats overlay */}
        <View style={styles.photoOverlay}>
          <View style={styles.photoStats}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={14} color="#FFFFFF" />
              <Text style={styles.statText}>{photo.likeCount || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={14} color="#FFFFFF" />
              <Text style={styles.statText}>{photo.commentCount || 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ Render comment item
  const renderCommentItem = ({ item: comment }) => (
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
        onPress={() => deleteComment(selectedPhoto._id, comment._id)}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );

  // ✅ Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading memory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ Error state
  if (error || !memory) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Memory</Text>
          <Text style={styles.errorMessage}>
            {error || 'Memory not found or access denied'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchMemoryDetails()}>
            <Text style={styles.retryButtonText}>
              {error ? 'Try Again' : 'Go Back'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ SUCCESS STATE
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{memory.title}</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Memory Header */}
        <View style={styles.memoryHeader}>
          <Text style={styles.memoryTitle}>{memory.title}</Text>
          {memory.description && (
            <Text style={styles.memoryDescription}>{memory.description}</Text>
          )}
          <View style={styles.memoryMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {new Date(memory.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {(memory.participants?.length || 0) + 1} participants
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="lock-closed-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>Private</Text>
            </View>
          </View>
        </View>

        {/* Photos Section */}
        {photos && photos.length > 0 ? (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
            <FlatList
              data={photos}
              renderItem={renderPhotoItem}
              keyExtractor={(item) => item._id}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={styles.photoGrid}
            />
          </View>
        ) : (
          <View style={styles.emptyPhotos}>
            <Ionicons name="camera-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyPhotosText}>No photos yet</Text>
            <Text style={styles.emptyPhotosSubtext}>
              Start capturing memories by adding photos
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Photo Detail Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closePhotoModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={closePhotoModal}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.modalHeaderInfo}>
              {selectedPhoto?.uploadedBy && (
                <Text style={styles.modalUsername}>
                  {selectedPhoto.uploadedBy.username}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.modalShareButton}
              onPress={() => sharePhoto(selectedPhoto)}
            >
              <Ionicons name="share-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Photo */}
          {selectedPhoto && (
            <View style={styles.photoContainer}>
              <Image
                source={{
                  uri: `http://${API_BASE_URL}:3000${selectedPhoto.url}`
                }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Photo Actions */}
          <View style={styles.photoActions}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleLike(selectedPhoto._id)}
              >
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
                <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Like count */}
            {photoLikes.length > 0 && (
              <Text style={styles.likesCount}>
                {photoLikes.length} {photoLikes.length === 1 ? 'like' : 'likes'}
              </Text>
            )}

            {/* Caption */}
            {selectedPhoto?.caption && (
              <Text style={styles.photoCaption}>{selectedPhoto.caption}</Text>
            )}
          </View>

          {/* Comments Section */}
          {showComments && (
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>
                Comments ({photoComments.length})
              </Text>
              
              {loadingComments ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FlatList
                  data={photoComments}
                  renderItem={renderCommentItem}
                  keyExtractor={(item) => item._id}
                  style={styles.commentsList}
                  showsVerticalScrollIndicator={false}
                />
              )}

              {/* Add Comment */}
              <View style={styles.addCommentContainer}>
                <TextInput
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
                    styles.sendCommentButton,
                    { opacity: commentText.trim() ? 1 : 0.5 }
                  ]}
                  onPress={() => addComment(selectedPhoto._id)}
                  disabled={!commentText.trim() || submittingComment}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Ionicons name="send" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
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
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    padding: 8,
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
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  memoryHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  memoryTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  memoryDescription: {
    fontSize: 16,
    color: '#3C3C43',
    lineHeight: 22,
    marginBottom: 16,
  },
  memoryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 6,
  },
  photosSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  photoGrid: {
    gap: 2,
  },
  photoGridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 1,
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 8,
  },
  photoStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyPhotos: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyPhotosText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptyPhotosSubtext: {
    fontSize: 16,
    color: '#C7C7CC',
    marginTop: 8,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalHeaderInfo: {
    flex: 1,
    alignItems: 'center',
  },
  modalUsername: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalShareButton: {
    padding: 8,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  photoActions: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    marginRight: 20,
    padding: 8,
  },
  likesCount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  photoCaption: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  commentsSection: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    maxHeight: screenHeight * 0.4,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  commentsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  commentsList: {
    maxHeight: screenHeight * 0.25,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
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
    lineHeight: 20,
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
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#3C3C43',
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
  sendCommentButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
  },
};

export default MemoryDetailsScreen;