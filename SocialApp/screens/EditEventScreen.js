// screens/EditEventScreen.js - Redesigned to match CreateEventScreen
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Image, Alert, ScrollView,
  Switch, TouchableOpacity, Modal, FlatList, SafeAreaView, StatusBar,
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import CoverPhotoSelectionModal from '../components/CoverPhotoSelectionModal';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { fetchNominatimSuggestions } from '../services/locationApi';
import { API_BASE_URL } from '@env';
import { FEATURES } from '../config/features';
import useEventStore from '../stores/eventStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = [
  'Party', 'Music', 'Workshop', 'Meetup'
];

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


export default function EditEventScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { eventId } = route.params;

  // Basic event fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [endDateTime, setEndDateTime] = useState(null);
  const [locQuery, setLocQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);
  const [category, setCategory] = useState('Party');
  const [cover, setCover] = useState(null);
  const [originalCoverImage, setOriginalCoverImage] = useState(null);
  const [coverSource, setCoverSource] = useState('upload');
  const [coverHeight, setCoverHeight] = useState(400);
  const [coverImageDimensions, setCoverImageDimensions] = useState({ width: 0, height: 0 });
  const HEADER_MAX_HEIGHT = 400;
  const HEADER_MIN_HEIGHT = 150;

  // Advanced fields
  const [maxAttendees, setMaxAttendees] = useState('50');
  const [price, setPrice] = useState('0');
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [hideGuestList, setHideGuestList] = useState(false);
  const [allowPhotos, setAllowPhotos] = useState(true);
  
  // Refs for state management
  const privacyLevelRef = useRef('public');
  const allowPhotosRef = useRef(true);
  const coHostsRef = useRef([]);
  const descriptionRef = useRef('');
  const categoryRef = useRef('Party');

  // Co-hosts management
  const [coHosts, setCoHosts] = useState([]);
  const [showCoHostModal, setShowCoHostModal] = useState(false);
  const [coHostSearchQuery, setCoHostSearchQuery] = useState('');
  const [coHostSearchResults, setCoHostSearchResults] = useState([]);
  const [searchingCoHosts, setSearchingCoHosts] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);

  // Delete functionality
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [event, setEvent] = useState(null);

  // Load event data
  useEffect(() => {
    fetchEventData();
  }, [eventId]);

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

  // Update refs when state changes
  useEffect(() => {
    privacyLevelRef.current = privacyLevel;
  }, [privacyLevel]);

  useEffect(() => {
    allowPhotosRef.current = allowPhotos;
  }, [allowPhotos]);

  useEffect(() => {
    coHostsRef.current = coHosts;
  }, [coHosts]);

  // Set up navigation header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
const handlePrivacySelect = (newPrivacyLevel) => {
  if (!['public', 'friends', 'private'].includes(newPrivacyLevel)) {
    return;
  }
  setPrivacyLevel(newPrivacyLevel);
  privacyLevelRef.current = newPrivacyLevel;
  setShowPrivacyModal(false);
};


  const fetchEventData = async () => {
  try {
    setLoading(true);
    console.log('📥 Fetching event data for eventId:', eventId);
    
    const response = await api.get(`/api/events/${eventId}`);
    const eventData = response.data;

    console.log('📥 RAW EVENT DATA from server:', JSON.stringify(eventData, null, 2));

    // Set basic fields
    setEvent(eventData);
    setTitle(eventData.title || '');
    
    // 🔍 DEBUG: Log description specifically
    console.log('🔍 DESCRIPTION DEBUG:');
    console.log('  - eventData.description (raw):', JSON.stringify(eventData.description));
    console.log('  - eventData.description type:', typeof eventData.description);
    console.log('  - eventData.description length:', eventData.description?.length);
    
   const descriptionValue = eventData.description || '';
setDescription(descriptionValue);
descriptionRef.current = descriptionValue; // ✅ Set ref immediately
console.log('  - Setting description state to:', JSON.stringify(descriptionValue));

const categoryValue = eventData.category || 'General';
setCategory(categoryValue);
categoryRef.current = categoryValue; // ✅ Set ref immediately
console.log('  - Setting category state to:', JSON.stringify(categoryValue));

    setDateTime(new Date(eventData.time));
    setEndDateTime(eventData.endTime ? new Date(eventData.endTime) : null);
    setLocation(eventData.location || '');
    setLocQuery(eventData.location || '');
    setMaxAttendees(String(eventData.maxAttendees || 50));
    
    // Privacy level setting
    const incomingPrivacyLevel = eventData.privacyLevel || 'public';
    if (['public', 'friends', 'private'].includes(incomingPrivacyLevel)) {
      setPrivacyLevel(incomingPrivacyLevel);
      privacyLevelRef.current = incomingPrivacyLevel;
    } else {
      setPrivacyLevel('public');
      privacyLevelRef.current = 'public';
    }
    
    // Hide guest list
    setHideGuestList(eventData.hideGuestList || false);
    
    // Co-hosts handling
    const coHostsData = eventData.coHosts || [];
    setCoHosts(coHostsData);
    coHostsRef.current = coHostsData;
    
    // Photo sharing
    const allowPhotosValue = eventData.allowPhotos !== undefined ? eventData.allowPhotos : true;
    setAllowPhotos(allowPhotosValue);
    allowPhotosRef.current = allowPhotosValue;
    
    // Cover image handling
    setOriginalCoverImage(eventData.coverImage);
    if (eventData.coverImageSource) {
      setCoverSource(eventData.coverImageSource);
    }
    
    // Set cover image if exists
    if (eventData.coverImage) {
      const coverUri = eventData.coverImage.startsWith('http') 
        ? eventData.coverImage 
        : `http://${API_BASE_URL}:3000${eventData.coverImage}`;
      setCover({ uri: coverUri });
      // Calculate cover height
      Image.getSize(coverUri, (width, height) => {
        const aspectRatio = height / width;
        const calculatedHeight = SCREEN_WIDTH * aspectRatio;
        setCoverHeight(Math.max(HEADER_MIN_HEIGHT, Math.min(calculatedHeight, 600)));
        setCoverImageDimensions({ width, height });
      }, (error) => {
        console.error('Error getting image size:', error);
        setCoverHeight(400);
      });
    }
    
    if (eventData.coordinates) {
      setCoords(eventData.coordinates);
    }

    console.log('✅ Event data loaded successfully');

  } catch (error) {
    console.error('❌ Error fetching event:', error);
    Alert.alert('Error', 'Failed to load event data');
    navigation.goBack();
  } finally {
    setLoading(false);
  }
};


// ✅ FIXED: Helper function to check if current user is the host
const isEventHost = () => {
  return currentUser && event && String(event.host._id || event.host) === String(currentUser._id);
};
const isEventCoHost = () => {
  if (!currentUser || !event || isEventHost()) return false;
  return event.coHosts && event.coHosts.some(
    coHost => String(coHost._id || coHost) === String(currentUser._id)
  );
};


const canEditField = (fieldName) => {
  if (isEventHost()) return true; // Host can edit everything
  if (!isEventCoHost()) return false; // Non-co-hosts can't edit anything
  
  // Co-host restrictions - CHECK IF 'allowPhotos' is in this list
  const restrictedFields = [
    'title', 'pricing', 'maxAttendees', 'privacyLevel', 
    'coHosts', 'deleteEvent', 'coverImage', 'category'
    // Notice: 'allowPhotos' is NOT in this list, so co-hosts CAN edit it
  ];
  
  return !restrictedFields.includes(fieldName);
};


// ✅ FIXED: Delete confirmation function
const showDeleteConfirmation = () => {
  Alert.alert(
    'Delete Event',
    'Are you sure you want to delete this event? This action cannot be undone and will:\n\n• Remove the event permanently\n• Untag all photos from this event\n• Notify all attendees\n• Process any necessary refunds',
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Delete Event',
        style: 'destructive',
        onPress: () => setShowDeleteModal(true)
      }
    ]
  );
};

// ✅ FIXED: Delete event function
const handleDeleteEvent = async () => {
  try {
    setDeleting(true);
    
    console.log(`🗑️ Deleting event: ${eventId}`);
    
    const response = await api.delete(`/api/events/${eventId}`);
    
    if (response.data.success) {
      console.log('✅ Event deleted successfully');
      
      // ✅ NEW: Remove event from store and feed caches
      const store = useEventStore.getState();
      store.removeEventFromFeedCache(eventId);
      store.removeEvent(eventId);
      
      Alert.alert(
        'Event Deleted',
        `${response.data.stats.eventTitle} has been deleted successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to the main events screen or home
              navigation.goBack(); 
            }
          }
        ]
      );
    }
    
  } catch (error) {
    console.error('❌ Delete event error:', error);
    
    const errorMessage = error.response?.data?.message || 'Failed to delete event. Please try again.';
    
    Alert.alert(
      'Delete Failed',
      errorMessage,
      [{ text: 'OK' }]
    );
  } finally {
    setDeleting(false);
    setShowDeleteModal(false);
  }
};
const getPrivacyDescription = (privacyLevel) => {
  switch (privacyLevel) {
    case 'public':
      return 'This event is completely open. Anyone can discover, view, and join this event.';
    case 'friends':
      return 'Only your followers will be able to see and join this event.';
    case 'private':
      return 'This event requires invitations, but attendees can invite others and share the event.';
    default:
      return 'This event is completely open. Anyone can discover, view, and join this event.';
  }
};


  // Search for potential co-hosts
  const searchCoHosts = async (query) => {
  if (query.length < 2) {
    setCoHostSearchResults([]);
    return;
  }

  try {
    setSearchingCoHosts(true);
    const response = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
    
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
    const filtered = users.filter(user => 
      user && user._id &&
      user._id !== currentUser._id && 
      !coHosts.some(ch => ch._id === user._id)
    );
    
    console.log('✅ EditEvent cohost search results:', filtered);
    setCoHostSearchResults(filtered);
  } catch (error) {
    console.error('Co-host search error:', error);
    setCoHostSearchResults([]);
  } finally {
    setSearchingCoHosts(false);
  }
};

  // Add co-host
  const addCoHost = (user) => {
  if (coHosts.length >= 10) {
    Alert.alert('Limit Reached', 'You can have a maximum of 10 co-hosts.');
    return;
  }
  
  console.log('👥 ===== ADD COHOST DEBUG =====');
  console.log('👥 Adding user:', user);
  console.log('👥 Current coHosts before add:', coHosts);
  console.log('👥 Current coHostsRef before add:', coHostsRef.current);
  
  const newCoHosts = [...coHosts, user];
  setCoHosts(newCoHosts);
  coHostsRef.current = newCoHosts; // ✅ Update ref immediately
  
  console.log('👥 New coHosts array after add:', newCoHosts);
  console.log('👥 Updated coHostsRef.current:', coHostsRef.current);
  
  setCoHostSearchQuery('');
  setCoHostSearchResults([]);
  
  console.log('👥 ===== ADD COHOST DEBUG END =====');
};

  // Remove co-host
  const removeCoHost = (userId) => {
  console.log('👥 ===== REMOVE COHOST DEBUG =====');
  console.log('👥 Removing userId:', userId);
  console.log('👥 Current coHosts before remove:', coHosts);
  console.log('👥 Current coHostsRef before remove:', coHostsRef.current);
  
  const filtered = coHosts.filter(coHost => coHost._id !== userId);
  setCoHosts(filtered);
  coHostsRef.current = filtered; // ✅ Update ref immediately
  
  console.log('👥 Filtered coHosts after remove:', filtered);
  console.log('👥 Updated coHostsRef.current:', coHostsRef.current);
  
  console.log('👥 ===== REMOVE COHOST DEBUG END =====');
};

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCoHosts(coHostSearchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [coHostSearchQuery]);

useEffect(() => {
  console.log('👥 ===== COHOST STATE CHANGED =====');
  console.log('👥 New coHosts state:', coHosts);
  console.log('👥 New coHosts length:', coHosts?.length);
  
  // ✅ FIXED: Keep ref in sync with state
  coHostsRef.current = coHosts;
  console.log('👥 Updated coHostsRef.current:', coHostsRef.current);
  
  coHosts.forEach((coHost, index) => {
    console.log(`👥 CoHost [${index}]:`, {
      _id: coHost._id,
      username: coHost.username
    });
  });
  console.log('👥 ===== COHOST STATE CHANGED END =====');
}, [coHosts]);
  
const handleSaveEvent = async () => {
  console.log('🔍 ===== SAVE EVENT DEBUG - STATE CHECK =====');
  console.log('🔍 title state:', JSON.stringify(title));
  console.log('🔍 description state:', JSON.stringify(description));
  console.log('🔍 description length:', description?.length);
  console.log('🔍 description type:', typeof description);
  console.log('🔍 category state:', JSON.stringify(category));

  const currentAllowPhotos = allowPhotosRef.current;
  const currentCoHosts = coHostsRef.current;
  const currentPrivacyLevel = privacyLevelRef.current;
  
  // Validation
  if (!title || !title.trim()) {
    Alert.alert('Error', 'Event title is required');
    return;
  }

  // End time validation
  if (endDateTime && endDateTime <= dateTime) {
    Alert.alert('Error', 'End time must be after start time');
    return;
  }

  // Add validation for description
  if (description === undefined || description === null) {
    console.log('⚠️ WARNING: Description is undefined/null, setting to empty string');
    setDescription('');
  }

  try {
    setSaving(true);
    
    const updateData = {
  title: title.trim(),
  description: (descriptionRef.current || '').trim(), // ✅ Use ref
  category: categoryRef.current || 'General', // ✅ Use ref
  time: dateTime.toISOString(),
  endTime: endDateTime ? endDateTime.toISOString() : null,
  location: location.trim(),
  maxAttendees: parseInt(maxAttendees) || 0,
  privacyLevel: currentPrivacyLevel,
  allowPhotos: currentAllowPhotos,
  allowGuestPasses: true,
  hideGuestList: hideGuestList,
  coHosts: currentCoHosts.map(coHost => coHost._id),
};

    console.log('🔍 ===== UPDATE DATA DEBUG =====');
    console.log('🔍 updateData.description:', JSON.stringify(updateData.description));
    console.log('🔍 updateData.category:', JSON.stringify(updateData.category));
    console.log('🔍 updateData.title:', JSON.stringify(updateData.title));
    console.log('🔍 updateData.endTime:', JSON.stringify(updateData.endTime));
    console.log('🔍 endDateTime state:', endDateTime);
    console.log('🔍 endDateTime type:', typeof endDateTime);
    console.log('🔍 endDateTime toISOString:', endDateTime ? endDateTime.toISOString() : 'null');


    // Add coordinates if available
    if (coords) {
      updateData.coordinates = coords;
    }

    console.log('🔄 ===== SENDING REQUEST =====');
    console.log('🔄 Full updateData:', JSON.stringify(updateData, null, 2));

    let response;

    // Handle cover image separately if it was changed
    if (cover) {
      console.log('📸 Using FormData (with cover image)');
      const formData = new FormData();
      
      // Add all the regular fields
      Object.keys(updateData).forEach(key => {
        if (key === 'coHosts' || key === 'permissions' || key === 'coordinates') {
          const jsonValue = JSON.stringify(updateData[key]);
          console.log(`📸 FormData ${key}:`, jsonValue);
          formData.append(key, jsonValue);
        } else {
          console.log(`📸 FormData ${key}:`, updateData[key].toString());
          formData.append(key, updateData[key].toString());
        }
      });
      
      // Handle cover image based on source
      if (coverSource === 'template') {
        formData.append('coverImage', {
          uri: cover,
          type: 'image/jpeg',
          name: 'template-cover.jpg',
        });
      } else {
        formData.append('coverImage', {
          uri: cover,
          type: 'image/jpeg',
          name: 'cover.jpg',
        });
      }
      
      formData.append('coverImageSource', coverSource);

      response = await api.put(`/api/events/${eventId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      console.log('📝 Using JSON (no cover image)');
      console.log('📝 JSON payload:', JSON.stringify(updateData, null, 2));
      
      response = await api.put(`/api/events/${eventId}`, updateData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    console.log('✅ ===== RESPONSE RECEIVED =====');
    console.log('✅ Response status:', response.status);
    console.log('✅ Response data:', JSON.stringify(response.data, null, 2));

    // Update local state with fresh data from backend
    const updatedEvent = response.data.event;
    if (updatedEvent) {
      console.log('🔄 Updating local state with backend response');
      setTitle(updatedEvent.title || '');
      setDescription(updatedEvent.description || '');
      setCategory(updatedEvent.category || 'General');
      setAllowPhotos(updatedEvent.allowPhotos !== undefined ? updatedEvent.allowPhotos : true);
      setMaxAttendees(String(updatedEvent.maxAttendees || 50));
      setLocation(updatedEvent.location || '');
      setPrivacyLevel(updatedEvent.privacyLevel || 'public');
      
      // Update date/time fields
      if (updatedEvent.time) {
        setDateTime(new Date(updatedEvent.time));
      }
      if (updatedEvent.endTime) {
        setEndDateTime(new Date(updatedEvent.endTime));
      } else {
        setEndDateTime(null);
      }
      
      // Update cover image if it was changed
      if (updatedEvent.coverImage) {
        setOriginalCoverImage(updatedEvent.coverImage);
        // Clear the cover state since we're using the original image
        setCover(null);
        setCoverSource('original');
      }
      
      // Update refs too
      allowPhotosRef.current = updatedEvent.allowPhotos !== undefined ? updatedEvent.allowPhotos : true;
      privacyLevelRef.current = updatedEvent.privacyLevel || 'public';
      
      console.log('✅ Local state updated with fresh data from backend');
    }

    Alert.alert(
      'Success!',
      'Your event has been updated successfully.',
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          }
        }
      ]
    );

  } catch (error) {
    console.error('❌ ===== SAVE ERROR =====');
    console.error('❌ Error object:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error response:', error.response?.data);
    
    Alert.alert(
      'Error',
      error.response?.data?.message || 'Failed to update event. Please try again.'
    );
  } finally {
    setSaving(false);
  }
};
  const handleCoverSelect = (imageSource, sourceType) => {
    let imageUri;
    if (sourceType === 'template') {
      const resolvedSource = Image.resolveAssetSource(imageSource);
      imageUri = resolvedSource.uri;
      setCover({ uri: imageUri });
      if (resolvedSource.width && resolvedSource.height) {
        const aspectRatio = resolvedSource.height / resolvedSource.width;
        const calculatedHeight = SCREEN_WIDTH * aspectRatio;
        setCoverHeight(Math.max(HEADER_MIN_HEIGHT, Math.min(calculatedHeight, 600)));
        setCoverImageDimensions({ width: resolvedSource.width, height: resolvedSource.height });
      }
    } else {
      imageUri = imageSource;
      setCover(imageSource);
      Image.getSize(imageUri, (width, height) => {
        const aspectRatio = height / width;
        const calculatedHeight = SCREEN_WIDTH * aspectRatio;
        setCoverHeight(Math.max(HEADER_MIN_HEIGHT, Math.min(calculatedHeight, 600)));
        setCoverImageDimensions({ width, height });
      }, (error) => {
        console.error('Error getting image size:', error);
        setCoverHeight(400);
      });
    }
    setCoverSource(sourceType);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </View>
    );
  }

  const currentCoverImage = cover || (originalCoverImage ? (originalCoverImage.startsWith('http') ? originalCoverImage : `http://${API_BASE_URL}:3000${originalCoverImage}`) : null);

  const canProceed = () => {
    return title.trim() && location.trim() && dateTime > new Date();
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
              <Text style={styles.headerTitle}>Edit Event</Text>
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
              {currentCoverImage ? (
                <Image 
                  source={typeof currentCoverImage === 'string' ? { uri: currentCoverImage } : currentCoverImage} 
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
                    if (width && height) {
                      const aspectRatio = height / width;
                      const calculatedHeight = SCREEN_WIDTH * aspectRatio;
                      const finalHeight = Math.max(HEADER_MIN_HEIGHT, Math.min(calculatedHeight, 600));
                      setCoverHeight(finalHeight);
                      setCoverImageDimensions({ width, height });
                    }
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
              
              {/* Co-host Permission Banner */}
              {isEventCoHost() && (
                <View style={styles.coHostBanner}>
                  <View style={styles.coHostBannerContent}>
                    <Ionicons name="information-circle" size={20} color="#3b82f6" />
                    <Text style={styles.coHostBannerText}>
                      You're a co-host! You can edit event details, but some settings are restricted to the main host.
                    </Text>
                  </View>
                </View>
              )}

              {/* Event Name - Large Input */}
              <View style={styles.eventNameContainer}>
                <TextInput
                  style={[
                    styles.eventNameInput,
                    !canEditField('title') && styles.inputDisabled
                  ]}
                  value={title}
                  onChangeText={canEditField('title') ? setTitle : undefined}
                  placeholder="Event Name"
                  placeholderTextColor="#C7C7CC"
                  maxLength={100}
                  editable={canEditField('title')}
                />
                {!canEditField('title') && (
                  <Text style={styles.restrictedHint}>
                    Only the event host can change the title
                  </Text>
                )}
              </View>

              {/* Category Pills */}
              {canEditField('category') && (
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
                        onPress={() => {
                          setCategory(cat);
                          categoryRef.current = cat;
                        }}
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
              )}

              {/* Description with Character Counter */}
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionLabel}>DESCRIPTION</Text>
                <TextInput
                  style={styles.descriptionInput}
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    descriptionRef.current = text;
                  }}
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

              {/* When */}
              <View style={styles.whenWhereSection}>
                <TouchableOpacity
                  style={styles.whenCard}
                  onPress={() => navigation.navigate('EventDateTimePickerScreen', {
                    fromScreen: 'EditEventScreen',
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
                    {endDateTime && (
                      <Text style={[styles.whenCardValue, { fontSize: 12, marginTop: 4, color: '#8E8E93' }]}>
                        Ends: {endDateTime.toLocaleDateString()} at {endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
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
                {/* Privacy Control - Improved UI */}
                {canEditField('privacyLevel') ? (
                  <View style={styles.combinedSectionItem}>
                    <View style={styles.privacyControlHeader}>
                      <View style={styles.privacyControlHeaderLeft}>
                        <Ionicons 
                          name={PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.icon || 'globe-outline'} 
                          size={20} 
                          color={PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.color || '#3b82f6'} 
                        />
                        <View style={styles.privacyControlTextContainer}>
                          <Text style={styles.combinedSectionLabel}>PRIVACY</Text>
                          <Text style={styles.privacyControlSubtext}>
                            {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.desc || 'Anyone can see and join'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.privacySelectButton}
                        onPress={() => setShowPrivacyModal(true)}
                      >
                        <Text style={styles.privacySelectText}>
                          {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.label || 'Public'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.combinedSectionItem}>
                    <View style={styles.privacyControlHeader}>
                      <View style={styles.privacyControlHeaderLeft}>
                        <Ionicons 
                          name={PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.icon || 'globe-outline'} 
                          size={20} 
                          color="#8E8E93"
                        />
                        <View style={styles.privacyControlTextContainer}>
                          <Text style={styles.combinedSectionLabel}>PRIVACY (Host Only)</Text>
                          <Text style={styles.privacyControlSubtext}>
                            {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.desc || 'Anyone can see and join'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Hosts */}
                {canEditField('coHosts') && (
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
                )}

                {/* Divider */}
                <View style={styles.combinedSectionDivider} />

                {/* Max Attendees */}
                {canEditField('maxAttendees') && (
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
                )}

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

              {/* Delete Event Section - Only show for event host */}
              {canEditField('deleteEvent') && (
                <View style={styles.section}>
                  <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
                  <Text style={styles.sectionDescription}>
                    Permanent actions that cannot be undone
                  </Text>

                  <View style={styles.dangerContainer}>
                    <View style={styles.deleteEventInfo}>
                      <View style={styles.deleteEventIcon}>
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                      </View>
                      <View style={styles.deleteEventText}>
                        <Text style={styles.deleteEventLabel}>Delete Event</Text>
                        <Text style={styles.deleteEventDesc}>
                          Permanently delete this event and all associated data
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteEventButton}
                      onPress={showDeleteConfirmation}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.deleteEventButtonText}>Delete Event</Text>
                    </TouchableOpacity>

                    {/* Warning indicators */}
                    <View style={styles.deleteWarningContainer}>
                      <View style={styles.deleteWarning}>
                        <Ionicons name="warning" size={16} color="#FF9500" />
                        <Text style={styles.deleteWarningText}>
                          This will notify all {event?.attendees?.length || 0} attendees
                        </Text>
                      </View>
                      <View style={styles.deleteWarning}>
                        <Ionicons name="image" size={16} color="#FF9500" />
                        <Text style={styles.deleteWarningText}>
                          Photos will be untagged but preserved in user galleries
                        </Text>
                      </View>
                      {event?.pricing?.amount > 0 && (
                        <View style={styles.deleteWarning}>
                          <Ionicons name="card" size={16} color="#FF9500" />
                          <Text style={styles.deleteWarningText}>
                            Paid event - future refund handling may be needed
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Fixed Save Event Button */}
        <View style={styles.createButtonContainer}>
          <TouchableOpacity
            style={[styles.createButton, (!canProceed() || saving) && styles.createButtonDisabled]}
            onPress={handleSaveEvent}
            disabled={!canProceed() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Privacy Modal */}
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
                      handlePrivacySelect(level.key);
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

        <CoverPhotoSelectionModal
          visible={showCoverModal}
          onClose={() => setShowCoverModal(false)}
          onSelectCover={handleCoverSelect}
          eventTitle={title || "Your Event"}
        />
      </KeyboardAvoidingView>

      {/* Co-host Search Modal */}
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
                <Ionicons name="search" size={20} color="#8E8E93" />
                <TextInput
                  style={styles.searchInput}
                  value={coHostSearchQuery}
                  onChangeText={setCoHostSearchQuery}
                  placeholder="Search for friends..."
                  placeholderTextColor="#C7C7CC"
                  autoFocus
                />
                {searchingCoHosts && (
                  <ActivityIndicator size="small" color="#8E8E93" />
                )}
              </View>
            </View>

            <FlatList
              data={coHostSearchResults}
              keyExtractor={(item) => item._id}
              style={styles.searchResultsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => addCoHost(item)}
                >
                  <View style={styles.searchResultAvatar}>
                    {item.profilePicture ? (
                      <Image 
                        source={{ 
                          uri: item.profilePicture.startsWith('http') 
                            ? item.profilePicture 
                            : `http://${API_BASE_URL}:3000${item.profilePicture}` 
                        }} 
                        style={styles.searchResultAvatarImage} 
                      />
                    ) : (
                      <View style={styles.searchResultAvatarPlaceholder}>
                        <Text style={styles.searchResultAvatarText}>
                          {item.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.username}</Text>
                    {item.bio && (
                      <Text style={styles.searchResultDisplayName} numberOfLines={1}>
                        {item.bio}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="add-circle" size={24} color="#3797EF" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptySearchResults}>
                  {coHostSearchQuery ? (
                    <Text style={styles.emptySearchText}>
                      {searchingCoHosts ? 'Searching...' : 'No users found'}
                    </Text>
                  ) : (
                    <Text style={styles.emptySearchText}>
                      Search for friends to add as co-hosts {coHosts.length >= 10 ? '(Limit: 10)' : `(${coHosts.length}/10)`}
                    </Text>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>


      {/* ✅ FIXED: Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            {/* Header */}
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteModalIcon}>
                <Ionicons name="trash" size={32} color="#FF3B30" />
              </View>
              <Text style={styles.deleteModalTitle}>Delete "{event?.title}"?</Text>
              <Text style={styles.deleteModalSubtitle}>
                This action cannot be undone
              </Text>
            </View>

            {/* Impact Summary */}
            <View style={styles.deleteImpactContainer}>
              <Text style={styles.deleteImpactTitle}>This will:</Text>
              
              <View style={styles.deleteImpactItem}>
                <Ionicons name="people" size={20} color="#8E8E93" />
                <Text style={styles.deleteImpactText}>
                  Notify {event?.attendees?.length || 0} attendees that the event is cancelled
                </Text>
              </View>

              <View style={styles.deleteImpactItem}>
                <Ionicons name="images" size={20} color="#8E8E93" />
                <Text style={styles.deleteImpactText}>
                  Untag all photos (photos remain in user galleries)
                </Text>
              </View>

              <View style={styles.deleteImpactItem}>
                <Ionicons name="notifications" size={20} color="#8E8E93" />
                <Text style={styles.deleteImpactText}>
                  Remove all event notifications and references
                </Text>
              </View>

              <View style={styles.deleteImpactItem}>
                <Ionicons name="trash" size={20} color="#FF3B30" />
                <Text style={[styles.deleteImpactText, styles.deleteImpactDanger]}>
                  Permanently delete the event
                </Text>
              </View>
            </View>

            {/* Final Confirmation */}
            <View style={styles.deleteConfirmationContainer}>
              <Text style={styles.deleteConfirmationText}>
                Type "{event?.title}" to confirm deletion:
              </Text>
              <TextInput
                style={styles.deleteConfirmationInput}
                placeholder={event?.title}
                placeholderTextColor="#C7C7CC"
                value={deleteConfirmationText}
                onChangeText={setDeleteConfirmationText}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmationText('');
                }}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deleteModalConfirmButton,
                  (deleteConfirmationText !== event?.title || deleting) && styles.deleteModalConfirmButtonDisabled
                ]}
                onPress={handleDeleteEvent}
                disabled={deleteConfirmationText !== event?.title || deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Delete Event</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  scrollContent: {
    paddingBottom: 100,
    backgroundColor: 'transparent',
    paddingTop: 0,
    marginTop: 0,
  },
  safeAreaHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
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
  heroContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
    elevation: 1,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  coverTouchable: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  heroImage: {
    resizeMode: 'cover',
    backgroundColor: '#E5E7EB',
    position: 'absolute',
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
  coverIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(8px)',
  },
  formContainerWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  formContainer: {
    padding: 24,
    paddingTop: 32,
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

  section: {
    marginBottom: 32,
    paddingHorizontal: 24,
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
  descriptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
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
  privacyControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  privacyControlHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  privacyControlTextContainer: {
    flex: 1,
  },
  privacyControlSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  privacySelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  privacySelectText: {
    fontSize: 14,
    fontWeight: '600',
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
    zIndex: 30,
    elevation: 30,
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

  // Cover Image
  coverImageContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 16,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  coverImageOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Form Elements
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
  dateTimeContainer: {
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
  dateTimeText: {
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

  // Photo Toggle Styles
  photoToggleContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
  },
  photoToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  photoToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  photoToggleText: {
    flex: 1,
  },
  photoToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  photoToggleDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  photoBenefitsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  photoBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoBenefitText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#34C759',
    flex: 1,
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
  borderRadius: 8, // ✅ FIXED: Square with rounded corners
  marginRight: 12,
},
coHostAvatarImage: {
  width: '100%',
  height: '100%',
  borderRadius: 8, // ✅ FIXED: Square with rounded corners
},
coHostAvatarPlaceholder: {
  width: '100%',
  height: '100%',
  borderRadius: 8, // ✅ FIXED: Square with rounded corners
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

  // Privacy Settings
  privacyButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  borderRadius: 8, // ✅ FIXED: Square with rounded corners
  marginRight: 12,
},
searchResultAvatarImage: {
  width: '100%',
  height: '100%',
  borderRadius: 8, // ✅ FIXED: Square with rounded corners
},
searchResultAvatarPlaceholder: {
  width: '100%',
  height: '100%',
  borderRadius: 8, // ✅ FIXED: Square with rounded corners
  backgroundColor: '#3797EF', // Changed from #C7C7CC
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

  // ✅ DANGER ZONE STYLES
  dangerSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 4,
  },
  dangerContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  deleteEventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteEventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deleteEventText: {
    flex: 1,
  },
  deleteEventLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  deleteEventDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  deleteEventButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteEventButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteWarningContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE5E5',
  },
  deleteWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteWarningText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#FF9500',
    flex: 1,
  },

  // ✅ DELETE MODAL STYLES
  deleteModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  deleteModalHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deleteModalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 4,
  },
  deleteModalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  deleteImpactContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  deleteImpactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  deleteImpactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 16,
  },
  deleteImpactText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
    lineHeight: 20,
  },
  deleteImpactDanger: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  deleteConfirmationContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deleteConfirmationText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  deleteConfirmationInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  deleteModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteModalConfirmButtonDisabled: {
    backgroundColor: '#FFB3B3',
    opacity: 0.5,
  },
  deleteModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Add these styles to your existing StyleSheet (before the closing });

// Co-host Banner
coHostBanner: {
  backgroundColor: '#E3F2FD',
  borderRadius: 12,
  marginHorizontal: 16,
  marginBottom: 20,
  borderLeftWidth: 4,
  borderLeftColor: '#3797EF',
},
coHostBannerContent: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
},
coHostBannerText: {
  flex: 1,
  marginLeft: 12,
  fontSize: 14,
  color: '#1976D2',
  lineHeight: 20,
},

// Restricted Fields
restrictedLabel: {
  fontSize: 12,
  color: '#FF9500',
  fontWeight: '500',
},
restrictedHint: {
  fontSize: 12,
  color: '#8E8E93',
  marginTop: 4,
  fontStyle: 'italic',
},
inputDisabled: {
  backgroundColor: '#F0F0F0',
  borderColor: '#E5E5EA',
  opacity: 0.7,
},
disabledText: {
  fontSize: 16,
  color: '#8E8E93',
  paddingVertical: 14,
},
privacyButtonDisabled: {
  opacity: 0.7,
  backgroundColor: '#F0F0F0',
},
modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#3797EF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalSpacer: {
    width: 60,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#000000',
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
  // Co-host Banner
  coHostBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  coHostBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  coHostBannerText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  // Restricted Fields
  restrictedLabel: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  restrictedHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputDisabled: {
    backgroundColor: '#F0F0F0',
    borderColor: '#E5E5EA',
    opacity: 0.7,
  },
  disabledText: {
    fontSize: 16,
    color: '#8E8E93',
    paddingVertical: 14,
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
  // Privacy Modal
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
    backgroundColor: '#3b82f6',
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
  // Delete Event Styles
  dangerSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 4,
  },
  dangerContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  deleteEventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteEventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deleteEventText: {
    flex: 1,
  },
  deleteEventLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  deleteEventDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  deleteEventButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteEventButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteWarningContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE5E5',
  },
  deleteWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteWarningText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#FF9500',
    flex: 1,
  },
  // Delete Modal Styles
  deleteModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  deleteModalHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deleteModalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 4,
  },
  deleteModalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  deleteImpactContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  deleteImpactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  deleteImpactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 16,
  },
  deleteImpactText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
    lineHeight: 20,
  },
  deleteImpactDanger: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  deleteConfirmationContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deleteConfirmationText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  deleteConfirmationInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  deleteModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteModalConfirmButtonDisabled: {
    backgroundColor: '#FFB3B3',
    opacity: 0.5,
  },
  deleteModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});