/* THIS WAS PRETTY MUCH DEPRICATED


*/

import React from 'react';
import { View, Text, Image, Button, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function PostPublishedScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const imageUri   = params?.imageUri || null;

  return (
    <View style={st.container}>
      <Text style={st.big}>Your post has been successfully shared.</Text>
      <Text style={st.sub}>It may take a moment to appear on your timeline.</Text>

      {imageUri && (
        <Image source={{ uri:imageUri }} style={st.img}/>
      )}

      <Button title="View post" onPress={()=>navigation.goBack()} />
      <View style={{height:8}}/>
      <Button title="Go to feed" onPress={()=>
        navigation.reset({ index:0, routes:[{ name:'FeedTab' }] })
      }/>
    </View>
  );
}

const st = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', padding:24 },
  big:{ fontSize:22, fontWeight:'700', textAlign:'center', marginBottom:6 },
  sub:{ color:'#555', textAlign:'center', marginBottom:20 },
  img:{ width:240, height:240, borderRadius:8, marginBottom:24 },
});