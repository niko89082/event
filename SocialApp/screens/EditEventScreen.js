/******************************************************************
 * screens/EditEventScreen.js
 ******************************************************************/
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  ScrollView
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

import api from '../services/api';
import { fetchNominatimSuggestions } from '../services/locationApi';

export default function EditEventScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const eventId    = params?.eventId;

  const [loading, setLoading]             = useState(true);

  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');
  const [dateTime, setDateTime]           = useState(new Date());
  const [showPicker, setShowPicker]       = useState(false);

  const [locQuery, setLocQuery]           = useState('');
  const [suggestions, setSuggestions]     = useState([]);
  const [location, setLocation]           = useState('');
  const [coords, setCoords]               = useState(null);

  const [maxAttendees, setMaxAttendees]   = useState('10');
  const [price, setPrice]                 = useState('0');
  const [category, setCategory]           = useState('');

  const [privateEvent, setPrivateEvent]   = useState(false);
  const [allowPhotos, setAllowPhotos]     = useState(true);
  const [openToPublic, setOpenToPublic]   = useState(true);
  const [allowUploads, setAllowUploads]   = useState(true);
  const [allowUploadsBeforeStart,setAllowUploadsBeforeStart] = useState(true);

  const [groupId, setGroupId]             = useState('');
  const [cover, setCover]                 = useState(null);

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
    if (eventId) load();
  }, [eventId]);

  const load = async () => {
    try {
      const { data } = await api.get(`/events/${eventId}`);
      setTitle(data.title);
      setDescription(data.description);
      setDateTime(new Date(data.time));
      setLocation(data.location);
      setLocQuery(data.location);
      setCoords(data.geo?.coordinates || null);

      setMaxAttendees(String(data.maxAttendees));
      setPrice(String(data.price || 0));
      setCategory(data.category || '');

      setPrivateEvent(!data.isPublic);
      setAllowPhotos(data.allowPhotos);
      setOpenToPublic(data.openToPublic);
      setAllowUploads(data.allowUploads);
      setAllowUploadsBeforeStart(data.allowUploadsBeforeStart);

      setGroupId(data.group || '');
      setCover(data.coverImage ? { uri: `http://${API_BASE_URL}:3000${data.coverImage}` } : null);
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', 'Could not load event');
    } finally {
      setLoading(false);
    }
  };

  /* ─── location search ───────────────────────────────────── */
  const onLocQuery = async (txt) => {
    setLocQuery(txt);
    setSuggestions([]);
    if (txt.trim().length < 3) return;
    const res = await fetchNominatimSuggestions(txt);
    setSuggestions(res.slice(0,6));
  };
  const pickSuggestion = (s) => {
    setLocation(s.display_name);
    setLocQuery(s.display_name);
    setCoords([Number(s.lon), Number(s.lat)]);
    setSuggestions([]);
  };

  /* ─── cover picker ──────────────────────────────────────── */
  const pickCover = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!r.canceled) setCover(r.assets[0]);
  };

  /* ─── save ──────────────────────────────────────────────── */
  const save = async () => {
    const fd = new FormData();
    fd.append('title',        title);
    fd.append('description',  description);
    fd.append('time',         dateTime.toISOString());
    fd.append('location',     location);
    if (coords) fd.append('geo', JSON.stringify({ type:'Point', coordinates:coords }));
    fd.append('maxAttendees', maxAttendees);
    fd.append('price',        price);
    fd.append('category',     category);
    fd.append('isPublic',     !privateEvent);
    fd.append('allowPhotos',  allowPhotos);
    fd.append('openToPublic', openToPublic);
    fd.append('allowUploads', allowUploads);
    fd.append('allowUploadsBeforeStart', allowUploadsBeforeStart);
    if (groupId.trim()) fd.append('groupId', groupId);

    if (cover && cover.uri && !cover.uri.startsWith('http')) {
      fd.append('coverImage', { uri: cover.uri, type:'image/jpeg', name:'cover.jpg' });
    }

    try {
      await api.put(`/events/${eventId}`, fd, {
        headers:{ 'Content-Type':'multipart/form-data' }
      });
      Alert.alert('Saved');
      navigation.goBack();
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', e.response?.data?.message || 'Save failed');
    }
  };

  /* ─── delete ────────────────────────────────────────────── */
  const del = () => Alert.alert('Delete event?', 'This cannot be undone', [
    { text:'Cancel', style:'cancel' },
    { text:'Delete', style:'destructive', onPress: async ()=>{
        try {
          await api.delete(`/events/${eventId}`);
          navigation.goBack();
        } catch (e) { Alert.alert('Error', 'Delete failed'); }
      }}
  ]);

  if (loading) return <View style={st.c}><Text>Loading…</Text></View>;

  /* ─── ui ────────────────────────────────────────────────── */
  return (
    <ScrollView style={st.c}>
      <Text style={st.h}>Edit Event</Text>

      <Text style={st.l}>Title</Text>
      <TextInput style={st.i} value={title} onChangeText={setTitle} />

      <Text style={st.l}>Description</Text>
      <TextInput style={[st.i,{height:80}]} multiline value={description} onChangeText={setDescription}/>

      <Text style={st.l}>Location</Text>
      <TextInput style={st.i} value={locQuery} onChangeText={onLocQuery}/>
      {suggestions.map(s=>(
        <TouchableOpacity key={s.place_id} onPress={()=>pickSuggestion(s)} style={st.sug}>
          <Text>{s.display_name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={st.l}>Date & Time</Text>
      <TouchableOpacity onPress={()=>setShowPicker(true)}><Text>{dateTime.toLocaleString()}</Text></TouchableOpacity>
      {showPicker && (
        <DateTimePicker value={dateTime} mode="datetime"
          onChange={(_,d)=>{ setShowPicker(false); if(d) setDateTime(d); }}/>
      )}

      <Text style={st.l}>Max Attendees</Text>
      <TextInput style={st.i} keyboardType="numeric" value={maxAttendees} onChangeText={setMaxAttendees}/>

      <Text style={st.l}>Price</Text>
      <TextInput style={st.i} keyboardType="numeric" value={price} onChangeText={setPrice}/>

      <Text style={st.l}>Category</Text>
      <TextInput style={st.i} value={category} onChangeText={setCategory}/>

      <View style={st.row}><Text>Private Event?</Text><Switch value={privateEvent} onValueChange={setPrivateEvent}/></View>
      <View style={st.row}><Text>Allow Photos?</Text><Switch value={allowPhotos} onValueChange={setAllowPhotos}/></View>
      <View style={st.row}><Text>Open To Public?</Text><Switch value={openToPublic} onValueChange={setOpenToPublic}/></View>
      <View style={st.row}><Text>Allow Uploads?</Text><Switch value={allowUploads} onValueChange={setAllowUploads}/></View>
      <View style={st.row}><Text>Uploads Before Start?</Text><Switch value={allowUploadsBeforeStart} onValueChange={setAllowUploadsBeforeStart}/></View>

      <Text style={st.l}>Group ID (optional)</Text>
      <TextInput style={st.i} value={groupId} onChangeText={setGroupId}/>

      {cover && <Image source={{uri:cover.uri}} style={{width:120,height:120,marginVertical:8}}/>}
      <Button title="Pick Cover Image" onPress={pickCover}/>

      <Button title="Save Changes" onPress={save}/>
      <View style={{marginVertical:12}}/>
      <Button title="Delete Event" color="red" onPress={del}/>
      <View style={{height:40}}/>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  c:{flex:1,backgroundColor:'#fff',padding:16},
  h:{fontSize:20,fontWeight:'700',marginBottom:12},
  l:{marginTop:8,fontWeight:'600'},
  i:{borderWidth:1,borderColor:'#ccc',borderRadius:4,padding:8,marginVertical:4},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginVertical:6},
  sug:{padding:8,borderWidth:1,borderColor:'#eee'}
});