// screens/CreatePostScreen.js - X/Twitter-style Create Post Screen with horizontal media carousel
import React, { useState, useEffect, useContext, useRef, useLayoutEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, Image, Alert, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Dimensions, StatusBar,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Pressable
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
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_TEXT_LENGTH = 5000;
const CHARACTER_COUNTER_THRESHOLD = MAX_TEXT_LENGTH * 0.9; // Show counter at 90% of limit
const MAX_MEDIA_COUNT = 10; // Increased limit for carousel

export default function CreatePostScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const [textContent, setTextContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState([]); // Changed from selectedImages to support videos
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
  const mediaCarouselRef = useRef(null);

  useEffect(() => {
    requestLibraryPermission();
    fetchMyAttendingEvents();
  }, []);

  // Tab bar hiding is handled in MainTabNavigator.js - no need to do it here

  // Auto-focus text input
  useEffect(() => {
    const timer = setTimeout(() => {
      textInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
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

  const handlePickMedia = async () => {
    try {
      const remainingSlots = MAX_MEDIA_COUNT - selectedMedia.length;
      if (remainingSlots <= 0) {
        Alert.alert('Media Limit', `You can add up to ${MAX_MEDIA_COUNT} photos/videos per post.`);
        return;
      }

      Alert.alert(
        'Add Media',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Camera', 
            onPress: async () => {
              try {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
                  return;
                }

                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.All,
                  quality: 0.85,
                  allowsEditing: true,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                  const newMedia = result.assets.map(asset => ({
                    ...asset,
                    type: asset.type || (asset.uri.includes('.mp4') || asset.uri.includes('.mov') ? 'video' : 'image')
                  }));
                  setSelectedMedia([...selectedMedia, ...newMedia]);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              } catch (error) {
                console.error('Camera error:', error);
                Alert.alert('Error', 'Failed to take photo. Please try again.');
              }
            }
          },
          { 
            text: 'Photo Library', 
            onPress: async () => {
              try {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.All,
                  allowsMultipleSelection: remainingSlots > 1,
                  quality: 0.85,
                  selectionLimit: remainingSlots,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                  const newMedia = result.assets.map(asset => ({
                    ...asset,
                    type: asset.type || (asset.uri.includes('.mp4') || asset.uri.includes('.mov') ? 'video' : 'image')
                  }));
                  setSelectedMedia([...selectedMedia, ...newMedia]);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              } catch (error) {
                console.error('Media picker error:', error);
                Alert.alert('Error', 'Failed to pick media. Please try again.');
              }
            }
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Media picker error:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const handleRemoveMedia = (index) => {
    const newMedia = selectedMedia.filter((_, i) => i !== index);
    setSelectedMedia(newMedia);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePost = async () => {
    // Validate: must have text, media, or review
    if (!textContent.trim() && selectedMedia.length === 0 && !review) {
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

      // Filter images only for now (videos can be added later)
      const images = selectedMedia.filter(m => !m.type || m.type === 'image' || !m.uri.includes('.mp4'));

      if (images.length === 0 && !textContent.trim() && !review) {
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
        
        // Add all selected images
        images.forEach((image, index) => {
          const mimeType = image.mimeType || image.type || 'image/jpeg';
          const fileName = image.fileName || image.filename || `photo_${index}.jpg`;
          
          formData.append('photo', {
            uri: image.uri,
            type: mimeType,
            name: fileName,
          });  
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Success!',
      'Your post has been shared!',
      [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setTextContent('');
            setSelectedMedia([]);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectEvent = (event) => {
    setSelectedEventId(selectedEventId === event._id ? '' : event._id);
    setShowEventModal(false);
  };

  const canPost = () => {
    return (textContent.trim().length > 0 || selectedMedia.length > 0 || review) && 
           textContent.length <= MAX_TEXT_LENGTH;
  };

  // Calculate media dimensions based on aspect ratio
  const getMediaDimensions = (media, containerWidth) => {
    const isVideo = media.type === 'video' || media.uri?.includes('.mp4') || media.uri?.includes('.mov');
    const aspectRatio = media.width && media.height ? media.width / media.height : 1;
    
    // For images, use actual aspect ratio; for videos, default to 16:9
    const finalAspectRatio = isVideo ? 16/9 : (aspectRatio || 1);
    
    // Max height to prevent overflow - make it fit better on screen
    const maxHeight = SCREEN_WIDTH * 0.7; // Allow images to be larger
    const calculatedHeight = containerWidth / finalAspectRatio;
    const height = Math.min(calculatedHeight, maxHeight);
    
    return { width: containerWidth, height };
  };

  // Render horizontal swipeable media carousel
  const renderMediaCarousel = () => {
    if (selectedMedia.length === 0) return null;

    // Use full screen width for images - no padding
    const itemWidth = SCREEN_WIDTH;

    return (
      <View style={styles.mediaCarouselContainer}>
        <FlatList
          ref={mediaCarouselRef}
          data={selectedMedia}
          horizontal
          pagingEnabled={selectedMedia.length > 1}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `media-${index}`}
          renderItem={({ item, index }) => {
            const dimensions = getMediaDimensions(item, itemWidth);
            const isVideo = item.type === 'video' || item.uri?.includes('.mp4') || item.uri?.includes('.mov');
            
            return (
              <View style={[styles.mediaItem, { width: SCREEN_WIDTH }]}>
                <View style={[styles.mediaWrapper, { width: dimensions.width, height: dimensions.height }]}>
                  {isVideo ? (
                    <View style={[styles.videoPlaceholder, { width: dimensions.width, height: dimensions.height }]}>
                      <Ionicons name="play-circle" size={48} color="#FFFFFF" />
                      <Text style={styles.videoLabel}>Video</Text>
                    </View>
                  ) : (
                    <Image 
                      source={{ uri: item.uri }} 
                      style={[styles.mediaImage, { width: dimensions.width, height: dimensions.height }]}
                      resizeMode="cover"
                    />
                  )}
                  <TouchableOpacity
                    style={styles.removeMediaButton}
                    onPress={() => handleRemoveMedia(index)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.mediaCarouselContent}
          snapToInterval={SCREEN_WIDTH}
          decelerationRate="fast"
          scrollEventThrottle={16}
        />
        {/* Media indicator dots */}
        {selectedMedia.length > 1 && (
          <View style={styles.mediaIndicators}>
            {selectedMedia.map((_, index) => (
              <View key={index} style={styles.mediaIndicator} />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderActionButtons = () => {
    return (
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, selectedMedia.length >= MAX_MEDIA_COUNT && styles.actionButtonDisabled]}
          onPress={handlePickMedia}
          activeOpacity={0.7}
          disabled={selectedMedia.length >= MAX_MEDIA_COUNT}
        >
          <Ionicons 
            name="image-outline" 
            size={24} 
            color={selectedMedia.length >= MAX_MEDIA_COUNT ? "#C7C7CC" : "#3797EF"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Keyboard.dismiss();
            setTimeout(() => {
              setShowSongReview(true);
            }, 100);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="musical-notes-outline" size={24} color="#3797EF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Keyboard.dismiss();
            setTimeout(() => {
              setShowMovieReview(true);
            }, 100);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="film-outline" size={24} color="#3797EF" />
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
          onPress={() => navigation.navigate('CreateEvent')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#3797EF" />
        </TouchableOpacity>
      </View>
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

      <View style={styles.keyboardContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight > 0 ? 80 : 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* User Avatar and Text Input */}
          <View style={styles.inputContainer}>
            <View style={styles.avatarContainer}>
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
            </View>
            
            <View style={styles.textInputWrapper}>
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
                scrollEnabled={false}
              />
            </View>
          </View>
          
          {/* Media Carousel - Full width, below text input */}
          {renderMediaCarousel()}

          {/* Character Count - Only show when nearing limit */}
          {textContent.length >= CHARACTER_COUNTER_THRESHOLD && (
            <View style={styles.characterCountContainer}>
              <Text style={[
                styles.characterCount,
                textContent.length > MAX_TEXT_LENGTH * 0.95 && styles.characterCountWarning
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
                  {review.type === 'movie' ? '🎬 Movie Review' : '🎵 Music Review'}
                </Text>
                <TouchableOpacity onPress={() => setReview(null)}>
                  <Ionicons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              <ReviewCard review={review} />
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

        {/* Action Buttons - Fixed at bottom, positioned relative to keyboard */}
        <View style={[
          styles.actionBarContainer, 
          { 
            bottom: keyboardHeight > 0 ? keyboardHeight + 5 : Math.max(insets.bottom, 0),
            paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 8)
          }
        ]}>
          {renderActionButtons()}
        </View>
      </View>

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  avatarContainer: {
    marginRight: 12,
    marginTop: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputWrapper: {
    flex: 1,
  },
  textInput: {
    fontSize: 20,
    color: '#000000',
    minHeight: 120,
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 0,
    paddingLeft: 0,
    lineHeight: 28,
  },
  mediaCarouselContainer: {
    marginTop: 12,
    marginBottom: 8,
    width: SCREEN_WIDTH,
  },
  mediaCarouselContent: {
    alignItems: 'flex-start',
  },
  mediaItem: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaWrapper: {
    position: 'relative',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
    width: SCREEN_WIDTH,
  },
  mediaImage: {
    borderRadius: 0,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  videoLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  mediaIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  mediaIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
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
  actionBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
    paddingTop: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 24,
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
  },
  actionButtonDisabled: {
    opacity: 0.5,
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
