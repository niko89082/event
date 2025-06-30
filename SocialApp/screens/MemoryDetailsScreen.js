// SocialApp/screens/MemoryDetailsScreen.js - Enhanced with all requested improvements
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, StatusBar, 
  Alert, FlatList, TouchableOpacity, Modal, Image,
  TextInput, KeyboardAvoidingView, Platform, ActionSheetIOS,
  Dimensions, StyleSheet, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';
import MemoryPhotoItem from '../components/MemoryPhotoItem';

const { width: screenWidth } = Dimensions.get('window');

export default function MemoryDetailsScreen({ route, navigation }) {
  const { memoryId } = route.params;
  const { currentUser } = useContext(AuthContext);
  
  // State management
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Photo interaction states
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentPhotoId, setCurrentPhotoId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  // NEW: Likes modal state
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [currentPhotoLikes, setCurrentPhotoLikes] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);

  // NEW: Participants modal state - REMOVED (now using separate screen)
  // const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  // Host control states - SIMPLIFIED (removed manage modal)
  // const [showManageModal, setShowManageModal] = useState(false);
  // const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchMemoryDetails();
  }, [memoryId]);

  useEffect(() => {
    if (memory && currentUser) {
      const isHost = memory.creator?._id === currentUser._id;
      if (isHost) {
        navigation.setOptions({
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('EditMemoryScreen', { memoryId: memory._id })}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="settings-outline" size={24} color="#000000" />
            </TouchableOpacity>
          ),
        });
      }
    }
  }, [memory?.creator?._id, currentUser?._id, navigation]);

  // Helper function to get proper profile picture URL
  const getProfilePictureUrl = (profilePicture, fallbackText = '👤') => {
    if (profilePicture) {
      if (profilePicture.startsWith('http')) {
        return profilePicture;
      }
      const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
      return `http://${API_BASE_URL}:3000${cleanPath}`;
    }
    return `https://placehold.co/40x40/E1E1E1/8E8E93?text=${fallbackText}`;
  };

  // NEW: Pull-to-refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMemoryDetails();
    } finally {
      setRefreshing(false);
    }
  };

  const fetchMemoryDetails = async () => {
    try {
      setLoading(!refreshing); // Don't show main loading if refreshing
      setError(null);
      
      console.log('🔍 Fetching memory details for:', memoryId);
      const response = await api.get(`/api/memories/${memoryId}`);
      setMemory(response.data.memory);
      console.log('✅ Memory loaded:', response.data.memory.title);
      
    } catch (err) {
      console.error('❌ Error fetching memory details:', err);
      setError(err.response?.data?.message || 'Failed to load memory');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Fetch photo likes
  const fetchPhotoLikes = async (photoId) => {
    try {
      setLikesLoading(true);
      const response = await api.get(`/api/memories/photos/${photoId}/likes`);
      setCurrentPhotoLikes(response.data.likes);
      setShowLikesModal(true);
    } catch (error) {
      console.error('Error fetching photo likes:', error);
      Alert.alert('Error', 'Failed to load likes');
    } finally {
      setLikesLoading(false);
    }
  };

  const handleOpenLikes = (photoId) => {
    fetchPhotoLikes(photoId);
  };

  const isHost = currentUser && memory && memory.creator?._id === currentUser._id;
  const isParticipant = currentUser && memory && (
    memory.creator?._id === currentUser._id ||
    memory.participants?.some(p => p._id === currentUser._id)
  );

  // Photo upload functionality
  const handleAddPhotos = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImage('camera');
          } else if (buttonIndex === 2) {
            pickImage('library');
          }
        }
      );
    } else {
      pickImage('library');
    }
  };

  const pickImage = async (source) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos.');
        return;
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      };

      let result;
      if (source === 'camera') {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus.status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.cancelled && result.assets && result.assets[0]) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadPhoto = async (asset) => {
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'memory-photo.jpg',
      });

      const response = await api.post(`/api/memories/${memoryId}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMemory(prev => ({
        ...prev,
        photos: [...(prev.photos || []), response.data.photo]
      }));

      Alert.alert('Success', 'Photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  // Photo interactions
  const handleLikeUpdate = (photoId, likeData) => {
    setMemory(prev => ({
      ...prev,
      photos: prev.photos?.map(photo => 
        photo._id === photoId 
          ? { ...photo, likeCount: likeData.count, userLiked: likeData.userLiked }
          : photo
      )
    }));
  };

  const handleOpenComments = async (photoId) => {
    try {
      setCurrentPhotoId(photoId);
      setCommentsLoading(true);
      setShowComments(true);
      
      const response = await api.get(`/api/memories/photos/${photoId}/comments`);
      setComments(response.data.comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleOpenFullscreen = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
  };

  // Participant management
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.get(`/api/search/users?q=${encodeURIComponent(query)}`);
      
      const filteredResults = response.data.users.filter(user => 
        user._id !== currentUser._id &&
        user._id !== memory.creator._id &&
        !memory.participants?.some(p => p._id === user._id)
      );
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const addParticipant = async (userId) => {
    try {
      await api.post(`/api/memories/${memoryId}/participants`, { userId });
      
      const user = searchResults.find(u => u._id === userId);
      if (user) {
        setMemory(prev => ({
          ...prev,
          participants: [...(prev.participants || []), user]
        }));
      }
      
      setSearchText('');
      setSearchResults([]);
      Alert.alert('Success', 'Participant added successfully');
    } catch (error) {
      console.error('Error adding participant:', error);
      Alert.alert('Error', 'Failed to add participant');
    }
  };

  const removeParticipant = async (userId) => {
    try {
      await api.delete(`/api/memories/${memoryId}/participants/${userId}`);
      
      setMemory(prev => ({
        ...prev,
        participants: prev.participants?.filter(p => p._id !== userId) || []
      }));
      
      Alert.alert('Success', 'Participant removed successfully');
    } catch (error) {
      console.error('Error removing participant:', error);
      Alert.alert('Error', 'Failed to remove participant');
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;

    try {
      const response = await api.post(`/api/memories/photos/${currentPhotoId}/comments`, {
        text: commentText.trim()
      });

      setComments(prev => [...prev, response.data.comment]);
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  // Render functions
  const renderPhoto = ({ item: photo }) => (
    <MemoryPhotoItem
      photo={photo}
      onLikeUpdate={handleLikeUpdate}
      onOpenComments={handleOpenComments}
      onOpenFullscreen={handleOpenFullscreen}
      onOpenLikes={handleOpenLikes}
    />
  );

  const renderParticipant = ({ item: participant }) => (
    <View style={styles.participantItem}>
      <TouchableOpacity 
        style={styles.participantInfo}
        onPress={() => navigation.navigate('ProfileScreen', { userId: participant._id })}
      >
        <Image
          source={{
            uri: getProfilePictureUrl(participant.profilePicture, participant.username?.charAt(0))
          }}
          style={styles.participantAvatar}
        />
        <Text style={styles.participantName}>
          {participant.username || participant.fullName || 'Unknown'}
        </Text>
      </TouchableOpacity>
      
      {isHost && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeParticipant(participant._id)}
        >
          <Ionicons name="remove-circle-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSearchResult = ({ item: user }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => addParticipant(user._id)}
    >
      <Image
        source={{
          uri: getProfilePictureUrl(user.profilePicture, user.username?.charAt(0))
        }}
        style={styles.searchResultAvatar}
      />
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{user.fullName || user.username}</Text>
        <Text style={styles.searchResultUsername}>@{user.username}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color="#3797EF" />
    </TouchableOpacity>
  );

  const renderComment = ({ item: comment }) => (
    <View style={styles.commentItem}>
      <Image
        source={{
          uri: getProfilePictureUrl(comment.user?.profilePicture, comment.user?.username?.charAt(0))
        }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <Text style={styles.commentAuthor}>{comment.user?.username || 'Unknown'}</Text>
        <Text style={styles.commentText}>{comment.text}</Text>
        <Text style={styles.commentTime}>
          {new Date(comment.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  const renderLikedUser = ({ item: like }) => (
    <TouchableOpacity
      style={styles.likedUserItem}
      onPress={() => {
        setShowLikesModal(false);
        navigation.navigate('ProfileScreen', { userId: like.user._id });
      }}
    >
      <Image
        source={{
          uri: getProfilePictureUrl(like.user.profilePicture, like.user.username?.charAt(0))
        }}
        style={styles.likedUserAvatar}
      />
      <View style={styles.likedUserInfo}>
        <Text style={styles.likedUserName}>
          {like.user.fullName || like.user.username}
        </Text>
        <Text style={styles.likedUserUsername}>@{like.user.username}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading memory...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchMemoryDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!memory) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Memory not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3797EF"
          />
        }
      >
        {/* Memory Header */}
        <View style={styles.memoryHeader}>
          <Text style={styles.memoryTitle}>{memory.title || 'Untitled Memory'}</Text>
          
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
            
            {/* NEW: Clickable participants count - Navigate to separate screen */}
            <TouchableOpacity 
              style={styles.metaItem}
              onPress={() => navigation.navigate('MemoryParticipantsScreen', { 
                memoryId: memory._id,
                memoryTitle: memory.title 
              })}
            >
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <Text style={[styles.metaText, styles.clickableText]}>
                {(memory.participants?.length || 0) + 1} participants
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* NEW: Add Photo Button - Moved above photos */}
        {isParticipant && (
          <View style={styles.addPhotoSection}>
            <TouchableOpacity
              style={[styles.addPhotoButton, uploading && styles.addPhotoButtonDisabled]}
              onPress={handleAddPhotos}
              disabled={uploading}
            >
              <Ionicons 
                name={uploading ? "cloud-upload-outline" : "add-outline"} 
                size={20} 
                color={uploading ? "#C7C7CC" : "#3797EF"} 
              />
              <Text style={[styles.addPhotoButtonText, uploading && styles.addPhotoButtonTextDisabled]}>
                {uploading ? 'Uploading...' : 'Add Photos'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Photos Section */}
        {memory.photos && memory.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({memory.photos.length})</Text>
            <FlatList
              data={memory.photos}
              renderItem={renderPhoto}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.photosList}
            />
          </View>
        )}
      </ScrollView>

      {/* Participants Modal - REMOVED, now using separate screen */}

      {/* Likes Modal */}
      <Modal
        visible={showLikesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLikesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.likesModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Likes ({currentPhotoLikes.length})
              </Text>
              <TouchableOpacity onPress={() => setShowLikesModal(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
            
            {likesLoading ? (
              <View style={styles.modalLoading}>
                <Text>Loading likes...</Text>
              </View>
            ) : (
              <FlatList
                data={currentPhotoLikes}
                renderItem={renderLikedUser}
                keyExtractor={(item, index) => `${item.user._id}-${index}`}
                style={styles.likedUsersList}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <SafeAreaView style={styles.commentsModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item, index) => `comment-${index}`}
            style={styles.commentsList}
            ListEmptyComponent={
              commentsLoading ? (
                <View style={styles.modalLoading}>
                  <Text>Loading comments...</Text>
                </View>
              ) : (
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyCommentsText}>No comments yet</Text>
                </View>
              )
            }
          />
          
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.commentInputContainer}
          >
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
              onPress={addComment}
              disabled={!commentText.trim()}
            >
              <Ionicons name="send" size={20} color={commentText.trim() ? "#3797EF" : "#C7C7CC"} />
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Host Management Modal - REMOVED (using direct navigation) */}

      {/* Add Participants Modal - REMOVED, now using separate screen */}

      {/* Fullscreen Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.fullscreenModal}>
          <TouchableOpacity
            style={styles.fullscreenCloseButton}
            onPress={() => setShowPhotoModal(false)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          
          {selectedPhoto && (
            <Image
              source={{
                uri: selectedPhoto.url?.startsWith('http') 
                  ? selectedPhoto.url 
                  : `http://${API_BASE_URL}:3000${selectedPhoto.url}`
              }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  memoryHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memoryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  memoryDescription: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
    marginBottom: 16,
  },
  memoryMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  clickableText: {
    color: '#3797EF',
    textDecorationLine: 'underline',
  },
  addPhotoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#3797EF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  addPhotoButtonDisabled: {
    backgroundColor: '#F6F6F6',
    borderColor: '#C7C7CC',
  },
  addPhotoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  addPhotoButtonTextDisabled: {
    color: '#C7C7CC',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  photosList: {
    gap: 16,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  
  // Participants Modal - REMOVED (using separate screen)
  
  // Likes Modal
  likesModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  likedUsersList: {
    maxHeight: 400,
  },
  likedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  likedUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  likedUserInfo: {
    marginLeft: 12,
    flex: 1,
  },
  likedUserName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  likedUserUsername: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  
  // Comments Modal
  commentsModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
  },
  commentContent: {
    marginLeft: 12,
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyComments: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 80,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 12,
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  
  // Management Modal
  manageModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  manageOptions: {
    paddingBottom: 20,
  },
  manageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  manageOptionText: {
    fontSize: 16,
    color: '#000000',
    marginLeft: 12,
  },
  
  // Add Participants Modal - REMOVED (using separate screen)
  
  // Fullscreen Photo Modal
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  fullscreenImage: {
    width: screenWidth,
    height: '100%',
  },
});