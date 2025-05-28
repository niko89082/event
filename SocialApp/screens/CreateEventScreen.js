// screens/CreateEventScreen.js - Enhanced with Privacy Controls
import React, { useState, useEffect } from 'react';
import {
  View, Text, Button, StyleSheet, TextInput, Image, Alert, ScrollView,
  Switch, TouchableOpacity, Modal, FlatList
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import api from '../services/api';
import { fetchNominatimSuggestions } from '../services/locationApi';

const PRIVACY_LEVELS = [
  { key: 'public', label: 'Public', desc: 'Anyone can see and join', icon: 'globe-outline' },
  { key: 'friends', label: 'Friends Only', desc: 'Only your followers can see', icon: 'people-outline' },
  { key: 'private', label: 'Private', desc: 'Invite-only, but guests can share', icon: 'lock-closed-outline' },
  { key: 'secret', label: 'Secret', desc: 'Completely hidden, host controls all', icon: 'eye-off-outline' }
];

const VIEW_OPTIONS = [
  { key: 'anyone', label: 'Anyone' },
  { key: 'followers', label: 'Followers Only' },
  { key: 'invitees', label: 'Invited Users Only' },
  { key: 'host-only', label: 'Host Only' }
];

const JOIN_OPTIONS = [
  { key: 'anyone', label: 'Anyone Can Join' },
  { key: 'followers', label: 'Followers Can Join' },
  { key: 'invited', label: 'Invitation Required' },
  { key: 'approval-required', label: 'Approval Required' }
];

const SHARE_OPTIONS = [
  { key: 'anyone', label: 'Anyone Can Share' },
  { key: 'attendees', label: 'Attendees Can Share' },
  { key: 'co-hosts', label: 'Co-hosts Only' },
  { key: 'host-only', label: 'Host Only' }
];

const CATEGORIES = [
  'General', 'Music', 'Arts', 'Sports', 'Food', 'Technology', 'Business',
  'Health', 'Education', 'Travel', 'Photography', 'Gaming', 'Fashion',
  'Movies', 'Books', 'Fitness', 'Outdoor', 'Indoor'
];

export default function CreateEventScreen({ navigation, route }) {
  const { groupId } = route.params || {};

  // Basic event fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState('General');
  const [cover, setCover] = useState(null);

  // Privacy & permissions
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [permissions, setPermissions] = useState({
    canView: 'anyone',
    canJoin: 'anyone',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  });

  // Discovery & recommendations
  const [tags, setTags] = useState('');
  const [interests, setInterests] = useState([]);
  const [weatherDependent, setWeatherDependent] = useState(false);

  // Legacy fields
  const [allowPhotos, setAllowPhotos] = useState(true);
  const [allowUploads, setAllowUploads] = useState(true);
  const [allowUploadsBeforeStart, setAllowUploadsBeforeStart] = useState(true);

  // Modal states
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [currentPermission, setCurrentPermission] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  // Update permissions based on privacy level
  useEffect(() => {
    switch (privacyLevel) {
      case 'public':
        setPermissions(prev => ({
          ...prev,
          canView: 'anyone',
          canJoin: 'anyone',
          appearInFeed: true,
          appearInSearch: true
        }));
        break;
      case 'friends':
        setPermissions(prev => ({
          ...prev,
          canView: 'followers',
          canJoin: 'followers',
          appearInFeed: true,
          appearInSearch: true
        }));
        break;
      case 'private':
        setPermissions(prev => ({
          ...prev,
          canView: 'invitees',
          canJoin: 'invited',
          appearInFeed: false,
          appearInSearch: false
        }));
        break;
      case 'secret':
        setPermissions(prev => ({
          ...prev,
          canView: 'invitees',
          canJoin: 'invited',
          canShare: 'host-only',
          canInvite: 'host-only',
          appearInFeed: false,
          appearInSearch: false,
          showAttendeesToPublic: false
        }));
        break;
    }
  }, [privacyLevel]);

  const onLocQuery = async (txt) => {
    setLocQuery(txt);
    setSuggestions([]);
    if (txt.trim().length < 3) return;
    const res = await fetchNominatimSuggestions(txt);
    setSuggestions(res.slice(0, 6));
  };

  const pickSuggestion = (s) => {
    setLocation(s.display_name);
    setCoords([Number(s.lon), Number(s.lat)]);
    setLocQuery(s.display_name);
    setSuggestions([]);
  };

  const pickCover = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images
    });
    if (!r.canceled) setCover(r.assets[0]);
  };

  const createEvent = async () => {
    if (!title.trim() || !location.trim() || !coords) {
      Alert.alert('Please fill title and choose a location from suggestions.');
      return;
    }

    const fd = new FormData();
    
    // Basic fields
    fd.append('title', title);
    fd.append('description', description);
    fd.append('category', category);
    fd.append('time', dateTime.toISOString());
    fd.append('location', location);
    fd.append('geo', JSON.stringify({ type: 'Point', coordinates: coords }));
    fd.append('maxAttendees', maxAttendees);
    fd.append('price', price);

    // Privacy settings
    fd.append('privacyLevel', privacyLevel);
    fd.append('canView', permissions.canView);
    fd.append('canJoin', permissions.canJoin);
    fd.append('canShare', permissions.canShare);
    fd.append('canInvite', permissions.canInvite);
    fd.append('appearInFeed', permissions.appearInFeed.toString());
    fd.append('appearInSearch', permissions.appearInSearch.toString());
    fd.append('showAttendeesToPublic', permissions.showAttendeesToPublic.toString());

    // Discovery fields
    fd.append('tags', tags);
    fd.append('interests', interests.join(','));
    fd.append('weatherDependent', weatherDependent.toString());

    // Legacy fields
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

    try {
      const endpoint = groupId 
        ? `/api/events/create-from-group/${groupId}` 
        : '/api/events/create';
      
      await api.post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      Alert.alert('Success', 'Event created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', e.response?.data?.message || 'Create failed');
    }
  };

  const renderPrivacySelector = () => (
    <Modal visible={showPrivacyModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Privacy Level</Text>
          
          <FlatList
            data={PRIVACY_LEVELS}
            keyExtractor={item => item.key}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.optionRow,
                  privacyLevel === item.key && styles.selectedOption
                ]}
                onPress={() => {
                  setPrivacyLevel(item.key);
                  setShowPrivacyModal(false);
                }}
              >
                <View style={styles.optionLeft}>
                  <Ionicons name={item.icon} size={24} color="#3797EF" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    <Text style={styles.optionDesc}>{item.desc}</Text>
                  </View>
                </View>
                {privacyLevel === item.key && (
                  <Ionicons name="checkmark" size={20} color="#3797EF" />
                )}
              </TouchableOpacity>
            )}
          />
          
          <Button title="Close" onPress={() => setShowPrivacyModal(false)} />
        </View>
      </View>
    </Modal>
  );

  const renderPermissionModal = () => {
    if (!currentPermission) return null;

    let options = [];
    switch (currentPermission.key) {
      case 'canView':
        options = VIEW_OPTIONS;
        break;
      case 'canJoin':
        options = JOIN_OPTIONS;
        break;
      case 'canShare':
      case 'canInvite':
        options = SHARE_OPTIONS;
        break;
    }

    return (
      <Modal visible={showPermissionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{currentPermission.label}</Text>
            
            <FlatList
              data={options}
              keyExtractor={item => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.optionRow,
                    permissions[currentPermission.key] === item.key && styles.selectedOption
                  ]}
                  onPress={() => {
                    setPermissions(prev => ({
                      ...prev,
                      [currentPermission.key]: item.key
                    }));
                    setShowPermissionModal(false);
                  }}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {permissions[currentPermission.key] === item.key && (
                    <Ionicons name="checkmark" size={20} color="#3797EF" />
                  )}
                </TouchableOpacity>
              )}
            />
            
            <Button title="Close" onPress={() => setShowPermissionModal(false)} />
          </View>
        </View>
      </Modal>
    );
  };

  const renderCategoryModal = () => (
    <Modal visible={showCategoryModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Category</Text>
          
          <FlatList
            data={CATEGORIES}
            keyExtractor={item => item}
            numColumns={2}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.categoryChip,
                  category === item && styles.selectedCategory
                ]}
                onPress={() => {
                  setCategory(item);
                  setShowCategoryModal(false);
                }}
              >
                <Text style={[
                  styles.categoryText,
                  category === item && styles.selectedCategoryText
                ]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          
          <Button title="Close" onPress={() => setShowCategoryModal(false)} />
        </View>
      </View>
    </Modal>
  );

  const openPermissionModal = (key, label) => {
    setCurrentPermission({ key, label });
    setShowPermissionModal(true);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Create Event</Text>

      {/* Basic Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} 
                   placeholder="What's your event called?" />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} multiline 
                   value={description} onChangeText={setDescription}
                   placeholder="Tell people what to expect..." />

        <Text style={styles.label}>Category</Text>
        <TouchableOpacity 
          style={styles.selector}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text style={styles.selectorText}>{category}</Text>
          <Ionicons name="chevron-down" size={20} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Date & Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>When & Where</Text>
        
        <Text style={styles.label}>Date & Time *</Text>
        <TouchableOpacity 
          style={styles.selector}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#3797EF" />
          <Text style={styles.selectorText}>{dateTime.toLocaleString()}</Text>
        </TouchableOpacity>
        
        {showPicker && (
          <DateTimePicker 
            value={dateTime} 
            mode="datetime"
            onChange={(_, d) => { setShowPicker(false); if(d) setDateTime(d); }}
          />
        )}

        <Text style={styles.label}>Location *</Text>
        <TextInput 
          style={styles.input} 
          value={locQuery} 
          onChangeText={onLocQuery}
          placeholder="Search for a location..."
        />
        
        {suggestions.map(s => (
          <TouchableOpacity key={s.place_id} onPress={() => pickSuggestion(s)} 
                            style={styles.suggestion}>
            <Ionicons name="location-outline" size={16} color="#8E8E93" />
            <Text style={styles.suggestionText}>{s.display_name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Privacy & Permissions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Permissions</Text>
        
        <TouchableOpacity 
          style={styles.privacySelector}
          onPress={() => setShowPrivacyModal(true)}
        >
          <View style={styles.privacyLeft}>
            <Ionicons 
              name={PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.icon || 'globe-outline'} 
              size={24} 
              color="#3797EF" 
            />
            <View style={styles.privacyText}>
              <Text style={styles.privacyLabel}>
                {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.label}
              </Text>
              <Text style={styles.privacyDesc}>
                {PRIVACY_LEVELS.find(p => p.key === privacyLevel)?.desc}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        {/* Granular Permissions */}
        <View style={styles.permissionsGrid}>
          <TouchableOpacity 
            style={styles.permissionItem}
            onPress={() => openPermissionModal('canView', 'Who Can View')}
          >
            <Text style={styles.permissionLabel}>Who Can View</Text>
            <Text style={styles.permissionValue}>
              {VIEW_OPTIONS.find(o => o.key === permissions.canView)?.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.permissionItem}
            onPress={() => openPermissionModal('canJoin', 'Who Can Join')}
          >
            <Text style={styles.permissionLabel}>Who Can Join</Text>
            <Text style={styles.permissionValue}>
              {JOIN_OPTIONS.find(o => o.key === permissions.canJoin)?.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.permissionItem}
            onPress={() => openPermissionModal('canShare', 'Who Can Share')}
          >
            <Text style={styles.permissionLabel}>Who Can Share</Text>
            <Text style={styles.permissionValue}>
              {SHARE_OPTIONS.find(o => o.key === permissions.canShare)?.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.permissionItem}
            onPress={() => openPermissionModal('canInvite', 'Who Can Invite')}
          >
            <Text style={styles.permissionLabel}>Who Can Invite</Text>
            <Text style={styles.permissionValue}>
              {SHARE_OPTIONS.find(o => o.key === permissions.canInvite)?.label}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Appear in Feed</Text>
          <Switch 
            value={permissions.appearInFeed} 
            onValueChange={(v) => setPermissions(prev => ({...prev, appearInFeed: v}))}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Appear in Search</Text>
          <Switch 
            value={permissions.appearInSearch} 
            onValueChange={(v) => setPermissions(prev => ({...prev, appearInSearch: v}))}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show Attendees Publicly</Text>
          <Switch 
            value={permissions.showAttendeesToPublic} 
            onValueChange={(v) => setPermissions(prev => ({...prev, showAttendeesToPublic: v}))}
          />
        </View>
      </View>

      {/* Event Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Details</Text>
        
        <Text style={styles.label}>Max Attendees</Text>
        <TextInput 
          style={styles.input} 
          keyboardType="numeric" 
          value={maxAttendees} 
          onChangeText={setMaxAttendees}
        />

        <Text style={styles.label}>Price (USD)</Text>
        <TextInput 
          style={styles.input} 
          keyboardType="numeric" 
          value={price} 
          onChangeText={setPrice}
          placeholder="0 for free events"
        />

        <Text style={styles.label}>Tags (comma separated)</Text>
        <TextInput 
          style={styles.input} 
          value={tags} 
          onChangeText={setTags}
          placeholder="music, outdoor, family-friendly..."
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Weather Dependent</Text>
          <Switch value={weatherDependent} onValueChange={setWeatherDependent} />
        </View>
      </View>

      {/* Media Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Media & Photos</Text>
        
        {cover && (
          <Image source={{ uri: cover.uri }} style={styles.coverPreview} />
        )}
        <Button title="Pick Cover Image" onPress={pickCover} />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Allow Photos</Text>
          <Switch value={allowPhotos} onValueChange={setAllowPhotos} />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Allow Photo Uploads</Text>
          <Switch value={allowUploads} onValueChange={setAllowUploads} />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Allow Uploads Before Start</Text>
          <Switch value={allowUploadsBeforeStart} onValueChange={setAllowUploadsBeforeStart} />
        </View>
      </View>

      <View style={styles.createButtonContainer}>
        <Button title="Create Event" onPress={createEvent} />
      </View>

      <View style={{ height: 40 }} />

      {/* Modals */}
      {renderPrivacySelector()}
      {renderPermissionModal()}
      {renderCategoryModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: 16 
  },
  header: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 24,
    textAlign: 'center'
  },
  
  section: {
    marginBottom: 32,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000'
  },
  
  label: { 
    marginTop: 8, 
    fontWeight: '600',
    marginBottom: 4,
    color: '#000'
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#E1E1E1', 
    borderRadius: 8, 
    padding: 12, 
    marginVertical: 4,
    backgroundColor: '#fff'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff'
  },
  selectorText: {
    fontSize: 16,
    color: '#000'
  },
  
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderTopWidth: 0,
    borderRadius: 0
  },
  suggestionText: {
    marginLeft: 8,
    flex: 1,
    color: '#000'
  },
  
  privacySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1'
  },
  privacyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  privacyText: {
    marginLeft: 12
  },
  privacyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  privacyDesc: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2
  },
  
  permissionsGrid: {
    gap: 12,
    marginBottom: 16
  },
  permissionItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1'
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  permissionValue: {
    fontSize: 12,
    color: '#3797EF'
  },
  
  toggleRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12
  },
  toggleLabel: {
    fontSize: 16,
    color: '#000'
  },
  
  coverPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12
  },
  
  createButtonContainer: {
    marginTop: 16,
    marginBottom: 32
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center'
  },
  
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  optionText: {
    marginLeft: 12
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  optionDesc: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2
  },
  selectedOption: {
    backgroundColor: '#F0F8FF'
  },
  
  categoryChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 4,
    flex: 1,
    alignItems: 'center'
  },
  selectedCategory: {
    backgroundColor: '#3797EF'
  },
  categoryText: {
    fontSize: 14,
    color: '#000'
  },
  selectedCategoryText: {
    color: '#fff'
  }
});