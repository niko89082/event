// components/PostItem.js - Updated with all requested changes
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet,
  TouchableOpacity, Pressable, Modal, Dimensions, Animated,
  TextInput, KeyboardAvoidingView, Platform, Alert, FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '@env';
import api from '../services/api';

/* ------------------------------------------------------------------ */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEART = '#ED4956';
const MEMORY_BLUE = '#3797EF';
const EVENT_BLUE = '#3797EF'; // Changed to blue as requested

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

/** Memory time formatter with nostalgic feel */
const formatMemoryTime = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) return 'captured today';
  if (diffDays <= 7) return `captured ${diffDays} days ago`;
  if (diffDays <= 30) return `captured ${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays <= 365) return `captured ${Math.ceil(diffDays / 30)} months ago`;
  return `captured ${Math.ceil(diffDays / 365)} years ago`;
};

/** Get memory mood based on time */
const getMemoryMood = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) return { emoji: '✨', mood: 'fresh' };
  if (diffDays <= 30) return { emoji: '🌟', mood: 'recent' };
  if (diffDays <= 365) return { emoji: '💫', mood: 'nostalgic' };
  return { emoji: '🕰️', mood: 'vintage' };
};

/** Get upload date display */
const getUploadDate = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
};
/* ------------------------------------------------------------------ */

export default function CompletePostItem({
  post,
  currentUserId,
  hideUserInfo = false,
  navigation,
  onDeletePost,
  disableEventLink = false,
  showEventContext = false,
  eventContextSource = null,
  onPostUpdate, // Callback for post updates
}) {
  // Detect if this is a memory post
  const isMemoryPost = post.postType === 'memory';
  const memoryInfo = post.memoryInfo || {};

  // Memory storytelling data
  const memoryMood = useMemo(() => 
    isMemoryPost ? getMemoryMood(post.createdAt || post.uploadDate) : null, 
    [isMemoryPost, post.createdAt, post.uploadDate]
  );
  
  const memoryTimeText = useMemo(() => 
    isMemoryPost ? formatMemoryTime(post.createdAt || post.uploadDate) : null,
    [isMemoryPost, post.createdAt, post.uploadDate]
  );

  // State for memory photo dimensions
  const [memoryImageDimensions, setMemoryImageDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  });

  /* ---- Enhanced state initialization from props ------- */
  const [liked, setLiked] = useState(post.userLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [modal, setModal] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);

  // NEW: Comment-related state with initial data from props
  const [comments, setComments] = useState(post.comments || []);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // NEW: Likes modal state
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);

  // NEW: Loading state for initial data
  const [initialLoading, setInitialLoading] = useState(false);

  // Animation refs
  const heartScale = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const memorySparkle = useRef(new Animated.Value(0)).current;
  const memoryGlow = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const DOUBLE_PRESS_DELAY = 300;

  /* ---- Load initial data (likes and comments) on mount -------- */
  useEffect(() => {
    if (post._id && !initialLoading) {
      loadInitialData();
    }
  }, [post._id]);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      
      // For regular posts, get full post data with likes and comments
      if (!isMemoryPost) {
        const response = await api.get(`/api/photos/${post._id}`);
        const postData = response.data;
        
        console.log('📊 Loaded post data:', {
          postId: post._id,
          userLiked: postData.userLiked,
          likeCount: postData.likeCount,
          commentCount: postData.commentCount,
          hasComments: postData.comments?.length > 0
        });
        
        setLiked(postData.userLiked || false);
        setLikeCount(postData.likeCount || 0);
        setComments(postData.comments || []);
        setCommentCount(postData.commentCount || 0);
      } else {
        // For memory posts, get the specific photo data
        try {
          const response = await api.get(`/api/memories/photos/${post._id}/likes`);
          setLiked(response.data.userLiked);
          setLikeCount(response.data.likeCount);
          
          // Load comments for memory posts if available
          try {
            const commentsResponse = await api.get(`/api/memories/photos/${post._id}/comments`);
            if (commentsResponse.data.comments) {
              setComments(commentsResponse.data.comments);
              setCommentCount(commentsResponse.data.comments.length);
            }
          } catch (commentError) {
            console.log('Comments not available for memory photos yet');
          }
        } catch (error) {
          console.error('Error loading memory post data:', error);
        }
      }
      
    } catch (error) {
      console.error('Error loading initial post data:', error);
      // Use the data from props as fallback
      setLiked(post.userLiked || false);
      setLikeCount(post.likeCount || 0);
      setComments(post.comments || []);
      setCommentCount(post.commentCount || 0);
    } finally {
      setInitialLoading(false);
    }
  };

  /* ---- image url -------------------------------------------------- */
  let imgURL = null;
  if (isMemoryPost) {
    imgURL = post.url ? `http://${API_BASE_URL}:3000${post.url}` : null;
  } else {
    const first = post.paths?.[0] ? `/${post.paths[0].replace(/^\/?/, '')}` : '';
    imgURL = first ? `http://${API_BASE_URL}:3000${first}` : null;
  }

  // Calculate memory photo dimensions
  useEffect(() => {
    if (isMemoryPost && imgURL) {
      Image.getSize(imgURL, (width, height) => {
        const containerWidth = SCREEN_WIDTH;
        const aspectRatio = height / width;
        const calculatedHeight = Math.min(containerWidth * aspectRatio, SCREEN_WIDTH * 1.5);

        setMemoryImageDimensions({
          width: containerWidth,
          height: calculatedHeight
        });
      }, (error) => {
        console.warn('Failed to get memory image dimensions:', error);
        setMemoryImageDimensions({
          width: SCREEN_WIDTH,
          height: SCREEN_WIDTH
        });
      });
    }
  }, [isMemoryPost, imgURL]);

  // Memory sparkle animation for nostalgic effect
  useEffect(() => {
    if (isMemoryPost && memoryMood?.mood === 'nostalgic') {
      const sparkleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(memorySparkle, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(memorySparkle, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      sparkleAnimation.start();
      return () => sparkleAnimation.stop();
    }
  }, [isMemoryPost, memoryMood]);

  // Vintage glow for old memories
  useEffect(() => {
    if (isMemoryPost && memoryMood?.mood === 'vintage') {
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(memoryGlow, {
            toValue: 0.3,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(memoryGlow, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      );
      glowAnimation.start();
      return () => glowAnimation.stop();
    }
  }, [isMemoryPost, memoryMood]);

  /* ---- FIXED like toggle with proper API endpoint handling ------- */
  const toggleLike = async () => {
    if (!post?._id) return;
    
    try {
      const newLiked = !liked;
      const newCount = newLiked ? likeCount + 1 : likeCount - 1;
      
      // Optimistic update
      setLiked(newLiked);
      setLikeCount(newCount);

      console.log(`🔄 Toggling like for ${isMemoryPost ? 'memory photo' : 'regular post'}:`, post._id);

      let response;
      if (isMemoryPost) {
        // Memory photo like endpoint
        response = await api.post(`/api/memories/photos/${post._id}/like`);
        setLiked(response.data.liked);
        setLikeCount(response.data.likeCount);
      } else {
        // Regular photo like endpoint  
        response = await api.post(`/api/photos/like/${post._id}`);
        setLiked(response.data.likes.includes(currentUserId));
        setLikeCount(response.data.likeCount);
      }

      // Notify parent component of update
      if (onPostUpdate) {
        onPostUpdate(post._id, { 
          liked: newLiked,
          likeCount: newCount
        });
      }

      console.log('✅ Like toggled successfully');
      
    } catch (err) {
      console.error('❌ Toggle like error:', err);
      // Revert optimistic update on error
      setLiked(!liked);
      setLikeCount(liked ? likeCount + 1 : likeCount - 1);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  /* ---- NEW: Fetch likes list for modal or navigate to screen ----- */
  const openLikesScreen = () => {
    if (likeCount > 0) {
      // Navigate to the existing PostLikesScreen
      navigation.navigate('PostLikesScreen', { 
        postId: post._id,
        likeCount: likeCount,
        isMemoryPost: isMemoryPost
      });
    }
  };

  /* ---- NEW: Submit comment --------------------------------------- */
  const submitComment = async () => {
    if (!commentText.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      console.log(`💬 Submitting comment for ${isMemoryPost ? 'memory photo' : 'regular post'}:`, post._id);

      let response;
      if (isMemoryPost) {
        response = await api.post(`/api/memories/photos/${post._id}/comments`, {
          text: commentText.trim(),
          tags: []
        });
        
        // Add the new comment to local state
        setComments(prev => [...prev, response.data.comment]);
        setCommentCount(prev => prev + 1);
      } else {
        response = await api.post(`/api/photos/comment/${post._id}`, {
          text: commentText.trim(),
          tags: []
        });
        
        // For regular posts, the response includes the full updated photo
        setComments(response.data.comments || []);
        setCommentCount(response.data.comments?.length || 0);
      }

      setCommentText('');
      console.log('✅ Comment submitted successfully');

      // Notify parent component
      if (onPostUpdate) {
        onPostUpdate(post._id, { 
          commentCount: isMemoryPost ? commentCount + 1 : response.data.comments?.length || 0 
        });
      }

    } catch (error) {
      console.error('❌ Error submitting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  /* ---- double tap handling --------------------------------------- */
  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSince = now - lastTap.current;

    if (timeSince < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (!liked) {
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
      // Single tap
      setTimeout(() => {
        const timeSinceLastTap = Date.now() - lastTap.current;
        if (timeSinceLastTap >= DOUBLE_PRESS_DELAY) {
          if (isMemoryPost) {
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

  const openMemoryComments = () => {
    console.log('🟡 PostItem: Opening memory photo comments:', post._id);
    navigation.navigate('PostDetailsScreen', { 
      postId: post._id, 
      isMemoryPhoto: true,
      memoryId: memoryInfo.memoryId 
    });
  };

  const openUser = (userId) => {
    console.log('🟡 PostItem: Opening user profile:', userId);
    navigation.navigate('ProfileScreen', { userId });
  };

  const openEvent = () => {
    console.log('🟡 PostItem: Opening event:', post.event?._id);
    navigation.navigate('EventDetailsScreen', { eventId: post.event._id });
  };

  const openMemory = () => {
    console.log('🟡 PostItem: Opening memory:', memoryInfo.memoryId);
    navigation.navigate('MemoryDetailsScreen', { memoryId: memoryInfo.memoryId });
  };

  /* ---- derived helpers ------------------------------------------- */
  const stamp = useMemo(() => niceDate(post.createdAt || post.uploadDate), [post]);
  const uploadDate = useMemo(() => getUploadDate(post.createdAt || post.uploadDate), [post]);
  const isOwner = String(post.user?._id) === String(currentUserId);

  // Caption handling
  const caption = post.caption || '';
  const shouldTruncate = caption.length > 100;
  const displayCaption = showFullCaption || !shouldTruncate
    ? caption
    : caption.slice(0, 100) + '...';

  // Comment display logic - show 2 comments max
  const displayComments = comments.slice(0, 2); // Show up to 2 comments
  const hasMoreComments = comments.length > 2;

  /* ================================================================== */
  /*                      MAIN RENDER                                  */
  /* ================================================================== */

  return (
    <View style={[
      styles.postContainer,
      isMemoryPost && styles.memoryPostContainer,
      isMemoryPost && memoryMood?.mood === 'vintage' && styles.vintagePostContainer
    ]}>

      {/* Memory Story Header */}
      {isMemoryPost && (
        <View style={styles.memoryStoryHeader}>
          <View style={styles.memoryIndicator}>
            <Text style={styles.memoryEmoji}>{memoryMood?.emoji}</Text>
            <Text style={styles.memoryStoryText}>
              A memory {memoryTimeText}
            </Text>
          </View>
          
          {/* Memory mood indicator */}
          <View style={[
            styles.memoryMoodBadge,
            { backgroundColor: getMoodColor(memoryMood?.mood) }
          ]}>
            <Text style={styles.memoryMoodText}>{memoryMood?.mood}</Text>
          </View>
        </View>
      )}

      {/* ---------- ENHANCED user info header (REMOVED "from") ---------- */}
      {!hideUserInfo && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => openUser(post.user?._id)} style={styles.userRow} activeOpacity={0.8}>
            <View style={[
              styles.avatarContainer,
              isMemoryPost && styles.memoryAvatarContainer
            ]}>
              {/* Vintage glow effect for old memories */}
              {isMemoryPost && memoryMood?.mood === 'vintage' && (
                <Animated.View 
                  style={[
                    styles.vintageAvatarGlow,
                    { opacity: memoryGlow }
                  ]} 
                />
              )}
              
              <Image
                source={{ uri: `http://${API_BASE_URL}:3000${post.user?.profilePicture || ''}` }}
                style={[
                  styles.avatar,
                  isMemoryPost && memoryMood?.mood === 'vintage' && styles.vintageAvatar
                ]}
                onError={(e) => console.log('Avatar error:', e.nativeEvent?.error)}
              />
            </View>
            
            <View style={styles.userText}>
              <View style={styles.usernameRow}>
                <Text style={styles.username}>{post.user?.username || 'Unknown'}</Text>
                
                {/* Memory context inline with username */}
                {isMemoryPost && (
                  <>
                    <Text style={styles.contextText}> in </Text>
                    <TouchableOpacity onPress={openMemory}>
                      <Text style={styles.memoryLink}>
                        {memoryInfo.memoryTitle || 'Memory'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* EVENT context inline with username (BLUE COLOR) */}
                {!isMemoryPost && post.event && (
                  <>
                    <Text style={styles.contextText}> at </Text>
                    <TouchableOpacity onPress={openEvent}>
                      <Text style={styles.eventLink}>
                        {post.event.title}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* REMOVED: Secondary event context - no more "from X" */}
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

      {/* ---------- main image with memory effects ---------- */}
      <Pressable onPress={handleDoubleTap} style={[
        styles.imageContainer,
        isMemoryPost && {
          width: memoryImageDimensions.width,
          height: memoryImageDimensions.height,
          aspectRatio: memoryImageDimensions.width / memoryImageDimensions.height
        }
      ]}>
        
        {/* Memory sparkle overlay for nostalgic photos */}
        {isMemoryPost && memoryMood?.mood === 'nostalgic' && (
          <Animated.View 
            style={[
              styles.memorySparkleOverlay,
              { opacity: memorySparkle }
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.8)', 'transparent', 'rgba(255,255,255,0.6)']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.sparkleGradient}
            />
            <View style={styles.sparkleParticles}>
              <Text style={[styles.sparkle, { top: '20%', left: '15%' }]}>✨</Text>
              <Text style={[styles.sparkle, { top: '60%', right: '20%' }]}>⭐</Text>
              <Text style={[styles.sparkle, { top: '80%', left: '70%' }]}>💫</Text>
            </View>
          </Animated.View>
        )}

        <Animated.View style={{ 
          transform: [{ scale: scaleValue }],
          width: '100%',
          height: '100%'
        }}>
          {imgURL ? (
            <Image
              source={{ uri: imgURL }}
              style={[
                styles.postImage,
                isMemoryPost && memoryMood?.mood === 'vintage' && styles.vintageImage
              ]}
              resizeMode={isMemoryPost ? "contain" : "cover"}
              onError={(e) => console.log('Image error:', e.nativeEvent?.error)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image" size={50} color="#C7C7CC" />
              <Text style={styles.placeholderText}>No image</Text>
            </View>
          )}

          {/* Animated heart for double tap */}
          <Animated.View
            style={[
              styles.heartOverlay,
              {
                opacity: heartScale,
                transform: [{ scale: heartScale }]
              }
            ]}
            pointerEvents="none"
          >
            <Ionicons name="heart" size={80} color={HEART} />
          </Animated.View>
        </Animated.View>
      </Pressable>

      {/* ---------- NEW: Upload date above likes/comments ---------- */}
      <Text style={[
        styles.uploadDate,
        isMemoryPost && styles.memoryUploadDate
      ]}>
        {isMemoryPost && memoryTimeText ? memoryTimeText : uploadDate}
      </Text>

      {/* ---------- action row ---------- */}
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
            onPress={isMemoryPost ? openMemoryComments : openComments} 
            style={styles.actionBtn} 
            activeOpacity={0.8}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={24} 
              color="#000" 
            />
          </TouchableOpacity>

          {/* Only show share for regular posts */}
          {!isMemoryPost && (
            <TouchableOpacity onPress={() => {}} style={styles.actionBtn} activeOpacity={0.8}>
              <Ionicons name="paper-plane-outline" size={24} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {/* Memory explore button */}
        {isMemoryPost && (
          <TouchableOpacity onPress={openMemory} style={styles.memoryExploreBtn}>
            <Text style={styles.memoryExploreBtnText}>Explore Memory</Text>
            <Ionicons name="arrow-forward" size={16} color={MEMORY_BLUE} />
          </TouchableOpacity>
        )}
      </View>

      {/* ---------- ENHANCED likes count with tap to view ---------- */}
      {likeCount > 0 && (
        <TouchableOpacity onPress={openLikesScreen} style={styles.likesContainer}>
          <Text style={styles.likesText}>
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ---------- caption ---------- */}
      {caption ? (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>{post.user?.username || 'Unknown'}</Text>{' '}
            {displayCaption}
          </Text>
          {shouldTruncate && !showFullCaption && (
            <TouchableOpacity onPress={() => setShowFullCaption(true)}>
              <Text style={styles.moreText}>more</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* ---------- ENHANCED comments section with proper order ---------- */}
      {commentCount > 0 && (
        <View style={styles.commentsSection}>
          {/* Display comments FIRST (1-2 recent comments) */}
          {displayComments.map((comment, index) => (
            <View key={`comment-${comment._id || index}`} style={styles.commentItem}>
              <TouchableOpacity onPress={() => openUser(comment.user?._id)}>
                <Image
                  source={{ uri: `http://${API_BASE_URL}:3000${comment.user?.profilePicture || ''}` }}
                  style={styles.commentAvatar}
                />
              </TouchableOpacity>
              <View style={styles.commentContent}>
                <Text style={styles.commentText}>
                  <Text style={styles.commentUsername}>{comment.user?.username || 'Unknown'}</Text>
                  {' '}
                  {comment.text}
                </Text>
                <Text style={styles.commentTime}>
                  {niceDate(comment.createdAt)}
                </Text>
              </View>
            </View>
          ))}

          {/* View all comments link BELOW the displayed comments */}
          <TouchableOpacity 
            onPress={isMemoryPost ? openMemoryComments : openComments} 
            style={styles.viewAllCommentsBtn}
          >
            <Text style={styles.viewAllCommentsText}>
              View all {commentCount} comment{commentCount === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---------- timestamp (moved above comment input) ---------- */}
      <Text style={[
        styles.timestamp,
        isMemoryPost && styles.memoryTimestamp
      ]}>
        {stamp}
      </Text>

      {/* ---------- NEW: Inline comment input ---------- */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.commentInputContainer}
      >
        <TouchableOpacity onPress={() => openUser(currentUserId)}>
          <Image
            source={{ uri: `http://${API_BASE_URL}:3000${post.user?.profilePicture || ''}` }}
            style={styles.commentInputAvatar}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          onSubmitEditing={submitComment}
          returnKeyType="send"
        />
        <TouchableOpacity 
          onPress={submitComment}
          disabled={!commentText.trim() || submittingComment}
          style={[
            styles.commentSubmitBtn,
            (!commentText.trim() || submittingComment) && styles.commentSubmitBtnDisabled
          ]}
        >
          <Text style={[
            styles.commentSubmitText,
            (!commentText.trim() || submittingComment) && styles.commentSubmitTextDisabled
          ]}>
            {submittingComment ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* ---------- REMOVED: timestamp moved above comment input ---------- */}

      {/* ---------- event link (for event posts) ---------- */}
      {!disableEventLink && post.event && !showEventContext && !isMemoryPost && (
        <TouchableOpacity onPress={openEvent} style={styles.eventLinkButton} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={16} color={EVENT_BLUE} />
          <Text style={styles.eventLinkButtonText}>View Event: {post.event.title}</Text>
        </TouchableOpacity>
      )}

      {/* ---------- delete modal ---------- */}
      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setModal(false);
                onDeletePost?.(post._id);
              }}
            >
              <Text style={styles.modalOptionText}>Delete {isMemoryPost ? 'Memory Photo' : 'Post'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => setModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================================================================== */
/*                      MEMORY HELPER FUNCTIONS                      */
/* ================================================================== */

const getMoodColor = (mood) => {
  switch (mood) {
    case 'fresh': return 'rgba(52, 199, 89, 0.1)';
    case 'recent': return 'rgba(55, 151, 239, 0.1)';
    case 'nostalgic': return 'rgba(255, 149, 0, 0.1)';
    case 'vintage': return 'rgba(142, 68, 173, 0.1)';
    default: return 'rgba(142, 142, 147, 0.1)';
  }
};

/* ================================================================== */
/*                        COMPLETE STYLES                            */
/* ================================================================== */

const styles = StyleSheet.create({
  // Container
  postContainer: {
    backgroundColor: '#FFF',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  
  memoryPostContainer: {
    backgroundColor: 'rgba(248, 249, 250, 0.5)',
  },
  
  vintagePostContainer: {
    backgroundColor: 'rgba(251, 250, 248, 0.8)',
  },

  // Memory Story Header
  memoryStoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  memoryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  memoryStoryText: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  memoryMoodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memoryMoodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'capitalize',
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
  
  // Enhanced avatar with memory effects
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  memoryAvatarContainer: {
    // Additional styling for memory avatars
  },
  vintageAvatarGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8, // Curved corners instead of circle
    backgroundColor: '#F6F6F6',
  },
  vintageAvatar: {
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderRadius: 8, // Keep consistent
  },
  
  userText: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
  },
  
  // Context text for both memory and event
  contextText: {
    fontSize: 14,
    color: '#000',
  },
  memoryLink: {
    fontSize: 14,
    color: MEMORY_BLUE,
    fontWeight: '500',
  },
  eventLink: {
    fontSize: 14,
    color: EVENT_BLUE, // Changed to blue
    fontWeight: '500',
  },

  dots: {
    padding: 5,
  },

  // Image with memory effects
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  
  // Memory sparkle overlay
  memorySparkleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  sparkleGradient: {
    flex: 1,
  },
  sparkleParticles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 16,
    opacity: 0.8,
  },
  
  postImage: {
    width: '100%',
    height: '100%',
  },
  vintageImage: {
    opacity: 0.95,
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

  // NEW: Upload Date
  uploadDate: {
    fontSize: 12,
    color: '#8E8E93',
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 4,
    fontWeight: '500',
  },
  memoryUploadDate: {
    fontStyle: 'italic',
    color: '#666',
  },

  // Enhanced Actions with Memory Features
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
  
  // Memory explore button
  memoryExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 151, 239, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(55, 151, 239, 0.2)',
  },
  memoryExploreBtnText: {
    fontSize: 12,
    color: MEMORY_BLUE,
    fontWeight: '600',
    marginRight: 4,
  },

  // Enhanced Likes
  likesContainer: {
    paddingHorizontal: 15,
    paddingVertical: 2,
  },
  likesText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
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

  // Enhanced Comments Section
  commentsSection: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  viewAllCommentsBtn: {
    marginTop: 8, // Moved below comments, so margin top instead of bottom
  },
  viewAllCommentsText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleCommentsBtn: {
    marginTop: 8,
  },
  toggleCommentsText: {
    color: '#3797EF',
    fontSize: 14,
    fontWeight: '500',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 6, // Curved corners instead of circle
    backgroundColor: '#F6F6F6',
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
  },
  commentUsername: {
    fontWeight: '600', // Bold usernames as requested
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Inline Comment Input (with more padding below)
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 15, // Added more padding below
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8, // Curved corners instead of circle
    backgroundColor: '#F6F6F6',
    marginRight: 10,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: '#F8F9FA',
  },
  commentSubmitBtn: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#3797EF',
  },
  commentSubmitBtnDisabled: {
    backgroundColor: '#E1E1E1',
  },
  commentSubmitText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  commentSubmitTextDisabled: {
    color: '#8E8E93',
  },

  // Timestamp (moved above comment input)
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    paddingHorizontal: 15,
    paddingBottom: 5, // Reduced padding since it's above comment input now
    paddingTop: 5,
  },
  memoryTimestamp: {
    fontStyle: 'italic',
    color: '#666',
  },

  // Event link button
  eventLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  eventLinkButtonText: {
    fontSize: 14,
    color: EVENT_BLUE, // Changed to blue
    marginLeft: 5,
    fontWeight: '500',
  },

  // Delete Modal
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