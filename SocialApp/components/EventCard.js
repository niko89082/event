// components/EventCard.js
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import useTheme       from '../hooks/useTheme';
import { spacing, radius } from '../theme';

export default function EventCard({ event, currentUserId, navigation, onAttend }) {
  const C         = useTheme();
  const past      = Date.now() > new Date(event.time).getTime();
  const attending = event.attendees?.includes(currentUserId);

  const cover = event.coverImage
    ? (event.coverImage.startsWith('http')
        ? event.coverImage
        : `http://${API_BASE_URL}:3000${event.coverImage}`)
    : null;

  const openDetail = () =>
    navigation.navigate('EventDetails',{eventId:event._id });

  const share = () =>
    navigation.getParent()?.navigate('ChatTab',{
      screen:'SelectChatScreen', params:{ shareType:'event', shareId:event._id }});

  return (
    <TouchableOpacity style={[S.card,{borderColor:C.border},C.shadow]} onPress={openDetail}>
      {cover
        ? <Image source={{ uri:cover }} style={S.cover}/>
        : <View style={[S.cover,{backgroundColor:C.surfaceAlt,justifyContent:'center',alignItems:'center'}]}>
            <Text>No image</Text></View>}

      <View style={S.info}>
        <Text style={[S.title,{color:C.text}]} numberOfLines={1}>{event.title}</Text>
        {!event.isPublic && <Text style={[S.private,{color:C.danger}]}>Private</Text>}
        <Text style={{color:C.textDim}}>
          {new Date(event.time).toLocaleString()} • {event.location}
        </Text>
        <Text style={{color:C.textDim,marginTop:spacing(0.5)}}>
          {event.attendees?.length||0} going{event.maxAttendees?` / ${event.maxAttendees}`:''}
        </Text>
      </View>

      <View style={S.footer}>
        {!past && (
          <TouchableOpacity
            style={[
              S.attBtn,
              { backgroundColor: attending ? C.surfaceAlt : C.brandBlue },
            ]}
            onPress={()=>onAttend?.(event)}
          >
            <Text style={{color:attending?C.text:'#fff',fontWeight:'600'}}>
              {attending ? 'Joined' : 'Attend'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={share} style={S.icon}>
          <Ionicons name="paper-plane-outline" size={21} color={C.text}/>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  card:{
    backgroundColor:'#fff',
    borderRadius:radius.card,
    borderWidth:1,
    marginHorizontal:spacing(2),
    marginBottom:spacing(4),
    overflow:'hidden',
  },
  cover:{ width:'100%', height:200 },
  info :{ padding:spacing(2) },
  title:{ fontSize:17, fontWeight:'700' },
  private:{ fontSize:12, marginTop:spacing(0.5) },
  footer:{
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingHorizontal:spacing(2), paddingBottom:spacing(2),
  },
  attBtn:{
    paddingHorizontal:spacing(4), paddingVertical:spacing(1.5),
    borderRadius:radius.btn,
  },
  icon:{ padding:spacing(1) },
});