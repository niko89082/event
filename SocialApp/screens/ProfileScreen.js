// screens/ProfileScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList, Dimensions, ScrollView,
} from 'react-native';
import { useIsFocused }  from '@react-navigation/native';
import { Ionicons }      from '@expo/vector-icons';
import api               from '../services/api';
import { API_BASE_URL }  from '@env';
import { AuthContext }   from '../services/AuthContext';
import { palette, spacing, radius } from '../theme';

import SharedEventsTab   from '../components/SharedEventsTab';
import CalendarTab       from '../components/CalendarTab';

/* ---------- constants ---------- */
const COLS  = 3;
const GAP   = spacing(0.5);
const WIDTH = Dimensions.get('window').width;
const THUMB = (WIDTH - GAP * (COLS + 1)) / COLS;

/* =========================================================================
 * ProfileScreen
 * ========================================================================= */
export default function ProfileScreen({ route, navigation }) {
  const { currentUser }   = useContext(AuthContext);
  const authId            = currentUser?._id;
  const userId            = route.params?.userId || null;
  const isFocused         = useIsFocused();

  /* state ----------------------------------------------------------- */
  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [following,   setFollowing]   = useState(false);
  const [requested,   setRequested]   = useState(false);
  const [isSelf,      setIsSelf]      = useState(false);
  const [tab,         setTab]         = useState(0);      // 0-Posts | 1-Events | 2-Calendar

  /* fetch ----------------------------------------------------------- */
  useEffect(() => { if (isFocused) fetchProfile(); }, [isFocused, userId]);

  const fetchProfile = async (pull=false) => {
    pull ? setRefreshing(true) : setLoading(true);
    try {
      const { data } = await api.get(userId ? `/profile/${userId}` : '/profile');
      setProfile(data);
      setIsSelf(String(data._id) === String(authId));   // strict self-check
      setFollowing(!!data.isFollowing);
      setRequested(!!data.hasRequested);
    } catch (err) {
      console.log('❌ profile fetch', err.response?.data || err);
      setProfile(null);
    } finally {
      pull ? setRefreshing(false) : setLoading(false);
    }
  };

  /* follow toggle --------------------------------------------------- */
  const toggleFollow = async () => {
    if (!profile) return;
    try {
      following
        ? await api.delete(`/follow/unfollow/${profile._id}`)
        : await api.post(`/follow/follow/${profile._id}`);
      setFollowing(!following);
      setRequested(false);
      fetchProfile();
    } catch (err) { console.log('❌ follow', err.response?.data || err); }
  };

  /* guards ---------------------------------------------------------- */
  if (loading)  return <View style={styles.center}><ActivityIndicator/></View>;
  if (!profile) return <View style={styles.center}><Text>Profile unavailable</Text></View>;

  /* helpers --------------------------------------------------------- */
  const avatar = profile.profilePicture
    ? `http://${API_BASE_URL}:3000${profile.profilePicture}`
    : null;

  const mutual = profile.followers
    .filter(f => currentUser.following.includes(f._id))
    .map(f => f.username);

  const mutualLabel = !isSelf && mutual.length
    ? `Followed by ${mutual.slice(0,2).join(', ')}${mutual.length>2 ? ` and ${mutual.length-2} others` : ''}`
    : null;

  /* header component (re-used in FlatList & ScrollView) ------------- */
  const Header = () => (
    <>
      {/* ---- Top row ---- */}
      <View style={styles.topRow}>
        {/* QR icon visible **only** for self */}
        {isSelf
          ? (
            <TouchableOpacity onPress={() => navigation.navigate('QrScreen')}>
              <Ionicons name="qr-code-outline" size={24}/>
            </TouchableOpacity>
          )
          : <View style={{ width:24 }}/>}
        <Text style={styles.username}>{profile.username}</Text>
        {isSelf ? (
          <TouchableOpacity onPress={() => navigation.navigate('UserSettingsScreen')}>
            <Ionicons name="settings-outline" size={24}/>
          </TouchableOpacity>
        ) : <View style={{ width:24 }}/>}
      </View>

      {/* ---- Avatar + counts ---- */}
      <View style={styles.headRow}>
        {avatar
          ? <Image source={{ uri: avatar }} style={styles.avatar}/>
          : <View style={[styles.avatar,{ backgroundColor:palette.border }]}/>}
        <View style={styles.countBox}>
          <Stat n={profile.photos.length}    label="Posts"/>
          <Stat n={profile.followers.length} label="Followers" onPress={() =>
            navigation.navigate('FollowListScreen',{ userId:profile._id, mode:'followers'})}/>
          <Stat n={profile.following.length} label="Following" onPress={() =>
            navigation.navigate('FollowListScreen',{ userId:profile._id, mode:'following'})}/>
        </View>
      </View>

      {mutualLabel && <Text style={styles.mutual}>{mutualLabel}</Text>}
      {profile.bio   && <Text style={styles.bio}>{profile.bio}</Text>}

      {/* ---- actions ---- */}
      <View style={styles.actions}>
        {isSelf ? (
          <>
            <Action solid label="Edit"   onPress={() => navigation.navigate('EditProfileScreen')}/>
            <Action       label="Share"  onPress={() =>
              navigation.navigate('ChatTab',{screen:'SelectChatScreen',
                params:{shareType:'profile',shareId:profile._id}})}/>
          </>
        ) : (
          <>
            <Action
              solid={!following}
              label={following ? 'Unfollow' : requested ? 'Requested' : 'Follow'}
              onPress={toggleFollow}
            />
            <Action label="Message" onPress={() =>
              navigation.navigate('ChatTab',{ screen:'ChatScreen',
                params:{ userId:profile._id }})}/>
          </>
        )}
      </View>

      {/* ---- tab bar ---- */}
      <View style={styles.tabBar}>
        {['Posts','Events','Calendar'].map((t,i)=>(
          (i===2 && !isSelf) ? null : (
            <TouchableOpacity key={t} style={styles.tabBtn} onPress={()=>setTab(i)}>
              <Text style={[styles.tabTxt, tab===i && styles.tabTxtActive]}>{t}</Text>
              {tab===i && <View style={styles.tabIndicator}/>}
            </TouchableOpacity>
          )
        ))}
      </View>
    </>
  );

  /* photo cell ------------------------------------------------------ */
  const renderPhoto = ({ item }) => (
    <TouchableOpacity
      style={{ width:THUMB, height:THUMB, margin:GAP }}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PostDetailsScreen',{ postId:item._id })}
    >
      <Image
        source={{ uri:`http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={{ width:'100%', height:'100%', borderRadius:radius.thumb }}
      />
    </TouchableOpacity>
  );

  /* ---------------- main return (switch by tab) ------------------- */
  if (tab === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <FlatList
          data={profile.photos}
          keyExtractor={p=>p._id}
          renderItem={renderPhoto}
          numColumns={COLS}
          ListHeaderComponent={Header}
          columnWrapperStyle={{ justifyContent:'flex-start' }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={()=>fetchProfile(true)}/>
          }
          ListEmptyComponent={<View style={styles.center}><Text>No posts yet.</Text></View>}
          contentContainerStyle={{ paddingBottom:spacing(8) }}
        />
      </SafeAreaView>
    );
  }

  /* Events / Calendar in ScrollView */
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={()=>fetchProfile(true)}/>
        }
        contentContainerStyle={{ paddingBottom:spacing(8) }}
      >
        <Header/>
        {tab === 1 && (
          <SharedEventsTab navigation={navigation} userId={profile._id} isSelf={isSelf}/>
        )}
        {tab === 2 && isSelf && (
          <CalendarTab navigation={navigation} userId={profile._id}/>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- tiny helpers ---------------- */
const Stat = ({ n,label,onPress }) => (
  <TouchableOpacity disabled={!onPress} onPress={onPress} style={{ alignItems:'center' }}>
    <Text style={{ fontWeight:'700', fontSize:16 }}>{n}</Text>
    <Text style={{ color:palette.grey }}>{label}</Text>
  </TouchableOpacity>
);

const Action = ({ label,solid=false,onPress }) => (
  <TouchableOpacity
    style={[
      styles.action,
      { backgroundColor: solid ? palette.brandBlue : palette.surface },
    ]}
    onPress={onPress}
  >
    <Text style={{
      color: solid ? palette.white : palette.black,
      fontWeight:'600'
    }}>{label}</Text>
  </TouchableOpacity>
);

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  root:{ flex:1, backgroundColor:palette.bg },
  center:{ flex:1, justifyContent:'center', alignItems:'center' },

  topRow:{
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:spacing(4), paddingTop:spacing(2),
  },
  username:{ fontSize:20, fontWeight:'700' },

  headRow:{
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:spacing(4), paddingTop:spacing(3),
  },
  avatar:{
    width:100, height:100,
    borderRadius:radius.avatar,                    // square avatar
  },
  countBox:{
    flexDirection:'row', flex:1, justifyContent:'space-around',
    marginLeft:spacing(6),
  },

  mutual:{ color:palette.grey, paddingHorizontal:spacing(4), marginTop:spacing(1) },
  bio:{    paddingHorizontal:spacing(4), marginTop:spacing(2), lineHeight:19 },

  actions:{
    flexDirection:'row', justifyContent:'space-around',
    paddingVertical:spacing(3), paddingHorizontal:spacing(4),
  },
  action:{
    flex:1, marginHorizontal:spacing(1),
    alignItems:'center', paddingVertical:spacing(2),
    borderRadius:radius.btn,
  },

  tabBar:{
    flexDirection:'row', borderTopWidth:1, borderBottomWidth:1,
    borderColor:palette.border, marginTop:spacing(4),
  },
  tabBtn:{ flex:1, alignItems:'center', paddingVertical:spacing(2) },
  tabTxt:{ color:palette.grey, fontWeight:'600' },
  tabTxtActive:{ color:palette.black },
  tabIndicator:{
    position:'absolute', bottom:0, height:3, width:'70%',
    backgroundColor:palette.brandBlue, borderRadius:2,
  },
});