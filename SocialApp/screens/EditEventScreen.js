// screens/EditEventScreen.js - Updated with Co-host management functionality
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

      setTitle(event.title || '');
      setDescription(event.description || '');
      setDateTime(new Date(event.time));
      setLocation(event.location || '');
      setLocQuery(event.location || '');
      setCategory(event.category || 'General');
      setMaxAttendees(String(event.maxAttendees || 50));
      setPrice(String(event.price || 0));
      setTags(event.tags?.join(', ') || '');
      setPrivacyLevel(event.privacyLevel || 'public');
      setPermissions(event.permissions || permissions);
      setCoHosts(event.coHosts || []);
      setOriginalCoverImage(event.coverImage);
      
      if (event.coordinates) {
        setCoords(event.coordinates);
      }

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
    if (!query.trim()) {
      setCoHostSearchResults([]);
      return;
    }

    try {
      setSearchingCoHosts(true);
      const response = await api.get(`/api/users/search`, {
        params: { q: query, limit: 10 }
      });
      
      // Filter out current user and already selected co-hosts
      const results = response.data.filter(user => 
        user._id !== currentUser._id && 
        !coHosts.some(coHost => coHost._id === user._id)
      );
      
      setCoHostSearchResults(results);
    } catch (error) {
      console.error('Error searching co-hosts:', error);
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
    if (!title.trim() || !location.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();
      
      // Basic fields
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('time', dateTime.toISOString());
      formData.append('location', location.trim());
      formData.append('category', category);
      formData.append('maxAttendees', parseInt(maxAttendees) || 0);
      formData.append('price', parseFloat(price) || 0);
      formData.append('privacyLevel', privacyLevel);
      
      // Co-hosts
      formData.append('coHosts', JSON.stringify(coHosts.map(coHost => coHost._id)));
      
      // Permissions
      formData.append('permissions', JSON.stringify(permissions));
      
      // Tags
      if (tags.trim()) {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        formData.append('tags', JSON.stringify(tagArray));
      }
      
      // Coordinates if available
      if (coords) {
        formData.append('coordinates', JSON.stringify(coords));
      }
      
      // Cover image if changed
      if (cover) {
        formData.append('coverImage', {
          uri: cover,
          type: 'image/jpeg',
          name: 'cover.jpg',
        });
      }

      await api.put(`/api/events/${eventId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

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
      console.error('Event update error:', error);
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
            <Text style={styles.sectionTitle}>Privacy & Permissions</Text>

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

            {/* Permission Toggles */}
            <View style={styles.permissionsList}>
              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Show in Feed</Text>
                <Switch
                  value={permissions.appearInFeed}
                  onValueChange={(value) => 
                    setPermissions(prev => ({ ...prev, appearInFeed: value }))
                  }
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Show in Search</Text>
                <Switch
                  value={permissions.appearInSearch}
                  onValueChange={(value) => 
                    setPermissions(prev => ({ ...prev, appearInSearch: value }))
                  }
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Show Attendee List</Text>
                <Switch
                  value={permissions.showAttendeesToPublic}
                  onValueChange={(value) => 
                    setPermissions(prev => ({ ...prev, showAttendeesToPublic: value }))
                  }
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
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
  permissionsList: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 4,
  },
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