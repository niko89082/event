// screens/CreateEventScreen.js - 2-Step Process with Cover Image First
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Image, Alert, ScrollView,
  Switch, TouchableOpacity, Modal, FlatList, SafeAreaView, StatusBar,
  Animated, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import api from '../services/api';
import { fetchNominatimSuggestions } from '../services/locationApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  'General', 'Music', 'Arts', 'Sports', 'Food', 'Technology', 'Business',
  'Health', 'Education', 'Travel', 'Photography', 'Gaming', 'Fashion',
  'Movies', 'Books', 'Fitness', 'Outdoor', 'Indoor'
];

export default function CreateEventScreen({ navigation, route }) {
  const { groupId } = route.params || {};

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
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [permissions, setPermissions] = useState({
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  });
  const [allowPhotos, setAllowPhotos] = useState(true);
  const [allowUploads, setAllowUploads] = useState(true);
  const [allowUploadsBeforeStart, setAllowUploadsBeforeStart] = useState(true);

  // Modal states
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  useEffect(() => {
    // Animate step transitions and update progress
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

  const goToStep = (newStep) => {
    if (newStep > step && newStep === 2) {
      if (!title.trim() || !location.trim()) {
        Alert.alert('Required Fields', 'Please fill in the title and location to continue.');
        return;
      }
    }
    setStep(newStep);
  };

  const onLocQuery = async (txt) => {
    setLocQuery(txt);
    if (txt.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetchNominatimSuggestions(txt);
      setSuggestions(res.slice(0, 4)); // Show only 4 suggestions
    } catch (error) {
      console.error('Location search error:', error);
      setSuggestions([]);
    }
  };

  const pickSuggestion = (s) => {
    setLocation(s.display_name);
    setCoords([Number(s.lon), Number(s.lat)]);
    setLocQuery(s.display_name);
    setSuggestions([]);
  };

  const pickCover = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        aspect: [16, 9],
      });
      if (!result.canceled) {
        setCover(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const createEvent = async () => {
    if (!title.trim() || !location.trim()) {
      Alert.alert('Missing Information', 'Please fill in the title and location.');
      return;
    }

    setCreating(true);
    
    try {
      const fd = new FormData();
      
      // Basic fields
      fd.append('title', title);
      fd.append('description', description);
      fd.append('category', category);
      fd.append('time', dateTime.toISOString());
      fd.append('location', location);
      if (coords) {
        fd.append('geo', JSON.stringify({ type: 'Point', coordinates: coords }));
      }
      fd.append('maxAttendees', maxAttendees);
      fd.append('price', price);

      // Privacy settings
      fd.append('privacyLevel', privacyLevel);
      fd.append('appearInFeed', permissions.appearInFeed.toString());
      fd.append('appearInSearch', permissions.appearInSearch.toString());
      fd.append('showAttendeesToPublic', permissions.showAttendeesToPublic.toString());

      // Discovery fields
      fd.append('tags', tags);

      // Media settings
      fd.append('allowPhotos', allowPhotos.toString());
      fd.append('allowUploads', allowUploads.toString());
      fd.append('allowUploadsBeforeStart', allowUploadsBeforeStart.toString());

      if (groupId) fd.append('groupId', groupId);

      if (cover) {
        fd.append('coverImage', {
          uri: cover.uri,
          type: 'image/jpeg',
          name: 'cover.jpg'
        });
      }

      const endpoint = groupId 
        ? `/api/events/create-from-group/${groupId}` 
        : '/api/events/create';
      
      await api.post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      Alert.alert('Success!', 'Your event has been created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', e.response?.data?.message || 'Failed to create event. Please try again.');
    } finally {
      setCreating(false);
    }
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
      <Text style={styles.progressText}>Step {step} of 2</Text>
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

  const renderFormGroup = (label, required = false, help = null, children) => (
    <View style={styles.formGroup}>
      <Text style={[styles.formLabel, required && styles.formLabelRequired]}>
        {label}
        {required && <Text style={styles.requiredStar}> *</Text>}
      </Text>
      {children}
      {help && <Text style={styles.formHelp}>{help}</Text>}
    </View>
  );

  const renderToggle = (label, description, value, onValueChange) => (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E1E1E1', true: '#34C759' }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E1E1E1"
      />
    </View>
  );

  const renderCategoryGrid = () => (
    <FlatList
      data={CATEGORIES}
      keyExtractor={item => item}
      numColumns={3}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.categoryChip,
            category === item && styles.selectedCategoryChip
          ]}
          onPress={() => {
            setCategory(item);
            setShowCategoryModal(false);
          }}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.categoryText,
            category === item && styles.selectedCategoryText
          ]}>
            {item}
          </Text>
        </TouchableOpacity>
      )}
      scrollEnabled={false}
      contentContainerStyle={styles.categoryGrid}
    />
  );

  const renderPrivacyModal = () => (
    <Modal
      visible={showPrivacyModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPrivacyModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Privacy Level</Text>
          <TouchableOpacity 
            onPress={() => setShowPrivacyModal(false)}
            style={styles.modalClose}
          >
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={PRIVACY_LEVELS}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.privacyOption,
                privacyLevel === item.key && styles.selectedPrivacyOption
              ]}
              onPress={() => {
                setPrivacyLevel(item.key);
                setShowPrivacyModal(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.privacyOptionLeft}>
                <View style={[styles.privacyOptionIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.privacyOptionText}>
                  <Text style={styles.privacyOptionLabel}>{item.label}</Text>
                  <Text style={styles.privacyOptionDesc}>{item.desc}</Text>
                </View>
              </View>
              {privacyLevel === item.key && (
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.privacyList}
        />
      </SafeAreaView>
    </Modal>
  );

  const renderCategoryModal = () => (
    <Modal
      visible={showCategoryModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCategoryModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Category</Text>
          <TouchableOpacity 
            onPress={() => setShowCategoryModal(false)}
            style={styles.modalClose}
          >
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        
        <ScrollView contentContainerStyle={styles.modalContent}>
          {renderCategoryGrid()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const getCurrentPrivacy = () => {
    return PRIVACY_LEVELS.find(p => p.key === privacyLevel) || PRIVACY_LEVELS[0];
  };

  const renderStep1 = () => (
    <KeyboardAvoidingView 
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover Image First */}
        {renderFormGroup('Cover Image', false, null, (
          <TouchableOpacity
            style={[styles.coverUpload, cover && styles.coverUploadWithImage]}
            onPress={pickCover}
            activeOpacity={0.8}
          >
            {cover ? (
              <>
                <Image source={{ uri: cover.uri }} style={styles.coverPreview} />
                <TouchableOpacity
                  style={styles.removeCoverButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    setCover(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.coverUploadContent}>
                <View style={styles.coverUploadIcon}>
                  <Ionicons name="camera" size={24} color="#3797EF" />
                </View>
                <Text style={styles.coverUploadText}>Add Cover Image</Text>
                <Text style={styles.coverUploadSubtext}>Optional</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {renderFormGroup('Event Title', true, null, (
          <TextInput
            style={styles.formInput}
            value={title}
            onChangeText={setTitle}
            placeholder="What's your event called?"
            placeholderTextColor="#8E8E93"
            maxLength={100}
          />
        ))}

        {renderFormGroup('Description', false, null, (
          <TextInput
            style={[styles.formInput, styles.textArea]}
            multiline
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people what to expect..."
            placeholderTextColor="#8E8E93"
            maxLength={500}
            textAlignVertical="top"
          />
        ))}

        {renderFormGroup('Category', false, null, (
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.selectorText}>{category}</Text>
            <Ionicons name="chevron-down" size={20} color="#8E8E93" />
          </TouchableOpacity>
        ))}

        {renderFormGroup('Date & Time', true, null, (
          <View style={styles.dateTimeContainer}>
            <TouchableOpacity
              style={[styles.formInput, styles.dateTimeInput]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color="#3797EF" />
              <Text style={styles.dateTimeText}>
                {dateTime.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.formInput, styles.dateTimeInput]}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={18} color="#3797EF" />
              <Text style={styles.dateTimeText}>
                {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {renderFormGroup('Location', true, null, (
          <View style={styles.locationContainer}>
            <TextInput
              style={styles.formInput}
              value={locQuery}
              onChangeText={onLocQuery}
              placeholder="Search for a location..."
              placeholderTextColor="#8E8E93"
            />
            {suggestions.length > 0 && (
              <View style={styles.suggestionsDropdown}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={suggestion.place_id || index}
                    onPress={() => pickSuggestion(suggestion)}
                    style={[
                      styles.suggestionItem,
                      index === suggestions.length - 1 && styles.lastSuggestionItem
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="location-outline" size={16} color="#8E8E93" />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {suggestion.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.stepActionsContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, (!title.trim() || !location.trim()) && styles.primaryButtonDisabled]}
          onPress={() => goToStep(2)}
          disabled={!title.trim() || !location.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderStep2 = () => (
    <KeyboardAvoidingView 
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Privacy Settings */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Privacy & Visibility</Text>
          
          {renderFormGroup('Privacy Level', false, null, (
            <TouchableOpacity
              style={styles.privacySelector}
              onPress={() => setShowPrivacyModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.privacySelectorLeft}>
                <View style={[styles.privacySelectorIcon, { backgroundColor: getCurrentPrivacy().color + '20' }]}>
                  <Ionicons name={getCurrentPrivacy().icon} size={24} color={getCurrentPrivacy().color} />
                </View>
                <View style={styles.privacySelectorText}>
                  <Text style={styles.privacySelectorLabel}>{getCurrentPrivacy().label}</Text>
                  <Text style={styles.privacySelectorDesc}>{getCurrentPrivacy().desc}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </TouchableOpacity>
          ))}

          {renderToggle(
            'Appear in Feed',
            'Show this event in public feeds',
            permissions.appearInFeed,
            (value) => setPermissions(prev => ({ ...prev, appearInFeed: value }))
          )}

          {renderToggle(
            'Appear in Search',
            'Allow people to find this event in search',
            permissions.appearInSearch,
            (value) => setPermissions(prev => ({ ...prev, appearInSearch: value }))
          )}

          {renderToggle(
            'Show Attendees',
            'Let people see who else is attending',
            permissions.showAttendeesToPublic,
            (value) => setPermissions(prev => ({ ...prev, showAttendeesToPublic: value }))
          )}
        </View>

        {/* Event Capacity & Pricing */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Capacity & Pricing</Text>
          
          {renderFormGroup('Maximum Attendees', false, 'Set a limit to manage capacity', (
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="How many people can attend?"
              placeholderTextColor="#8E8E93"
            />
          ))}

          {renderFormGroup('Price (USD)', false, 'Leave as 0 for free events', (
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
              placeholder="0 for free events"
              placeholderTextColor="#8E8E93"
            />
          ))}
        </View>

        {/* Tags & Discovery */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Tags & Discovery</Text>
          
          {renderFormGroup('Tags', false, 'Comma-separated tags to help people find your event', (
            <TextInput
              style={styles.formInput}
              value={tags}
              onChangeText={setTags}
              placeholder="music, outdoor, family-friendly..."
              placeholderTextColor="#8E8E93"
            />
          ))}
        </View>

        {/* Photo Settings */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Photo Settings</Text>
          
          {renderToggle(
            'Allow Photos',
            'Let attendees upload photos during the event',
            allowPhotos,
            setAllowPhotos
          )}

          {renderToggle(
            'Allow Photo Uploads',
            'Enable photo sharing for this event',
            allowUploads,
            setAllowUploads
          )}

          {renderToggle(
            'Allow Pre-event Uploads',
            'Allow photo uploads before the event starts',
            allowUploadsBeforeStart,
            setAllowUploadsBeforeStart
          )}
        </View>
      </ScrollView>

      <View style={styles.stepActionsContainer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => goToStep(1)}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#3797EF" />
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.primaryButton, creating && styles.primaryButtonDisabled]}
          onPress={createEvent}
          disabled={creating}
          activeOpacity={0.8}
        >
          {creating ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Creating...</Text>
            </>
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Create Event</Text>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={styles.headerRight} />
      </View>

      {renderStepIndicator()}
      {renderProgressBar()}

      <View style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </View>

      {/* Date Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={dateTime}
          mode="date"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) setDateTime(date);
          }}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={dateTime}
          mode="time"
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (date) setDateTime(date);
          }}
        />
      )}

      {/* Modals */}
      {renderPrivacyModal()}
      {renderCategoryModal()}
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
    paddingVertical: 16,
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
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
  },
  progressBar: {
    width: '100%',
    height: 2,
    backgroundColor: '#E1E1E1',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3797EF',
    borderRadius: 1,
  },
  progressText: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
  },

  // Content
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Scroll Content
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 100, // Space for button
  },
  
  // Step Actions
  stepActionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  // Subsections
  subsection: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },

  // Form Elements
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  formLabelRequired: {
    // Style for required labels
  },
  requiredStar: {
    color: '#FF3B30',
  },
  formInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#000000',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formHelp: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },

  // DateTime
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#000000',
  },

  // Selector
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    padding: 16,
  },
  selectorText: {
    fontSize: 16,
    color: '#000000',
  },

  // Location Container & Dropdown
  locationContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  lastSuggestionItem: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },

  // Privacy Selector
  privacySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    padding: 16,
  },
  privacySelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privacySelectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  privacySelectorText: {
    flex: 1,
  },
  privacySelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  privacySelectorDesc: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Category Grid
  categoryGrid: {
    paddingHorizontal: 0,
  },
  categoryChip: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    margin: 4,
    alignItems: 'center',
  },
  selectedCategoryChip: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Cover Image
  coverUpload: {
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E1E1E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  coverUploadWithImage: {
    borderStyle: 'solid',
    borderWidth: 0,
    padding: 0,
  },
  coverPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeCoverButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverUploadContent: {
    alignItems: 'center',
  },
  coverUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  coverUploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  coverUploadSubtext: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Action Buttons
  stepActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
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

  // Modal
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalClose: {
    padding: 8,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Privacy Options
  privacyList: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectedPrivacyOption: {
    backgroundColor: '#F0F8FF',
    borderColor: '#3797EF',
  },
  privacyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privacyOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 12,
    color: '#8E8E93',
  },
});