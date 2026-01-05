// screens/CreateEventScreen.js - Phase 2: Simplified Privacy + Form Toggle + Photos
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, Image, Alert, ScrollView,
  Switch, TouchableOpacity, Modal, FlatList, SafeAreaView, StatusBar,
  Animated, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useActionSheet } from '@expo/react-native-action-sheet';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { fetchNominatimSuggestions } from '../services/locationApi';
import PaymentSetupComponent from '../components/PaymentSetupComponent';
import SimplifiedEventPrivacySettings from '../components/SimplifiedEventPrivacySettings';
import { FEATURES } from '../config/features';
import CoverPhotoSelectionModal from '../components/CoverPhotoSelectionModal';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PERMISSION_PRESETS = {
  public: {
    canView: 'anyone',
    canJoin: 'anyone',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  },
  friends: {
    canView: 'followers',
    canJoin: 'followers',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: false
  },
  private: {
    canView: 'invited-only',
    canJoin: 'invited-only',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: false,
    appearInSearch: false,
    showAttendeesToPublic: false
  }
};
// PHASE 2: Simplified Privacy Levels (auto-calculated permissions)
const PRIVACY_LEVELS = [
  { 
    key: 'public', 
    label: 'Public', 
    desc: 'Anyone can see and join', 
    icon: 'globe-outline',
    color: '#3797EF'
  },
  { 
    key: 'friends', 
    label: 'Friends Only', 
    desc: 'Only your followers can see', 
    icon: 'people-outline',
    color: '#34C759'
  },
  { 
    key: 'private', 
    label: 'Private', 
    desc: 'Invite-only, but guests can share', 
    icon: 'lock-closed-outline',
    color: '#FF9500'
  }
];

const CATEGORIES = [
  'Party', 'Music', 'Workshop', 'Meetup'
];

// PHASE 2: Smart form recommendations based on category
const FORM_RECOMMENDATIONS = {
  'Club': {
    title: 'Club meetings often need attendance tracking',
    suggestions: ['Member check-in', 'Contact info collection']
  },
  'Meeting': {
    title: 'Professional meetings benefit from check-in forms',
    suggestions: ['Attendee verification', 'Department tracking']
  },
  'Business': {
    title: 'Business events need professional data collection',
    suggestions: ['Contact information', 'Company details']
  },
  'Education': {
    title: 'Educational events often require registration info',
    suggestions: ['Student verification', 'Academic details']
  }
};

const REFUND_POLICIES = [
  { key: 'no-refund', label: 'No Refunds' },
  { key: 'full-refund-24h', label: 'Full Refund (24h before)' },
  { key: 'full-refund-7d', label: 'Full Refund (7 days before)' },
  { key: 'partial-refund', label: 'Partial Refunds' }
];

export default function CreateEventScreen({ navigation, route }) {
  const { groupId } = route.params || {};
  const { currentUser } = useContext(AuthContext);

  // Basic event fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [endDateTime, setEndDateTime] = useState(null);  // Optional
  const [locQuery, setLocQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);
  const [category, setCategory] = useState('Party');
  const [cover, setCover] = useState(null);
  const [hideGuestList, setHideGuestList] = useState(false); 

  // Advanced fields (Step 2)
  const [maxAttendees, setMaxAttendees] = useState('');
  const [price, setPrice] = useState('0');
  
  // PHASE 2: Simplified privacy (no redundant toggles)
  const [privacyLevel, setPrivacyLevel] = useState('public');

  // ADDED: Photo sharing toggle
  const [allowPhotos, setAllowPhotos] = useState(true);

  // PHASE 2: Form integration
  const [requiresCheckInForm, setRequiresCheckInForm] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [availableForms, setAvailableForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);

  // Payment fields
  const [isPaidEvent, setIsPaidEvent] = useState(false);
  const [priceDescription, setPriceDescription] = useState('');
  const [refundPolicy, setRefundPolicy] = useState('no-refund');
  const [earlyBirdEnabled, setEarlyBirdEnabled] = useState(false);
  const [earlyBirdPrice, setEarlyBirdPrice] = useState('');
  const [earlyBirdDeadline, setEarlyBirdDeadline] = useState(new Date());
  const [showEarlyBirdDatePicker, setShowEarlyBirdDatePicker] = useState(false);
  const [showRefundPolicyModal, setShowRefundPolicyModal] = useState(false);

  // Payment setup state
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);

  // Co-hosts management
  const [coHosts, setCoHosts] = useState([]);
  const [showCoHostModal, setShowCoHostModal] = useState(false);
  const [coHostSearchQuery, setCoHostSearchQuery] = useState('');
  const [coHostSearchResults, setCoHostSearchResults] = useState([]);
  const [searchingCoHosts, setSearchingCoHosts] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  // UI state
  const [creating, setCreating] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverSource, setCoverSource] = useState(null); // 'template' | 'upload'
  const [coverImageDimensions, setCoverImageDimensions] = useState({ width: 0, height: 0 });
  const [coverHeight, setCoverHeight] = useState(400);
  const HEADER_MAX_HEIGHT = 400;
  const HEADER_MIN_HEIGHT = 150;
  
  // Handle navigation params from date picker screen
  useEffect(() => {
    if (route.params?.startDateTime) {
      setDateTime(new Date(route.params.startDateTime));
    }
    if (route.params?.endDateTime) {
      setEndDateTime(new Date(route.params.endDateTime));
    } else if (route.params?.endDateTime === null) {
      setEndDateTime(null);
    }
  }, [route.params]);

  useEffect(() => {
    checkPaymentStatus();
    
    navigation.setOptions({
      headerShown: false,
    });
  }, [title, location, dateTime, creating, coHosts, isPaidEvent, price, requiresCheckInForm, selectedForm]);

  // Debug: Log initial dimensions
  useEffect(() => {
    console.log('🎬 CreateEventScreen mounted:', {
      SCREEN_WIDTH,
      coverHeight,
      cover: cover ? 'has cover' : 'no cover',
      HEADER_MIN_HEIGHT,
      HEADER_MAX_HEIGHT: 600
    });
  }, []);

  // PHASE 2: Load available forms when user wants to add form
  const loadAvailableForms = async () => {
    try {
      setLoadingForms(true);
      const response = await api.get('/api/forms/my-forms');
      setAvailableForms(response.data.forms || []);
    } catch (error) {
      console.error('Failed to load forms:', error);
      Alert.alert('Error', 'Failed to load your forms');
    } finally {
      setLoadingForms(false);
    }
  };

  // Payment functions
  const checkPaymentStatus = async () => {
    try {
      const response = await api.get('/api/events/payment-status');
      setPaymentStatus(response.data);
    } catch (err) {
      console.error('Failed to check payment status:', err);
    }
  };

  const handlePaidEventToggle = (value) => {
    if (value && !paymentStatus?.canReceivePayments) {
      setShowPaymentSetup(true);
      return;
    }
    
    setIsPaidEvent(value);
    if (!value) {
      setPrice('0');
      setPriceDescription('');
      setEarlyBirdEnabled(false);
      setEarlyBirdPrice('');
    }
  };

  // PHASE 2: Form requirement toggle with smart recommendations
  const handleFormToggle = (value) => {
    setRequiresCheckInForm(value);
    if (!value) {
      setSelectedForm(null);
    } else {
      // Load forms when toggled on
      loadAvailableForms();
    }
  };

  // PHASE 2: Handle form selection
  const handleFormSelect = (form) => {
    setSelectedForm(form);
    setShowFormModal(false);
  };

  const handleCreateNewForm = () => {
    setShowFormModal(false);
    navigation.navigate('FormBuilderScreen', {
      onFormCreated: (newForm) => {
        setSelectedForm(newForm);
        loadAvailableForms(); // Refresh the list
      }
    });
  };

  const calculateEstimatedEarnings = (priceValue) => {
    const amount = parseFloat(priceValue);
    if (isNaN(amount) || amount <= 0) return '0.00';
    const stripeFee = (amount * 0.029) + 0.30;
    const earnings = Math.max(0, amount - stripeFee);
    return earnings.toFixed(2);
  };

  const validatePricing = () => {
    if (!isPaidEvent) return true;
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Error', 'Event price must be greater than $0');
      return false;
    }
    
    if (earlyBirdEnabled) {
      const earlyPrice = parseFloat(earlyBirdPrice);
      if (isNaN(earlyPrice) || earlyPrice <= 0) {
        Alert.alert('Error', 'Early bird price must be greater than $0');
        return false;
      }
      if (earlyPrice >= priceNum) {
        Alert.alert('Error', 'Early bird price must be less than regular price');
        return false;
      }
    }
    
    return true;
  };

  // Search for potential co-hosts
  const searchCoHosts = async (query) => {
  if (!query.trim()) {
    setCoHostSearchResults([]);
    return;
  }

  try {
    setSearchingCoHosts(true);
    const response = await api.get(`/api/users/search`, {
      params: { q: query, limit: 10 }
    });
    
    // ✅ FIX: Handle both response formats from backend
    let users = [];
    if (response.data && Array.isArray(response.data.users)) {
      users = response.data.users;
    } else if (Array.isArray(response.data)) {
      users = response.data;
    } else {
      console.warn('❌ Unexpected search response format:', response.data);
      users = [];
    }
    
    // Filter out current user and already selected co-hosts
    const results = users.filter(user => 
      user && user._id && 
      user._id !== currentUser._id && 
      !coHosts.some(coHost => coHost._id === user._id)
    );
    
    console.log('✅ CreateEvent cohost search results:', results);
    setCoHostSearchResults(results);
  } catch (error) {
    console.error('Error searching co-hosts:', error);
    setCoHostSearchResults([]);
  } finally {
    setSearchingCoHosts(false);
  }
};

  const addCoHost = (user) => {
    setCoHosts(prev => [...prev, user]);
    setCoHostSearchQuery('');
    setCoHostSearchResults([]);
  };

  const removeCoHost = (userId) => {
    setCoHosts(prev => prev.filter(coHost => coHost._id !== userId));
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCoHosts(coHostSearchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [coHostSearchQuery]);

  const canProceed = () => {
  // Basic validation for all required fields
  const basicValidation = title.trim() && location.trim() && dateTime > new Date();
  
  // End time validation
  if (endDateTime && endDateTime <= dateTime) {
    Alert.alert('Error', 'End time must be after start time');
    return false;
  }
  
  // Form requirement validation
  if (requiresCheckInForm && !selectedForm) {
    return false;
  }
  
  return basicValidation && validatePricing();
};

  const handleCreate = async () => {
     if ((isPaidEvent && !FEATURES.PAYMENTS) || (requiresCheckInForm && !FEATURES.EVENT_FORMS)) {
    Alert.alert('Feature Unavailable', 'This feature is temporarily disabled.');
    return;
  }

  if (!canProceed() || creating) return;

  try {
    setCreating(true);

    const formData = new FormData();
    
    // Basic fields
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('time', dateTime.toISOString());
    if (endDateTime) {
      formData.append('endTime', endDateTime.toISOString());
    }
    formData.append('location', location.trim());
    formData.append('category', category);
    formData.append('maxAttendees', maxAttendees && maxAttendees.trim() !== '' ? parseInt(maxAttendees) || 0 : 0);
    formData.append('coverImageSource', coverSource || 'upload');
    // PHASE 1: Only send privacy level - backend sets appropriate permissions
    formData.append('privacyLevel', privacyLevel);
    formData.append('allowGuestPasses', true); // Enable guest passes for all privacy levels
    formData.append('hideGuestList', hideGuestList);
    
      // PHASE 2: Form integration
      if (requiresCheckInForm && selectedForm) {
        formData.append('checkInFormId', selectedForm._id);
        formData.append('requiresFormForCheckIn', true);
      }
      
      // Enhanced pricing fields
      formData.append('isPaidEvent', isPaidEvent);
      if (isPaidEvent) {
        formData.append('eventPrice', price);
        if (priceDescription) formData.append('priceDescription', priceDescription);
        formData.append('refundPolicy', refundPolicy);
        formData.append('earlyBirdEnabled', earlyBirdEnabled);
        if (earlyBirdEnabled) {
          formData.append('earlyBirdPrice', earlyBirdPrice);
          formData.append('earlyBirdDeadline', earlyBirdDeadline.toISOString());
        }
      } else {
        formData.append('eventPrice', '0');
      }
      
      // Co-hosts
      formData.append('coHosts', JSON.stringify(coHosts.map(coHost => coHost._id)));

      // Coordinates if available
      if (coords) {
        formData.append('coordinates', JSON.stringify(coords));
      }
      
      // Group ID if creating from group
      if (groupId) {
        formData.append('groupId', groupId);
      }
      
      // Cover image
      // Cover image
if (cover) {
  if (coverSource === 'template') {
    // For template assets, cover is already a resolved URI object
    console.log('📷 Using template cover:', cover);
    
    formData.append('coverImage', {
      uri: cover.uri,
      type: 'image/jpeg',
      name: 'template-cover.jpg',
    });
  } else {
    // Regular uploads
    console.log('📷 Using uploaded cover:', cover);
    
    formData.append('coverImage', {
      uri: cover.uri || cover,
      type: 'image/jpeg', 
      name: 'cover.jpg',
    });
  }
  
  formData.append('coverImageSource', coverSource);
}

      const response = await api.post('/api/events/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert(
        'Success!',
        'Your event has been created successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('EventDetailsScreen', { 
                eventId: response.data._id 
              });
            }
          }
        ]
      );

    } catch (error) {
      console.error('Event creation error:', error);
      
      if (error.response?.data?.needsPaymentSetup) {
        setShowPaymentSetup(true);
      } else {
        Alert.alert(
          'Error',
          error.response?.data?.message || 'Failed to create event. Please try again.'
        );
      }
    } finally {
      setCreating(false);
    }
  };
const pickCoverImage = () => {
  setShowCoverModal(true);
};

// // Add these helper functions for gallery and camera
// const pickFromGallery = async () => {
//   const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
//   if (permissionResult.granted === false) {
//     Alert.alert('Permission Required', 'Permission to access camera roll is required!');
//     return;
//   }

//   const result = await ImagePicker.launchImageLibraryAsync({
//     mediaTypes: ImagePicker.MediaTypeOptions.Images,
//     allowsEditing: true,
//     aspect: [16, 9],
//     quality: 0.8,
//   });

//   if (!result.canceled) {
//     setCover(result.assets[0].uri);
//     setCoverSource('upload');
//   }
// };

// const takePhoto = async () => {
//   const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
  
//   if (permissionResult.granted === false) {
//     Alert.alert('Permission Required', 'Permission to access camera is required!');
//     return;
//   }

//   const result = await ImagePicker.launchCameraAsync({
//     allowsEditing: true,
//     aspect: [16, 9],
//     quality: 0.8,
//   });

//   if (!result.canceled) {
//     setCover(result.assets[0].uri);
//     setCoverSource('upload');
//   }
// };
  const handleCoverSelect = (imageSource, sourceType) => {
  console.log('🖼️ Cover selected:', { sourceType, imageSource });
  
  let imageUri;
  if (sourceType === 'template') {
    // For templates, imageSource is a require() object
    // We need to resolve it to get the URI
    const resolvedSource = Image.resolveAssetSource(imageSource);
    console.log('📷 Resolved template URI:', resolvedSource.uri);
    imageUri = resolvedSource.uri;
    setCover({ uri: imageUri });
    // Get dimensions from resolved source
    if (resolvedSource.width && resolvedSource.height) {
      const aspectRatio = resolvedSource.height / resolvedSource.width;
      const calculatedHeight = SCREEN_WIDTH * aspectRatio;
      setCoverHeight(Math.max(HEADER_MIN_HEIGHT, Math.min(calculatedHeight, 600)));
      setCoverImageDimensions({ width: resolvedSource.width, height: resolvedSource.height });
    }
  } else {
    // For uploaded images, imageSource should already be a URI
    imageUri = imageSource;
    setCover(imageSource);
    // Get image dimensions
    Image.getSize(imageUri, (width, height) => {
      const aspectRatio = height / width;
      const calculatedHeight = SCREEN_WIDTH * aspectRatio;
      setCoverHeight(Math.max(HEADER_MIN_HEIGHT, Math.min(calculatedHeight, 600)));
      setCoverImageDimensions({ width, height });
    }, (error) => {
      console.error('Error getting image size:', error);
      setCoverHeight(340);
    });
  }
  
  setCoverSource(sourceType);
  console.log('📷 Cover set - Source type:', sourceType);
};

  const onEarlyBirdDateChange = (event, selectedDate) => {
    setShowEarlyBirdDatePicker(false);
    if (selectedDate) {
      setEarlyBirdDeadline(selectedDate);
    }
  };

  const onLocQuery = async (text) => {
    setLocQuery(text);
    if (text.length > 2) {
      try {
        const results = await fetchNominatimSuggestions(text);
        setSuggestions(results.slice(0, 5));
      } catch (error) {
        console.error('Location search error:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const selectLocation = (suggestion) => {
    setLocation(suggestion.display_name);
    setLocQuery(suggestion.display_name);
    setCoords([parseFloat(suggestion.lon), parseFloat(suggestion.lat)]);
    setSuggestions([]);
  };


  return (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header Overlay - Consistent styling */}
      <View style={styles.safeAreaHeader} pointerEvents="box-none">
        <View style={styles.headerOverlay} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerCancelButton}
          >
            <Text style={styles.headerCancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Create New Event</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* Cover Photo Section at Top - Hero Container */}
        <View 
          style={[
            styles.heroContainer,
            { 
              height: coverHeight,
              backgroundColor: 'transparent',
              marginTop: 0,
              paddingTop: 0,
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.coverTouchable}
            onPress={() => setShowCoverModal(true)}
            activeOpacity={0.9}
          >
            {cover ? (
              <Image 
                source={typeof cover === 'string' ? { uri: cover } : cover} 
                style={[
                  styles.heroImage,
                  { 
                    width: SCREEN_WIDTH,
                    height: coverHeight,
                  }
                ]}
                resizeMode="cover"
                onLoad={(e) => {
                  const { width, height } = e.nativeEvent.source;
                  console.log('🖼️ Image loaded:', { 
                    sourceWidth: width, 
                    sourceHeight: height,
                    screenWidth: SCREEN_WIDTH,
                    coverHeight,
                  });
                  if (width && height) {
                    const aspectRatio = height / width;
                    const calculatedHeight = SCREEN_WIDTH * aspectRatio;
                    const finalHeight = Math.max(HEADER_MIN_HEIGHT, Math.min(calculatedHeight, 600));
                    console.log('📐 Height calculation:', {
                      aspectRatio,
                      calculatedHeight,
                      finalHeight,
                      HEADER_MIN_HEIGHT
                    });
                    setCoverHeight(finalHeight);
                    setCoverImageDimensions({ width, height });
                  }
                }}
                onError={(error) => {
                  console.error('❌ Image load error:', error);
                }}
              />
            ) : (
              <View 
                style={[
                  styles.coverPlaceholder,
                  {
                    width: SCREEN_WIDTH,
                    height: coverHeight,
                  }
                ]}
              >
                <View style={styles.coverIconContainer}>
                  <Ionicons name="add-a-photo" size={32} color="#8E8E93" />
                </View>
                <Text style={styles.coverPlaceholderText}>Add Cover Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.formContainerWrapper}>
          <View style={styles.formContainer}>
            
            {/* Event Name - Large Input */}
    <View style={styles.eventNameContainer}>
      <TextInput
        style={styles.eventNameInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Event Name"
        placeholderTextColor="#C7C7CC"
      />
    </View>

    {/* Description with Character Counter */}
    <View style={styles.descriptionContainer}>
      <TextInput
        style={styles.descriptionInput}
        value={description}
        onChangeText={setDescription}
        placeholder="Tell people what your event is about..."
        placeholderTextColor="#8E8E93"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        maxLength={500}
      />
      <Text style={styles.characterCounter}>
        {description.length}/500
      </Text>
    </View>

    {/* Category Pills */}
    <View style={styles.categorySection}>
      <Text style={styles.categoryLabel}>CATEGORY</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryPillsContainer}
        contentContainerStyle={styles.categoryPillsContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryPill,
              category === cat && styles.categoryPillSelected
            ]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[
              styles.categoryPillText,
              category === cat && styles.categoryPillTextSelected
            ]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>

          {/* When */}
          <View style={styles.whenWhereSection}>
            <TouchableOpacity
              style={styles.whenCard}
              onPress={() => navigation.navigate('EventDateTimePickerScreen', {
                startDateTime: dateTime ? dateTime.toISOString() : new Date().toISOString(),
                endDateTime: endDateTime ? endDateTime.toISOString() : null
              })}
              activeOpacity={0.7}
            >
              <View style={styles.whenCardIcon}>
                <Ionicons name="calendar-month" size={20} color="#3b82f6" />
              </View>
              <View style={styles.whenCardContent}>
                <Text style={styles.whenCardLabel}>When</Text>
                <Text style={styles.whenCardValue}>
                  {dateTime ? `${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Select Date & Time'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
            </TouchableOpacity>

            {/* Where */}
            <View style={styles.whereCard}>
              <View style={styles.whereCardIcon}>
                <Ionicons name="location-on" size={20} color="#3b82f6" />
              </View>
              <View style={styles.whereCardContent}>
                <Text style={styles.whereCardLabel}>Where</Text>
                <TextInput
                  style={styles.whereCardInput}
                  value={locQuery}
                  onChangeText={onLocQuery}
                  placeholder="Location or Address"
                  placeholderTextColor="#8E8E93"
                />
              </View>
              <Ionicons name="search" size={20} color="#8E8E93" />
            </View>
            
            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => selectLocation(suggestion)}
                  >
                    <Ionicons name="location-outline" size={16} color="#8E8E93" />
                    <Text style={styles.suggestionText}>{suggestion.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Combined Settings Section: Privacy, Hosts, Max Attendees, Hide Guest List */}
          <View style={styles.combinedSettingsSection}>
            {/* Privacy Control */}
            <View style={styles.combinedSectionItem}>
              <Text style={styles.combinedSectionLabel}>PRIVACY CONTROL</Text>
              <TouchableOpacity
                style={styles.privacySelectButton}
                onPress={() => setShowPrivacyModal(true)}
              >
                <Text style={styles.privacySelectText}>
                  {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.label || 'Public'} Event
                </Text>
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Hosts */}
            <View style={styles.combinedSectionItem}>
              <Text style={styles.combinedSectionLabel}>HOSTS</Text>
              <View style={styles.hostsRow}>
                <View style={styles.hostItem}>
                  <View style={styles.hostAvatarContainer}>
                    {currentUser?.profilePicture ? (
                      <Image 
                        source={{ uri: currentUser.profilePicture }} 
                        style={styles.hostAvatar} 
                      />
                    ) : (
                      <View style={styles.hostAvatarPlaceholder}>
                        <Text style={styles.hostAvatarText}>
                          {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                
                {coHosts.length > 0 && (
                  coHosts.map((coHost) => (
                    <View key={coHost._id} style={styles.hostItem}>
                      <View style={styles.hostAvatarContainer}>
                        {coHost.profilePicture ? (
                          <Image 
                            source={{ uri: coHost.profilePicture }} 
                            style={styles.hostAvatar} 
                          />
                        ) : (
                          <View style={styles.hostAvatarPlaceholder}>
                            <Text style={styles.hostAvatarText}>
                              {coHost.username.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => removeCoHost(coHost._id)}
                        style={styles.removeHostButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <TouchableOpacity
                  style={styles.addCoHostButtonNew}
                  onPress={() => setShowCoHostModal(true)}
                >
                  <Ionicons name="add-circle" size={20} color="#3b82f6" />
                  <Text style={styles.addCoHostButtonTextNew}>Add Co-host</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.combinedSectionDivider} />

            {/* Max Attendees */}
            <View style={styles.combinedSectionItem}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Max Attendees</Text>
                  <Text style={styles.settingSubtitle}>Limit number of guests</Text>
                </View>
                <View style={styles.maxAttendeesContainer}>
                  <TextInput
                    style={styles.maxAttendeesInput}
                    value={maxAttendees}
                    onChangeText={setMaxAttendees}
                    placeholder="N/A"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    textAlign="center"
                  />
                </View>
              </View>
            </View>

            {/* Hide Guest List */}
            <View style={styles.combinedSectionItem}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Hide Guest List</Text>
                  <Text style={styles.settingSubtitle}>Only hosts can see who's going</Text>
                </View>
                <Switch
                  value={hideGuestList}
                  onValueChange={setHideGuestList}
                  trackColor={{ false: '#E5E5EA', true: '#3b82f6' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
          {showPrivacyModal && (
  <Modal
    visible={showPrivacyModal}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowPrivacyModal(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Privacy Level</Text>
          <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        
        {PRIVACY_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.key}
            style={styles.privacyModalOption}
            onPress={() => {
              setPrivacyLevel(level.key);
              setShowPrivacyModal(false);
            }}
          >
            <View style={styles.privacyModalOptionContent}>
              <View style={[styles.privacyModalIcon, { backgroundColor: level.color + '20' }]}>
                <Ionicons 
                  name={level.icon} 
                  size={20} 
                  color={level.color} 
                />
              </View>
              <View style={styles.privacyModalText}>
                <Text style={styles.privacyModalLabel}>{level.label}</Text>
                <Text style={styles.privacyModalDesc}>{level.desc}</Text>
              </View>
            </View>
            {privacyLevel === level.key && (
              <Ionicons name="checkmark" size={20} color={level.color} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </Modal>
)}

          </View>
        </View>
      </ScrollView>

      {/* Fixed Create Event Button */}
      <View style={styles.createButtonContainer}>
        <TouchableOpacity
          style={[styles.createButton, (!canProceed() || creating) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canProceed() || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Create Event</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <Modal
  visible={showCategoryModal}
  transparent={true}
  animationType="slide"
  onRequestClose={() => setShowCategoryModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Select Category</Text>
        <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
          <Ionicons name="close" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.categoryItem}
            onPress={() => {
              setCategory(item);
              setShowCategoryModal(false);
            }}
          >
            <Text style={[
              styles.categoryText,
              category === item && styles.categoryTextSelected
            ]}>
              {item}
            </Text>
            {category === item && (
              <Ionicons name="checkmark" size={20} color="#3797EF" />
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  </View>
</Modal>



{showCoHostModal && (
  <Modal
    visible={showCoHostModal}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowCoHostModal(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.coHostModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Co-host</Text>
          <TouchableOpacity onPress={() => setShowCoHostModal(false)}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#C7C7CC" />
            <TextInput
              style={styles.searchInput}
              value={coHostSearchQuery}
              onChangeText={setCoHostSearchQuery}
              placeholder="Search for friends..."
              placeholderTextColor="#C7C7CC"
            />
          </View>
        </View>

        <FlatList
          style={styles.searchResultsList}
          data={coHostSearchResults}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchResultItem}
              onPress={() => addCoHost(item)}
            >
              <View style={styles.searchResultAvatar}>
                {item.profilePicture ? (
                  <Image 
                    source={{ uri: item.profilePicture }} 
                    style={styles.searchResultAvatarImage} 
                  />
                ) : (
                  <View style={styles.searchResultAvatarPlaceholder}>
                    <Text style={styles.searchResultAvatarText}>
                      {item.username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultName}>{item.username}</Text>
                {item.fullName && (
                  <Text style={styles.searchResultDisplayName}>{item.fullName}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptySearchResults}>
              <Text style={styles.emptySearchText}>
                {coHostSearchQuery ? 'No users found' : 'Start typing to search for friends'}
              </Text>
            </View>
          )}
        />
      </View>
    </View>
  </Modal>
)}
      {/* Modals */}
<Modal
  visible={showCategoryModal}
  transparent={true}
  animationType="slide"
  onRequestClose={() => setShowCategoryModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Select Category</Text>
        <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
          <Ionicons name="close" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.categoryItem}
            onPress={() => {
              setCategory(item);
              setShowCategoryModal(false);
            }}
          >
            <Text style={[
              styles.categoryText,
              category === item && styles.categoryTextSelected
            ]}>
              {item}
            </Text>
            {category === item && (
              <Ionicons name="checkmark" size={20} color="#3797EF" />
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  </View>
</Modal>

{showCoHostModal && (
  <Modal
    visible={showCoHostModal}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowCoHostModal(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.coHostModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Co-host</Text>
          <TouchableOpacity onPress={() => setShowCoHostModal(false)}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#C7C7CC" />
            <TextInput
              style={styles.searchInput}
              value={coHostSearchQuery}
              onChangeText={setCoHostSearchQuery}
              placeholder="Search for friends..."
              placeholderTextColor="#C7C7CC"
            />
          </View>
        </View>

        <FlatList
          style={styles.searchResultsList}
          data={coHostSearchResults}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchResultItem}
              onPress={() => addCoHost(item)}
            >
              <View style={styles.searchResultAvatar}>
                {item.profilePicture ? (
                  <Image 
                    source={{ uri: item.profilePicture }} 
                    style={styles.searchResultAvatarImage} 
                  />
                ) : (
                  <View style={styles.searchResultAvatarPlaceholder}>
                    <Text style={styles.searchResultAvatarText}>
                      {item.username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultName}>{item.username}</Text>
                {item.fullName && (
                  <Text style={styles.searchResultDisplayName}>{item.fullName}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptySearchResults}>
              <Text style={styles.emptySearchText}>
                {coHostSearchQuery ? 'No users found' : 'Start typing to search for friends'}
              </Text>
            </View>
          )}
        />
      </View>
    </View>
  </Modal>
)}

{showPaymentSetup && (
  <PaymentSetupComponent
    onPaymentSetupComplete={() => {
      setShowPaymentSetup(false);
      checkPaymentStatus();
      setIsPaidEvent(true);
    }}
    onClose={() => setShowPaymentSetup(false)}
  />
)}

<CoverPhotoSelectionModal
  visible={showCoverModal}
  onClose={() => setShowCoverModal(false)}
  onSelectCover={handleCoverSelect}
  eventTitle={title || "Your Event"}
/>

      {showPaymentSetup && (
        <PaymentSetupComponent
          onPaymentSetupComplete={() => {
            setShowPaymentSetup(false);
            checkPaymentStatus();
            setIsPaidEvent(true);
          }}
          onClose={() => setShowPaymentSetup(false)}
        />
      )}

      <CoverPhotoSelectionModal
        visible={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        onSelectCover={handleCoverSelect}
        eventTitle={title || "Your Event"}
      />
     </KeyboardAvoidingView>
   </View>
 );
 }

// Enhanced Styles with Photo Toggle additions
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Changed from #E5E7EB to prevent gray showing
    overflow: 'hidden',
    // No padding or margin - image should start at absolute top
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent so image shows through
    overflow: 'visible',
    // Ensure content starts at absolute top
    contentInset: { top: 0, bottom: 0, left: 0, right: 0 },
    contentOffset: { x: 0, y: 0 },
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  headerButtonTextDisabled: {
    color: '#C7C7CC',
  },

  safeAreaHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 0,
    left: 0,
    right: 0,
    zIndex: 100, // Above everything
    backgroundColor: 'transparent',
    // No background - completely transparent
  },
  // Header Overlay - Consistent styling
  headerOverlay: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  headerCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(10px)',
    zIndex: 1,
  },
  headerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSpacer: {
    width: 32,
  },

  // Hero Container - Stretchy header with proper clipping
  heroContainer: {
    width: '100%',
    backgroundColor: 'transparent', // Always transparent - image covers everything
    overflow: 'hidden', // Clip to container bounds - image extends beyond but is clipped
    position: 'relative',
    zIndex: 1, // Lower than form container so it can overlap
    elevation: 1, // Android
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    // Container starts at ABSOLUTE top of ScrollView - NO spacing whatsoever
  },
  coverTouchable: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden', // Clip to container - image extends beyond but is clipped
  },
  heroImage: {
    resizeMode: 'cover',
    backgroundColor: '#E5E7EB', // Opaque fallback - prevents transparency (should never show)
    position: 'absolute',
    // top, left, width, height are set dynamically via animated values
    // to ensure image ALWAYS covers container, even when stretched
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E5E7EB',
  },
  coverPlaceholderText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Form - Curved overlap with image
  formContainerWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24, // Overlap the image by 24px to show curved border
    zIndex: 10, // Above the hero container
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10, // Android - ensure it's above hero
    // Clip content but show the curved border
    overflow: 'hidden',
    position: 'relative', // Ensure proper stacking
  },
  formContainer: {
    padding: 24,
    paddingTop: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Date & Time
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateTimeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
  },

  // Location Suggestions
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  suggestionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },

  // Select Button
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  // PHASE 2: Form Toggle Styles
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  recommendationText: {
    marginLeft: 8,
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  recommendationDesc: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  formToggleContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
  },
  formToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formToggleText: {
    flex: 1,
    marginRight: 16,
  },
  formToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  formToggleDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  formSelectionContainer: {
    marginTop: 16,
  },
  selectedFormCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#B3D9FF',
  },
  selectedFormInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedFormText: {
    marginLeft: 12,
    flex: 1,
  },
  selectedFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  selectedFormDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  removeFormButton: {
    padding: 8,
  },
  formSelectionButtons: {
    gap: 12,
  },
  formSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  createFormButton: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  formSelectionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Payment-specific styles
  paymentStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusReady: {
    backgroundColor: '#E8F5E8',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  pricingConfig: {
    backgroundColor: '#F0F7FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  pricingSummary: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#000000',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  summaryLabelSmall: {
    fontSize: 12,
    color: '#8E8E93',
  },
  summaryValueSmall: {
    fontSize: 12,
    color: '#8E8E93',
  },
  summaryRowHighlight: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginTop: 4,
  },
  summaryLabelEarnings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  summaryValueEarnings: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34C759',
  },

  // Co-hosts
  coHostsList: {
    marginBottom: 16,
  },
  coHostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  coHostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coHostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  coHostAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  coHostAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coHostAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  coHostDetails: {
    flex: 1,
  },
  coHostName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  coHostRole: {
    fontSize: 14,
    color: '#8E8E93',
  },
  removeCoHostButton: {
    padding: 8,
  },
  addCoHostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  addCoHostButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Privacy Button (Main)
privacyButton: {
  backgroundColor: '#F8F8F8',
  borderRadius: 12,
  padding: 16,
},
privacyButtonContent: {
  flexDirection: 'row',
  alignItems: 'center',
},
privacyButtonText: {
  flex: 1,
  marginLeft: 12,
},
privacyLabel: {
  fontSize: 16,
  fontWeight: '600',
  color: '#000000',
},
privacyDesc: {
  fontSize: 14,
  color: '#8E8E93',
  marginTop: 2,
},

// Privacy Modal Options
privacyModalOption: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingVertical: 16,
  borderBottomWidth: 0.5,
  borderBottomColor: '#E5E5EA',
},
privacyModalOptionContent: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
privacyModalIcon: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},
privacyModalText: {
  flex: 1,
},
privacyModalLabel: {
  fontSize: 16,
  fontWeight: '600',
  color: '#000000',
  marginBottom: 2,
},
privacyModalDesc: {
  fontSize: 14,
  color: '#8E8E93',
},

  // Permissions
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  permissionLabel: {
    fontSize: 16,
    color: '#000000',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  coHostModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },

  // Category Modal
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  categoryText: {
    fontSize: 16,
    color: '#000000',
  },
  categoryTextSelected: {
    color: '#3797EF',
    fontWeight: '600',
  },

  // Privacy Modal
  privacyOption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  privacyOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  privacyOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  privacyOptionDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Form Selection Modal
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  formItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  formItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formItemText: {
    flex: 1,
    marginLeft: 12,
  },
  formItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  formItemDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  emptyFormsContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyFormsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
  },
  emptyFormsDesc: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  createFirstFormButton: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  createFirstFormButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Co-host Search
  searchContainer: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  searchResultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  searchResultAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  searchResultAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  searchResultDisplayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  emptySearchResults: {
    padding: 32,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  // Add these to your existing styles
coverPlaceholderSubtext: {
  fontSize: 14,
  color: '#C7C7CC',
  marginTop: 4,
  textAlign: 'center',
},
coverSourceIndicator: {
  position: 'absolute',
  top: 16,
  left: 16,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.7)',
  borderRadius: 12,
  paddingHorizontal: 8,
  paddingVertical: 4,
},
coverSourceText: {
  marginLeft: 4,
  fontSize: 12,
  fontWeight: '500',
  color: '#FFFFFF',
},
dateTimeText: {
  marginLeft: 8,
  fontSize: 16,
  color: '#000000',
},
coverPhotoButton: {
  backgroundColor: '#F8F8F8',
  borderRadius: 12,
  paddingVertical: 16,
  borderWidth: 1,
  borderColor: '#E5E5EA',
  borderStyle: 'dashed',
},
coverPhotoContent: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
coverPhotoText: {
  marginLeft: 8,
  fontSize: 16,
  fontWeight: '600',
  color: '#3797EF',
},
// Privacy Options
privacyOptionsContainer: {
  gap: 12,
},
privacyOption: {
  backgroundColor: '#F8F8F8',
  borderRadius: 12,
  padding: 16,
  borderWidth: 2,
  borderColor: 'transparent',
},
privacyOptionSelected: {
  borderColor: '#3797EF',
  backgroundColor: '#F0F8FF',
},
privacyOptionContent: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
privacyOptionIcon: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},
privacyOptionText: {
  flex: 1,
},
privacyOptionLabel: {
  fontSize: 16,
  fontWeight: '600',
  color: '#000000',
  marginBottom: 2,
},
privacyOptionDesc: {
  fontSize: 14,
  color: '#8E8E93',
},
labelRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},
clearButton: {
  paddingHorizontal: 12,
  paddingVertical: 4,
},
clearButtonText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#FF3B30',
},
addEndTimeButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#F8F8F8',
  borderRadius: 12,
  paddingVertical: 14,
  borderWidth: 1,
  borderColor: '#E5E5EA',
  borderStyle: 'dashed',
},
addEndTimeText: {
  marginLeft: 8,
  fontSize: 16,
  fontWeight: '600',
  color: '#3797EF',
},
// New Design Styles
scrollContent: {
  paddingBottom: 100,
  backgroundColor: 'transparent', // Don't cover the image
  paddingTop: 0, // NO padding at top - image starts at absolute top
  marginTop: 0, // NO margin at top
},
coverIconContainer: {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: 'rgba(255, 255, 255, 0.6)',
  justifyContent: 'center',
  alignItems: 'center',
  backdropFilter: 'blur(8px)',
},
// Debug overlay styles
debugOverlay: {
  position: 'absolute',
  top: 10,
  left: 10,
  backgroundColor: 'rgba(255, 0, 0, 0.7)',
  padding: 8,
  borderRadius: 8,
  zIndex: 1000,
  elevation: 1000,
},
debugText: {
  color: '#FFFFFF',
  fontSize: 10,
  fontWeight: 'bold',
  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
},
coverOverlayContent: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  justifyContent: 'center',
  alignItems: 'center',
},
eventNameContainer: {
  marginBottom: 16,
},
eventNameInput: {
  fontSize: 28,
  fontWeight: '700',
  color: '#000000',
  padding: 0,
  backgroundColor: 'transparent',
},
descriptionContainer: {
  marginBottom: 24,
  position: 'relative',
},
descriptionInput: {
  minHeight: 140,
  borderRadius: 16,
  borderWidth: 1,
  borderStyle: 'dashed',
  borderColor: '#E5E5EA',
  backgroundColor: '#F8F8F8',
  padding: 16,
  fontSize: 16,
  color: '#000000',
  textAlignVertical: 'top',
},
characterCounter: {
  position: 'absolute',
  bottom: 12,
  right: 12,
  fontSize: 12,
  color: '#8E8E93',
},
categorySection: {
  marginBottom: 24,
  marginLeft: -24,
  marginRight: -24,
},
categoryLabel: {
  fontSize: 11,
  fontWeight: '700',
  color: '#8E8E93',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 12,
  paddingHorizontal: 24,
},
categoryPillsContainer: {
  paddingHorizontal: 24,
},
categoryPillsContent: {
  paddingHorizontal: 0,
  gap: 10,
},
categoryPill: {
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 9999,
  backgroundColor: '#EFF6FF',
  borderWidth: 1,
  borderColor: '#DBEAFE',
},
categoryPillSelected: {
  backgroundColor: '#3b82f6',
  borderColor: '#3b82f6',
},
categoryPillText: {
  fontSize: 14,
  fontWeight: '500',
  color: '#3b82f6',
},
categoryPillTextSelected: {
  color: '#FFFFFF',
  fontWeight: '600',
},
whenWhereSection: {
  marginBottom: 24,
  gap: 12,
},
whenCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F8F9FA',
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: '#E2E8F0',
},
whenCardIcon: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#DBEAFE',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
whenCardContent: {
  flex: 1,
},
whenCardLabel: {
  fontSize: 12,
  fontWeight: '700',
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 2,
},
whenCardValue: {
  fontSize: 14,
  fontWeight: '600',
  color: '#1E293B',
},
whereCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F8F9FA',
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: '#E2E8F0',
},
whereCardIcon: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#DBEAFE',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
whereCardContent: {
  flex: 1,
},
whereCardLabel: {
  fontSize: 12,
  fontWeight: '700',
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 2,
},
whereCardInput: {
  fontSize: 14,
  fontWeight: '600',
  color: '#1E293B',
  padding: 0,
  backgroundColor: 'transparent',
},
combinedSettingsSection: {
  backgroundColor: '#F8F9FA',
  borderRadius: 16,
  padding: 20,
  marginBottom: 24,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  gap: 20,
},
combinedSectionItem: {
  // No margin - using gap on parent
},
combinedSectionLabel: {
  fontSize: 11,
  fontWeight: '700',
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 12,
},
combinedSectionDivider: {
  height: 1,
  backgroundColor: '#E2E8F0',
  marginVertical: 20,
},
privacySelectButton: {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  padding: 12,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
privacySelectText: {
  fontSize: 14,
  fontWeight: '500',
  color: '#1E293B',
},
hostsRow: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 12,
},
hostItem: {
  position: 'relative',
},
hostAvatarContainer: {
  position: 'relative',
},
hostAvatar: {
  width: 48,
  height: 48,
  borderRadius: 24,
  borderWidth: 2,
  borderColor: '#FFFFFF',
},
hostAvatarPlaceholder: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: '#3b82f6',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#FFFFFF',
},
hostAvatarText: {
  fontSize: 18,
  fontWeight: '600',
  color: '#FFFFFF',
},
removeHostButton: {
  position: 'absolute',
  top: -8,
  right: -8,
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
},
addCoHostButtonNew: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 12,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderStyle: 'dashed',
  borderColor: '#CBD5E1',
},
addCoHostButtonTextNew: {
  fontSize: 14,
  fontWeight: '600',
  color: '#475569',
},
settingsSection: {
  backgroundColor: '#F8F8F8',
  borderRadius: 16,
  padding: 20,
  marginBottom: 24,
  borderWidth: 1,
  borderColor: '#E5E5EA',
  gap: 20,
},
settingRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
settingInfo: {
  flex: 1,
},
settingTitle: {
  fontSize: 14,
  fontWeight: '700',
  color: '#000000',
  marginBottom: 4,
},
settingSubtitle: {
  fontSize: 12,
  color: '#8E8E93',
},
maxAttendeesContainer: {
  backgroundColor: '#FFFFFF',
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderWidth: 1,
  borderColor: '#E5E5EA',
  minWidth: 60,
},
maxAttendeesInput: {
  fontSize: 14,
  fontWeight: '700',
  color: '#000000',
  textAlign: 'center',
  minWidth: 40,
  padding: 0,
},
createButtonContainer: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  paddingHorizontal: 24,
  paddingTop: 16,
  paddingBottom: 32,
  borderTopWidth: 0.5,
  borderTopColor: '#E5E5EA',
  zIndex: 30, // Stay above scroll content and form
  elevation: 30, // Android
},
createButton: {
  backgroundColor: '#3b82f6',
  borderRadius: 12,
  paddingVertical: 16,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#3b82f6',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
},
createButtonDisabled: {
  backgroundColor: '#C7C7CC',
  shadowOpacity: 0,
  elevation: 0,
},
createButtonText: {
  color: '#FFFFFF',
  fontSize: 18,
  fontWeight: '700',
},
cancelHeaderButton: {
  fontSize: 16,
  color: '#000000',
  fontWeight: '500',
},
});