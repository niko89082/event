// screens/CreatePostScreen.js - Twitter-style single screen
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, Image, Alert, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Dimensions, StatusBar,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import MovieReviewSelector from '../components/MovieReviewSelector';
import SongReviewSelector from '../components/SongReviewSelector';
import ReviewCard from '../components/ReviewCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_TEXT_LENGTH = 5000;

export default function CreatePostScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const [textContent, setTextContent] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [privacy, setPrivacy] = useState('public');
  const [review, setReview] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showMovieReview, setShowMovieReview] = useState(false);
  const [showSongReview, setShowSongReview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const textInputRef = useRef(null);

  useEffect(() => {
    requestLibraryPermission();
    fetchMyAttendingEvents();
  }, []);

  // Hide bottom tab bar when this screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Get the tab navigator (parent of the stack navigator)
      const tabNavigator = navigation.getParent()?.getParent();
      if (tabNavigator) {
        tabNavigator.setOptions({
          tabBarStyle: { display: 'none' },
        });
      }
      return () => {
        if (tabNavigator) {
          tabNavigator.setOptions({
            tabBarStyle: undefined,
          });
        }
      };
    }, [navigation])
  );

  // Keep keyboard open permanently
  useEffect(() => {
    const timer = setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Refocus when keyboard is dismissed
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        // Small delay to ensure keyboard is fully dismissed before refocusing
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  // Keyboard handling
  useEffect(() => {
    const keyboardWillShow = (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    
    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    let showListener, hideListener;
    
    if (Platform.OS === 'ios') {
      showListener = Keyboard.addListener('keyboardWillShow', keyboardWillShow);
      hideListener = Keyboard.addListener('keyboardWillHide', keyboardWillHide);
    } else {
      showListener = Keyboard.addListener('keyboardDidShow', keyboardWillShow);
      hideListener = Keyboard.addListener('keyboardDidHide', keyboardWillHide);
    }

    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, []);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photo library to continue.');
    }
  };

  const fetchMyAttendingEvents = async () => {
    try {
      const res = await api.get('/events/my-photo-events');
      setMyEvents(res.data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.slice(0, 10 - selectedImages.length);
        setSelectedImages([...selectedImages, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const handleAddLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to add location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setSelectedLocation({
        name: address ? `${address.street || ''} ${address.city || ''}`.trim() : 'Current Location',
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      });
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location.');
    }
  };

  const handlePost = async () => {
    // Validate: must have text, image, or review
    if (!textContent.trim() && selectedImages.length === 0 && !review) {
      Alert.alert('Empty Post', 'Please add some content to your post.');
      return;
    }

    // Validate text length
    if (textContent.length > MAX_TEXT_LENGTH) {
      Alert.alert('Text Too Long', `Text must be ${MAX_TEXT_LENGTH} characters or less.`);
      return;
    }

    try {
      setPublishing(true);

      // Determine post type
      const postType = selectedImages.length > 0 ? 'photo' : 'text';

      if (postType === 'text' && selectedImages.length === 0) {
        // Text-only post
        const response = await api.post('/api/photos/create-text', {
          textContent: textContent.trim(),
          privacy: privacy,
          location: selectedLocation,
          eventId: selectedEventId || null,
          review: review,
        });

        console.log('✅ Text post created:', response.data);
        handlePostSuccess(response.data);
      } else {
        // Photo post (with optional text)
        const formData = new FormData();
        
        // Add first image (required for photo post)
        formData.append('photo', {
          uri: selectedImages[0].uri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });

        // Add text content
        if (textContent.trim()) {
          formData.append('textContent', textContent.trim());
        }
        formData.append('caption', textContent.trim() || '');
        formData.append('postType', 'photo');
        formData.append('privacy', privacy);
        
        if (selectedLocation) {
          formData.append('location', JSON.stringify(selectedLocation));
        }
        
        if (selectedEventId) {
          formData.append('eventId', selectedEventId);
        }
        
        if (review) {
          formData.append('review', JSON.stringify(review));
        }

        const response = await api.post('/api/photos/create', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('✅ Photo post created:', response.data);
        handlePostSuccess(response.data);
      }
    } catch (error) {
      console.error('❌ Post creation error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create post. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handlePostSuccess = (data) => {
    Alert.alert(
      'Success!',
      'Your post has been shared!',
      [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setTextContent('');
            setSelectedImages([]);
            setSelectedEventId('');
            setSelectedLocation(null);
            setReview(null);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleReviewSelect = (reviewData) => {
    setReview(reviewData);
  };

  const selectEvent = (event) => {
    setSelectedEventId(selectedEventId === event._id ? '' : event._id);
    setShowEventModal(false);
  };

  const canPost = () => {
    return (textContent.trim().length > 0 || selectedImages.length > 0 || review) && 
           textContent.length <= MAX_TEXT_LENGTH;
  };

  const renderImagePreview = () => {
    if (selectedImages.length === 0) return null;

    return (
      <View style={styles.imagesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.imagePreviewWrapper}>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => handleRemoveImage(index)}
              >
                <Ionicons name="close-circle" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderActionButtons = () => {
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.actionButtons}
        contentContainerStyle={styles.actionButtonsContent}
      >
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handlePickImage}
          activeOpacity={0.7}
        >
          <Ionicons name="image-outline" size={24} color="#3797EF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowMovieReview(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="film-outline" size={24} color="#3797EF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowSongReview(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="musical-notes-outline" size={24} color="#3797EF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAddLocation}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={selectedLocation ? "location" : "location-outline"} 
            size={24} 
            color={selectedLocation ? "#34C759" : "#3797EF"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowEventModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={selectedEventId ? "calendar" : "calendar-outline"} 
            size={24} 
            color={selectedEventId ? "#34C759" : "#3797EF"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('CreateEventScreen')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#3797EF" />
        </TouchableOpacity>
      </ScrollView>
    );
  };


  const renderEventItem = ({ item: event }) => {
    const isSelected = selectedEventId === event._id;
    
    return (
      <TouchableOpacity
        style={[styles.eventItem, isSelected && styles.eventItemSelected]}
        onPress={() => selectEvent(event)}
        activeOpacity={0.8}
      >
        <View style={styles.eventItemContent}>
          <View style={[styles.eventIcon, isSelected && styles.eventIconSelected]}>
            <Ionicons 
              name="calendar" 
              size={20} 
              color={isSelected ? "#FFFFFF" : "#3797EF"} 
            />
          </View>
          <View style={styles.eventDetails}>
            <Text style={[styles.eventTitle, isSelected && styles.eventTitleSelected]}>
              {event.title}
            </Text>
            <Text style={styles.eventDate}>
              {new Date(event.time).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#34C759" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#000000" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.postButton, !canPost() && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={!canPost() || publishing}
        >
          {publishing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[
              styles.postButtonText,
              !canPost() && styles.postButtonTextDisabled
            ]}>
              Post
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
        {/* User Avatar and Text Input */}
        <View style={styles.inputContainer}>
          {currentUser?.profilePicture ? (
            <Image
              source={{ uri: currentUser.profilePicture }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
          )}
          
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            multiline
            value={textContent}
            onChangeText={setTextContent}
            placeholder="What's happening?"
            placeholderTextColor="#8E8E93"
            maxLength={MAX_TEXT_LENGTH}
            textAlignVertical="top"
            autoFocus
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          />
        </View>

        {/* Character Count */}
        {textContent.length > 0 && (
          <View style={styles.characterCountContainer}>
            <Text style={[
              styles.characterCount,
              textContent.length > MAX_TEXT_LENGTH * 0.9 && styles.characterCountWarning
            ]}>
              {textContent.length}/{MAX_TEXT_LENGTH}
            </Text>
          </View>
        )}

        {/* Review Preview */}
        {review && (
          <View style={styles.reviewPreviewContainer}>
            <View style={styles.reviewPreviewHeader}>
              <Text style={styles.reviewPreviewTitle}>
                {review.type === 'movie' ? 'Movie Review' : 'Song Review'}
              </Text>
              <TouchableOpacity onPress={() => setReview(null)}>
                <Ionicons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <ReviewCard review={review} />
          </View>
        )}

        {/* Image Previews */}
        {renderImagePreview()}

        {/* Location Preview */}
        {selectedLocation && (
          <View style={styles.locationPreview}>
            <Ionicons name="location" size={16} color="#3797EF" />
            <Text style={styles.locationText}>{selectedLocation.name}</Text>
            <TouchableOpacity onPress={() => setSelectedLocation(null)}>
              <Ionicons name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        )}

        {/* Event Preview */}
        {selectedEventId && (
          <View style={styles.eventPreview}>
            <Ionicons name="calendar" size={16} color="#34C759" />
            <Text style={styles.eventPreviewText}>
              {myEvents.find(e => e._id === selectedEventId)?.title || 'Selected Event'}
            </Text>
            <TouchableOpacity onPress={() => setSelectedEventId('')}>
              <Ionicons name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>

        {/* Action Buttons - Fixed at bottom, moves with keyboard */}
        <View style={[styles.actionButtonsContainer, { marginBottom: keyboardHeight > 0 ? 0 : 0 }]}>
          {renderActionButtons()}
        </View>
      </KeyboardAvoidingView>

      {/* Event Selection Modal */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEventModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEventModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Event</Text>
            <TouchableOpacity onPress={() => {
              setSelectedEventId('');
              setShowEventModal(false);
            }}>
              <Text style={styles.modalClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={myEvents}
            keyExtractor={item => item._id}
            renderItem={renderEventItem}
            contentContainerStyle={styles.eventsList}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>

      {/* Review Selectors */}
      <MovieReviewSelector
        visible={showMovieReview}
        onClose={() => setShowMovieReview(false)}
        onSelect={handleReviewSelect}
      />

      <SongReviewSelector
        visible={showSongReview}
        onClose={() => setShowSongReview(false)}
        onSelect={handleReviewSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  headerButton: {
    padding: 4,
  },
  postButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  postButtonTextDisabled: {
    color: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 20,
    color: '#000000',
    minHeight: 100,
    maxHeight: 500,
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 0,
  },
  characterCountContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  characterCountWarning: {
    color: '#FF3B30',
  },
  reviewPreviewContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  reviewPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  imagesContainer: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  imagePreviewWrapper: {
    marginRight: 12,
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#E1E1E1',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#3797EF',
  },
  eventPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: '#F0F9F0',
    borderRadius: 8,
    gap: 8,
  },
  eventPreviewText: {
    flex: 1,
    fontSize: 14,
    color: '#34C759',
  },
  actionButtonsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  actionButtons: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  actionButtonsContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 16,
  },
  actionButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  modalClear: {
    fontSize: 16,
    color: '#FF3B30',
  },
  eventsList: {
    padding: 16,
  },
  eventItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  eventItemSelected: {
    backgroundColor: '#F0F9F0',
    borderColor: '#34C759',
  },
  eventItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventIconSelected: {
    backgroundColor: '#34C759',
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  eventTitleSelected: {
    color: '#34C759',
  },
  eventDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
