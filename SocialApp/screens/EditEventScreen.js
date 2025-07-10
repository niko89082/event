// screens/EditEventScreen.js - Updated with Co-host management functionality + Photo Toggle
import React, { useState, useEffect, useContext } from 'react';
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

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { fetchNominatimSuggestions } from '../services/locationApi';
import { API_BASE_URL } from '@env';

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
  },
  { 
    key: 'secret', 
    label: 'Secret', 
    desc: 'Completely hidden, host controls all', 
    icon: 'eye-off-outline',
    color: '#FF3B30'
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);
  const [category, setCategory] = useState('General');
  const [cover, setCover] = useState(null);
  const [originalCoverImage, setOriginalCoverImage] = useState(null);

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

  // Load event data
  useEffect(() => {
    fetchEventData();
  }, [eventId]);

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
      const response = await api.get(`/api/events/${eventId}`);
      const event = response.data;

      console.log('📥 Loading event data:', {
        title: event.title,
        pricing: event.pricing,
        price: event.price,
        isPaidEvent: event.isPaidEvent
      });

      setTitle(event.title || '');
      setDescription(event.description || '');
      setDateTime(new Date(event.time));
      setLocation(event.location || '');
      setLocQuery(event.location || '');
      setCategory(event.category || 'General');
      setMaxAttendees(String(event.maxAttendees || 50));
      setTags(event.tags?.join(', ') || '');
      setPrivacyLevel(event.privacyLevel || 'public');
      setPermissions(event.permissions || permissions);
      setCoHosts(event.coHosts || []);
      setOriginalCoverImage(event.coverImage);
      
      // ADDED: Set photo sharing toggle from event data
      setAllowPhotos(event.allowPhotos !== false); // Default to true if not set
      
      // FIXED: Properly handle pricing data from both old and new formats
      if (event.pricing) {
        // New pricing structure
        setPrice(String((event.pricing.amount || 0) / 100)); // Convert cents to dollars
        setIsPaidEvent(!event.pricing.isFree);
        
        // FIXED: Map legacy refund policy values to correct enum values
        let mappedRefundPolicy = event.pricing.refundPolicy || 'no-refund';
        
        // Map legacy values to correct enum values
        const policyMapping = {
          'No refunds': 'no-refund',
          'No Refunds': 'no-refund',
          'Partial refunds': 'partial-refund',
          'Partial Refunds': 'partial-refund',
          'Full refunds': 'full-refund',
          'Full Refunds': 'full-refund',
          'Full refund': 'full-refund',
          'Custom': 'custom',
          'custom': 'custom',
          // Enum values (should already be correct)
          'no-refund': 'no-refund',
          'partial-refund': 'partial-refund',
          'full-refund': 'full-refund'
        };
        
        mappedRefundPolicy = policyMapping[mappedRefundPolicy] || 'no-refund';
        setRefundPolicy(mappedRefundPolicy);
        
        console.log('📝 Mapped refund policy:', {
          original: event.pricing.refundPolicy,
          mapped: mappedRefundPolicy
        });
      } else {
        // Legacy pricing structure
        setPrice(String(event.price || 0));
        setIsPaidEvent((event.price || 0) > 0);
        setRefundPolicy('no-refund'); // Default for legacy events
      }
      
      if (event.coordinates) {
        setCoords(event.coordinates);
      }

      console.log('✅ Event data loaded successfully');

    } catch (error) {
      console.error('Error fetching event:', error);
      Alert.alert('Error', 'Failed to load event data');
      navigation.goBack();
    } finally {
      setLoading(false);
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
    setCoHosts(prev => [...prev, user]);
    setCoHostSearchQuery('');
    setCoHostSearchResults([]);
  };

  // Remove co-host
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

  const handleSaveEvent = async () => {
    // Enhanced validation with debugging
    console.log('🔍 Saving event with values:', {
      title: `"${title}"`,
      titleLength: title.length,
      titleTrimmed: `"${title.trim()}"`,
      location: `"${location}"`,
      locationTrimmed: `"${location.trim()}"`
    });

    if (!title || !title.trim()) {
      console.error('❌ Title validation failed:', { title, trimmed: title.trim() });
      Alert.alert('Error', 'Event title is required');
      return;
    }

    if (!location || !location.trim()) {
      console.error('❌ Location validation failed:', { location, trimmed: location.trim() });
      Alert.alert('Error', 'Event location is required');
      return;
    }

    try {
      setSaving(true);
      console.log('🔄 Preparing event update data...');

      // Prepare the update data
      const priceInCents = Math.round(parseFloat(price || 0) * 100);
      const updateData = {
        title: title.trim(),
        description: description.trim(),
        time: dateTime.toISOString(),
        location: location.trim(),
        category: category,
        maxAttendees: parseInt(maxAttendees) || 0,
        privacyLevel: privacyLevel,
        allowPhotos: allowPhotos,
        coHosts: coHosts.map(coHost => coHost._id),
        permissions: {
          appearInFeed: permissions.appearInFeed,
          appearInSearch: permissions.appearInSearch,
          canJoin: permissions.canJoin || 'anyone',
          canShare: permissions.canShare || 'attendees',
          canInvite: permissions.canInvite || 'attendees',
          showAttendeesToPublic: permissions.showAttendeesToPublic
        },
        // FIXED: Include proper pricing structure
        pricing: {
          isFree: priceInCents === 0,
          amount: priceInCents,
          currency: 'USD',
          refundPolicy: refundPolicy
        },
        // Legacy price field for backward compatibility
        price: parseFloat(price || 0),
        // ADDED: Individual pricing fields that backend might expect
        isPaidEvent: priceInCents > 0,
        eventPrice: parseFloat(price || 0),
        refundPolicy: refundPolicy // Also send as individual field
      };

      // Add tags if provided
      if (tags && tags.trim()) {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        updateData.tags = tagArray;
      }

      // Add coordinates if available
      if (coords) {
        updateData.coordinates = coords;
      }

      console.log('📝 Update data prepared:', {
        ...updateData,
        coHosts: updateData.coHosts.length + ' co-hosts',
        pricingDebug: {
          refundPolicy: updateData.refundPolicy,
          pricingRefundPolicy: updateData.pricing.refundPolicy,
          priceInCents: priceInCents,
          isFree: priceInCents === 0
        }
      });

      // Handle cover image separately if it was changed
      if (cover) {
        console.log('🖼️ New cover image detected, using FormData approach');
        
        const formData = new FormData();
        
        // Add all the regular fields
        Object.keys(updateData).forEach(key => {
          if (key === 'coHosts' || key === 'permissions' || key === 'tags' || key === 'coordinates' || key === 'pricing') {
            formData.append(key, JSON.stringify(updateData[key]));
          } else {
            formData.append(key, updateData[key].toString());
          }
        });
        
        // Add the cover image
        formData.append('coverImage', {
          uri: cover,
          type: 'image/jpeg',
          name: 'cover.jpg',
        });

        console.log('🚀 Sending update with new cover image');
        const response = await api.put(`/api/events/${eventId}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        console.log('✅ Event update with image successful:', response.data);
      } else {
        console.log('📄 No new cover image, using JSON approach');
        console.log('🚀 Sending JSON update request to /api/events/' + eventId);
        
        const response = await api.put(`/api/events/${eventId}`, updateData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('✅ Event update successful:', response.data);
      }

      Alert.alert(
        'Success!',
        'Event updated successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error) {
      console.error('❌ Event update error:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error config:', error.config);
      
      // Log the actual data that was sent
      if (error.config?.data) {
        console.error('❌ Data sent to server:', error.config.data);
      }
      
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update event. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const pickCoverImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setCover(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
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

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="What's your event called?"
                placeholderTextColor="#C7C7CC"
                maxLength={100}
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
                maxLength={500}
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
                  onValueChange={setAllowPhotos}
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

          {/* Co-hosts Section */}
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
                        source={{ uri: item.profilePicture }} 
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
                    {item.displayName && (
                      <Text style={styles.searchResultDisplayName}>{item.displayName}</Text>
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
                      Search for friends to add as co-hosts
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
            <FlatList
              data={PRIVACY_LEVELS}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.privacyOption}
                  onPress={() => {
                    setPrivacyLevel(item.key);
                    setShowPrivacyModal(false);
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

  // ADDED: Photo Toggle Styles (same as CreateEventScreen)
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
});