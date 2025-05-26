/******************************************************************
 * screens/CreateEventScreen.js
 ******************************************************************/
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  ScrollView,
  Switch,
  TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import api from '../services/api';
import { fetchNominatimSuggestions } from '../services/locationApi';

export default function CreateEventScreen({ navigation }) {
  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');

  /* ─── date / time ────────────────────────────────────────── */
  const [dateTime, setDateTime]           = useState(new Date());
  const [showPicker, setShowPicker]       = useState(false);

  /* ─── location (text + geo) ─────────────────────────────── */
  const [locQuery, setLocQuery]           = useState('');
  const [suggestions, setSuggestions]     = useState([]);
  const [location, setLocation]           = useState('');
  const [coords, setCoords]               = useState(null);  // [lng, lat]

  /* ─── other fields ──────────────────────────────────────── */
  const [maxAttendees, setMaxAttendees]   = useState('10');
  const [price, setPrice]                 = useState('0');
  const [category, setCategory]           = useState('General');
  const [privateEvent, setPrivateEvent]   = useState(false);
  const [allowPhotos, setAllowPhotos]     = useState(true);
  const [openToPublic, setOpenToPublic]   = useState(true);
  const [allowUploads, setAllowUploads]   = useState(true);
  const [allowUploadsBeforeStart,setAllowUploadsBeforeStart] = useState(true);
  const [groupId, setGroupId]             = useState('');

  /* ─── cover image ───────────────────────────────────────── */
  const [cover, setCover]                 = useState(null);

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  /* ─── location search helpers ───────────────────────────── */
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

  /* ─── cover image picker ────────────────────────────────── */
  const pickCover = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images
    });
    if (!r.canceled) setCover(r.assets[0]);
  };

  /* ─── submit ────────────────────────────────────────────── */
  const createEvent = async () => {
    if (!title.trim() || !location.trim() || !coords) {
      Alert.alert('Please fill title and choose a location from suggestions.');
      return;
    }

    const fd = new FormData();
    fd.append('title',        title);
    fd.append('description',  description);
    fd.append('category',     category);
    fd.append('time',         dateTime.toISOString());
    fd.append('location',     location);
    fd.append('geo',          JSON.stringify({ type: 'Point', coordinates: coords }));
    fd.append('maxAttendees', maxAttendees);
    fd.append('price',        price);
    fd.append('isPublic',     !privateEvent);
    fd.append('allowPhotos',  allowPhotos);
    fd.append('openToPublic', openToPublic);
    fd.append('allowUploads', allowUploads);
    fd.append('allowUploadsBeforeStart', allowUploadsBeforeStart);
    if (groupId.trim()) fd.append('groupId', groupId);

    if (cover) {
      fd.append('coverImage', {
        uri:  cover.uri,
        type: 'image/jpeg',
        name: 'cover.jpg'
      });
    }

    try {
      await api.post('/events/create', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Alert.alert('Success', 'Event created', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', e.response?.data?.message || 'Create failed');
    }
  };

  /* ─── ui ────────────────────────────────────────────────── */
  return (
    <ScrollView style={st.c}>
      <Text style={st.l}>Title</Text>
      <TextInput style={st.i} value={title} onChangeText={setTitle} />

      <Text style={st.l}>Description</Text>
      <TextInput style={[st.i, { height: 80 }]} multiline value={description} onChangeText={setDescription} />

      <Text style={st.l}>Location</Text>
      <TextInput
        style={st.i}
        value={locQuery}
        onChangeText={onLocQuery}
        placeholder="Type an address..."
      />
      {suggestions.map((s) => (
        <TouchableOpacity key={s.place_id} onPress={() => pickSuggestion(s)} style={st.sug}>
          <Text>{s.display_name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={st.l}>Date & Time</Text>
      <TouchableOpacity onPress={() => setShowPicker(true)}>
        <Text>{dateTime.toLocaleString()}</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker value={dateTime} mode="datetime" onChange={(_, d) => {
          setShowPicker(false); if (d) setDateTime(d);
        }} />
      )}

      <Text style={st.l}>Max Attendees</Text>
      <TextInput style={st.i} keyboardType="numeric" value={maxAttendees} onChangeText={setMaxAttendees} />

      <Text style={st.l}>Price</Text>
      <TextInput style={st.i} keyboardType="numeric" value={price} onChangeText={setPrice} />

      <Text style={st.l}>Category</Text>
      <TextInput style={st.i} value={category} onChangeText={setCategory} placeholder="Concert, Workshop…" />

      <View style={st.row}><Text>Private Event?</Text><Switch value={privateEvent} onValueChange={setPrivateEvent} /></View>
      <View style={st.row}><Text>Allow Photos?</Text><Switch value={allowPhotos} onValueChange={setAllowPhotos} /></View>
      <View style={st.row}><Text>Open To Public?</Text><Switch value={openToPublic} onValueChange={setOpenToPublic} /></View>
      <View style={st.row}><Text>Allow Uploads?</Text><Switch value={allowUploads} onValueChange={setAllowUploads} /></View>
      <View style={st.row}><Text>Uploads Before Start?</Text><Switch value={allowUploadsBeforeStart} onValueChange={setAllowUploadsBeforeStart} /></View>

      <Text style={st.l}>Group ID (optional)</Text>
      <TextInput style={st.i} value={groupId} onChangeText={setGroupId} />

      {cover && <Image source={{ uri: cover.uri }} style={{ width: 120, height: 120, marginVertical: 8 }} />}
      <Button title="Pick Cover Image" onPress={pickCover} />

      <View style={{ height: 12 }} />
      <Button title="Create Event" onPress={createEvent} />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#fff', padding: 16 },
  l: { marginTop: 8, fontWeight: '600' },
  i: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  sug: { padding: 8, borderWidth: 1, borderColor: '#eee' }
});