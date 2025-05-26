// screens/CreatePostScreen.js// screens/CreatePostScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, Button, StyleSheet, Image, Alert,
  TextInput, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../services/api';

export default function CreatePostScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [caption, setCaption] = useState('');
  const [myEvents, setMyEvents] = useState([]);
  const [useEvent, setUseEvent] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');

  useEffect(() => {
    requestLibraryPermission();
    fetchMyAttendingEvents();
  }, []);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('We need access to your camera roll.');
    }
  };

  const fetchMyAttendingEvents = async () => {
    try {
      const res = await api.get('/events/my-photo-events');
      setMyEvents(res.data);
    } catch (err) {
      console.error(err.response?.data || err);
    }
  };

  const handlePickImages = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
    });
    if (!r.canceled) setSelectedImages(r.assets);
  };

  const goToStep2 = () => {
    if (!selectedImages.length) {
      Alert.alert('Pick at least one image');
      return;
    }
    setStep(2);
  };
  const goToStep3 = () => setStep(3);

  const handlePost = async () => {
    try {
      if (!selectedImages.length) {
        Alert.alert('No images to upload');
        return;
      }
      const fd = new FormData();
      selectedImages.forEach((img, i) =>
        fd.append('photos', { uri:img.uri, type:'image/jpeg', name:`photo-${i}.jpg` })
      );
      fd.append('filter',  selectedFilter);
      fd.append('caption', caption);

      let url = '/photos/upload';
      if (useEvent && selectedEventId) url = `/photos/upload/${selectedEventId}`;

      await api.post(url, fd, { headers:{'Content-Type':'multipart/form-data'} });
      /* ✨ changed: go to confirmation */
      navigation.replace('PostPublished', { imageUri: selectedImages[0].uri });
    } catch (err) {
      console.error(err.response?.data || err);
      Alert.alert('Failed to upload photos');
    }
  };

  /* ---------- render steps (unchanged except final Post button) ---------- */
  if (step === 1) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Step 1 • Pick Images</Text>
        <Button title="Pick Images" onPress={handlePickImages} />
        <View style={styles.previewContainer}>
          {selectedImages.map((a,i)=>(
            <Image key={i} source={{uri:a.uri}} style={styles.previewImage}/>
          ))}
        </View>
        <Button title="Next" onPress={goToStep2}/>
      </ScrollView>
    );
  }

  if (step === 2) {
    const filters = ['normal','grayscale','saturate','contrast'];
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Step 2 • Apply Filter</Text>
        <View style={styles.filterButtons}>
          {filters.map(f=>(
            <Button key={f} title={selectedFilter===f?`✔ ${f}`:f}
              onPress={()=>setSelectedFilter(f)}/>
          ))}
        </View>
        {!!selectedImages.length && (
          <View style={{alignSelf:'center',marginVertical:12}}>
            <FilterPreview sourceUri={selectedImages[0].uri} filter={selectedFilter}/>
          </View>
        )}
        <Button title="Next" onPress={goToStep3}/>
      </ScrollView>
    );
  }

  if (step === 3) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Step 3 • Finalise</Text>
        <Text style={styles.label}>Caption</Text>
        <TextInput style={styles.captionInput} multiline value={caption}
          onChangeText={setCaption} placeholder="Write a caption…"/>
        <View style={{marginVertical:8}}>
          <Text style={styles.label}>Attach to an Event?</Text>
          <Button title={useEvent?'Yes':'No'} onPress={()=>setUseEvent(!useEvent)}/>
          {useEvent && (
            <View style={{marginTop:8}}>
              {myEvents.length===0
                ? <Text style={styles.noEventsText}>No events available</Text>
                : myEvents.map(evt=>(
                    <Button key={evt._id}
                      title={selectedEventId===evt._id?`✔ ${evt.title}`:evt.title}
                      onPress={()=>setSelectedEventId(evt._id)}/>
                  ))}
            </View>
          )}
        </View>
        <Button title="Post" onPress={handlePost}/>
      </ScrollView>
    );
  }

  return <View style={styles.container}><Text>Invalid step</Text></View>;
}

/* ---- FilterPreview helper (unchanged) ---- */
function FilterPreview({ sourceUri, filter }) {
  const [uri,setUri] = useState(sourceUri);
  useEffect(()=>{
    const run=async()=>{
      let acts=[];
      if(filter==='grayscale') acts.push({adjust:{saturation:0}});
      if(filter==='saturate')  acts.push({adjust:{saturation:2}});
      if(filter==='contrast')  acts.push({adjust:{contrast:1.8}});
      const r=await ImageManipulator.manipulateAsync(sourceUri,acts,{compress:1,format:ImageManipulator.SaveFormat.JPEG});
      setUri(r.uri);
    };
    run();
  },[sourceUri,filter]);
  return <Image source={{uri}} style={styles.filterPreviewImage}/>;
}

const styles = StyleSheet.create({
  container:{ padding:16 },
  header:{ fontSize:18, fontWeight:'600', marginBottom:12 },
  previewContainer:{ flexDirection:'row', flexWrap:'wrap', marginVertical:10 },
  previewImage:{ width:100, height:100, marginRight:8, marginBottom:8 },
  label:{ fontWeight:'600', marginTop:8 },
  captionInput:{ borderWidth:1, borderColor:'#ccc', padding:8, borderRadius:6, minHeight:60, textAlignVertical:'top', marginVertical:4 },
  filterButtons:{ flexDirection:'row', flexWrap:'wrap', marginVertical:8 },
  noEventsText:{ fontStyle:'italic', color:'#888', marginVertical:4 },
  filterPreviewImage:{ width:300, height:300, borderRadius:8, marginBottom:8 },
});