// screens/CreateEventScreen.js - Phase 2: Simplified Privacy + Form Toggle + Photos
import React, { useState, useEffect, useRef, useContext } from 'react';
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
  'General', 'Party', 'Social', 'Meeting', 'Club', 'Education', 
  'Business', 'Professional', 'Entertainment', 'Music', 'Sports',
  'Food', 'Art', 'Technology', 'Health', 'Travel', 'Celebration'
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
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);
  const [category, setCategory] = useState('General');
  const [cover, setCover] = useState(null); 

  // Advanced fields (Step 2)
  const [maxAttendees, setMaxAttendees] = useState('50');
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
  const scrollY = useRef(new Animated.Value(0)).current;

  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverSource, setCoverSource] = useState(null); // 'template' | 'upload'
  useEffect(() => {
    checkPaymentStatus();
    
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: 'New Event',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleCreate}
          style={[styles.headerButton, (!canProceed() || creating) && styles.headerButtonDisabled]}
          disabled={!canProceed() || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.headerButtonText, (!canProceed() || creating) && styles.headerButtonTextDisabled]}>
              Create
            </Text>
          )}
        </TouchableOpacity>
      ),
          });
}, [title, location, dateTime, creating, coHosts, isPaidEvent, price, requiresCheckInForm, selectedForm]);

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
    formData.append('maxAttendees', parseInt(maxAttendees) || 0);
    formData.append('coverImageSource', coverSource || 'upload');
    // PHASE 1: Only send privacy level - backend sets appropriate permissions
    formData.append('privacyLevel', privacyLevel);
    formData.append('allowGuestPasses', true); // Enable guest passes for all privacy levels
    
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
  
  if (sourceType === 'template') {
    // For templates, imageSource is a require() object
    // We need to resolve it to get the URI
    const resolvedSource = Image.resolveAssetSource(imageSource);
    console.log('📷 Resolved template URI:', resolvedSource.uri);
    setCover({ uri: resolvedSource.uri });
  } else {
    // For uploaded images, imageSource should already be a URI
    setCover(imageSource);
  }
  
  setCoverSource(sourceType);
  console.log('📷 Cover set - Source type:', sourceType);
};
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDateTime = new Date(dateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setDateTime(newDateTime);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDateTime = new Date(dateTime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setDateTime(newDateTime);
    }
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
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
  {/* Cover Photo Section at Top */}
 {/* Cover Photo Section at Top */}
<View style={styles.coverSection}>
  {cover ? (
    <Image 
      source={typeof cover === 'string' ? { uri: cover } : cover} 
      style={styles.coverImage} 
    />
  ) : (
    <View style={styles.coverPlaceholder}>
      <Ionicons name="camera-outline" size={48} color="#C7C7CC" />
      <Text style={styles.coverPlaceholderText}>Add Cover Photo</Text>
      <Text style={styles.coverPlaceholderSubtext}>Make your event stand out</Text>
    </View>
  )}
  <TouchableOpacity
    style={styles.coverOverlay}
    onPress={() => setShowCoverModal(true)}
  >
    <Ionicons name="camera" size={20} color="#FFFFFF" />
  </TouchableOpacity>
</View>

  <View style={styles.formContainer}>
    
    {/* Basic Event Information */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Event Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Event Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What's the name of your event?"
          placeholderTextColor="#C7C7CC"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Tell people what your event is about..."
          placeholderTextColor="#C7C7CC"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text style={styles.selectButtonText}>{category}</Text>
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          </View>

          {/* When & Where */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When & Where</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date & Time *</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[styles.dateTimeButton, { flex: 1, marginRight: 8 }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#3797EF" />
                  <Text style={styles.dateTimeText}>
                    {dateTime.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.dateTimeButton, { flex: 1, marginLeft: 8 }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#3797EF" />
                  <Text style={styles.dateTimeText}>
                    {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* End Time Picker - only show if start time is set */}
            {dateTime && (
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>End Time (Optional)</Text>
                  {endDateTime && (
                    <TouchableOpacity 
                      onPress={() => setEndDateTime(null)}
                      style={styles.clearButton}
                    >
                      <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {endDateTime ? (
                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity
                      style={[styles.dateTimeButton, { flex: 1, marginRight: 8 }]}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#3797EF" />
                      <Text style={styles.dateTimeText}>
                        {endDateTime.toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.dateTimeButton, { flex: 1, marginLeft: 8 }]}
                      onPress={() => setShowEndTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={20} color="#3797EF" />
                      <Text style={styles.dateTimeText}>
                        {endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addEndTimeButton}
                    onPress={() => {
                      // Default to 2 hours after start
                      const defaultEnd = new Date(dateTime.getTime() + 2 * 60 * 60 * 1000);
                      setEndDateTime(defaultEnd);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#3797EF" />
                    <Text style={styles.addEndTimeText}>Add End Time</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={styles.input}
                value={locQuery}
                onChangeText={onLocQuery}
                placeholder="Where is your event?"
                placeholderTextColor="#C7C7CC"
              />
              
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
          </View>

          {/* Privacy Settings */}
         {/* Privacy Settings */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Privacy Level</Text>
  <Text style={styles.sectionDescription}>
    Controls who can see and join your event
  </Text>

  <TouchableOpacity
    style={styles.privacyButton}
    onPress={() => setShowPrivacyModal(true)}
  >
    <View style={styles.privacyButtonContent}>
      <Ionicons 
        name={PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.icon || 'globe-outline'} 
        size={24} 
        color={PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.color || '#3797EF'} 
      />
      <View style={styles.privacyButtonText}>
        <Text style={styles.privacyLabel}>
          {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.label || 'Public'}
        </Text>
        <Text style={styles.privacyDesc}>
          {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.desc || 'Anyone can see and join'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </View>
  </TouchableOpacity>
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
          {/* Event Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Max Attendees</Text>
              <TextInput
                style={styles.input}
                value={maxAttendees}
                onChangeText={setMaxAttendees}
                placeholder="50"
                placeholderTextColor="#C7C7CC"
                keyboardType="numeric"
              />
            </View>

            {FEATURES.PAYMENTS && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Ticket Price ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0.00"
                    placeholderTextColor="#C7C7CC"
                    keyboardType="numeric"
                  />
                </View>
              </>
            )}
          </View>

          {/* Co-hosts Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Co-hosts</Text>
            <Text style={styles.sectionDescription}>
              Invite friends to help you manage this event
            </Text>

            {coHosts.length > 0 && (
              <View style={styles.coHostsList}>
                {coHosts.map((coHost) => (
                  <View key={coHost._id} style={styles.coHostItem}>
                    <View style={styles.coHostInfo}>
                      <View style={styles.coHostAvatar}>
                        {coHost.profilePicture ? (
                          <Image 
                            source={{ uri: coHost.profilePicture }} 
                            style={styles.coHostAvatarImage} 
                          />
                        ) : (
                          <View style={styles.coHostAvatarPlaceholder}>
                            <Text style={styles.coHostAvatarText}>
                              {coHost.username.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.coHostDetails}>
                        <Text style={styles.coHostName}>{coHost.username}</Text>
                        <Text style={styles.coHostRole}>Co-host</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeCoHost(coHost._id)}
                      style={styles.removeCoHostButton}
                    >
                      <Ionicons name="close" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.addCoHostButton}
              onPress={() => setShowCoHostModal(true)}
            >
              <Ionicons name="person-add-outline" size={20} color="#3797EF" />
              <Text style={styles.addCoHostButtonText}>Add Co-host</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={dateTime}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={dateTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}

      {/* Date/Time Pickers for End Time */}
      {showEndDatePicker && endDateTime && (
        <DateTimePicker
          value={endDateTime}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) {
              const newEndDateTime = new Date(endDateTime);
              newEndDateTime.setFullYear(selectedDate.getFullYear());
              newEndDateTime.setMonth(selectedDate.getMonth());
              newEndDateTime.setDate(selectedDate.getDate());
              setEndDateTime(newEndDateTime);
            }
          }}
          minimumDate={dateTime}
        />
      )}

      {showEndTimePicker && endDateTime && (
        <DateTimePicker
          value={endDateTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) {
              const newEndDateTime = new Date(endDateTime);
              newEndDateTime.setHours(selectedTime.getHours());
              newEndDateTime.setMinutes(selectedTime.getMinutes());
              setEndDateTime(newEndDateTime);
            }
          }}
        />
      )}

      {/* Modals */}
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
  </SafeAreaView>
);
}

// Enhanced Styles with Photo Toggle additions
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
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

  // Cover Image
  coverSection: {
    height: 200,
    backgroundColor: '#F6F6F6',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    marginTop: 8,
    fontSize: 16,
    color: '#C7C7CC',
    fontWeight: '500',
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

  // Form
  formContainer: {
    padding: 16,
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
});