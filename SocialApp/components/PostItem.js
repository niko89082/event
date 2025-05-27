// components/PostItem.js
import React, { useState, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet,
  TouchableOpacity, Pressable, Modal, Button, Dimensions,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { API_BASE_URL }  from '@env';
import api               from '../services/api';

/* ------------------------------------------------------------------ */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEART = '#ED4956';

/** util – relative "x ago" or absolute date */
const niceDate = (iso) => {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60)            return `${mins || 1}m`;
  const hrs  = Math.floor(mins / 60);
  if (hrs < 24)             return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)             return `${days}d`;
  return new Date(iso).toLocaleDateString();
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
  const [showFullCaption, setShowFullCaption] = useState(false);

  const toggleLike = async () => {
    try {
      const { data } = await api.post(`/api/photos/like/${post._id}`);
      setLiked(data.likes.includes(currentUserId));
      setLikes(data.likeCount);
    } catch (e) { console.log(e.response?.data || e); }
  };

  /* ---- navigation helpers ---------------------------------------- */
  const openComments = () =>
    navigation.navigate('PostDetailsScreen', { postId: post._id });

  const openUser = () =>
    navigation.navigate('ProfileScreen',    { userId: post.user?._id });

  const openEvent = () =>
    navigation.getParent()?.navigate('EventsTab', {
      screen : 'EventDetails',
      params : { eventId: post.event._id },
    });

  const quickShare = () =>
    navigation.navigate('ChatTab', {
      screen : 'SelectChatScreen',
      params : { shareType:'post', shareId: post._id },
    });

  /* ---- derived helpers ------------------------------------------- */
  const stamp = useMemo(() => niceDate(post.createdAt || post.uploadDate), [post]);
  const isOwner = String(post.user?._id) === String(currentUserId);
  
  // Caption handling
  const caption = post.caption || '';
  const shouldTruncate = caption.length > 100;
  const displayCaption = showFullCaption || !shouldTruncate 
    ? caption 
    : caption.substring(0, 100) + '...';

  /* ---- render ----------------------------------------------------- */
  return (
    <View style={styles.postContainer}>
      {/* ---------- header row ---------- */}
      {!hideUserInfo && post.user && (
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.userInfo} onPress={openUser}>
            <Image
              source={{ uri: post.user.profilePicture
                ? `http://${API_BASE_URL}:3000${post.user.profilePicture}`
                : 'https://placehold.co/32x32.png?text=👤' }}
              style={styles.avatar}
            />
            <View style={styles.userDetails}>
              <Text style={styles.username}>{post.user.username}</Text>
              {post.event && (
                <Text style={styles.eventLocation}>{post.event.title}</Text>
              )}
            </View>
          </TouchableOpacity>
          
          {isOwner && (
            <TouchableOpacity onPress={() => setModal(true)} style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ---------- photo ---------- */}
      <View style={styles.imageContainer}>
        {imgURL
          ? <Image source={{ uri: imgURL }} style={styles.postImage} resizeMode="cover" />
          : <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={50} color="#C7C7CC" />
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
        }
      </View>

      {/* ---------- action row ---------- */}
      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={toggleLike} style={styles.actionButton}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? HEART : '#000'}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={openComments} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={23} color="#000"/>
          </TouchableOpacity>

          <TouchableOpacity onPress={quickShare} style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={23} color="#000"/>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---------- likes ---------- */}
      {likes > 0 && (
        <TouchableOpacity style={styles.likesContainer}>
          <Text style={styles.likesText}>
            {likes.toLocaleString()} {likes === 1 ? 'like' : 'likes'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ---------- caption ---------- */}
      <View style={styles.captionContainer}>
        {!!displayCaption && (
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>{post.user?.username} </Text>
            {displayCaption}
          </Text>
        )}
        
        {shouldTruncate && !showFullCaption && (
          <TouchableOpacity onPress={() => setShowFullCaption(true)}>
            <Text style={styles.moreText}>more</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ---------- comment preview ---------- */}
      {(post.comments?.length || 0) > 0 && (
        <TouchableOpacity onPress={openComments} style={styles.commentsPreview}>
          <Text style={styles.viewCommentsText}>
            View all {post.comments.length} comments
          </Text>
          
          {/* Show latest comment */}
          {post.comments.length > 0 && (
            <Text style={styles.latestComment}>
              <Text style={styles.commentUsername}>
                {post.comments[post.comments.length - 1].user?.username}{' '}
              </Text>
              {post.comments[post.comments.length - 1].text}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* ---------- timestamp ---------- */}
      <Text style={styles.timestamp}>{stamp}</Text>

      {/* ---------- linked event ---------- */}
      {post.event && !disableEventLink && (
        <TouchableOpacity onPress={openEvent} style={styles.eventLink}>
          <Ionicons name="calendar-outline" size={16} color="#3797EF" />
          <Text style={styles.eventLinkText}>{post.event.title}</Text>
        </TouchableOpacity>
      )}

      {/* ---------- owner modal ---------- */}
      <Modal transparent visible={modal} animationType="fade"
             onRequestClose={() => setModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => { 
                setModal(false); 
                onDeletePost?.(); 
              }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => setModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  postContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
  },
  eventLocation: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  moreButton: {
    padding: 5,
  },

  // Image
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F6F6F6',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
  },
  placeholderText: {
    color: '#C7C7CC',
    fontSize: 14,
    marginTop: 8,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 15,
    padding: 3,
  },

  // Likes
  likesContainer: {
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  likesText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
  },
  captionUsername: {
    fontWeight: '600',
    color: '#000',
  },
  moreText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },

  // Comments
  commentsPreview: {
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  viewCommentsText: {
    color: '#8E8E93', 
    fontSize: 14,
    marginBottom: 4,
  },
  latestComment: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
  },
  commentUsername: {
    fontWeight: '600',
    color: '#000',
  },

  // Timestamp
  timestamp: {
    paddingHorizontal: 15,
    paddingTop: 8,
    fontSize: 12,
    color: '#8E8E93',
  },

  // Event link
  eventLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  eventLinkText: {
    color: '#3797EF',
    fontSize: 14,
    marginLeft: 5,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  modalOption: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    alignItems: 'center',
  },
  deleteText: {
    color: '#ED4956',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
});