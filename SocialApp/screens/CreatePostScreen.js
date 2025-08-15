// screens/CreatePostScreen.js - Single Photo, 2 Steps
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Alert, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Animated, Dimensions, StatusBar,
  SafeAreaView, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CreatePostScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [myEvents, setMyEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    requestLibraryPermission();
    fetchMyAttendingEvents();
  }, []);

  useEffect(() => {
    // Animate step transitions
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: (step - 1) * -SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: step / 2,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start();
  }, [step]);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photo library to continue.');
    }
  };

  const fetchMyAttendingEvents = async () => {
    try {
      const res = await api.get('/events/my-photo-events');
      setMyEvents(res.data);
    } catch (err) {
      console.error(err.response?.data || err);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0]);
        goToStep(2);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const goToStep = (newStep) => {
    setStep(newStep);
  };

  const handlePost = async () => {
  if (!selectedImage) {
    Alert.alert('No Photo', 'Please select a photo to share.');
    return;
  }

  // ✅ Event selection is now optional

  try {
    setPublishing(true);

    const formData = new FormData();
    formData.append('photo', {
      uri: selectedImage.uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    });
    
    // ✅ Only include eventId if one is selected
    if (selectedEventId) {
      formData.append('eventId', selectedEventId);
    }
    
    if (caption.trim()) {
      formData.append('caption', caption.trim());
    }

    console.log('📤 Uploading photo:', selectedEventId ? `to event: ${selectedEventId}` : 'as general post');

    // ✅ Use different endpoints based on post type
    const endpoint = selectedEventId ? '/photos/upload' : '/photos/create';
    
    const response = await api.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('✅ Photo upload successful:', response.data);

    // Navigation logic (same as before)
    try {
      navigation.replace('PostPublished', {
        photoId: response.data._id,
        eventId: selectedEventId || null,
        imageUri: selectedImage.uri,
        isGeneralPost: !selectedEventId // ✅ Flag for general posts
      });
    } catch (navError) {
      console.warn('❌ Stack navigation failed, trying root navigation:', navError);
      
      try {
        navigation.navigate('PostPublishedScreen', {
          photoId: response.data._id,
          eventId: selectedEventId || null,
          imageUri: selectedImage.uri,
          isGeneralPost: !selectedEventId
        });
      } catch (rootNavError) {
        console.warn('❌ Root navigation failed, going back with success:', rootNavError);
        
        Alert.alert(
          'Success!',
          selectedEventId ? 'Your photo has been shared to the event!' : 'Your post has been shared to your feed!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    }

  } catch (error) {
    console.error('❌ Post creation error:', error);
    
    let errorMessage = 'Failed to share photo. Please try again.';
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    Alert.alert('Error', errorMessage);
  } finally {
    setPublishing(false);
  }
};


  const selectEvent = (event) => {
    setSelectedEventId(selectedEventId === event._id ? '' : event._id);
    setShowEventModal(false);
  };

  const renderProgressBar = () => (
  <View style={styles.progressContainer}>
    <View style={styles.progressBar}>
      <Animated.View style={[
        styles.progressFill,
        { width: progressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%']
        })}
      ]} />
    </View>
    {/* Removed the progress text line completely */}
  </View>
);

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2].map((stepNum) => (
        <View key={stepNum} style={styles.stepIndicatorContainer}>
          <View style={[
            styles.stepDot,
            step >= stepNum && styles.stepDotActive,
            step === stepNum && styles.stepDotCurrent
          ]}>
            {step > stepNum ? (
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            ) : (
              <Text style={[
                styles.stepNumber,
                step >= stepNum && styles.stepNumberActive
              ]}>
                {stepNum}
              </Text>
            )}
          </View>
          {stepNum < 2 && (
            <View style={[
              styles.stepConnector,
              step > stepNum && styles.stepConnectorActive
            ]} />
          )}
        </View>
      ))}
    </View>
  );

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

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Ionicons name="camera" size={32} color="#3797EF" />
        </View>
        <Text style={styles.stepTitle}>Choose Photo</Text>
        <Text style={styles.stepSubtitle}>
          Select a photo to share with your community
        </Text>
      </View>

      <View style={styles.imageContainer}>
        {selectedImage ? (
          <View style={styles.selectedImageContainer}>
            <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
            <TouchableOpacity 
              style={styles.changeImageButton}
              onPress={handlePickImage}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={20} color="#3797EF" />
              <Text style={styles.changeImageText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadArea} onPress={handlePickImage}>
            <View style={styles.uploadIcon}>
              <Ionicons name="cloud-upload-outline" size={48} color="#3797EF" />
            </View>
            <Text style={styles.uploadTitle}>Tap to select photo</Text>
            <Text style={styles.uploadSubtitle}>Choose from your photo library</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedImage && (
        <TouchableOpacity style={styles.primaryButton} onPress={() => goToStep(2)}>
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Ionicons name="create" size={32} color="#3797EF" />
        </View>
        <Text style={styles.stepTitle}>Write Caption</Text>
        <Text style={styles.stepSubtitle}>
          Add a caption and tag an event (optional)
        </Text>
      </View>

      {/* Photo Preview */}
      {selectedImage && (
        <View style={styles.photoPreview}>
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
        </View>
      )}

      <View style={styles.captionContainer}>
        <TextInput
          style={styles.captionInput}
          multiline
          value={caption}
          onChangeText={setCaption}
          placeholder="What's happening? Share your moment..."
          placeholderTextColor="#8E8E93"
          maxLength={2000}
          textAlignVertical="top"
        />
        <Text style={styles.characterCount}>
          {caption.length}/2000
        </Text>
      </View>

      <View style={styles.eventSection}>
        <Text style={styles.sectionTitle}>Tag an Event</Text>
        <Text style={styles.sectionSubtitle}>
          Link this post to an event you're attending
        </Text>
        
        <TouchableOpacity
  style={styles.eventSelector}
  onPress={() => setShowEventModal(true)}
  activeOpacity={0.7}
>
  <View style={styles.eventSelectorLeft}>
    <Ionicons 
      name={selectedEventId ? "calendar" : "calendar-outline"} 
      size={20} 
      color={selectedEventId ? "#34C759" : "#8E8E93"} 
    />
    <Text style={[
        styles.eventSelectorText,
        selectedEventId && styles.eventSelectorTextSelected
      ]}>
        {selectedEventId 
          ? myEvents.find(e => e._id === selectedEventId)?.title || 'Selected Event'
          : 'Link to event (optional)' // ✅ Make it clear it's optional
        }
      </Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
</TouchableOpacity>
      </View>

      <View style={styles.stepActions}>
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={() => goToStep(1)}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#3797EF" />
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.primaryButton, publishing && styles.primaryButtonDisabled]} 
          onPress={handlePost}
          disabled={publishing}
          activeOpacity={0.8}
        >
          {publishing ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Publishing...</Text>
            </>
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Share Post</Text>
              <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
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
        <Text style={styles.headerTitle}>Create Post</Text>
        <View style={styles.headerRight} />
      </View>

      {renderStepIndicator()}
      {renderProgressBar()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
          </View>
        </View>
      </ScrollView>

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
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
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
    width: 32,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F8F9FA',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#3797EF',
  },
  stepDotCurrent: {
    backgroundColor: '#3797EF',
    transform: [{ scale: 1.1 }],
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepConnector: {
    width: 60,
    height: 2,
    backgroundColor: '#E1E1E1',
    marginHorizontal: 12,
  },
  stepConnectorActive: {
    backgroundColor: '#3797EF',
  },

  // Progress Bar
  progressContainer: {
  paddingHorizontal: 40,  // ← Changed from 20 to 40 (narrower width)
  paddingBottom: 8,       // ← Changed from 16 to 8 (less space)
  backgroundColor: '#F8F9FA',
},
  progressBar: {
  width: '100%',
  height: 2,              // ← Changed from 4 to 2 (thinner bar)
  backgroundColor: '#E1E1E1',
  borderRadius: 1,        // ← Changed from 2 to 1 (proportional to height)
  overflow: 'hidden',
},
  progressFill: {
    height: '100%',
    backgroundColor: '#3797EF',
    borderRadius: 2,
  },

  // Content
  content: {
    flex: 1,
  },
  stepsContainer: {
    flex: 1,
  },
  step: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Step 1 - Photo Selection
  imageContainer: {
    marginBottom: 32,
  },
  selectedImageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: 280,
    height: 280,
    borderRadius: 16,
    backgroundColor: '#F6F6F6',
    marginBottom: 16,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },
  changeImageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 8,
  },
  uploadArea: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E1E1E1',
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Step 2 - Photo Preview
  photoPreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },

  // Caption
  captionContainer: {
    marginBottom: 24,
  },
  captionInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    maxHeight: 200,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 8,
  },
  eventSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  eventSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  eventSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eventSelectorText: {
    flex:1,
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 12,
  },
  eventSelectorTextSelected: {
    color: '#000000',
    fontWeight: '500',
  },

  // Action Buttons
  stepActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Event Modal
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
  eventSelectorLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,  // ← Add this line
},
});