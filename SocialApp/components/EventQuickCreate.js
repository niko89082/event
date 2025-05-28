// components/EventQuickCreate.js - One-Click Event Creation from Group Chats
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Alert, ScrollView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function EventQuickCreate({ 
  visible, 
  onClose, 
  groupId, 
  conversationId,
  onEventCreated 
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date(Date.now() + 3600000)); // 1 hour from now
  const [showPicker, setShowPicker] = useState(false);
  const [location, setLocation] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    try {
      setCreating(true);

      const eventData = {
        title: title.trim(),
        description: description.trim() || `Event created from group chat`,
        time: dateTime.toISOString(),
        location: location.trim(),
        maxAttendees: parseInt(maxAttendees) || 10,
        category: 'General',
        price: 0,
        
        // Group events are private by default
        privacyLevel: 'private',
        canView: 'invitees',
        canJoin: 'invited',
        canShare: 'attendees',
        canInvite: 'attendees',
        appearInFeed: 'false',
        appearInSearch: 'false',
        showAttendeesToPublic: 'false',
        
        // Media settings
        allowPhotos: 'true',
        allowUploads: 'true',
        allowUploadsBeforeStart: 'true'
      };

      let endpoint = '/api/events/create';
      if (groupId) {
        endpoint = `/api/events/create-from-group/${groupId}`;
      }

      const response = await api.post(endpoint, eventData);
      
      Alert.alert('Success!', 'Event created successfully', [
        {
          text: 'OK',
          onPress: () => {
            onEventCreated?.(response.data);
            handleClose();
          }
        }
      ]);

    } catch (error) {
      console.error('Quick create event error:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.message || 'Failed to create event'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setDateTime(new Date(Date.now() + 3600000));
    setLocation('');
    setMaxAttendees('10');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Quick Event</Text>
          
          <TouchableOpacity 
            onPress={handleCreate} 
            style={styles.createButton}
            disabled={creating}
          >
            <Text style={[
              styles.createButtonText,
              creating && styles.createButtonDisabled
            ]}>
              {creating ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What's happening?"
              multiline={false}
              maxLength={100}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell people what to expect..."
              multiline={true}
              maxLength={500}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>When *</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#3797EF" />
              <Text style={styles.dateButtonText}>
                {dateTime.toLocaleDateString()} at {dateTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
            </TouchableOpacity>
            
            {showPicker && (
              <DateTimePicker
                value={dateTime}
                mode="datetime"
                minimumDate={new Date()}
                onChange={(_, selectedDate) => {
                  setShowPicker(false);
                  if (selectedDate) {
                    setDateTime(selectedDate);
                  }
                }}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Where *</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Add a location..."
              maxLength={200}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Max Attendees</Text>
            <TextInput
              style={styles.input}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="10"
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          <View style={styles.privacyNotice}>
            <View style={styles.privacyIcon}>
              <Ionicons name="lock-closed" size={16} color="#8E8E93" />
            </View>
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>Private Event</Text>
              <Text style={styles.privacyDescription}>
                Only group members will be invited. You can change privacy settings after creation.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#3797EF',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 32,
  },
  privacyIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
});