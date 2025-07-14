// SocialApp/screens/MemoryDetailsScreen.js - Fixed with centralized state management
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, StatusBar, 
  Alert, FlatList, TouchableOpacity, Modal, Image,
  TextInput, KeyboardAvoidingView, Platform, ActionSheetIOS,
  Dimensions, StyleSheet, RefreshControl, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../services/AuthContext';
import usePostsStore from '../stores/postsStore';
import api from '../services/api';
import { API_BASE_URL } from '@env';
import MemoryPhotoItem from '../components/MemoryPhotoItem';

const { width: screenWidth } = Dimensions.get('window');

export default function MemoryDetailsScreen({ route, navigation }) {
  const { memoryId } = route?.params || {};
  const { currentUser } = useContext(AuthContext);
  
  // ✅ FIXED: Use centralized store
  const { 
    getPost, 
    updatePost, 
    addPost,
    syncPostsFromFeed 
  } = usePostsStore();
  
  if (!memoryId) {
    console.error('❌ MemoryDetailsScreen: No memoryId provided');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Memory ID not found</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
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

  // Likes modal state
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [currentPhotoLikes, setCurrentPhotoLikes] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (memoryId) {
      fetchMemoryDetails();
    }
  }, [memoryId]);

  useEffect(() => {
    if (memory?.creator?._id && currentUser?._id) {
      const isHost = memory.creator._id === currentUser._id;
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

  // ✅ ENHANCED: Better refresh functionality
  const onRefresh = async () => {
    console.log('🔄 Pull-to-refresh triggered');
    setRefreshing(true);
    try {
      await fetchMemoryDetails();
      console.log('✅ Refresh completed successfully');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ FIXED: Improved memory fetching with store integration
  const fetchMemoryDetails = async () => {
    try {
      setLoading(!refreshing);
      setError(null);
      
      console.log('🔍 === FETCHING MEMORY DETAILS START ===');
      console.log('📋 Memory ID:', memoryId);
      
      const response = await api.get(`/api/memories/${memoryId}`);
      
      console.log('📥 Memory API response received:', {
        success: response.data?.success,
        hasMemory: !!response.data?.memory,
        photoCount: response.data?.memory?.photos?.length || 0
      });
      
      const memoryData = response.data?.memory;
      if (!memoryData) {
        throw new Error('Memory data not found in response');
      }
      
      // ✅ CRITICAL: Sync memory photos with posts store
      if (memoryData.photos && memoryData.photos.length > 0) {
        console.log('📊 Syncing memory photos with posts store...');
        
        // Transform memory photos to post format and sync with store
        const photosForStore = memoryData.photos.map(photo => ({
          ...photo,
          postType: 'memory',
          user: photo.uploadedBy, // Standardize user field
          createdAt: photo.uploadedAt, // Standardize date field
          userLiked: Boolean(photo.userLiked),
          likeCount: photo.likeCount || 0,
          commentCount: photo.commentCount || 0
        }));
        
        // Add/update each photo in the store
        photosForStore.forEach(photo => {
          const existingPost = getPost(photo._id);
          if (existingPost) {
            // Update existing post, preserving any optimistic updates
            updatePost(photo._id, {
              ...photo,
              // Keep current like state if it was optimistically updated
              userLiked: existingPost.userLiked,
              likeCount: existingPost.likeCount,
              commentCount: Math.max(existingPost.commentCount, photo.commentCount)
            });
          } else {
            // Add new post to store
            addPost(photo);
          }
        });
        
        console.log('✅ Memory photos synced with posts store');
      }
      
      setMemory(memoryData);
      console.log('✅ Memory loaded successfully:', {
        title: memoryData.title || 'Untitled',
        photoCount: memoryData.photos?.length || 0,
        participantCount: memoryData.participantCount || 0
      });
      
    } catch (err) {
      console.error('🚨 === FETCH MEMORY DETAILS ERROR ===');
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        memoryId
      });
      
      const errorMessage = err.response?.data?.message || 'Failed to load memory';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ REMOVED: handleLikeUpdate - no longer needed with centralized store

  // ✅ FIXED: Fetch photo likes with proper user data
  const fetchPhotoLikes = async (photoId) => {
    console.log('🚀 === FETCHING PHOTO LIKES START ===');
    console.log('📷 Photo ID:', photoId);
    
    try {
      setLikesLoading(true);
      setCurrentPhotoLikes([]);
      
      console.log('📡 Making API request to get photo likes...');
      const response = await api.get(`/api/memories/photos/${photoId}/likes`);
      
      console.log('📥 Likes API response received:', {
        success: response.data?.success,
        likesCount: response.data?.likes?.length || 0,
        likeCount: response.data?.likeCount,
        userLiked: response.data?.userLiked,
        firstUser: response.data?.likes?.[0]?.username || 'none'
      });

      if (response.data && response.data.success !== false) {
        const likesData = response.data.likes || [];
        
        console.log('👥 Processing likes data:', {
          totalLikes: likesData.length,
          usernames: likesData.map(like => like.username || 'unknown')
        });
        
        // ✅ CRITICAL: Transform likes data to ensure we have user objects
        const transformedLikes = likesData.map(like => {
          if (like && like._id) {
            // Already a user object
            return {
              user: {
                _id: like._id,
                username: like.username || 'Unknown',
                fullName: like.fullName || like.username || 'Unknown User',
                profilePicture: like.profilePicture
              }
            };
          } else if (typeof like === 'string') {
            // Just an ObjectId string
            return {
              user: {
                _id: like,
                username: 'Loading...',
                fullName: 'Loading...',
                profilePicture: null
              }
            };
          } else {
            console.warn('⚠️ Invalid like data:', like);
            return null;
          }
        }).filter(Boolean); // Remove null entries
        
        console.log('✅ Transformed likes data:', {
          originalCount: likesData.length,
          transformedCount: transformedLikes.length,
          sampleUser: transformedLikes[0]?.user?.username
        });
        
        setCurrentPhotoLikes(transformedLikes);
        setShowLikesModal(true);
        
      } else {
        console.error('❌ Invalid response format from likes API');
        Alert.alert('Error', 'Failed to load likes data');
      }
      
    } catch (error) {
      console.error('🚨 === FETCH PHOTO LIKES ERROR ===');
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        photoId
      });
      
      let errorMessage = 'Failed to load likes';
      
      if (error.response?.status === 404) {
        errorMessage = 'Photo not found';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLikesLoading(false);
    }
  };

  // ✅ FIXED: Handle opening likes with proper debugging
  const handleOpenLikes = (photoId) => {
    console.log('👥 Opening likes for photo:', photoId);
    fetchPhotoLikes(photoId);
  };

  // ✅ FIXED: Add null safety for user checks
  const isHost = currentUser?._id && memory?.creator?._id && memory.creator._id === currentUser._id;
  const isParticipant = currentUser?._id && memory && (
    memory.creator?._id === currentUser._id ||
    memory.participants?.some(p => p?._id === currentUser._id)
  );

  // Photo upload functionality
  const handleAddPhotos = () => {
    console.log('📷 === ADD PHOTOS REQUESTED ===');
    console.log('🔐 Access check:', { isParticipant, uploading });
    
    if (uploading) {
      console.log('⚠️ Upload already in progress, ignoring request');
      return;
    }
    
    if (!isParticipant) {
      console.error('❌ User is not a participant, cannot add photos');
      Alert.alert('Access Denied', 'You must be a participant to add photos to this memory.');
      return;
    }

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
      Alert.alert(
        'Add Photo',
        'How would you like to add a photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => pickImage('camera') },
          { text: 'Choose from Library', onPress: () => pickImage('library') }
        ]
      );
    }
  };

   const pickImage = async (source) => {
    console.log('📷 === STARTING IMAGE PICKER ===');
    console.log('🖼️ Source:', source);
    
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required', 
          'Please grant camera roll permissions to upload photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      };

      let result;
      if (source === 'camera') {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus.status !== 'granted') {
          Alert.alert(
            'Camera Permission Required', 
            'Please grant camera permissions to take photos.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => Linking.openSettings() }
            ]
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      console.log('📷 Image picker result:', {
        cancelled: result.cancelled || result.canceled,
        hasAssets: !!(result.assets && result.assets.length > 0),
        assetCount: result.assets?.length
      });

      if (result.cancelled || result.canceled) {
        console.log('ℹ️ User cancelled image selection');
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        console.warn('⚠️ No assets returned from image picker');
        Alert.alert('Error', 'No image selected. Please try again.');
        return;
      }

      const selectedAsset = result.assets[0];
      
      if (!selectedAsset.uri) {
        console.error('❌ Invalid asset - no URI');
        Alert.alert('Error', 'Invalid image selected. Please try again.');
        return;
      }

      console.log('✅ Valid image selected:', {
        uri: selectedAsset.uri,
        width: selectedAsset.width,
        height: selectedAsset.height,
        fileSize: selectedAsset.fileSize,
        type: selectedAsset.type
      });

      // Check file size
      if (selectedAsset.fileSize && selectedAsset.fileSize > 10 * 1024 * 1024) { // 10MB
        Alert.alert(
          'File Too Large', 
          'Please select an image smaller than 10MB.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      await uploadPhoto(selectedAsset);
      
    } catch (error) {
      console.error('❌ Error in image picker:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadPhoto = async (asset) => {
    console.log('🚀 === STARTING PHOTO UPLOAD ===');
    console.log('📤 Asset details:', {
      uri: asset.uri,
      type: asset.type,
      fileName: asset.fileName || asset.filename,
      width: asset.width,
      height: asset.height
    });
    
    try {
      setUploading(true);
      
      const formData = new FormData();
      
      const fileType = asset.type || asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || asset.filename || `memory-photo-${Date.now()}.jpg`;
      
      console.log('📄 Prepared file info:', {
        fileType,
        fileName,
        memoryId
      });
      
      formData.append('photo', {
        uri: asset.uri,
        type: fileType,
        name: fileName,
      });

      if (asset.caption) {
        formData.append('caption', asset.caption);
      }

      console.log('📡 Making upload request to:', `/api/memories/${memoryId}/photos`);
      
      const response = await api.post(`/api/memories/${memoryId}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      console.log('📥 Upload response received:', {
        status: response.status,
        hasData: !!response.data,
        hasPhoto: !!response.data?.photo,
        photoId: response.data?.photo?._id
      });

      if (!response.data || !response.data.photo) {
        throw new Error('Invalid response from server - missing photo data');
      }

      const uploadedPhoto = response.data.photo;
      
      if (!uploadedPhoto._id) {
        throw new Error('Invalid photo data - missing ID');
      }

      console.log('✅ Photo uploaded successfully:', {
        id: uploadedPhoto._id,
        url: uploadedPhoto.url,
        uploadedBy: uploadedPhoto.uploadedBy?.username,
        likeCount: uploadedPhoto.likeCount,
        userLiked: uploadedPhoto.userLiked
      });

      // ✅ FIXED: Add uploaded photo to posts store
      const photoForStore = {
        ...uploadedPhoto,
        postType: 'memory',
        user: uploadedPhoto.uploadedBy,
        createdAt: uploadedPhoto.uploadedAt,
        userLiked: Boolean(uploadedPhoto.userLiked),
        likeCount: uploadedPhoto.likeCount || 0,
        commentCount: uploadedPhoto.commentCount || 0
      };
      
      addPost(photoForStore);
      console.log('✅ Photo added to posts store');

      // Update memory state
      setMemory(prev => {
        if (!prev) {
          console.warn('⚠️ No previous memory state, cannot add photo');
          return prev;
        }

        const updatedMemory = {
          ...prev,
          photos: [...(prev.photos || []), uploadedPhoto]
        };

        console.log('📊 Updated memory state:', {
          memoryId: updatedMemory._id,
          photoCount: updatedMemory.photos.length,
          newPhotoId: uploadedPhoto._id
        });

        return updatedMemory;
      });

      Alert.alert(
        'Success', 
        `Photo uploaded successfully! ${response.data.memory?.photoCount || ''} photos in memory.`,
        [{ text: 'OK', style: 'default' }]
      );

      console.log('✅ === PHOTO UPLOAD COMPLETED ===');

    } catch (error) {
      console.error('🚨 === PHOTO UPLOAD ERROR ===');
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
        memoryId
      });
      
      let errorMessage = 'Failed to upload photo';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message === 'Network Error') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Upload timed out. Please try again with a smaller photo.';
      } else if (error.response?.status === 413) {
        errorMessage = 'Photo is too large. Please choose a smaller photo.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid photo format. Please choose a JPEG or PNG image.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to upload photos to this memory.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Memory not found. Please refresh and try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenComments = async (photoId) => {
    try {
      navigation.navigate('UnifiedDetailsScreen', { 
        postId: photoId,
        postType: 'memory',
        openKeyboard: true
      });
    } catch (error) {
      console.error('Error opening comments:', error);
      Alert.alert('Error', 'Failed to open comments');
    }
  };

  const handleOpenFullscreen = (photo) => {
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'memory',
      post: {
        ...photo,
        postType: 'memory',
        user: photo.uploadedBy,
        createdAt: photo.uploadedAt,
        memoryInfo: {
          memoryId: memory._id,
          memoryTitle: memory.title
        }
      }
    });
  };

  // ✅ SIMPLIFIED: Comment update handler - no longer needed with centralized store
  const handleCommentUpdate = (photoId, updates) => {
    // Updates are now handled automatically by the centralized store
    console.log('📝 Comment update notification received:', { photoId, updates });
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
      
      const users = response.data?.users || [];
      const filteredResults = users.filter(user => 
        user?._id && 
        user._id !== currentUser?._id &&
        user._id !== memory?.creator?._id &&
        !memory?.participants?.some(p => p?._id === user._id)
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
      await api.put(`/api/memories/${memoryId}/participants`, { participantId: userId });
      
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
        participants: prev.participants?.filter(p => p?._id !== userId) || []
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

  // ✅ SIMPLIFIED: Photo rendering using centralized store data
  const renderPhoto = ({ item: photo }) => {
    console.log('🖼️ Rendering memory photo:', {
      photoId: photo._id,
      uploadedBy: photo.uploadedBy?.username
    });
    
    return (
      <MemoryPhotoItem
        photo={photo}
        onCommentUpdate={handleCommentUpdate}
        onOpenComments={handleOpenComments}
        onOpenFullscreen={handleOpenFullscreen}
        onOpenLikes={handleOpenLikes}
      />
    );
  };

  const renderParticipant = ({ item: participant }) => {
    if (!participant?._id) {
      console.warn('⚠️ Invalid participant data:', participant);
      return null;
    }

    return (
      <View style={styles.participantItem}>
        <TouchableOpacity 
          style={styles.participantInfo}
          onPress={() => navigation.navigate('ProfileScreen', { userId: participant._id })}
        >
          <Image
            source={{
              uri: getProfilePictureUrl(
                participant.profilePicture, 
                participant.username?.charAt(0) || participant.fullName?.charAt(0) || 'U'
              )
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
  };

  const renderSearchResult = ({ item: user }) => {
    if (!user?._id) {
      console.warn('⚠️ Invalid user data in search results:', user);
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => addParticipant(user._id)}
      >
        <Image
          source={{
            uri: getProfilePictureUrl(
              user.profilePicture, 
              user.username?.charAt(0) || user.fullName?.charAt(0) || 'U'
            )
          }}
          style={styles.searchResultAvatar}
        />
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>
            {user.fullName || user.username || 'Unknown'}
          </Text>
          <Text style={styles.searchResultUsername}>
            @{user.username || 'unknown'}
          </Text>
        </View>
        <Ionicons name="add-circle-outline" size={24} color="#3797EF" />
      </TouchableOpacity>
    );
  };

  const renderComment = ({ item: comment }) => {
    if (!comment?.user) {
      console.warn('⚠️ Invalid comment data:', comment);
      return null;
    }

    return (
      <View style={styles.commentItem}>
        <Image
          source={{
            uri: getProfilePictureUrl(
              comment.user.profilePicture, 
              comment.user.username?.charAt(0) || 'U'
            )
          }}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <Text style={styles.commentAuthor}>
            {comment.user.username || 'Unknown'}
          </Text>
          <Text style={styles.commentText}>{comment.text || ''}</Text>
          <Text style={styles.commentTime}>
            {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderLikedUser = ({ item: like, index }) => {
    console.log(`👤 Rendering liked user ${index}:`, {
      hasUser: !!like?.user,
      userId: like?.user?._id,
      username: like?.user?.username,
      fullItem: like
    });
    
    if (!like?.user?._id) {
      console.warn('⚠️ Invalid like data in renderLikedUser:', like);
      return (
        <View style={styles.likedUserItem}>
          <View style={styles.likedUserAvatar} />
          <View style={styles.likedUserInfo}>
            <Text style={styles.likedUserName}>Unknown User</Text>
            <Text style={styles.likedUserUsername}>@unknown</Text>
          </View>
        </View>
      );
    }

    const user = like.user;
    
    return (
      <TouchableOpacity
        style={styles.likedUserItem}
        onPress={() => {
          console.log('📱 Navigating to profile for user:', user._id);
          setShowLikesModal(false);
          navigation.navigate('ProfileScreen', { userId: user._id });
        }}
      >
        <Image
          source={{
            uri: getProfilePictureUrl(
              user.profilePicture, 
              user.username?.charAt(0) || 'U'
            )
          }}
          style={styles.likedUserAvatar}
        />
        <View style={styles.likedUserInfo}>
          <Text style={styles.likedUserName}>
            {user.fullName || user.username || 'Unknown'}
          </Text>
          <Text style={styles.likedUserUsername}>
            @{user.username || 'unknown'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
                {memory.createdAt ? new Date(memory.createdAt).toLocaleDateString() : 'Unknown date'}
              </Text>
            </View>
            
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

        {/* Add Photo Button */}
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
              keyExtractor={(item) => item._id || item.id || Math.random().toString()}
              scrollEnabled={false}
              contentContainerStyle={styles.photosList}
            />
          </View>
        )}
      </ScrollView>

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
            ) : currentPhotoLikes.length === 0 ? (
              <View style={styles.modalLoading}>
                <Text style={styles.emptyLikesText}>No likes yet</Text>
              </View>
            ) : (
              <FlatList
                data={currentPhotoLikes}
                renderItem={renderLikedUser}
                keyExtractor={(item, index) => {
                  const key = item?.user?._id || `like-${index}`;
                  console.log(`🔑 Like item key: ${key} for user: ${item?.user?.username || 'unknown'}`);
                  return key;
                }}
                style={styles.likedUsersList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
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
            keyExtractor={(item, index) => `comment-${item?._id || index}`}
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
// ✅ ENHANCED: Updated styles with new additions
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
  
  // ✅ NEW: Enhanced Likes Modal Styles
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
  listSeparator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 52, // Align with text, not avatar
  },
  emptyLikesText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
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
  
  // Participant rendering styles (for potential future use)
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 12,
  },
  removeButton: {
    padding: 8,
  },
  
  // Search result styles (for potential future use)
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  searchResultInfo: {
    marginLeft: 12,
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