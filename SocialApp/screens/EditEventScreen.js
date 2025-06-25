// screens/EditEventScreen.js - Enhanced UI and functionality
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import api from '../services/api';
import { fetchNominatimSuggestions } from '../services/locationApi';
import { API_BASE_URL } from '@env';

export default function EditEventScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const eventId = params?.eventId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Event data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');

  // Location
  const [locQuery, setLocQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);

  // Event settings
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState('');

  // Privacy & permissions
  const [privateEvent, setPrivateEvent] = useState(false);
  const [allowPhotos, setAllowPhotos] = useState(true);
  const [openToPublic, setOpenToPublic] = useState(true);
  const [allowUploads, setAllowUploads] = useState(true);
  const [allowUploadsBeforeStart, setAllowUploadsBeforeStart] = useState(true);

  // Media
  const [cover, setCover] = useState(null);
  const [newCoverImage, setNewCoverImage] = useState(null);

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
    if (eventId) loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const { data } = await api.get(`/api/events/${eventId}`);
      
      setTitle(data.title);
      setDescription(data.description);
      setDateTime(new Date(data.time));
      setLocation(data.location);
      setLocQuery(data.location);
      
      if (data.geo?.coordinates) {
        setCoords(data.geo.coordinates);
      }

      setMaxAttendees(String(data.maxAttendees));
      setPrice(String(data.price || 0));
      setCategory(data.category || '');

      setPrivateEvent(!data.isPublic);
      setAllowPhotos(data.allowPhotos);
      setOpenToPublic(data.openToPublic);
      setAllowUploads(data.allowUploads);
      setAllowUploadsBeforeStart(data.allowUploadsBeforeStart);

      if (data.coverImage) {
        setCover(`http://${API_BASE_URL}:3000${data.coverImage}`);
      }

    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
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
      }
    } else {
      setSuggestions([]);
    }
  };

  const pickSuggestion = (suggestion) => {
    setLocation(suggestion.display_name);
    setLocQuery(suggestion.display_name);
    setCoords([parseFloat(suggestion.lon), parseFloat(suggestion.lat)]);
    setSuggestions([]);
  };

  const pickCoverImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setNewCoverImage(result.assets[0]);
        setCover(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Event location is required');
      return;
    }

    try {
      setSaving(true);

      let coverImagePath = null;
      if (newCoverImage) {
        // Use the existing photo upload endpoint instead
        const formData = new FormData();
        formData.append('photos', {
          uri: newCoverImage.uri,
          type: newCoverImage.type || 'image/jpeg',
          name: 'cover.jpg',
        });

        try {
          const uploadResponse = await api.post('/api/photos/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          
          // Use the first uploaded photo path as cover image
          if (uploadResponse.data.paths && uploadResponse.data.paths.length > 0) {
            coverImagePath = uploadResponse.data.paths[0];
          }
        } catch (uploadError) {
          console.error('Cover image upload error:', uploadError);
          Alert.alert('Warning', 'Failed to upload cover image, but event details will be saved');
        }
      }

      const eventData = {
        title: title.trim(),
        description: description.trim(),
        time: dateTime.toISOString(),
        location: location.trim(),
        maxAttendees: parseInt(maxAttendees) || 10,
        price: parseFloat(price) || 0,
        category: category.trim() || 'General',
        isPublic: !privateEvent,
        allowPhotos,
        openToPublic,
        allowUploads,
        allowUploadsBeforeStart,
      };

      if (coords) {
        eventData.geo = {
          type: 'Point',
          coordinates: coords
        };
      }

      if (coverImagePath) {
        eventData.coverImage = coverImagePath;
      }

      await api.put(`/api/events/${eventId}`, eventData);
      
      Alert.alert('Success', 'Event updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      console.error('Save event error:', error);
      Alert.alert('Error', 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event', 
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await api.delete(`/api/events/${eventId}`);
              Alert.alert('Deleted', 'Event has been deleted', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete event');
            }
          }
        }
      ]
    );
  };

  const showDatePicker = () => {
    setPickerMode('date');
    setShowPicker(true);
  };

  const showTimePicker = () => {
    setPickerMode('time');
    setShowPicker(true);
  };

  const onDateTimeChange = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDateTime(selectedDate);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={24} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Event</Text>
        
        <TouchableOpacity
          style={[styles.headerButton, styles.saveButton]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover Image Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cover Image</Text>
          <TouchableOpacity
            style={styles.coverImageContainer}
            onPress={pickCoverImage}
            activeOpacity={0.8}
          >
            {cover ? (
              <Image source={{ uri: cover }} style={styles.coverImage} />
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
            <Text style={styles.label}>Event Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What's your event called?"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell people what your event is about..."
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Social, Business, Entertainment"
              placeholderTextColor="#8E8E93"
            />
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When</Text>
          
          <View style={styles.dateTimeContainer}>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={showDatePicker}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={20} color="#3797EF" />
              <Text style={styles.dateTimeText}>
                {dateTime.toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={showTimePicker}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={20} color="#3797EF" />
              <Text style={styles.dateTimeText}>
                {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Where</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={locQuery}
              onChangeText={onLocQuery}
              placeholder="Search for a venue or address"
              placeholderTextColor="#8E8E93"
            />
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => pickSuggestion(suggestion)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="location-outline" size={16} color="#8E8E93" />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {suggestion.display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Event Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Maximum Attendees</Text>
            <TextInput
              style={styles.input}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="How many people can attend?"
              placeholderTextColor="#8E8E93"
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
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Privacy & Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Permissions</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Private Event</Text>
              <Text style={styles.switchDescription}>Only invited people can see and join</Text>
            </View>
            <Switch
              value={privateEvent}
              onValueChange={setPrivateEvent}
              trackColor={{ false: '#F2F2F7', true: '#3797EF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Allow Photos</Text>
              <Text style={styles.switchDescription}>Attendees can take photos at the event</Text>
            </View>
            <Switch
              value={allowPhotos}
              onValueChange={setAllowPhotos}
              trackColor={{ false: '#F2F2F7', true: '#3797EF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Allow Uploads</Text>
              <Text style={styles.switchDescription}>Attendees can upload photos to the event</Text>
            </View>
            <Switch
              value={allowUploads}
              onValueChange={setAllowUploads}
              trackColor={{ false: '#F2F2F7', true: '#3797EF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Open to Public</Text>
              <Text style={styles.switchDescription}>Anyone can find and join this event</Text>
            </View>
            <Switch
              value={openToPublic}
              onValueChange={setOpenToPublic}
              trackColor={{ false: '#F2F2F7', true: '#3797EF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Event</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Date/Time Picker */}
      {showPicker && (
        <DateTimePicker
          value={dateTime}
          mode={pickerMode}
          display="default"
          onChange={onDateTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  saveButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  dangerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 16,
  },
  
  // Cover Image
  coverImageContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImageOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  
  // Input Groups
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
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  
  // Date Time
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  
  // Location Suggestions
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
  },
  
  // Switch Rows
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  
  // Delete Button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});