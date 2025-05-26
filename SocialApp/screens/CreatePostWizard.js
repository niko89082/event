import React, { useState } from 'react';
import { View, Text, TextInput, Image, Button, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { useNavigation } from '@react-navigation/native';

export default function CreatePostWizard(){
  const nav             = useNavigation();
  const [asset, setAsset]= useState(null);
  const [caption,setCap] = useState('');

  const pick = async ()=>{
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes:ImagePicker.MediaTypeOptions.Images, quality:0.9 });
    if(!r.canceled) setAsset(r.assets[0]);
  };

  const publish = async ()=>{
    if(!asset){ Alert.alert('Choose a photo first'); return; }
    const fd = new FormData();
    fd.append('caption', caption);
    fd.append('photo', { uri:asset.uri, type:'image/jpeg', name:'post.jpg' });
    try{
      await api.post('/photos/create', fd, { headers:{'Content-Type':'multipart/form-data'} });
      nav.replace('PostPublished');   // clear history of wizard
    }catch(e){
      console.error(e.response?.data||e);
      Alert.alert('Error', e.response?.data?.message || 'Upload failed');
    }
  };

  return (
    <View style={st.c}>
      <Text style={st.h}>New post</Text>
      {asset
        ? <Image source={{ uri:asset.uri }} style={st.img}/>
        : <Button title="Pick photo" onPress={pick} />}
      <Text style={st.l}>Description</Text>
      <TextInput
        style={[st.i,{height:80}]}
        multiline value={caption}
        onChangeText={setCap}
        placeholder="Say something…"
      />
      <Button title="Post" onPress={publish} disabled={!asset}/>
    </View>
  );
}

const st = StyleSheet.create({
  c:{ flex:1, backgroundColor:'#fff', padding:16 },
  h:{ fontSize:18, fontWeight:'700', marginBottom:12 },
  img:{ width:'100%', height:260, marginBottom:12, borderRadius:6 },
  l:{ fontWeight:'600', marginTop:8 },
  i:{ borderWidth:1, borderColor:'#ccc', borderRadius:6, padding:8, marginTop:4 }
});