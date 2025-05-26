import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, FlatList,
  ActivityIndicator, TouchableOpacity, Button, Alert, Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useStripe }  from '@stripe/stripe-react-native';
import { AuthContext } from '../services/AuthContext';
import api             from '../services/api';
import { API_BASE_URL } from '@env';
import { palette as C, spacing as sp, radius, shadow } from '../theme';

const W      = Dimensions.get('window').width;
const THUMB  = (W - sp(4) - sp(2)) / 2;        // album grid (2-col)

/* ------------------------------------------------------------------ */
export default function EventDetailsScreen() {
  /* ── context / nav ------------------------------------------------ */
  const { eventId }  = useRoute().params ?? {};
  const navigation   = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  /* ── state -------------------------------------------------------- */
  const [event, setEvent] = useState(null);
  const [load,  setLoad ] = useState(true);

  /* ── fetch -------------------------------------------------------- */
  useEffect(() => { if (eventId) fetchEvent(); }, [eventId]);

  const fetchEvent = async () => {
    try {
      setLoad(true);
      const { data } = await api.get(`/events/${eventId}`);
      setEvent(data);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Unable to load event');
    } finally { setLoad(false); }
  };

  /* ── guards ------------------------------------------------------- */
  if (load)    return <View style={S.center}><ActivityIndicator size="large"/></View>;
  if (!event)  return <View style={S.center}><Text>Event not found.</Text></View>;

  /* ── helpers ------------------------------------------------------ */
  const hero = event.coverImage
    ? (event.coverImage.startsWith('http')
        ? event.coverImage
        : `http://${API_BASE_URL}:3000${event.coverImage}`)
    : null;

  const past        = Date.now() > new Date(event.time).getTime();
  const host        = String(event.host?._id) === String(currentUser?._id);
  const attending   = event.attendees?.some(u => String(u._id) === String(currentUser?._id));
  const attendeeCt  = event.attendees?.length || 0;

  /* ── attend / pay ------------------------------------------------- */
  const attend = async () => {
    try {
      /* free OR already paid route */
      if (event.price <= 1) {
        await api.post(`/events/attend/${eventId}`, { paymentConfirmed:true });
        fetchEvent(); return;
      }
      /* paid route */
      const { data } = await api.post(`/events/attend/${eventId}`); // creates PI
      const i = await initPaymentSheet({
        paymentIntentClientSecret:data.clientSecret,
        merchantDisplayName:'MyApp',
        returnURL:'myapp://stripe-redirect',
      });
      if (i.error) return Alert.alert('Payment', i.error.message);
      const p = await presentPaymentSheet();
      if (p.error) return Alert.alert('Payment', p.error.message);

      await api.post(`/events/attend/${eventId}`, { paymentConfirmed:true });
      fetchEvent();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Unable to attend');
    }
  };
  const unattend = async () => {
    try { await api.delete(`/events/attend/${eventId}`); fetchEvent(); }
    catch(e){ console.log(e.response?.data||e); }
  };

  /* ── shared-posts thumbnail -------------------------------------- */
  const renderThumb = ({ item }) => (
    <TouchableOpacity
      style={{ width:THUMB, height:THUMB, borderRadius:radius.thumb,
               marginBottom:sp(2), overflow:'hidden' }}
      onPress={()=>navigation.navigate('PostDetailsScreen',{ postId:item._id })}
    >
      <Image
        source={{ uri:`http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={{ width:'100%', height:'100%' }}
      />
    </TouchableOpacity>
  );

  /* ── UI ----------------------------------------------------------- */
  return (
    <ScrollView style={S.root} contentContainerStyle={{ paddingBottom:sp(8) }}>
      {/* hero ------------------------------------------------------- */}
      {hero && <Image source={{ uri:hero }} style={S.hero}/>}

      {/* host block ------------------------------------------------- */}
      <View style={S.hostRow}>
        <Image
          source={{ uri:event.host?.profilePicture
            ? `http://${API_BASE_URL}:3000${event.host.profilePicture}`
            : 'https://placehold.co/56x56?text=👤' }}
          style={S.hostLogo}
        />
        <View style={{ flex:1 }}>
          <Text style={S.hostTxt}>{event.title}</Text>
          <Text style={S.sub}>
            {new Date(event.time).toLocaleDateString(undefined,{month:'long',day:'numeric'})}
            {' • '}
            {new Date(event.time).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}
          </Text>
          <Text style={S.sub}>Presented by {event.host?.username}</Text>
        </View>
      </View>

      {/* description ------------------------------------------------ */}
      <Section title="Description">
        <Text style={S.body}>{event.description}</Text>
      </Section>

      <Section title="Venue">
        <Text style={S.link}>{event.location}</Text>
      </Section>

      <Section title="Tickets">
        <Text style={S.link}>
          {event.price > 0 ? `$${event.price.toFixed(2)}` : 'Free'}
        </Text>
      </Section>

      <Section title="Guest List">
        <TouchableOpacity onPress={()=>
          navigation.navigate('AttendeeListScreen',{ eventId })}>
          <Text style={S.link}>{attendeeCt} attending • View all</Text>
        </TouchableOpacity>
      </Section>

      {/* attend / host buttons ------------------------------------- */}
      <View style={S.btnBox}>
        {!past && !host && (
          attending
            ? <Button title="Unattend" onPress={unattend}/>
            : <Button title="Attend"   onPress={attend}/>
        )}
        {host && (
          <>
            <Button title="Check-In"  onPress={()=>
              navigation.navigate('QrScanScreen',{ eventId })}/>
            <View style={{ height:sp() }}/>
            <Button title="Edit Event" onPress={()=>
              navigation.navigate('EditEventScreen',{eventId})}/>
          </>
        )}
      </View>

      {/* photo album / shared posts -------------------------------- */}
      <Section title="Photo Album" noPad>
        {event.photos?.length
          ? (
            <FlatList
              data={event.photos}
              keyExtractor={p=>p._id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent:'space-between' }}
              renderItem={renderThumb}
              scrollEnabled={false}
            />
          )
          : <Text style={S.body}>No photos yet.</Text>}
      </Section>
    </ScrollView>
  );
}

/* ---------- tiny helpers ------------------------------------------ */
const Section = ({ title, children, noPad }) => (
  <View style={{ paddingHorizontal:noPad?sp(2):sp(4), marginTop:sp(4) }}>
    <Text style={S.secTitle}>{title}</Text>
    {children}
  </View>
);

/* ---------- styles ------------------------------------------------ */
const S = StyleSheet.create({
  root:{ flex:1, backgroundColor:C.bg },
  center:{ flex:1, justifyContent:'center', alignItems:'center' },

  hero:{ width:'100%', height:W*0.6 },

  hostRow:{ flexDirection:'row', alignItems:'center',
            paddingHorizontal:sp(4), marginTop:sp(4) },
  hostLogo:{ width:56, height:56, borderRadius:radius.avatar, marginRight:sp(3) },
  hostTxt:{ fontWeight:'700', fontSize:18, marginBottom:2 },
  sub:{ color:C.grey, fontSize:13 },

  secTitle:{ fontWeight:'700', fontSize:18, marginBottom:sp(1.5) },
  body:{ lineHeight:20 },
  link:{ color:C.brandBlue },

  btnBox:{ paddingHorizontal:sp(4), marginTop:sp(2) },

});
