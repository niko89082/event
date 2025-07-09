// screens/CreateEventScreen.js - Phase 2: Simplified Privacy + Form Toggle
import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View, Text, StyleSheet, TextInput, Image, Alert, ScrollView,
  Switch, TouchableOpacity, Modal, FlatList, SafeAreaView, StatusBar,
  Animated, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { fetchNominatimSuggestions } from '../services/locationApi';
import PaymentSetupComponent from '../components/PaymentSetupComponent';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  },
  { 
    key: 'secret', 
    label: 'Secret', 
    desc: 'Completely hidden, host controls all', 
    icon: 'eye-off-outline',
    color: '#FF3B30'
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

  // Step management
  const [step, setStep] = useState(1);

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

  // Advanced fields (Step 2)
  const [maxAttendees, setMaxAttendees] = useState('50');
  const [price, setPrice] = useState('0');
  const [tags, setTags] = useState('');
  
  // PHASE 2: Simplified privacy (no redundant toggles)
  const [privacyLevel, setPrivacyLevel] = useState('public');

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

  // UI state
  const [creating, setCreating] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

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
      headerTitle: step === 1 ? 'New Event' : 'Event Details',
      headerLeft: () => (
        <TouchableOpacity
          onPress={step === 1 ? () => navigation.goBack() : () => setStep(1)}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={step === 1 ? handleNext : handleCreate}
          style={[styles.headerButton, (!canProceed() || creating) && styles.headerButtonDisabled]}
          disabled={!canProceed() || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.headerButtonText, (!canProceed() || creating) && styles.headerButtonTextDisabled]}>
              {step === 1 ? 'Next' : 'Create'}
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [step, title, location, dateTime, creating, coHosts, isPaidEvent, price, requiresCheckInForm, selectedForm]);

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
    if (step === 1) {
      return title.trim() && location.trim() && dateTime > new Date();
    }
    // Step 2 validation including form requirement
    if (requiresCheckInForm && !selectedForm) {
      return false;
    }
    return validatePricing();
  };

  const handleNext = () => {
    if (canProceed()) {
      setStep(2);
    }
  };

  const handleCreate = async () => {
    if (!canProceed() || creating) return;

    try {
      setCreating(true);

      const formData = new FormData();
      
      // Basic fields
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('time', dateTime.toISOString());
      formData.append('location', location.trim());
      formData.append('category', category);
      formData.append('maxAttendees', parseInt(maxAttendees) || 0);
      
      // PHASE 2: Simplified privacy (auto-calculated permissions)
      formData.append('privacyLevel', privacyLevel);
      
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
      
      // Tags
      if (tags.trim()) {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        formData.append('tags', JSON.stringify(tagArray));
      }
      
      // Coordinates if available
      if (coords) {
        formData.append('coordinates', JSON.stringify(coords));
      }
      
      // Group ID if creating from group
      if (groupId) {
        formData.append('groupId', groupId);
      }
      
      // Cover image
      if (cover) {
        formData.append('coverImage', {
          uri: cover,
          type: 'image/jpeg',
          name: 'cover.jpg',
        });
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

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Cover Image Section */}
            <TouchableOpacity
              style={styles.coverSection}
              onPress={pickCoverImage}
              activeOpacity={0.9}
            >
              {cover ? (
                <Image source={{ uri: cover }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="camera" size={48} color="#C7C7CC" />
                  <Text style={styles.coverPlaceholderText}>Add Cover Photo</Text>
                </View>
              )}
              <View style={styles.coverOverlay}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.formContainer}>
              {/* Title */}
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

              {/* Date & Time */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>When *</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                    <Text style={styles.dateTimeButtonText}>
                      {dateTime.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="#8E8E93" />
                    <Text style={styles.dateTimeButtonText}>
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

              {/* Description */}
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

              {/* Category */}
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
          </ScrollView>
        </KeyboardAvoidingView>

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

        {/* Payment Setup Modal */}
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
      </SafeAreaView>
    );
  }

  // Step 2: Advanced Settings with Simplified Privacy and Form Toggle
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            
            {/* PHASE 2: Simplified Privacy Settings */}
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

            {/* PHASE 2: Check-in Form Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Check-in Form</Text>
              <Text style={styles.sectionDescription}>
                Collect additional information when attendees check in
              </Text>

              {/* Smart recommendation banner */}
              {FORM_RECOMMENDATIONS[category] && (
                <View style={styles.recommendationBanner}>
                  <Ionicons name="lightbulb" size={20} color="#FF9500" />
                  <View style={styles.recommendationText}>
                    <Text style={styles.recommendationTitle}>Recommendation</Text>
                    <Text style={styles.recommendationDesc}>
                      {FORM_RECOMMENDATIONS[category].title}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.formToggleContainer}>
                <View style={styles.formToggleRow}>
                  <View style={styles.formToggleText}>
                    <Text style={styles.formToggleLabel}>Require Check-in Form</Text>
                    <Text style={styles.formToggleDesc}>
                      Attendees must fill out a form when checking in
                    </Text>
                  </View>
                  <Switch
                    value={requiresCheckInForm}
                    onValueChange={handleFormToggle}
                    trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Form Selection */}
                {requiresCheckInForm && (
                  <View style={styles.formSelectionContainer}>
                    {selectedForm ? (
                      <View style={styles.selectedFormCard}>
                        <View style={styles.selectedFormInfo}>
                          <Ionicons name="document-text" size={24} color="#3797EF" />
                          <View style={styles.selectedFormText}>
                            <Text style={styles.selectedFormTitle}>{selectedForm.title}</Text>
                            <Text style={styles.selectedFormDesc}>
                              {selectedForm.questions?.length || 0} questions
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => setSelectedForm(null)}
                          style={styles.removeFormButton}
                        >
                          <Ionicons name="close" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.formSelectionButtons}>
                        <TouchableOpacity
                          style={styles.formSelectionButton}
                          onPress={() => setShowFormModal(true)}
                        >
                          <Ionicons name="list" size={20} color="#3797EF" />
                          <Text style={styles.formSelectionButtonText}>Choose Existing Form</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.formSelectionButton, styles.createFormButton]}
                          onPress={handleCreateNewForm}
                        >
                          <Ionicons name="add" size={20} color="#FFFFFF" />
                          <Text style={[styles.formSelectionButtonText, { color: '#FFFFFF' }]}>
                            Create New Form
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Event Pricing */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Event Pricing</Text>
              <Text style={styles.sectionDescription}>
                Configure ticket pricing for your event
              </Text>

              {/* Payment Status Indicator */}
              {paymentStatus && (
                <View style={[
                  styles.paymentStatusBanner,
                  paymentStatus.canReceivePayments ? styles.statusReady : styles.statusPending
                ]}>
                  <Ionicons 
                    name={paymentStatus.canReceivePayments ? "checkmark-circle" : "warning"} 
                    size={20} 
                    color={paymentStatus.canReceivePayments ? "#34C759" : "#FF9500"} 
                  />
                  <Text style={[
                    styles.statusText,
                    { color: paymentStatus.canReceivePayments ? "#34C759" : "#FF9500" }
                  ]}>
                    {paymentStatus.canReceivePayments 
                      ? 'Payment account ready - you can create paid events'
                      : 'Payment setup required for paid events'
                    }
                  </Text>
                </View>
              )}

              {/* Paid Event Toggle */}
              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Paid Event</Text>
                <Switch
                  value={isPaidEvent}
                  onValueChange={handlePaidEventToggle}
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Price Configuration */}
              {isPaidEvent && paymentStatus?.canReceivePayments && (
                <View style={styles.pricingConfig}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Ticket Price ($) *</Text>
                    <TextInput
                      style={styles.input}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="25.00"
                      placeholderTextColor="#C7C7CC"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Price Description (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={priceDescription}
                      onChangeText={setPriceDescription}
                      placeholder="e.g., Includes drinks and appetizers"
                      placeholderTextColor="#C7C7CC"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Refund Policy</Text>
                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() => setShowRefundPolicyModal(true)}
                    >
                      <Text style={styles.selectButtonText}>
                        {REFUND_POLICIES.find(p => p.key === refundPolicy)?.label || 'No Refunds'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>

                  {/* Early Bird Pricing */}
                  <View style={styles.permissionItem}>
                    <Text style={styles.permissionLabel}>Early Bird Pricing</Text>
                    <Switch
                      value={earlyBirdEnabled}
                      onValueChange={setEarlyBirdEnabled}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {earlyBirdEnabled && (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Early Bird Price ($) *</Text>
                        <TextInput
                          style={styles.input}
                          value={earlyBirdPrice}
                          onChangeText={setEarlyBirdPrice}
                          placeholder="20.00"
                          placeholderTextColor="#C7C7CC"
                          keyboardType="decimal-pad"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Early Bird Deadline *</Text>
                        <TouchableOpacity
                          style={styles.dateTimeButton}
                          onPress={() => setShowEarlyBirdDatePicker(true)}
                        >
                          <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                          <Text style={styles.dateTimeButtonText}>
                            {earlyBirdDeadline.toLocaleDateString()}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {showEarlyBirdDatePicker && (
                        <DateTimePicker
                          value={earlyBirdDeadline}
                          mode="datetime"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={onEarlyBirdDateChange}
                        />
                      )}
                    </>
                  )}

                  {/* Pricing Summary */}
                  {price && parseFloat(price) > 0 && (
                    <View style={styles.pricingSummary}>
                      <Text style={styles.summaryTitle}>Pricing Summary</Text>
                      
                      {earlyBirdEnabled && earlyBirdPrice && (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Early Bird Price:</Text>
                          <Text style={styles.summaryValue}>${parseFloat(earlyBirdPrice).toFixed(2)}</Text>
                        </View>
                      )}
                      
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Regular Price:</Text>
                        <Text style={styles.summaryValue}>${parseFloat(price).toFixed(2)}</Text>
                      </View>
                      
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabelSmall}>Processing Fee (2.9% + $0.30):</Text>
                        <Text style={styles.summaryValueSmall}>
                          ~${((parseFloat(price) * 0.029) + 0.30).toFixed(2)}
                        </Text>
                      </View>
                      
                      <View style={[styles.summaryRow, styles.summaryRowHighlight]}>
                        <Text style={styles.summaryLabelEarnings}>Your Estimated Earnings:</Text>
                        <Text style={styles.summaryValueEarnings}>
                          ~${calculateEstimatedEarnings(price)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Co-hosts Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Co-hosts</Text>
              <Text style={styles.sectionDescription}>
                Add friends to help you manage this event
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
              <Text style={styles.sectionTitle}>Event Settings</Text>

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

      {/* Form Selection Modal */}
      <Modal
        visible={showFormModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFormModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Check-in Form</Text>
              <TouchableOpacity onPress={() => setShowFormModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            {loadingForms ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3797EF" />
                <Text style={styles.loadingText}>Loading your forms...</Text>
              </View>
            ) : (
              <FlatList
                data={availableForms}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.formItem}
                    onPress={() => handleFormSelect(item)}
                  >
                    <View style={styles.formItemContent}>
                      <Ionicons name="document-text" size={24} color="#3797EF" />
                      <View style={styles.formItemText}>
                        <Text style={styles.formItemTitle}>{item.title}</Text>
                        <Text style={styles.formItemDesc}>
                          {item.questions?.length || 0} questions • {item.category || 'General'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.emptyFormsContainer}>
                    <Ionicons name="document-outline" size={48} color="#C7C7CC" />
                    <Text style={styles.emptyFormsTitle}>No Forms Yet</Text>
                    <Text style={styles.emptyFormsDesc}>
                      Create your first check-in form to collect information from attendees
                    </Text>
                    <TouchableOpacity
                      style={styles.createFirstFormButton}
                      onPress={handleCreateNewForm}
                    >
                      <Text style={styles.createFirstFormButtonText}>Create Your First Form</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Refund Policy Modal */}
      <Modal
        visible={showRefundPolicyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRefundPolicyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refund Policy</Text>
              <TouchableOpacity onPress={() => setShowRefundPolicyModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={REFUND_POLICIES}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    setRefundPolicy(item.key);
                    setShowRefundPolicyModal(false);
                  }}
                >
                  <Text style={[
                    styles.categoryText,
                    refundPolicy === item.key && styles.categoryTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {refundPolicy === item.key && (
                    <Ionicons name="checkmark" size={20} color="#3797EF" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Payment Setup Modal */}
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
    </SafeAreaView>
  );
}

// Enhanced Styles with Phase 2 additions
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

  // Privacy Settings (Simplified)
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
});