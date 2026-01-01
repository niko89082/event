// components/PostComposer.js - Redesigned to match feed design
import React, { useContext, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';
import api from '../services/api';
import * as ImagePicker from 'expo-image-picker';

export default function PostComposer({ navigation, onPostCreated, debugValues = {} }) {
  const { currentUser } = useContext(AuthContext);
  const [textContent, setTextContent] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef(null);

  const MAX_TEXT_LENGTH = 5000;

  const handleImagePress = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to add photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setIsExpanded(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handlePost = async () => {
    // Validate: must have text or image
    if (!textContent.trim() && !selectedImage) {
      Alert.alert('Empty Post', 'Please add some content to your post.');
      return;
    }

    // Validate text length
    if (textContent.length > MAX_TEXT_LENGTH) {
      Alert.alert('Text Too Long', `Text must be ${MAX_TEXT_LENGTH} characters or less.`);
      return;
    }

    try {
      setIsPosting(true);
      Keyboard.dismiss();

      if (selectedImage) {
        // Photo post (with optional text)
        const formData = new FormData();
        formData.append('photo', {
          uri: selectedImage.uri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
        formData.append('textContent', textContent.trim());
        formData.append('postType', 'photo');
        formData.append('privacy', 'public');

        const response = await api.post('/api/photos/create', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('✅ Post created:', response.data);
        handlePostSuccess(response.data);
      } else {
        // Text-only post
        const response = await api.post('/api/photos/create-text', {
          textContent: textContent.trim(),
          privacy: 'public',
        });

        console.log('✅ Text post created:', response.data);
        handlePostSuccess(response.data);
      }
    } catch (error) {
      console.error('❌ Post creation error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';
      Alert.alert(
        'Failed to Post',
        errorMessage
      );
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostSuccess = (responseData) => {
    // Reset form
    setTextContent('');
    setSelectedImage(null);
    setIsExpanded(false);
    
    // Extract post data from response - handle both response.data.photo and response.data
    const postData = responseData.photo || responseData;
    
    // Ensure post data has all required fields for feed insertion
    const completePostData = {
      ...postData,
      createdAt: postData.createdAt || postData.uploadDate || new Date().toISOString(),
      uploadDate: postData.uploadDate || postData.createdAt || new Date().toISOString(),
      user: postData.user || currentUser, // Ensure user info is included
      likes: postData.likes || [],
      comments: postData.comments || [],
      userLiked: false,
      likeCount: postData.likeCount || 0,
      commentCount: postData.commentCount || 0,
    };
    
    // Notify parent component with complete post data
    if (onPostCreated) {
      onPostCreated(completePostData);
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    if (!textContent.trim() && !selectedImage) {
      setIsExpanded(false);
    }
  };

  const getProfilePictureUrl = () => {
    if (currentUser?.profilePicture) {
      const path = currentUser.profilePicture.startsWith('/') 
        ? currentUser.profilePicture 
        : `/${currentUser.profilePicture}`;
      return `http://${API_BASE_URL}:3000${path}`;
    }
    return null;
  };

  const profilePictureUri = getProfilePictureUrl();
  const canPost = (textContent.trim().length > 0 || selectedImage) && !isPosting;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Profile Picture - Smaller to match header */}
        <View style={styles.profilePictureContainer}>
          {profilePictureUri ? (
            <Image source={{ uri: profilePictureUri }} style={styles.profilePicture} />
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
          )}
        </View>

        {/* Input Section with Icons */}
        <View style={styles.inputSection}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="What's happening?"
              placeholderTextColor="#8E8E93"
              value={textContent}
              onChangeText={setTextContent}
              onFocus={handleFocus}
              onBlur={handleBlur}
              multiline
              maxLength={MAX_TEXT_LENGTH}
              textAlignVertical="center"
            />
            
            {/* Action Icons - Inside the textbox on the right */}
            <View style={styles.actionIconsContainer}>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={handleImagePress}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={22} color="#3797EF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={() => navigation.navigate('Create', { screen: 'CreateEvent' })}
                activeOpacity={0.7}
              >
                <Ionicons name="school-outline" size={22} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Selected Image Preview */}
          {selectedImage && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={handleRemoveImage}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={28} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Bar - Only show when expanded and has content */}
          {isExpanded && (textContent.trim() || selectedImage) && (
            <View style={styles.actionBar}>
              <View style={styles.postButtonContainer}>
                <TouchableOpacity
                  style={[styles.postButton, !canPost && styles.postButtonDisabled]}
                  onPress={handlePost}
                  disabled={!canPost}
                  activeOpacity={0.8}
                >
                  {isPosting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.postButtonText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePictureContainer: {
    marginRight: 12,
    alignSelf: 'flex-start',
    marginTop: 2, // Slight offset to align with input
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  profilePicturePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputSection: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginRight: 4,
    maxHeight: 100,
    ...Platform.select({
      ios: {
        fontWeight: '400',
      },
      android: {
        fontWeight: 'normal',
      },
    }),
  },
  actionIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  actionIcon: {
    padding: 4,
  },
  imagePreviewContainer: {
    marginTop: 12,
    marginBottom: 12,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBar: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  postButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  postButtonDisabled: {
    backgroundColor: '#C7C7CC',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
