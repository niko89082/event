// components/EnhancedPostItem.js - Enhanced PostItem with event context
import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, Image, StyleSheet,
  TouchableOpacity, Pressable, Modal, Button, Dimensions, Animated,
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

export default function EnhancedPostItem({
  post,
  currentUserId,
  hideUserInfo   = false,
  navigation,
  onDeletePost,
  disableEventLink = false,
  showEventContext = false, // NEW: Show event context
  eventContextSource = null, // NEW: Source type ('friend' or 'event_attendee')
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

  /* ---- double tap animation ---------------------------------------- */
  const scaleValue = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(null);

  const toggleLike = async () => {
    try {
      const { data } = await api.post(`/api/photos/like/${post._id}`);
      setLiked(data.likes.includes(currentUserId));
      setLikes(data.likeCount);
    } catch (e) { console.log(e.response?.data || e); }
  };

  /* ---- double tap handler ----------------------------------------- */
  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      // Double tap detected!
      if (!liked) {
        // Animate heart
        heartScale.setValue(0);
        Animated.sequence([
          Animated.spring(heartScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 5,
          }),
          Animated.timing(heartScale, {
            toValue: 0,
            duration: 300,
            delay: 500,
            useNativeDriver: true,
          }),
        ]).start();

        // Animate image scale
        Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleValue, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();

        toggleLike();
      }
    } else {
      // Single tap - open comments after delay to check for double tap
      setTimeout(() => {
        const timeSinceLastTap = Date.now() - lastTap.current;
        if (timeSinceLastTap >= DOUBLE_PRESS_DELAY) {
          openComments();
        }
      }, DOUBLE_PRESS_DELAY);
    }
    
    lastTap.current = now;
  };

  /* ---- navigation helpers ---------------------------------------- */
  const openComments = () => {
    console.log('🟡 PostItem: Opening comments for post:', post._id);
    navigation.navigate('PostDetailsScreen', { postId: post._id });
  };

  const openUser = () => {
    console.log('🟡 PostItem: Opening user profile:', post.user?._id);
    navigation.navigate('ProfileScreen', { userId: post.user?._id });
  };

  const openEvent = () => {
    console.log('🟡 PostItem: Opening event:', post.event?._id);
    navigation.navigate('EventDetailsScreen', { eventId: post.event._id });
  };

  const quickShare = () => {
    console.log('🟡 PostItem: Sharing post:', post._id);
    navigation.navigate('SelectChatScreen', {
      shareType: 'post', 
      shareId: post._id
    });
  };

  /* ---- derived helpers ------------------------------------------- */
  const stamp = useMemo(() => niceDate(post.createdAt || post.uploadDate), [post]);
  const isOwner = String(post.user?._id) === String(currentUserId);
  
  // Caption handling
  const caption = post.caption || '';
  const shouldTruncate = caption.length > 100;
  const displayCaption = showFullCaption || !shouldTruncate 
    ? caption 
    : caption.substring(0, 100) + '...';

  // NEW: Event context rendering
  const renderEventContext = () => {
    if (!showEventContext || !post.event || eventContextSource === 'friend') {
      return null;
    }

    return (
      <TouchableOpacity 
        style={styles.eventContext}
        onPress={openEvent}
        activeOpacity={0.8}
      >
        <Ionicons name="calendar-outline" size={12} color="#3797EF" />
        <Text style={styles.eventContextText}>
          from {post.event.title}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ---- render ----------------------------------------------------- */
  return (
    <View style={styles.postContainer}>
      {/* ---------- header row ---------- */}
      {!hideUserInfo && post.user && (
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.userInfo} onPress={openUser} activeOpacity={0.8}>
            <Image
              source={{ uri: post.user.profilePicture
                ? `http://${API_BASE_URL}:3000${post.user.profilePicture}`
                : 'https://placehold.co/32x32.png?text=👤' }}
              style={styles.avatar}
            />
            <View style={styles.userDetails}>
              <Text style={styles.username}>{post.user.username}</Text>
              {/* NEW: Event context */}
              {renderEventContext()}
              {/* Existing event location (for friend posts) */}
              {post.event && eventContextSource === 'friend' && (
                <Text style={styles.eventLocation}>{post.event.title}</Text>
              )}
            </View>
          </TouchableOpacity>
          
          {isOwner && (
            <TouchableOpacity onPress={() => setModal(true)} style={styles.moreButton} activeOpacity={0.8}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ---------- photo with double tap ---------- */}
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={handleDoubleTap}
        activeOpacity={1}
      >
        <Animated.View style={[styles.imageWrapper, { transform: [{ scale: scaleValue }] }]}>
          {imgURL
            ? <Image source={{ uri: imgURL }} style={styles.postImage} resizeMode="cover" />
            : <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={50} color="#C7C7CC" />
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
          }
        </Animated.View>
        
        {/* Double tap heart animation */}
        <Animated.View 
          style={[
            styles.doubleTapHeart, 
            { 
              transform: [{ scale: heartScale }],
              opacity: heartScale 
            }
          ]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={80} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      {/* ---------- action row ---------- */}
      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={toggleLike} style={styles.actionButton} activeOpacity={0.8}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? HEART : '#000'}
            />
          </TouchableOpacity>

          {/* Like count positioned to the right of heart */}
          {likes > 0 && (
            <Text style={styles.likeCountInline}>
              {likes.toLocaleString()}
            </Text>
          )}

          <TouchableOpacity onPress={openComments} style={styles.actionButton} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={23} color="#000"/>
          </TouchableOpacity>

          <TouchableOpacity onPress={quickShare} style={styles.actionButton} activeOpacity={0.8}>
            <Ionicons name="paper-plane-outline" size={23} color="#000"/>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---------- caption ---------- */}
      <View style={styles.captionContainer}>
        {!!displayCaption && (
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>{post.user?.username} </Text>
            {displayCaption}
          </Text>
        )}
        
        {shouldTruncate && !showFullCaption && (
          <TouchableOpacity onPress={() => setShowFullCaption(true)} activeOpacity={0.8}>
            <Text style={styles.moreText}>more</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ---------- comment preview ---------- */}
      {(post.comments?.length || 0) > 0 && (
        <TouchableOpacity onPress={openComments} style={styles.commentsPreview} activeOpacity={0.8}>
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

      {/* ---------- linked event (for friend posts) ---------- */}
      {post.event && !disableEventLink && eventContextSource === 'friend' && (
        <TouchableOpacity onPress={openEvent} style={styles.eventLink} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={16} color="#3797EF" />
          <Text style={styles.eventLinkText}>{post.event.title}</Text>
        </TouchableOpacity>
      )}

      {/* ---------- owner modal ---------- */}
      <Modal transparent visible={modal} animationType="fade"
             onRequestClose={() => setModal(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModal(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => { 
                setModal(false); 
                onDeletePost?.(); 
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => setModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    borderRadius: 8,
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
  
  // NEW: Event context styles
  eventContext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  eventContextText: {
    fontSize: 12,
    color: '#3797EF',
    marginLeft: 4,
    fontWeight: '500',
  },
  
  moreButton: {
    padding: 5,
  },

  // Image with double tap
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F6F6F6',
    position: 'relative',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
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
  doubleTapHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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

  // Inline like count positioning
  likeCountInline: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
    marginLeft: -10,
    marginRight: 15,
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