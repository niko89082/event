import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import api from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function CreateEventScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState(new Date());  // we'll store as a Date object
  const [showPicker, setShowPicker] = useState(false);

  const [maxAttendees, setMaxAttendees] = useState('10');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState('General');

  const [isPublic, setIsPublic] = useState(true);
  const [allowPhotos, setAllowPhotos] = useState(true);
  const [openToPublic, setOpenToPublic] = useState(true);
  const [allowUploads, setAllowUploads] = useState(true);

  const [recurring, setRecurring] = useState(null);

  // If hosting within a group
  const [groupId, setGroupId] = useState('');

  // Show the date/time picker
  const openDateTimePicker = () => {
    setShowPicker(true);
  };

  const onChangeDateTime = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDateTime(selectedDate);
    }
  };

  const handleCreateEvent = async () => {
    try {
      const maxAttendeesNum = parseInt(maxAttendees, 10);
      const priceNum = parseFloat(price);

      const eventData = {
        title,
        description,
        // Convert dateTime to something like '2025-01-01 10:00'
        time: dateTime.toISOString(),
        location,
        maxAttendees: maxAttendeesNum,
        price: priceNum,
        isPublic,
        recurring,
        allowPhotos,
        openToPublic,
        allowUploads,
        groupId,
        category,
      };

      const response = await api.post('events/create', eventData);
      console.log('Created Event:', response.data);

      Alert.alert('Success', 'Event created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error(error.response?.data || error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to create event'
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 60 }]}
        multiline
        value={description}
        onChangeText={setDescription}
      />

      {/* Location picking approach (simple) */}
      <Text style={styles.label}>Location</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="Enter location or see 'Pick Location' below"
      />
      {/* Optionally an advanced approach */}
      <TouchableOpacity
        style={styles.pickLocationButton}
        onPress={() => {
          // Example:
          // navigation.navigate('LocationPickerScreen', {
          //   onLocationSelect: setLocation
          // });
          Alert.alert('Location Picker', 'Implement an advanced location picking method if desired.');
        }}
      >
        <Text style={styles.pickLocationText}>Pick Location</Text>
      </TouchableOpacity>

      {/* DateTime */}
      <Text style={styles.label}>Event Date & Time</Text>
      <View style={styles.dateTimeRow}>
        <Text style={styles.dateTimeValue}>
          {dateTime.toLocaleString()}
        </Text>
        <Button title="Set Date/Time" onPress={openDateTimePicker} />
      </View>
      {showPicker && (
        <DateTimePicker
          value={dateTime}
          mode="datetime"
          display="default"
          onChange={onChangeDateTime}
        />
      )}

      <Text style={styles.label}>Max Attendees</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={maxAttendees}
        onChangeText={setMaxAttendees}
      />

      <Text style={styles.label}>Price</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />

      <Text style={styles.label}>Category</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="E.g., Concert, Workshop, General..."
      />

      <Text style={styles.label}>Recurring</Text>
      <View style={styles.row}>
        <Button
          title="None"
          onPress={() => setRecurring(null)}
          color={recurring === null ? 'blue' : 'gray'}
        />
        <Button
          title="Daily"
          onPress={() => setRecurring('daily')}
          color={recurring === 'daily' ? 'blue' : 'gray'}
        />
        <Button
          title="Weekly"
          onPress={() => setRecurring('weekly')}
          color={recurring === 'weekly' ? 'blue' : 'gray'}
        />
        <Button
          title="Monthly"
          onPress={() => setRecurring('monthly')}
          color={recurring === 'monthly' ? 'blue' : 'gray'}
        />
      </View>

      {/* Switches */}
      <View style={styles.switchRow}>
        <Text>Public</Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </View>
      <View style={styles.switchRow}>
        <Text>Allow Photos</Text>
        <Switch value={allowPhotos} onValueChange={setAllowPhotos} />
      </View>
      <View style={styles.switchRow}>
        <Text>Open To Public</Text>
        <Switch value={openToPublic} onValueChange={setOpenToPublic} />
      </View>
      <View style={styles.switchRow}>
        <Text>Allow Uploads</Text>
        <Switch value={allowUploads} onValueChange={setAllowUploads} />
      </View>

      {/* If you have groups */}
      <Text style={styles.label}>Group ID (optional)</Text>
      <TextInput
        style={styles.input}
        value={groupId}
        onChangeText={setGroupId}
      />

      {/* Create Button */}
      <Button title="Create Event" onPress={handleCreateEvent} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  label: {
    marginTop: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 4,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  pickLocationButton: {
    backgroundColor: '#ddd',
    padding: 10,
    borderRadius: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  pickLocationText: { 
    color: '#333',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  dateTimeValue: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    paddingVertical: 6,
  },
});