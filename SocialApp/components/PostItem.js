// components/PostItem.js
import React, { useState, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet,
  TouchableOpacity, Pressable, Modal, Button,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { API_BASE_URL }  from '@env';
import api               from '../services/api';
import { palette as C, spacing as sp, radius, shadow } from '../theme';

/* ------------------------------------------------------------------ */
/** Instagram-style red */
const HEART = '#ED4956';

/** util – relative “x ago” or absolute date */
const niceDate = (iso) => {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60)            return `${mins || 1} m`;
  const hrs  = Math.floor(mins / 60);
  if (hrs < 24)             return `${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)             return `${days} d`;
  return new Date(iso).toLocaleDateString();   // > 1 week
};
/* ------------------------------------------------------------------ */

export default function PostItem({
  post,
  currentUserId,
  hideUserInfo   = false,
  navigation,
  onDeletePost,
  disableEventLink = false,
}) {
  /* ---- image url -------------------------------------------------- */
  const first  = post.paths?.[0] ? `/${post.paths[0].replace(/^\/?/,'')}` : '';
  const imgURL = first ? `http://${API_BASE_URL}:3000${first}` : null;

  /* ---- like state ------------------------------------------------- */
  const [liked, setLiked] = useState(
    post.likes?.some(u => String(u) === String(currentUserId))
  );
  const [likes, setLikes] = useState(post.likes?.length || 0);
  const [modal, setModal] = useState(false);

  const toggleLike = async () => {
    try {
      const { data } = await api.post(`/photos/like/${post._id}`);
      setLiked(data.likes.includes(currentUserId));
      setLikes(data.likeCount);
    } catch (e) { console.log(e.response?.data || e); }
  };

  /* ---- navigation helpers ---------------------------------------- */
  const openComments = () =>
    navigation.navigate('PostDetailsScreen', { postId: post._id });

  const openUser = () =>
    navigation.navigate('ProfileScreen',    { userId: post.user?._id });

  /** Go to EventDetails inside the Home/Feed stack */
  const openEvent = () =>
    navigation.getParent()?.navigate('Home', {
      screen : 'EventDetails',
      params : { eventId: post.event._id },
    });

  /** instant “share” → SelectChatScreen */
  const quickShare = () =>
    navigation.navigate('ChatTab', {
      screen : 'SelectChatScreen',
      params : { shareType:'post', shareId: post._id },
    });

  /* ---- derived helpers ------------------------------------------- */
  const stamp = useMemo(() => niceDate(post.createdAt || post.uploadDate), [post]);

  /* ---- render ----------------------------------------------------- */
  return (
    <View style={styles.card}>
      {/* ---------- header row ---------- */}
      {!hideUserInfo && post.user && (
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.userRow} onPress={openUser}>
            <Image
              source={{ uri: post.user.profilePicture
                ? `http://${API_BASE_URL}:3000${post.user.profilePicture}`
                : 'https://placehold.co/32x32.png?text=👤' }}
              style={styles.avatar}
            />
            <Text style={styles.username}>{post.user.username}</Text>
          </TouchableOpacity>
          <Text style={styles.time}>{stamp}</Text>
        </View>
      )}

      {/* ---------- photo ---------- */}
      {imgURL
        ? <Image source={{ uri: imgURL }} style={styles.img}/>
        : <View style={styles.imgPH}><Text>No Image</Text></View>}

      {/* ---------- action row ---------- */}
      <View style={styles.actionRow}>
        <Pressable style={styles.iconBtn} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={24}
            color={liked ? HEART : C.text}
          />
          {likes > 0 && <Text style={styles.counter}>{likes}</Text>}
        </Pressable>

        <Pressable style={[styles.iconBtn,{marginLeft:sp(3)}]} onPress={openComments}>
          <Ionicons name="chatbubble-outline" size={23} color={C.text}/>
          {(post.comments?.length || 0) > 0 &&
            <Text style={styles.counter}>{post.comments.length}</Text>}
        </Pressable>

        <Pressable
          style={[styles.iconBtn,{marginLeft:sp(3)}]}
          onPress={quickShare}
          onLongPress={()=>setModal(true)}
        >
          <Ionicons name="paper-plane-outline" size={23} color={C.text}/>
        </Pressable>

        {String(post.user?._id) === String(currentUserId) && (
          <Pressable style={styles.moreBtn} onPress={()=>setModal(true)}>
            <Ionicons name="ellipsis-horizontal" size={20}/>
          </Pressable>
        )}
      </View>

      {/* ---------- likes ---------- */}
      {likes > 0 && (
        <Text style={styles.likesLabel}>
          {likes.toLocaleString()} {likes === 1 ? 'like' : 'likes'}
        </Text>
      )}

      {/* ---------- caption ---------- */}
      {!!post.caption && (
        <Text style={styles.caption}>
          <Text style={styles.username}>{post.user?.username} </Text>
          {post.caption}
        </Text>
      )}

      {/* ---------- comment preview (max 2) ---------- */}
      {(post.comments?.length || 0) > 0 && (
        <TouchableOpacity onPress={openComments}>
          {post.comments.slice(0,2).map(c=>(
            <Text key={c._id} style={styles.commentLine}>
              <Text style={styles.username}>{c.user?.username} </Text>
              {c.text}
            </Text>
          ))}
          {post.comments.length > 2 && (
            <Text style={styles.viewAll}>View all {post.comments.length} comments</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ---------- linked event ---------- */}
      {post.event && !disableEventLink && (
        <TouchableOpacity onPress={openEvent}>
          <Text style={styles.eventLink}>View event • {post.event.title}</Text>
        </TouchableOpacity>
      )}

      {/* ---------- owner modal ---------- */}
      <Modal transparent visible={modal} animationType="fade"
             onRequestClose={()=>setModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            {String(post.user?._id) === String(currentUserId) && (
              <Button title="Delete post" color={C.danger}
                onPress={()=>{ setModal(false); onDeletePost?.(); }}/>
            )}
            <Button title="Cancel" onPress={()=>setModal(false)}/>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  card:{ backgroundColor:C.surface, marginBottom:sp(4),
         borderRadius:radius.card, padding:sp(3), ...shadow },

  /* header */
  headerRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  userRow  :{ flexDirection:'row', alignItems:'center' },
  avatar   :{ width:32, height:32, borderRadius:radius.avatar },
  username :{ fontWeight:'700', fontSize:13, color:C.text, marginLeft:sp(1) },
  time     :{ fontSize:11, color:C.grey },

  /* photo */
  img  :{ width:'100%', aspectRatio:1, borderRadius:radius.thumb },
  imgPH:{ width:'100%', aspectRatio:1, backgroundColor:C.surfaceAlt,
          justifyContent:'center', alignItems:'center', borderRadius:radius.thumb },

  /* actions */
  actionRow:{ flexDirection:'row', alignItems:'center', marginTop:sp(2) },
  iconBtn  :{ flexDirection:'row', alignItems:'center' },
  counter  :{ marginLeft:sp(0.5), fontSize:13, color:C.text },
  moreBtn  :{ marginLeft:'auto' },

  /* meta */
  likesLabel :{ fontWeight:'600', marginTop:sp(1), fontSize:13 },
  caption    :{ marginTop:sp(1), lineHeight:17 },
  commentLine:{ marginTop:sp(0.5), lineHeight:17 },
  viewAll    :{ color:C.grey, marginTop:sp(0.5) },
  eventLink  :{ color:C.brandBlue, marginTop:sp(1) },

  /* modal */
  overlay :{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  modalBox:{ backgroundColor:C.surface, padding:sp(5),
             borderTopLeftRadius:12, borderTopRightRadius:12 },
});