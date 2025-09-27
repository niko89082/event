// screens/EditEventScreen.js - Updated with Co-host management functionality + Photo Toggle
import React, { useState, useEffect, useContext, useRef} from 'react';
import {
  View, Text, StyleSheet, TextInput, Image, Alert, ScrollView,
  Switch, TouchableOpacity, Modal, FlatList, SafeAreaView, StatusBar,
  ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import CoverPhotoSelectionModal from '../components/CoverPhotoSelectionModal';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { fetchNominatimSuggestions } from '../services/locationApi';
import { API_BASE_URL } from '@env';
import { FEATURES } from '../config/features';

const CATEGORIES = [
  'General', 'Music', 'Arts', 'Sports', 'Food', 'Technology', 'Business',
  'Health', 'Education', 'Travel', 'Photography', 'Gaming', 'Fashion',
  'Movies', 'Books', 'Fitness', 'Outdoor', 'Indoor'
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
const [categoryModalVisible, setCategoryModalVisible] = useState(false);
const [coverModalVisible, setCoverModalVisible] = useState(false);
const [coverSource, setCoverSource] = useState('upload');

  // Basic event fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);
  const [category, setCategory] = useState('General');
  const [cover, setCover] = useState(null);
  const [originalCoverImage, setOriginalCoverImage] = useState(null);
  const [debugToggleCount, setDebugToggleCount] = useState(0);
  const privacyLevelRef = useRef('public');

  // Advanced fields
  const [maxAttendees, setMaxAttendees] = useState('50');
  const [price, setPrice] = useState('0');
  const [tags, setTags] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [permissions, setPermissions] = useState({
    appearInFeed: true,
    appearInSearch: true,
    canJoin: 'anyone',
    canShare: 'attendees',
    canInvite: 'attendees',
    showAttendeesToPublic: true
  });

  // ADDED: Photo sharing toggle
  const [allowPhotos, setAllowPhotos] = useState(true);
  const allowPhotosRef = useRef(true); 
  const coHostsRef = useRef([]);
const descriptionRef = useRef('');
const categoryRef = useRef('General');
  // ADDED: Missing pricing fields that might be causing the issue
  const [isPaidEvent, setIsPaidEvent] = useState(false);
  const [refundPolicy, setRefundPolicy] = useState('no-refund');

  // Co-hosts management
  const [coHosts, setCoHosts] = useState([]);
  const [showCoHostModal, setShowCoHostModal] = useState(false);
  const [coHostSearchQuery, setCoHostSearchQuery] = useState('');
  const [coHostSearchResults, setCoHostSearchResults] = useState([]);
  const [searchingCoHosts, setSearchingCoHosts] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // ✅ FIXED: Delete functionality state moved inside component
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [event, setEvent] = useState(null);

  // Load event data
  useEffect(() => {
    fetchEventData();
  }, [eventId]);
const PrivacyDebugPanel = ({ privacyLevel, onPrivacyChange }) => {
  if (process.env.NODE_ENV !== 'development') return null;


  const updatedEvent = response.data.event;
if (updatedEvent) {
  setTitle(updatedEvent.title || '');
  setDescription(updatedEvent.description || '');
  setCategory(updatedEvent.category || 'General');
  setAllowPhotos(updatedEvent.allowPhotos !== undefined ? updatedEvent.allowPhotos : true);
  setMaxAttendees(String(updatedEvent.maxAttendees || 50));
  setLocation(updatedEvent.location || '');
  setPrivacyLevel(updatedEvent.privacyLevel || 'public');
  
  // Update refs too
  allowPhotosRef.current = updatedEvent.allowPhotos !== undefined ? updatedEvent.allowPhotos : true;
  privacyLevelRef.current = updatedEvent.privacyLevel || 'public';
  
  console.log('✅ Local state updated with fresh data from backend');
}

  return (
    <View style={{
      backgroundColor: '#FFF3CD',
      borderWidth: 1,
      borderColor: '#FFEAA7',
      borderRadius: 8,
      padding: 16,
      margin: 16
    }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>
        🐛 DEBUG: Privacy Level State
      </Text>
      <Text style={{ fontSize: 12, marginBottom: 4 }}>
        State: "{privacyLevel}" | Ref: "{privacyLevelRef.current}" | Match: {privacyLevel === privacyLevelRef.current ? '✅' : '❌'}
      </Text>
      <Text style={{ fontSize: 12, marginBottom: 4 }}>
        Type: {typeof privacyLevel} | Timestamp: {new Date().toLocaleTimeString()}
      </Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {['public', 'friends', 'private'].map(level => (
          <TouchableOpacity
            key={level}
            onPress={() => {
              console.log(`🐛 DEBUG: Manually setting privacy to "${level}"`);
              onPrivacyChange(level);
            }}
            style={{
              backgroundColor: privacyLevel === level ? '#007AFF' : '#E0E0E0',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 4,
              marginRight: 8,
              marginBottom: 4
            }}
          >
            <Text style={{
              color: privacyLevel === level ? 'white' : 'black',
              fontSize: 12
            }}>
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

useEffect(() => {
  privacyLevelRef.current = privacyLevel;
  console.log(`🔒 FRONTEND: Privacy level ref updated to: "${privacyLevelRef.current}"`);
}, [privacyLevel]);

useEffect(() => {
  console.log(`🔒 FRONTEND: Privacy level state changed to: "${privacyLevel}" (type: ${typeof privacyLevel})`);
  console.log(`🔒 FRONTEND: Privacy level state update timestamp: ${new Date().toISOString()}`);
}, [privacyLevel]);
// PHASE 2: Enhanced privacy selection handler
const handlePrivacySelect = (newPrivacyLevel) => {
  console.log(`🔒 FRONTEND: Privacy selection - changing from "${privacyLevel}" to "${newPrivacyLevel}"`);
  
  // Validate the new privacy level
  if (!['public', 'friends', 'private'].includes(newPrivacyLevel)) {
    console.error(`❌ Invalid privacy level: "${newPrivacyLevel}"`);
    return;
  }
  
  // Update state
  setPrivacyLevel(newPrivacyLevel);
  setShowPrivacyModal(false);
  
  // FIXED: Remove setTimeout verification - it reads old state due to React's async nature
  // Instead, log the new value directly
  console.log(`✅ FRONTEND: Privacy level set to: "${newPrivacyLevel}"`);
  
  // Show confirmation with the new value (not state)
  Alert.alert(
    'Privacy Updated',
    `Event privacy changed to: ${newPrivacyLevel}`,
    [{ text: 'OK' }]
  );
};

  // Set up navigation header
  useEffect(() => {
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
      headerTitle: 'Edit Event',
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSaveEvent}
          style={[styles.headerButton, saving && styles.headerButtonDisabled]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={styles.headerButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [saving, title, location, dateTime]);

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
    setLocation(eventData.location || '');
    setLocQuery(eventData.location || '');
    setMaxAttendees(String(eventData.maxAttendees || 50));
    setTags(eventData.tags?.join(', ') || '');
    
    // PHASE 2: Enhanced privacy level setting with validation
    const incomingPrivacyLevel = eventData.privacyLevel || 'public';
    console.log(`🔒 FRONTEND: Setting privacy level from server: "${incomingPrivacyLevel}"`);
    
    if (['public', 'friends', 'private'].includes(incomingPrivacyLevel)) {
      setPrivacyLevel(incomingPrivacyLevel);
      console.log(`✅ FRONTEND: Privacy level set to: "${incomingPrivacyLevel}"`);
    } else {
      console.warn(`⚠️ Invalid privacy level from server: "${incomingPrivacyLevel}", defaulting to "public"`);
      setPrivacyLevel('public');
    }
    
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

const handlePhotoToggle = (newValue) => {
  console.log('🔧 SWITCH TOGGLE - Old value:', allowPhotos, 'New value:', newValue);
  setAllowPhotos(newValue);
  allowPhotosRef.current = newValue; // Immediately update ref
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
  location: location.trim(),
  maxAttendees: parseInt(maxAttendees) || 0,
  privacyLevel: currentPrivacyLevel,
  allowPhotos: currentAllowPhotos,
  allowGuestPasses: true,
  coHosts: currentCoHosts.map(coHost => coHost._id),
};

    console.log('🔍 ===== UPDATE DATA DEBUG =====');
    console.log('🔍 updateData.description:', JSON.stringify(updateData.description));
    console.log('🔍 updateData.category:', JSON.stringify(updateData.category));
    console.log('🔍 updateData.title:', JSON.stringify(updateData.title));

    // Add tags if provided
    if (tags && tags.trim()) {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      updateData.tags = tagArray;
    }

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
        if (key === 'coHosts' || key === 'permissions' || key === 'tags' || key === 'coordinates') {
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
  const pickCoverImage = () => {
  setCoverModalVisible(true);
};
const handleCoverSelection = (coverImage, source) => {
  setCover(coverImage.uri || coverImage);
  setCoverSource(source);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentCoverImage = cover || (originalCoverImage ? `http://${API_BASE_URL}:3000${originalCoverImage}` : null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover Image */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.coverImageContainer}
              onPress={pickCoverImage}
              activeOpacity={0.8}
            >
              {currentCoverImage ? (
                <Image source={{ uri: currentCoverImage }} style={styles.coverImage} />
              ) : (
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.coverImagePlaceholder}
                >
                  <Ionicons name="camera" size={32} color="#FFFFFF" />
                  <Text style={styles.placeholderText}>Add Cover Photo</Text>
                </LinearGradient>
              )}
              <View style={styles.coverImageOverlay}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
          {/* Co-host Permission Banner */}
          {isEventCoHost() && (
            <View style={styles.coHostBanner}>
              <View style={styles.coHostBannerContent}>
                <Ionicons name="information-circle" size={20} color="#3797EF" />
                <Text style={styles.coHostBannerText}>
                  You're a co-host! You can edit event details, but some settings are restricted to the main host.
                </Text>
              </View>
            </View>
          )}
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            
            <View style={styles.inputGroup}>
  <Text style={styles.label}>
    Event Title *
    {!canEditField('title') && (
      <Text style={styles.restrictedLabel}> (Host Only)</Text>
    )}
  </Text>
  <TextInput
    style={[
      styles.input,
      !canEditField('title') && styles.inputDisabled
    ]}
    value={title}
    onChangeText={canEditField('title') ? setTitle : undefined}
    placeholder="What's your event called?"
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

           <View style={styles.inputGroup}>
  <Text style={styles.label}>Description</Text>
  <TextInput
  style={[styles.input, styles.textArea]}
  value={description}
  onChangeText={(text) => {
    console.log('🔍 DESCRIPTION INPUT CHANGE:', JSON.stringify(text));
    setDescription(text);
    descriptionRef.current = text; // ✅ Update ref immediately
  }}
  placeholder="Tell people what your event is about..."
  placeholderTextColor="#C7C7CC"
  multiline
  numberOfLines={4}
  maxLength={500}
/>
  {__DEV__ && (
    <Text style={{fontSize: 12, color: '#999', marginTop: 4}}>
      DEBUG - Description length: {description?.length || 0} | Value: "{description}"
    </Text>
  )}
</View>

            <View style={styles.inputGroup}>
  <Text style={styles.label}>
    Category *
    {!canEditField('category') && (
      <Text style={styles.restrictedLabel}> (Host Only)</Text>
    )}
  </Text>
  <TouchableOpacity
    style={[
      styles.selectButton,
      !canEditField('category') && styles.inputDisabled
    ]}
    onPress={canEditField('category') ? () => setCategoryModalVisible(true) : undefined}
    disabled={!canEditField('category')}
  >
    <Text style={styles.selectButtonText}>{category || 'Select Category'}</Text>
    <Ionicons name="chevron-down" size={20} color="#8E8E93" />
  </TouchableOpacity>
</View>
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When</Text>
            
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                <Text style={styles.dateTimeText}>
                  {dateTime.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#8E8E93" />
                <Text style={styles.dateTimeText}>
                  {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

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
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where</Text>
            
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

          {/* ADDED: Photo Sharing Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photo Sharing</Text>
            <Text style={styles.sectionDescription}>
              Allow attendees to share photos and create memories from your event
            </Text>

            <View style={styles.photoToggleContainer}>
              <View style={styles.photoToggleRow}>
                <View style={styles.photoToggleContent}>
                  <View style={styles.photoToggleIcon}>
                    <Ionicons 
                      name={allowPhotos ? "camera" : "camera-outline"} 
                      size={24} 
                      color={allowPhotos ? "#3797EF" : "#8E8E93"} 
                    />
                  </View>
                  <View style={styles.photoToggleText}>
                    <Text style={styles.photoToggleLabel}>Enable Photo Sharing</Text>
                    <Text style={styles.photoToggleDesc}>
                      {allowPhotos 
                        ? 'Attendees can post photos and create shared memories'
                        : 'Photo sharing is disabled for this event'
                      }
                    </Text>
                  </View>
                </View>
                <Switch
                  value={allowPhotos}
                  onValueChange={handlePhotoToggle}
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Photo sharing benefits */}
              {allowPhotos && (
                <View style={styles.photoBenefitsContainer}>
                  <View style={styles.photoBenefit}>
                    <Ionicons name="people" size={16} color="#34C759" />
                    <Text style={styles.photoBenefitText}>Build community through shared memories</Text>
                  </View>
                  <View style={styles.photoBenefit}>
                    <Ionicons name="heart" size={16} color="#34C759" />
                    <Text style={styles.photoBenefitText}>Increase engagement and event satisfaction</Text>
                  </View>
                  <View style={styles.photoBenefit}>
                    <Ionicons name="time" size={16} color="#34C759" />
                    <Text style={styles.photoBenefitText}>Create lasting memories after the event</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Co-hosts Section - Only show if user can edit co-hosts */}
          {canEditField('coHosts') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Co-hosts</Text>
              <Text style={styles.sectionDescription}>
                Manage friends who can help you run this event
              </Text>

              {/* Selected Co-hosts */}
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

              {/* Add Co-host Button */}
              <TouchableOpacity
                style={styles.addCoHostButton}
                onPress={() => setShowCoHostModal(true)}
              >
                <Ionicons name="person-add-outline" size={20} color="#3797EF" />
                <Text style={styles.addCoHostButtonText}>Add Co-host</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Event Settings */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Settings</Text>

  {/* Max Attendees - Host Only */}
  {canEditField('maxAttendees') ? (
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
  ) : (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        Max Attendees <Text style={styles.restrictedLabel}>(Host Only)</Text>
      </Text>
      <View style={[styles.input, styles.inputDisabled]}>
        <Text style={styles.disabledText}>{maxAttendees}</Text>
      </View>
      <Text style={styles.restrictedHint}>
        Only the host can change attendee limits
      </Text>
    </View>
  )}

  {/* Ticket Price - Host Only */}
  
  {/* Ticket Price - Host Only
{FEATURES.PAYMENTS && (
  <>
    {canEditField('pricing') ? (
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
    ) : (
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Ticket Price ($) <Text style={styles.restrictedLabel}>(Host Only)</Text>
        </Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.disabledText}>${price}</Text>
        </View>
        <Text style={styles.restrictedHint}>
          Only the host can change pricing
        </Text>
      </View>
    )}
  </>
)} */}

  {/* Tags - Co-hosts CAN edit this */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Tags (optional)</Text>
    <TextInput
      style={styles.input}
      value={tags}
      onChangeText={setTags}
      placeholder="music, party, fun (separated by commas)"
      placeholderTextColor="#C7C7CC"
    />
  </View>
</View>

          {/* Privacy Settings */}
{canEditField('privacyLevel') ? (
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
) : (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      Privacy Level <Text style={styles.restrictedLabel}>(Host Only)</Text>
    </Text>
    <Text style={styles.sectionDescription}>
      Only the host can change privacy settings
    </Text>

    <View style={[styles.privacyButton, styles.privacyButtonDisabled]}>
      <View style={styles.privacyButtonContent}>
        <Ionicons 
          name={PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.icon || 'globe-outline'} 
          size={24} 
          color="#8E8E93"
        />
        <View style={styles.privacyButtonText}>
          <Text style={styles.disabledText}>
            {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.label || 'Public'}
          </Text>
          <Text style={styles.restrictedHint}>
            {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.desc || 'Anyone can see and join'}
          </Text>
        </View>
      </View>
    </View>
  </View>
)}

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

          <CoverPhotoSelectionModal
  visible={coverModalVisible}
  onClose={() => setCoverModalVisible(false)}
  onSelectCover={handleCoverSelection}
  eventTitle={title}
/>
        </ScrollView>
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

      {/* Category Modal */}
      <Modal
  visible={categoryModalVisible}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setCategoryModalVisible(false)}
>
  <SafeAreaView style={styles.modalContainer}>
    <View style={styles.modalHeader}>
      <TouchableOpacity
        onPress={() => setCategoryModalVisible(false)}
        style={styles.modalCloseButton}
      >
        <Text style={styles.modalCloseText}>Cancel</Text>
      </TouchableOpacity>
      <Text style={styles.modalTitle}>Select Category</Text>
      <View style={styles.modalSpacer} />
    </View>

    <FlatList
      data={CATEGORIES}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.categoryOption}
         onPress={() => {
  setCategory(item);
  categoryRef.current = item; // ✅ Update ref immediately
  setCategoryModalVisible(false);
}}
        >
          <Text style={styles.categoryOptionText}>{item}</Text>
          {category === item && (
            <Ionicons name="checkmark" size={20} color="#3797EF" />
          )}
        </TouchableOpacity>
      )}
    />
  </SafeAreaView>
</Modal>

      {/* Privacy Level Modal */}
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

      {/* PHASE 2: Debug current selection */}
      <View style={styles.debugSection}>
        <Text style={styles.debugText}>
          Current: {privacyLevel} | Type: {typeof privacyLevel}
        </Text>
      </View>

      <FlatList
        data={PRIVACY_LEVELS}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.privacyOption}
            onPress={() => {
              console.log(`🔒 FRONTEND: Modal selection - "${item.key}"`);
              handlePrivacySelect(item.key); // Use the enhanced handler instead of direct setState
            }}
          >
            <View style={styles.privacyOptionContent}>
              <Ionicons name={item.icon} size={24} color={item.color} />
              <View style={styles.privacyOptionText}>
                <Text style={styles.privacyOptionLabel}>{item.label}</Text>
                <Text style={styles.privacyOptionDesc}>{item.desc}</Text>
              </View>
              {privacyLevel === item.key && (
                <Ionicons name="checkmark" size={20} color="#3797EF" />
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* PHASE 2: Manual testing buttons */}
      <View style={styles.testSection}>
        <Text style={styles.testTitle}>🧪 Quick Test (Development Only)</Text>
        {['public', 'friends', 'private'].map(testLevel => (
          <TouchableOpacity
            key={testLevel}
            style={[styles.testButton, privacyLevel === testLevel && styles.testButtonActive]}
            onPress={() => {
              console.log(`🧪 TEST: Setting privacy to "${testLevel}"`);
              setPrivacyLevel(testLevel);
              setShowPrivacyModal(false);
            }}
          >
            <Text style={[
              styles.testButtonText, 
              privacyLevel === testLevel && styles.testButtonTextActive
            ]}>
              {testLevel.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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

  // Sections
  section: {
    marginBottom: 32,
    paddingHorizontal: 16,
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
});