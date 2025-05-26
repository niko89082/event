// screens/CreatePickerScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OPTIONS = [
  { key:'event', label:'Event',  desc:'Create an event',          icon:'calendar' },
  { key:'photo', label:'Photo',  desc:'Add photos to your post',  icon:'image'    },
];

export default function CreatePickerScreen({ navigation }) {

  const onSelect = (key) => {
    if (key === 'event') navigation.navigate('CreateEvent');
    if (key === 'photo') navigation.navigate('CreatePost');
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={st.row} onPress={()=>onSelect(item.key)}>
      <View style={st.icon}>
        <Ionicons name={item.icon} size={22} color="#000" />
      </View>
      <View>
        <Text style={st.label}>{item.label}</Text>
        <Text style={st.desc}>{item.desc}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={st.container}>
      <View style={st.header}><Text style={st.title}>Create</Text></View>
      <FlatList
        data={OPTIONS}
        renderItem={renderItem}
        keyExtractor={i=>i.key}
        contentContainerStyle={{ padding:16 }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff' },
  header:{ alignItems:'center', paddingVertical:14, borderBottomWidth:0.5, borderColor:'#ddd' },
  title:{ fontSize:20, fontWeight:'700' },
  row:{ flexDirection:'row', alignItems:'center', padding:14, borderRadius:8, marginBottom:8, backgroundColor:'#f3f6fb' },
  icon:{ width:40, height:40, borderRadius:8, backgroundColor:'#e5ecf7', justifyContent:'center', alignItems:'center', marginRight:12 },
  label:{ fontWeight:'600', fontSize:16 },
  desc:{ color:'#567', marginTop:2 },
});