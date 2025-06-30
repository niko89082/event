// SocialApp/screens/MemoryDetailsScreen.js - Simplified without config/api
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
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

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
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Animation
  const likeAnimation = useRef(new Animated.Value(1)).current;

  // Helper functions
  const buildApiUrl = (endpoint) => `http://${API_BASE_URL || 'localhost'}:3000${endpoint}`;
  
  const buildImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `http://${API_BASE_URL || 'localhost'}:3000${imagePath}`;
  };

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

      const response = await fetch(buildApiUrl(`/api/memories/${memoryId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setMemory(data.memory);
        setPhotos(data.memory.photos || []);
      } else {
        throw new Error(data.message || 'Failed to fetch memory details');
      }

    } catch (error) {
      console.error('❌ Error fetching memory details:', error);
      setError(error.message);
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        Alert.alert(
          'Session Expired',
          'Please log in again to continue.',
          [{ text: 'OK', onPress: () => navigation.replace('LoginScreen') }]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memoryId, navigation]);

  // ✅ Toggle like on photo
  const toggleLike = async (photoId) => {
    try {
      // Optimistic update
      const wasLiked = isLiked;
      setIsLiked(!wasLiked);
      
      // Animate like button
      Animated.sequence([
        Animated.timing(likeAnimation, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.timing(likeAnimation, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(buildApiUrl(`/api/memories/photos/${photoId}/like`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Revert optimistic update
        setIsLiked(wasLiked);
        throw new Error('Failed to toggle like');
      }

      const data = await response.json();
      
      if (data.success) {
        setIsLiked(data.isLiked);
        
        // Update the photo in the photos array
        setPhotos(prev => prev.map(photo => 
          photo._id === photoId 
            ? { ...photo, likeCount: data.likeCount, isLikedByUser: data.isLiked }
            : photo
        ));
      }

    } catch (error) {
      console.error('❌ Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // ✅ Add comment to photo
  const addComment = async () => {
    if (!commentText.trim() || !selectedPhoto) return;

    try {
      setSubmittingComment(true);
      const token = await AsyncStorage.getItem('token');

      const response = await fetch(buildApiUrl(`/api/memories/photos/${selectedPhoto._id}/comments`), {
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
      
      if (data.success) {
        setPhotoComments(prev => [...prev, data.comment]);
        setCommentText('');
        
        // Update photo comment count
        setPhotos(prev => prev.map(photo => 
          photo._id === selectedPhoto._id 
            ? { ...photo, commentCount: data.commentCount }
            : photo
        ));
      }

    } catch (error) {
      console.error('❌ Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ✅ Delete comment
  const deleteComment = async (commentId) => {
    try {
      const token = await AsyncStorage.getItem('token');

      const response = await fetch(buildApiUrl(`/api/memories/photos/${selectedPhoto._id}/comments/${commentId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      const data = await response.json();
      
      if (data.success) {
        setPhotoComments(prev => prev.filter(comment => comment._id !== commentId));
        
        // Update photo comment count
        setPhotos(prev => prev.map(photo => 
          photo._id === selectedPhoto._id 
            ? { ...photo, commentCount: data.commentCount }
            : photo
        ));
      }

    } catch (error) {
      console.error('❌ Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  // ✅ Fetch photo comments when photo is selected
  const fetchPhotoComments = async (photoId) => {
    try {
      setLoadingComments(true);
      const token = await AsyncStorage.getItem('token');

      // Find the photo in our current photos array to get comment data
      const photo = photos.find(p => p._id === photoId);
      if (photo) {
        setPhotoComments(photo.comments || []);
        setIsLiked(photo.isLikedByUser || false);
      }

    } catch (error) {
      console.error('❌ Error fetching photo comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // ✅ Share memory
  const shareMemory = async () => {
    try {
      await Share.share({
        message: `Check out this memory: "${memory.title}"\n\nCreated by ${memory.creator.fullName || memory.creator.username}`,
        title: memory.title,
      });
    } catch (error) {
      console.error('❌ Error sharing memory:', error);
    }
  };

  // ✅ Open photo modal
  const openPhotoModal = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
    setShowComments(false);
    fetchPhotoComments(photo._id);
  };

  // ✅ Close photo modal
  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setPhotoComments([]);
    setIsLiked(false);
    setShowComments(false);
    setCommentText('');
  };

  // ✅ Initial load
  useEffect(() => {
    fetchMemoryDetails();
  }, [fetchMemoryDetails]);

  // ✅ Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMemoryDetails(false);
  }, [fetchMemoryDetails]);

  // ✅ Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading memory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchMemoryDetails()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ Render photo grid item
  const renderPhotoItem = ({ item, index }) => {
    const numColumns = 3;
    const photoSize = (screenWidth - 48) / numColumns; // 48 = padding + gaps

    return (
      <TouchableOpacity
        style={[styles.photoGridItem, { width: photoSize, height: photoSize }]}
        onPress={() => openPhotoModal(item)}
      >
        <Image
          source={{ uri: buildImageUrl(item.url) }}
          style={styles.photoThumbnail}
          resizeMode="cover"
        />
        <View style={styles.photoOverlay}>
          <View style={styles.photoStats}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={12} color="#FFFFFF" />
              <Text style={styles.statText}>{item.likeCount || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={12} color="#FFFFFF" />
              <Text style={styles.statText}>{item.commentCount || 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ Render comment item
  const renderCommentItem = ({ item }) => (
    <View style={styles.commentItem}>
      <Image
        source={{ 
          uri: buildImageUrl(item.user.profilePicture) || 'https://via.placeholder.com/32'
        }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>
            {item.user.fullName || item.user.username}
          </Text>
          <Text style={styles.commentTime}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
      <TouchableOpacity
        style={styles.commentOptions}
        onPress={() => {
          Alert.alert(
            'Comment Options',
            'What would you like to do?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Delete', 
                style: 'destructive',
                onPress: () => deleteComment(item._id)
              },
            ]
          );
        }}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Memory</Text>
        <TouchableOpacity onPress={shareMemory}>
          <Ionicons name="share-outline" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Memory Header */}
        <View style={styles.memoryHeader}>
          <Text style={styles.memoryTitle}>{memory.title}</Text>
          {memory.description ? (
            <Text style={styles.memoryDescription}>{memory.description}</Text>
          ) : null}
          
          <View style={styles.memoryMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="person" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {memory.creator.fullName || memory.creator.username}
              </Text>
            </View>
            
            <View style={styles.metaItem}>
              <Ionicons name="calendar" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {new Date(memory.createdAt).toLocaleDateString()}
              </Text>
            </View>
            
            {memory.participants && memory.participants.length > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="people" size={16} color="#8E8E93" />
                <Text style={styles.metaText}>
                  {memory.participants.length + 1} participants
                </Text>
              </View>
            )}
            
            {memory.location && (
              <View style={styles.metaItem}>
                <Ionicons name="location" size={16} color="#8E8E93" />
                <Text style={styles.metaText}>{memory.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Photos Section */}
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>
            Photos ({photos.length})
          </Text>
          
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              renderItem={renderPhotoItem}
              keyExtractor={(item) => item._id}
              numColumns={3}
              scrollEnabled={false}
              style={styles.photoGrid}
              columnWrapperStyle={styles.photoRow}
            />
          ) : (
            <View style={styles.emptyPhotos}>
              <Ionicons name="camera-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyPhotosText}>No photos yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closePhotoModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            onPress={closePhotoModal}
          />
          
          {selectedPhoto && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              {/* Photo */}
              <Image
                source={{ uri: buildImageUrl(selectedPhoto.url) }}
                style={styles.modalPhoto}
                resizeMode="contain"
              />
              
              {/* Photo Controls */}
              <View style={styles.photoControls}>
                <View style={styles.photoActions}>
                  <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
                    <TouchableOpacity
                      style={[styles.actionButton, isLiked && styles.actionButtonLiked]}
                      onPress={() => toggleLike(selectedPhoto._id)}
                    >
                      <Ionicons
                        name={isLiked ? "heart" : "heart-outline"}
                        size={24}
                        color={isLiked ? "#FF3B30" : "#FFFFFF"}
                      />
                      <Text style={styles.actionText}>
                        {selectedPhoto.likeCount || 0}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowComments(!showComments)}
                  >
                    <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
                    <Text style={styles.actionText}>
                      {selectedPhoto.commentCount || 0}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {selectedPhoto.caption && (
                  <Text style={styles.photoCaption}>{selectedPhoto.caption}</Text>
                )}
              </View>
              
              {/* Comments Section */}
              {showComments && (
                <View style={styles.commentsContainer}>
                  <Text style={styles.commentsTitle}>Comments</Text>
                  
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
                        (!commentText.trim() || submittingComment) && styles.sendCommentButtonDisabled
                      ]}
                      onPress={addComment}
                      disabled={!commentText.trim() || submittingComment}
                    >
                      {submittingComment ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <Ionicons name="send" size={20} color="#000000" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </KeyboardAvoidingView>
          )}
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
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
    marginTop: 8,
  },
  photoRow: {
    justifyContent: 'space-between',
  },
  photoGridItem: {
    marginBottom: 2,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyPhotosText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modalPhoto: {
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  photoControls: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 12,
  },
  actionButtonLiked: {
    backgroundColor: 'rgba(255,59,48,0.2)',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  photoCaption: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  // Comments styles
  commentsContainer: {
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
  sendCommentButtonDisabled: {
    backgroundColor: '#3C3C43',
  },
};

export default MemoryDetailsScreen;