// screens/EditEventScreen.js - FIXED COVER IMAGE UPLOAD
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Alert, ActivityIndicator,
  Image, Platform, StatusBar, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function EditEventScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const eventId = params?.eventId;

  // Form state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [location, setLocation] = useState('');
  const [locQuery, setLocQuery] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [price, setPrice] = useState('0');
  const [suggestions, setSuggestions] = useState([]);
  const [coords, setCoords] = useState(null);

  // Date/time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Permissions
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
    setLocation(text);

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
        // FIXED: Use the correct event cover image upload endpoint
        const formData = new FormData();
        formData.append('coverImage', {
          uri: newCoverImage.uri,
          type: newCoverImage.type || 'image/jpeg',
          name: 'cover.jpg',
        });

        try {
          // FIXED: Use events endpoint with coverImage field name
          const uploadResponse = await api.post(`/api/events/${eventId}/cover`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          
          // The endpoint should return the cover image path
          if (uploadResponse.data.coverImage) {
            coverImagePath = uploadResponse.data.coverImage;
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
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          }
        }
      ]
    );
  };

  const fetchNominatimSuggestions = async (query) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Nominatim error:', error);
      return [];
    }
  };

  const showDatePickerModal = () => setShowDatePicker(true);
  const showTimePickerModal = () => setShowTimePicker(true);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
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
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="close" size={28} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Event</Text>
        
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7}>
          {saving ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

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
              onPress={showDatePickerModal}
            >
              <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
              <Text style={styles.dateTimeText}>
                {dateTime.toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={showTimePickerModal}
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
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={locQuery}
              onChangeText={onLocQuery}
              placeholder="Where is your event?"
              placeholderTextColor="#8E8E93"
            />
            
            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => pickSuggestion(suggestion)}
                  >
                    <Ionicons name="location-outline" size={16} color="#8E8E93" />
                    <Text style={styles.suggestionText}>{suggestion.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
              placeholder="How many people can attend?"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Entry Price ($)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor="#8E8E93"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Privacy & Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Permissions</Text>
          
          <View style={styles.toggleGroup}>
            <View style={styles.toggleItem}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Private Event</Text>
                <Text style={styles.toggleDescription}>Only invited people can see and join</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, privateEvent && styles.toggleActive]}
                onPress={() => setPrivateEvent(!privateEvent)}
              >
                <View style={[styles.toggleThumb, privateEvent && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleItem}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Allow Photos</Text>
                <Text style={styles.toggleDescription}>Let attendees upload photos</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, allowPhotos && styles.toggleActive]}
                onPress={() => setAllowPhotos(!allowPhotos)}
              >
                <View style={[styles.toggleThumb, allowPhotos && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleItem}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Open to Public</Text>
                <Text style={styles.toggleDescription}>Anyone can join without invitation</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, openToPublic && styles.toggleActive]}
                onPress={() => setOpenToPublic(!openToPublic)}
              >
                <View style={[styles.toggleThumb, openToPublic && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleItem}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Allow Uploads</Text>
                <Text style={styles.toggleDescription}>Enable photo/video uploads</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, allowUploads && styles.toggleActive]}
                onPress={() => setAllowUploads(!allowUploads)}
              >
                <View style={[styles.toggleThumb, allowUploads && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleItem}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Allow Uploads Before Start</Text>
                <Text style={styles.toggleDescription}>Let people upload before event begins</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, allowUploadsBeforeStart && styles.toggleActive]}
                onPress={() => setAllowUploadsBeforeStart(!allowUploadsBeforeStart)}
              >
                <View style={[styles.toggleThumb, allowUploadsBeforeStart && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Event</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  
  // Content
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
  },
  
  // Cover Image
  coverImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  
  // Form Inputs
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
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F8F9FA',
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#000000',
    marginLeft: 8,
  },
  
  // Location Suggestions
  suggestionsContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  suggestionText: {
    fontSize: 14,
    color: '#000000',
    marginLeft: 8,
    flex: 1,
  },
  
  // Toggles
  toggleGroup: {
    gap: 20,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E1E1E1',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#3797EF',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  
  // Delete Button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  
  bottomSpace: {
    height: 40,
  },
});