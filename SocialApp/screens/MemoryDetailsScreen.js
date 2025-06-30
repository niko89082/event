// SocialApp/screens/MemoryDetailsScreen.js - FIXED: Square profile photos + natural photo ratios
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, StatusBar, 
  Alert, FlatList, TouchableOpacity, Modal, Image,
  TextInput, KeyboardAvoidingView, Platform, ActionSheetIOS,
  Dimensions, StyleSheet
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

  // Host control states
  const [showManageModal, setShowManageModal] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ✅ FIXED: Separate useEffect for initial fetch - no dependencies on memory
  useEffect(() => {
    fetchMemoryDetails();
  }, [memoryId]);

  // ✅ FIXED: Separate useEffect for navigation header - only runs when needed
  useEffect(() => {
    if (memory && currentUser) {
      const isHost = memory.creator?._id === currentUser._id;
      if (isHost) {
        navigation.setOptions({
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowManageModal(true)}
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
      // Check if it's already a full URL
      if (profilePicture.startsWith('http')) {
        return profilePicture;
      }
      // Add the base URL if it's a relative path
      const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
      return `http://${API_BASE_URL}:3000${cleanPath}`;
    }
    return `https://placehold.co/40x40/E1E1E1/8E8E93?text=${fallbackText}`;
  };

  const fetchMemoryDetails = async () => {
    try {
      setLoading(true);
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

      let result;
      if (source === 'camera') {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus.status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false, // ✅ FIXED: Don't force square cropping
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false, // ✅ FIXED: Don't force square cropping
          quality: 0.8,
          allowsMultipleSelection: true,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        for (const asset of result.assets) {
          await uploadPhoto(asset);
        }
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
        type: 'image/jpeg',
        name: 'memory-photo.jpg',
      });

      formData.append('caption', '');

      console.log('📤 Uploading photo to memory:', memoryId);
      const response = await api.post(`/api/memories/${memoryId}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      await fetchMemoryDetails();
      Alert.alert('Success', 'Photo uploaded successfully!');

    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Host control functions
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      const existingUserIds = [
        memory.creator._id,
        ...memory.participants.map(p => p._id)
      ];
      const filteredResults = response.data.users.filter(
        user => !existingUserIds.includes(user._id)
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
      await api.put(`/api/memories/${memoryId}/participants`, {
        participantId: userId
      });

      await fetchMemoryDetails();
      setSearchText('');
      setSearchResults([]);
      Alert.alert('Success', 'Participant added successfully!');
    } catch (error) {
      console.error('Error adding participant:', error);
      Alert.alert('Error', 'Failed to add participant');
    }
  };

  const removeParticipant = async (participantId) => {
    Alert.alert(
      'Remove Participant',
      'Are you sure you want to remove this person from the memory?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/memories/${memoryId}/participants/${participantId}`);
              await fetchMemoryDetails();
              Alert.alert('Success', 'Participant removed successfully');
            } catch (error) {
              console.error('Error removing participant:', error);
              Alert.alert('Error', 'Failed to remove participant');
            }
          },
        },
      ]
    );
  };

  // Comment functions
  const fetchComments = async (photoId) => {
    try {
      setCommentsLoading(true);
      const response = await api.get(`/api/memories/photos/${photoId}/comments`);
      setComments(response.data.comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentPhotoId) return;
    
    try {
      const response = await api.post(`/api/memories/photos/${currentPhotoId}/comments`, {
        text: commentText.trim()
      });
      
      setComments(prev => [response.data.comment, ...prev]);
      setCommentText('');
      
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/api/memories/photos/comments/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const handleOpenComments = (photoId) => {
    setCurrentPhotoId(photoId);
    fetchComments(photoId);
    setShowComments(true);
  };

  const handleOpenFullscreen = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
  };

  const handleLikeUpdate = (photoId, likeData) => {
    setMemory(prev => ({
      ...prev,
      photos: prev.photos.map(photo => 
        photo._id === photoId 
          ? { ...photo, likeCount: likeData.count, userLiked: likeData.userLiked }
          : photo
      )
    }));
  };

  const renderPhoto = ({ item: photo }) => (
    <MemoryPhotoItem
      photo={photo}
      onLikeUpdate={handleLikeUpdate}
      onOpenComments={handleOpenComments}
      onOpenFullscreen={handleOpenFullscreen}
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
      
      {/* Remove button for host */}
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
        <View style={styles.commentBubble}>
          <Text style={styles.commentUsername}>{comment.user?.username}</Text>
          <Text style={styles.commentText}>{comment.text}</Text>
        </View>
        <View style={styles.commentMeta}>
          <Text style={styles.commentTime}>
            {new Date(comment.createdAt).toLocaleDateString()}
          </Text>
          {(comment.user?._id === currentUser?._id || isHost) && (
            <TouchableOpacity
              style={styles.deleteCommentButton}
              onPress={() => handleDeleteComment(comment._id)}
            >
              <Text style={styles.deleteCommentText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading memory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMemoryDetails}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Memory Header */}
        <View style={styles.headerSection}>
          <View style={styles.titleRow}>
            <Text style={styles.memoryTitle}>{memory.title}</Text>
            {isHost && (
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() => setShowManageModal(true)}
              >
                <Ionicons name="settings-outline" size={20} color="#3797EF" />
              </TouchableOpacity>
            )}
          </View>
          
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

        {/* Participants Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Participants ({(memory.participants?.length || 0) + 1})
            </Text>
            {isHost && (
              <TouchableOpacity
                style={styles.addParticipantButton}
                onPress={() => setShowAddParticipants(true)}
              >
                <Ionicons name="person-add-outline" size={20} color="#3797EF" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Creator */}
          {memory.creator && (
            <View style={styles.participantsList}>
              <View style={[styles.participantItem, styles.creatorItem]}>
                <TouchableOpacity 
                  style={styles.participantInfo}
                  onPress={() => navigation.navigate('ProfileScreen', { userId: memory.creator._id })}
                >
                  <Image
                    source={{
                      uri: getProfilePictureUrl(memory.creator.profilePicture, memory.creator.username?.charAt(0))
                    }}
                    style={styles.participantAvatar}
                  />
                  <View>
                    <Text style={styles.participantName}>
                      {memory.creator.username || memory.creator.fullName || 'Unknown'}
                    </Text>
                    <Text style={styles.creatorLabel}>Creator</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Other Participants */}
          {memory.participants && memory.participants.length > 0 && (
            <FlatList
              data={memory.participants}
              renderItem={renderParticipant}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Add Photos Button */}
        {isParticipant && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[styles.addPhotoButton, uploading && styles.addPhotoButtonDisabled]}
              onPress={handleAddPhotos}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="camera-outline" 
                size={24} 
                color={uploading ? "#C7C7CC" : "#3797EF"} 
              />
              <Text style={[styles.addPhotoButtonText, uploading && styles.addPhotoButtonTextDisabled]}>
                {uploading ? 'Uploading...' : 'Add Photos'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Host Management Modal */}
      <Modal
        visible={showManageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.manageModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Memory</Text>
              <TouchableOpacity onPress={() => setShowManageModal(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.manageOptions}>
              <TouchableOpacity
                style={styles.manageOption}
                onPress={() => {
                  setShowManageModal(false);
                  setShowAddParticipants(true);
                }}
              >
                <Ionicons name="person-add-outline" size={24} color="#3797EF" />
                <Text style={styles.manageOptionText}>Add Participants</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.manageOption}
                onPress={() => {
                  setShowManageModal(false);
                }}
              >
                <Ionicons name="create-outline" size={24} color="#3797EF" />
                <Text style={styles.manageOptionText}>Edit Memory</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Participants Modal */}
      <Modal
        visible={showAddParticipants}
        animationType="slide"
        onRequestClose={() => setShowAddParticipants(false)}
      >
        <SafeAreaView style={styles.addParticipantsModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddParticipants(false)}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Participants</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                searchUsers(text);
              }}
            />
          </View>
          
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item._id}
            style={styles.searchResults}
            ListEmptyComponent={
              searchText ? (
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>
                    {searchLoading ? 'Searching...' : 'No users found'}
                  </Text>
                </View>
              ) : null
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Fullscreen Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoModalClose}
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
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <SafeAreaView style={styles.commentsModal}>
          <View style={styles.commentsHeader}>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.commentsTitle}>Comments</Text>
            <View style={{ width: 24 }} />
          </View>
          
          {commentsLoading ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>Loading comments...</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={(item) => item._id}
                style={styles.commentsList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.noCommentsContainer}>
                    <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
                    <Text style={styles.noCommentsText}>No comments yet</Text>
                    <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
                  </View>
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
                  style={[
                    styles.sendButton,
                    !commentText.trim() && styles.sendButtonDisabled
                  ]}
                  onPress={handleAddComment}
                  disabled={!commentText.trim()}
                >
                  <Ionicons 
                    name="send" 
                    size={20} 
                    color={commentText.trim() ? "#FFFFFF" : "#C7C7CC"} 
                  />
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </>
          )}
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
  scrollContainer: {
    flex: 1,
  },
  centerContent: {
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
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: 12,
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
  headerSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  memoryTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  manageButton: {
    padding: 8,
    marginLeft: 12,
  },
  memoryDescription: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 16,
  },
  memoryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontWeight: '500',
  },

  // Sections
  section: {
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  addParticipantButton: {
    padding: 8,
  },

  // Photos
  photosList: {
    paddingHorizontal: 20,
  },

  // Participants
  participantsList: {
    paddingHorizontal: 20,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  creatorItem: {
    backgroundColor: '#F8F9FA',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12, // ✅ FIXED: Square with curved edges (was 20 for circle)
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  creatorLabel: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '600',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },

  // Action section
  actionSection: {
    padding: 20,
    paddingBottom: 40,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F6F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addPhotoButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  addPhotoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  addPhotoButtonTextDisabled: {
    color: '#C7C7CC',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  manageModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  addParticipantsModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  manageOptions: {
    padding: 20,
  },
  manageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  manageOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },

  // Search
  searchContainer: {
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchResults: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12, // ✅ FIXED: Square with curved edges (was 20 for circle)
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  searchResultUsername: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#8E8E93',
  },

  // Photo Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullPhoto: {
    width: '90%',
    height: '70%',
  },

  // Comments Modal
  commentsModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  commentsList: {
    flex: 1,
    paddingVertical: 8,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10, // ✅ FIXED: Square with curved edges (was 16 for circle)
    marginRight: 12,
    backgroundColor: '#F6F6F6',
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
    gap: 12,
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  deleteCommentButton: {
    padding: 4,
  },
  deleteCommentText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  },
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
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
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
});