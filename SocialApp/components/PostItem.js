// components/PostItem.js - PHASE 2: Enhanced with Memory Photo Support
import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, Image, StyleSheet,
  TouchableOpacity, Pressable, Modal, Button, Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import api from '../services/api';

/* ------------------------------------------------------------------ */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEART = '#ED4956';
const MEMORY_PURPLE = '#8E44AD';

/** util – relative "x ago" or absolute date */
const niceDate = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins || 1}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
};
/* ------------------------------------------------------------------ */

export default function EnhancedPostItem({
  post,
  currentUserId,
  hideUserInfo = false,
  navigation,
  onDeletePost,
  disableEventLink = false,
  showEventContext = false,
  eventContextSource = null,
}) {
  // 🧠 PHASE 2: Detect if this is a memory post
  const isMemoryPost = post.postType === 'memory';
  const memoryInfo = post.memoryInfo || {};

  /* ---- image url -------------------------------------------------- */
  let imgURL = null;
  if (isMemoryPost) {
    // Memory photos use direct URL from backend
    imgURL = post.url ? `http://${API_BASE_URL}:3000${post.url}` : null;
  } else {
    // Regular posts use paths array
    const first = post.paths?.[0] ? `/${post.paths[0].replace(/^\/?/, '')}` : '';
    imgURL = first ? `http://${API_BASE_URL}:3000${first}` : null;
  }

  /* ---- like state ------------------------------------------------- */
  const [liked, setLiked] = useState(
    post.likes?.some(u => String(u) === String(currentUserId))
  );
  const [likes, setLikes] = useState(post.likes?.length || post.likeCount || 0);
  const [modal, setModal] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);

  /* ---- double tap animation ---------------------------------------- */
  const scaleValue = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(null);

  // 🧠 PHASE 2: Different like handling for memory photos
  const toggleLike = async () => {
    try {
      if (isMemoryPost) {
        // Memory photo like endpoint
        const { data } = await api.post(`/api/memories/photos/${post._id}/like`);
        setLiked(data.liked);
        setLikes(data.likeCount);
      } else {
        // Regular photo like endpoint
        const { data } = await api.post(`/api/photos/like/${post._id}`);
        setLiked(data.likes.includes(currentUserId));
        setLikes(data.likeCount);
      }
    } catch (e) {
      console.log('Like error:', e.response?.data || e);
    }
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
          if (isMemoryPost) {
            // For memory posts, navigate to memory details instead of post details
            openMemory();
          } else {
            openComments();
          }
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

  // 🧠 PHASE 2: New navigation helper for memory posts
  const openMemory = () => {
    console.log('🟡 PostItem: Opening memory:', memoryInfo.memoryId);
    navigation.navigate('MemoryDetailsScreen', { memoryId: memoryInfo.memoryId });
  };

  const quickShare = () => {
    console.log('🟡 PostItem: Sharing post:', post._id);
    navigation.navigate('SelectChatScreen', {
      shareType: isMemoryPost ? 'memory_photo' : 'post',
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
    : caption.slice(0, 100) + '...';

  /* ================================================================== */
  /*                            RENDER                                  */
  /* ================================================================== */

  return (
    <View style={[
      styles.postContainer,
      isMemoryPost && styles.memoryPostContainer // 🧠 PHASE 2: Memory post styling
    ]}>

      {/* 🧠 PHASE 2: Memory Badge */}
      {isMemoryPost && (
        <View style={styles.memoryBadge}>
          <Ionicons name="library" size={16} color={MEMORY_PURPLE} />
          <Text style={styles.memoryBadgeText}>Memory</Text>
        </View>
      )}

      {/* ---------- user info header ---------- */}
      {!hideUserInfo && (
        <View style={styles.header}>
          <TouchableOpacity onPress={openUser} style={styles.userRow} activeOpacity={0.8}>
            <Image
              source={{ uri: `http://${API_BASE_URL}:3000${post.user?.profilePicture || ''}` }}
              style={styles.avatar}
              onError={(e) => console.log('Avatar error:', e.nativeEvent?.error)}
            />
            <View style={styles.userText}>
              <Text style={styles.username}>{post.user?.username || 'Unknown'}</Text>

              {/* 🧠 PHASE 2: Show memory context below username */}
              {isMemoryPost && (
                <TouchableOpacity onPress={openMemory} style={styles.memoryContext}>
                  <Ionicons name="library-outline" size={12} color={MEMORY_PURPLE} />
                  <Text style={styles.memoryContextText}>
                    from {memoryInfo.memoryTitle || 'Memory'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Regular event context for non-memory posts */}
              {!isMemoryPost && post.event && showEventContext && (
                <TouchableOpacity onPress={openEvent} style={styles.eventContext}>
                  <Ionicons name="calendar-outline" size={12} color="#3797EF" />
                  <Text style={styles.eventContextText}>from {post.event.title}</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>

          {/* owner dots */}
          {isOwner && (
            <TouchableOpacity onPress={() => setModal(true)} style={styles.dots} activeOpacity={0.8}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ---------- main image ---------- */}
      <Pressable onPress={handleDoubleTap} style={styles.imageContainer}>
        <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
          {imgURL ? (
            <Image
              source={{ uri: imgURL }}
              style={styles.postImage}
              onError={(e) => console.log('Post image error:', e.nativeEvent?.error)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons 
                name={isMemoryPost ? "library-outline" : "image-outline"} 
                size={64} 
                color="#C7C7CC" 
              />
              <Text style={styles.placeholderText}>
                {isMemoryPost ? "Memory Photo" : "Image not available"}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Heart animation overlay */}
        <Animated.View style={[styles.heartOverlay, { transform: [{ scale: heartScale }] }]}>
          <Ionicons name="heart" size={80} color="#FFFFFF" />
        </Animated.View>
      </Pressable>

      {/* ---------- action row (like, comment, share) ---------- */}
      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={toggleLike} style={styles.actionBtn} activeOpacity={0.8}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? HEART : '#000'}
            />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={isMemoryPost ? openMemory : openComments} 
            style={styles.actionBtn} 
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#000" />
          </TouchableOpacity>

          <TouchableOpacity onPress={quickShare} style={styles.actionBtn} activeOpacity={0.8}>
            <Ionicons name="paper-plane-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ---------- like count ---------- */}
      {likes > 0 && (
        <TouchableOpacity onPress={isMemoryPost ? openMemory : openComments} activeOpacity={0.8}>
          <Text style={styles.likesText}>
            {likes} like{likes === 1 ? '' : 's'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ---------- caption ---------- */}
      {displayCaption && (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>{post.user?.username} </Text>
            {displayCaption}
          </Text>

          {shouldTruncate && !showFullCaption && (
            <TouchableOpacity onPress={() => setShowFullCaption(true)} activeOpacity={0.8}>
              <Text style={styles.moreText}>more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 🧠 PHASE 2: Memory-specific footer info */}
      {isMemoryPost && (
        <TouchableOpacity onPress={openMemory} style={styles.memoryFooter} activeOpacity={0.8}>
          <View style={styles.memoryFooterContent}>
            <View style={styles.memoryStats}>
              <Ionicons name="people-outline" size={14} color="#8E8E93" />
              <Text style={styles.memoryStatsText}>
                {memoryInfo.participantCount} participant{memoryInfo.participantCount === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.viewMemoryLink}>View full memory</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ---------- comment preview (for regular posts only) ---------- */}
      {!isMemoryPost && (post.comments?.length || 0) > 0 && (
        <TouchableOpacity onPress={openComments} style={styles.commentsPreview} activeOpacity={0.8}>
          <Text style={styles.viewCommentsText}>
            View all {post.comments.length} comments
          </Text>

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

      {/* ---------- linked event (for regular posts only) ---------- */}
      {!isMemoryPost && post.event && !disableEventLink && eventContextSource === 'friend' && (
        <TouchableOpacity onPress={openEvent} style={styles.eventLink} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={16} color="#3797EF" />
          <Text style={styles.eventLinkText}>{post.event.title}</Text>
        </TouchableOpacity>
      )}

      {/* ---------- owner modal ---------- */}
      <Modal transparent visible={modal} animationType="fade" onRequestClose={() => setModal(false)}>
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
                onDeletePost?.(post._id);
              }}
            >
              <Text style={styles.modalOptionText}>Delete Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => setModal(false)}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ================================================================== */
/*                             STYLES                                 */
/* ================================================================== */

const styles = StyleSheet.create({
  postContainer: {
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  
  // 🧠 PHASE 2: Memory post styling
  memoryPostContainer: {
    borderLeftWidth: 3,
    borderLeftColor: MEMORY_PURPLE,
    backgroundColor: '#FAFBFC', // Subtle background tint
  },

  // 🧠 PHASE 2: Memory badge at top
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(142, 68, 173, 0.2)',
  },
  memoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: MEMORY_PURPLE,
    marginLeft: 6,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#E1E1E1',
    marginRight: 10,
  },
  userText: {
    flex: 1,
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
  },
  
  // 🧠 PHASE 2: Memory context styling
  memoryContext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  memoryContextText: {
    fontSize: 12,
    color: MEMORY_PURPLE,
    marginLeft: 4,
    fontWeight: '500',
  },

  // Event context (existing)
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

  dots: {
    padding: 5,
  },

  // Image
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
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
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    opacity: 0.9,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    marginRight: 15,
    padding: 2,
  },

  // Likes
  likesText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
    paddingHorizontal: 15,
    paddingVertical: 2,
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
  },
  captionUsername: {
    fontWeight: '600',
  },
  moreText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 2,
  },

  // 🧠 PHASE 2: Memory footer
  memoryFooter: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(142, 68, 173, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(142, 68, 173, 0.1)',
  },
  memoryFooterContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryStatsText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  viewMemoryLink: {
    fontSize: 12,
    color: MEMORY_PURPLE,
    fontWeight: '600',
  },

  // Comments
  commentsPreview: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  viewCommentsText: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 2,
  },
  latestComment: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
  },
  commentUsername: {
    fontWeight: '600',
  },

  // Timestamp
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },

  // Event link
  eventLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  eventLinkText: {
    fontSize: 14,
    color: '#3797EF',
    marginLeft: 5,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalCancel: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '500',
  },
});