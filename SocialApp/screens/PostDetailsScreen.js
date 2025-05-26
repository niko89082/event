import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, Image, StyleSheet, Button, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function PostDetailsScreen() {
  const { params }        = useRoute();
  const navigation        = useNavigation();
  const { currentUser }   = useContext(AuthContext);

  const postId            = params?.postId;
  const [post,   setPost] = useState(null);
  const [loading,setLoad] = useState(true);

  /* ─── edit modal state ───────────────────────────────────── */
  const [showEdit, setShowEdit] = useState(false);
  const [caption,  setCaption ] = useState('');
  const [events,   setEvents ] = useState([]);
  const [evPage,   setEvPage ] = useState(1);
  const [evEnd,    setEvEnd  ] = useState(false);
  const [selEvent, setSelEv  ] = useState(null);

  /* ─── fetch post ─────────────────────────────────────────── */
  useEffect(() => { if (postId) fetchPost(); }, [postId]);

  const fetchPost = async () => {
    try {
      setLoad(true);
      const { data } = await api.get(`/photos/${postId}`);
      setPost(data);
      setCaption(data.caption || '');
      setSelEv(data.event?._id || null);
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', 'Unable to load post.');
    } finally { setLoad(false); }
  };

  /* ─── fetch attended events (last-10-days first) ─────────── */
  const fetchEvents = async (page = 1) => {
    try {
      // backend already returns ONLY events the user attended & allows photos
      const { data } = await api.get(`/events/my-photo-events?page=${page}`);
      if (page === 1) setEvents(data || []);
      else             setEvents(p => [...p, ...(data || [])]);

      if (!data || data.length < 10) setEvEnd(true);
      setEvPage(page);
    } catch (e) {
      console.error('fetch events:', e.response?.data || e);
    }
  };

  /* ─── helpers ────────────────────────────────────────────── */
  const isOwner   = post?.user?._id === currentUser?._id;
  const imgPath   = post?.paths?.[0] || null;
  const imgURL    = imgPath ? `http://${API_BASE_URL}:3000${imgPath}` : null;

  const sharePost = () => navigation.navigate('ChatTab', {
    screen: 'SelectChatScreen',
    params: { shareType: 'post', shareId: postId },
  });

  const saveEdit  = async () => {
    try {
      await api.put(`/photos/${postId}`, { caption, eventId: selEvent });
      setPost(p => ({ ...p, caption, event: selEvent ? { _id: selEvent } : null }));
      setShowEdit(false);
    } catch (e) {
      console.error(e.response?.data || e);
      Alert.alert('Error', 'Could not update post.');
    }
  };

  const delPost   = () => Alert.alert(
    'Delete post?',
    'This cannot be undone.',
    [
      { text: 'Cancel', style:'cancel' },
      { text: 'Delete', style:'destructive',
        onPress: async () => {
          try {
            await api.delete(`/photos/${postId}`);
            navigation.goBack();
          } catch (e) {
            console.error(e.response?.data || e);
            Alert.alert('Error', 'Delete failed.');
          }
        }
      },
    ]
  );

  const postComment = async () => {
    if (!newComment.trim()) return;
    try {
      const { data } = await api.post(`/photos/comment/${postId}`, { text: newComment });
      setPost(data);
      setNewComment('');
    } catch (e) { console.error(e.response?.data || e); }
  };

  /* ─── UI state for comments input ────────────────────────── */
  const [newComment, setNewComment] = useState('');

  /* ─── render ─────────────────────────────────────────────── */
  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" /></View>
  );
  if (!post) return (
    <View style={styles.center}><Text>Post not found.</Text></View>
  );

  
  return (
    <View style={styles.container}>
      {/* header row */}
      <View style={styles.header}>
        <Text style={styles.hTxt}>Post</Text>
        <View style={{ flexDirection:'row' }}>
          <TouchableOpacity onPress={sharePost} style={{ marginRight:20 }}>
            <Ionicons name="share-social-outline" size={22} />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={() => { setShowEdit(true); fetchEvents(1);} }>
              <Ionicons name="ellipsis-horizontal" size={22} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* image */}
      {imgURL
        ? <Image source={{ uri: imgURL }} style={styles.image} />
        : <View style={styles.placeholder}><Text>No image</Text></View>}

      {/* caption & meta */}
      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
      <Text style={styles.meta}>Uploaded by {post.user?.username || '??'}</Text>
      {post.event && (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('EventsTab', {   // stack name
              screen: 'EventDetails',             // inner route name
              params: { eventId: post.event._id }
            })
          }>
          <Text style={styles.eventLink}>View Event ↗</Text>
        </TouchableOpacity>
      )}

      {/* comments list */}
      <FlatList
        data={post.comments || []}
        keyExtractor={(c,i)=>`${c._id}-${i}`}
        renderItem={({item})=>(
          <View style={styles.cItem}>
            <TouchableOpacity
              onPress={()=>navigation.navigate('ProfileScreen',{userId:item.user?._id})}>
              <Text style={styles.cUser}>{item.user?.username||'??'}:</Text>
            </TouchableOpacity>
            <Text style={styles.cText}>{item.text}</Text>
          </View>
        )}
        style={{ flex:1 }}
      />

      {/* add comment */}
      <View style={styles.cRow}>
        <TextInput
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Add a comment…"
          style={styles.cInput}
        />
        <Button title="Post" onPress={postComment} />
      </View>

      {/* edit modal */}
      <Modal transparent visible={showEdit} animationType="slide">
        <TouchableOpacity style={styles.mOverlay} activeOpacity={1}
                          onPress={()=>setShowEdit(false)}>
          <View style={styles.mBox}>
            <Text style={styles.mTitle}>Edit post</Text>
            <TextInput
              multiline
              value={caption}
              onChangeText={setCaption}
              style={styles.mInput}
              placeholder="Caption"
            />

            {/* event picker */}
            <Text style={{ fontWeight:'600', marginTop:8 }}>Add to Event</Text>
            {events.length === 0 && (
              <Text style={{ color:'#666', marginVertical:4 }}>
                No events in the last 10 days.
              </Text>
            )}
            <FlatList
              data={events}
              keyExtractor={e=>e._id}
              renderItem={({item})=>(
                <TouchableOpacity
                  style={styles.evRow}
                  onPress={()=>setSelEv(selEvent===item._id?null:item._id)}>
                  <Ionicons
                    name={selEvent===item._id
                            ? 'radio-button-on' : 'radio-button-off'}
                    size={18} style={{ marginRight:8 }} />
                  <Text>{item.title}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight:150 }}
            />
            {!evEnd && (
              <Button
                title="Load older events…"
                onPress={()=>fetchEvents(evPage+1)}
              />
            )}

            {/* action buttons */}
            <View style={styles.mBtns}>
              <Button title="Save" onPress={saveEdit} />
              <Button title="Delete" color="red" onPress={delPost} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ─── styles ───────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff' },
  center:{ flex:1,justifyContent:'center',alignItems:'center' },

  header:{ flexDirection:'row',justifyContent:'space-between',
           padding:12, borderBottomWidth:.5, borderColor:'#ccc' },
  hTxt:{ fontSize:16, fontWeight:'700' },

  image:{ width:'100%', height:300, backgroundColor:'#eee' },
  placeholder:{ width:'100%', height:300,
                justifyContent:'center',alignItems:'center',
                backgroundColor:'#ddd' },
  caption:{ margin:12 },
  meta:{ marginHorizontal:12, fontSize:12, color:'#666' },
  eventLink:{ color:'#1664ff', marginHorizontal:12, marginBottom:6 },

  /* comments */
  cItem:{ flexDirection:'row', margin:8 },
  cUser:{ fontWeight:'700', marginRight:4 },
  cText:{ flex:1 },
  cRow:{ flexDirection:'row', alignItems:'center',
         borderTopWidth:.5, borderColor:'#ccc', padding:6 },
  cInput:{ flex:1, borderWidth:1, borderColor:'#ccc',
           borderRadius:6, padding:8, marginRight:6 },

  /* modal */
  mOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,.4)',
             justifyContent:'flex-end' },
  mBox:{ backgroundColor:'#fff', padding:16,
         borderTopRightRadius:16, borderTopLeftRadius:16 },
  mTitle:{ fontSize:16, fontWeight:'700', marginBottom:6 },
  mInput:{ borderWidth:1,borderColor:'#ccc',borderRadius:6,
           padding:8,minHeight:60 },

  evRow:{ flexDirection:'row', alignItems:'center',
          paddingVertical:4 },
  mBtns:{ flexDirection:'row', justifyContent:'space-between',
          marginTop:12 },
});