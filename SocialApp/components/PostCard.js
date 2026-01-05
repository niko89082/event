// components/PostCard.js - Display all post types (text, photo, review)
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, Linking, Alert, Platform, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import ReviewCard from './ReviewCard';
import PhotoCarousel from './PhotoCarousel';
import RepostButton from './RepostButton';
import RepostWrapper from './RepostWrapper';
import QuoteRepostModal from './QuoteRepostModal';
import api from '../services/api';
import usePostsStore from '../stores/postsStore';
import { repostAPI } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 32;

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

export default function PostCard({ post, currentUserId, navigation, onLike, onComment, profileUser, onDeletePost, onPostUpdated }) {
  const [showFullText, setShowFullText] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 42, left: null, right: 16 });
  const moreButtonRef = useRef(null);
  
  // ✅ FIX: Better user data extraction - handle both ObjectId strings and populated objects
  let user = {};
  if (post.user) {
    // Check if it's a populated object with username
    if (typeof post.user === 'object' && !Array.isArray(post.user) && post.user.username) {
      user = post.user;
    } else if (typeof post.user === 'string' || (typeof post.user === 'object' && post.user._id && !post.user.username)) {
      // If user is just an ID string or object without username, use profileUser
      user = profileUser || {};
    } else {
      user = post.user;
    }
  }
  
  // Always fallback to profileUser if user doesn't have username
  if (!user.username && profileUser && profileUser.username) {
    user = { ...user, ...profileUser };
  }
  
  // Final fallback - ensure we have at least an object
  if (!user || typeof user !== 'object') {
    user = {};
  }
  
  // Debug logging (can be removed later)
  if (!user.username && (post.user || profileUser)) {
    console.log('⚠️ PostCard: Missing username', {
      hasPostUser: !!post.user,
      postUserType: typeof post.user,
      postUserUsername: post.user?.username,
      hasProfileUser: !!profileUser,
      profileUserUsername: profileUser?.username,
      finalUser: user
    });
  }
  
  // Check if current user is the post owner
  const isOwner = currentUserId && (
    String(post.user?._id || post.user) === String(currentUserId) ||
    String(user._id) === String(currentUserId)
  );
  
  // ✅ CENTRALIZED STATE MANAGEMENT - Get post data and actions from store
  const toggleLikeInStore = usePostsStore(state => state.toggleLike);
  
  // Get post from store - use selector that returns stable reference
  const storePost = usePostsStore(state => {
    if (!post._id) return null;
    return state.posts.get(post._id);
  });
  
  // Memoize the like state to prevent unnecessary re-renders
  const isLikedFromStore = useMemo(() => {
    if (!storePost) return null;
    return Boolean(storePost.userLiked);
  }, [storePost?.userLiked]);
  
  const likeCountFromStore = useMemo(() => {
    if (!storePost) return null;
    return storePost.likeCount || 0;
  }, [storePost?.likeCount]);
  
  // Initialize store with this post if not already there (only once per post ID)
  const initializedPostIds = useRef(new Set());
  useEffect(() => {
    if (post._id && !initializedPostIds.current.has(post._id)) {
      const existingPost = usePostsStore.getState().posts.get(post._id);
      if (!existingPost) {
        initializedPostIds.current.add(post._id);
        // Ensure userLiked is properly set from initial post data
        const postToAdd = {
          ...post,
          userLiked: Boolean(post.userLiked || (post.likes && Array.isArray(post.likes) && post.likes.includes(currentUserId))),
          likeCount: post.likeCount || (post.likes && Array.isArray(post.likes) ? post.likes.length : 0),
        };
        usePostsStore.getState().addPost(postToAdd);
      } else {
        initializedPostIds.current.add(post._id);
      }
    }
  }, [post._id, currentUserId]); // Include currentUserId to properly check like status
  
  // Use store data if available, otherwise fall back to initial post
  const currentPost = storePost || post;
  
  // Get engagement counts from store (always up to date)
  // Prioritize store data, then fall back to post data, then calculate from likes array
  const isLiked = isLikedFromStore !== null
    ? isLikedFromStore
    : (post.userLiked !== undefined 
        ? Boolean(post.userLiked) 
        : (post.likes && Array.isArray(post.likes) && currentUserId 
            ? post.likes.some(likeId => String(likeId) === String(currentUserId))
            : false));
  const likeCount = likeCountFromStore !== null
    ? likeCountFromStore
    : (post.likeCount || (post.likes && Array.isArray(post.likes) ? post.likes.length : 0));
  const commentCount = storePost
    ? (storePost.commentCount || 0)
    : (post.commentCount || (post.comments ? post.comments.length : 0));
  const repostCount = post.repostCount || 0;
  
  // ✅ NEW: Repost state
  const [hasReposted, setHasReposted] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const isRepost = post.isRepost === true;
  const originalPost = post.originalPost || null;
  
  // Local state for like loading
  const [isLiking, setIsLiking] = useState(false);
  
  // Follow status
  const [isFollowing, setIsFollowing] = useState(false);
  const [isCheckingFollow, setIsCheckingFollow] = useState(false);
  
  useEffect(() => {
    if (currentUserId && user._id && String(user._id) !== String(currentUserId)) {
      checkFollowStatus();
    }
  }, [currentUserId, user._id]);
  
  const checkFollowStatus = async () => {
    if (!user._id || !currentUserId) return;
    try {
      if (post.user?.isFollowing !== undefined) {
        setIsFollowing(post.user.isFollowing);
        return;
      }
      const response = await api.get(`/api/profile/${user._id}`);
      if (response.data && response.data.isFollowing !== undefined) {
        setIsFollowing(response.data.isFollowing);
      } else {
        const currentUserResponse = await api.get(`/api/profile/${currentUserId}`);
        const currentUser = currentUserResponse.data;
        if (currentUser && currentUser.following) {
          const followingIds = (currentUser.following || []).map(id => String(id));
          setIsFollowing(followingIds.includes(String(user._id)));
        } else {
          setIsFollowing(false);
        }
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
      setIsFollowing(false);
    }
  };
  
  const handleFollow = async () => {
    if (!user._id || !currentUserId || String(user._id) === String(currentUserId)) {
      return;
    }
    try {
      setIsCheckingFollow(true);
      if (isFollowing) {
        await api.delete(`/api/follow/unfollow/${user._id}`);
        setIsFollowing(false);
      } else {
        await api.post(`/api/follow/follow/${user._id}`);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsCheckingFollow(false);
    }
  };
  
  const postType = post.postType || 'photo';
  const textContent = post.textContent || post.caption || '';
  const TEXT_LIMIT = 300;
  const shouldTruncate = textContent.length > TEXT_LIMIT;
  const displayText = showFullText || !shouldTruncate ? textContent : textContent.substring(0, TEXT_LIMIT) + '...';

  const handleLike = async () => {
    if (!post._id || !currentUserId || isLiking) {
      return;
    }
    
    setIsLiking(true);
    
    try {
      // Use centralized store toggleLike which handles optimistic updates and API calls
      const isMemoryPost = post.postType === 'memory';
      await toggleLikeInStore(post._id, isMemoryPost, currentUserId);
      
      // Call onLike callback if provided to sync with parent
      if (onLike) {
        const updatedPost = usePostsStore.getState().getPost(post._id);
        onLike(post._id, updatedPost?.userLiked || isLiked, updatedPost?.likeCount || likeCount);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = () => {
    if (onComment) {
      onComment(post._id);
    } else if (navigation) {
      navigation.navigate('UnifiedDetailsScreen', {
        postId: post._id,
        postType: postType,
        focusComments: true,
      });
    }
  };

  // ✅ NEW: Load repost status
  useEffect(() => {
    if (post._id && currentUserId) {
      loadRepostStatus();
    }
  }, [post._id, currentUserId]);

  const loadRepostStatus = async () => {
    if (!post._id || !currentUserId) return;
    
    try {
      const response = await repostAPI.getRepostStatus(post._id);
      setHasReposted(response.data.hasReposted);
    } catch (error) {
      console.error('Error loading repost status:', error);
      setHasReposted(false);
    }
  };

  // ✅ NEW: Handle repost changes
  const handleRepostChange = ({ action, postId, repost }) => {
    if (action === 'quote') {
      setShowQuoteModal(true);
    } else if (action === 'repost') {
      setHasReposted(true);
      if (onPostUpdated) {
        onPostUpdated({ ...post, repostCount: repostCount + 1 });
      }
    } else if (action === 'undo') {
      setHasReposted(false);
      if (onPostUpdated) {
        onPostUpdated({ ...post, repostCount: Math.max(0, repostCount - 1) });
      }
    }
  };

  const handleQuoteRepostCreated = (repost) => {
    setHasReposted(true);
    setShowQuoteModal(false);
    if (onPostUpdated) {
      onPostUpdated({ ...post, repostCount: repostCount + 1 });
    }
  };

  const handleRepost = () => {
    // Legacy handler - now handled by RepostButton
    // TODO: Implement repost functionality
    console.log('Repost:', post._id);
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Share:', post._id);
  };

  const handleUserPress = () => {
    if (navigation && user._id) {
      navigation.navigate('ProfileScreen', { userId: user._id });
    }
  };

  const handlePostPress = () => {
    if (navigation) {
      navigation.navigate('UnifiedDetailsScreen', {
        postId: post._id,
        postType: postType,
        post: post
      });
    }
  };

  const handleMoreOptions = () => {
    if (!isOwner) return;
    // Calculate position: menu should be adjacent to ellipsis (right side)
    // But text inside should align with username which starts at 68px from left
    // So position menu at 68px from left, and it will extend to the right
    setMenuPosition({ top: 42, left: 68, right: null });
    setShowOptionsMenu(true);
  };

  const handleEditOption = () => {
    setShowOptionsMenu(false);
    handleEditPost();
  };

  const handleDeleteOption = () => {
    setShowOptionsMenu(false);
    handleDeletePost();
  };

  const handleEditPost = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Edit Caption',
        'Enter new caption:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: updateCaption },
        ],
        'plain-text',
        post.textContent || post.caption || ''
      );
    } else {
      // For Android, show a simple alert with input
      Alert.alert(
        'Edit Caption',
        'Caption editing is available. Please use the post details screen to edit.',
        [
          { text: 'OK', onPress: () => {
            if (navigation) {
              navigation.navigate('UnifiedDetailsScreen', {
                postId: post._id,
                postType: postType,
                post: post,
                editMode: true
              });
            }
          }}
        ]
      );
    }
  };

  const updateCaption = async (newCaption) => {
    if (!newCaption) return;
    
    try {
      await api.put(`/api/photos/${post._id}`, { 
        caption: newCaption,
        textContent: newCaption 
      });
      
      // Call onPostUpdated callback if provided
      if (onPostUpdated) {
        onPostUpdated(post._id, { 
          caption: newCaption,
          textContent: newCaption 
        });
      }
      
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post');
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: confirmDeletePost 
        },
      ]
    );
  };

  const confirmDeletePost = async () => {
    try {
      await api.delete(`/api/photos/${post._id}`);
      
      // Call onDeletePost callback if provided
      if (onDeletePost) {
        onDeletePost(post._id);
      }
      
      Alert.alert('Success', 'Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
      Alert.alert('Error', 'Failed to delete post. Please try again.');
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `http://${API_BASE_URL}:3000${path}`;
  };

  return (
    <RepostWrapper
      repost={isRepost ? post : null}
      originalPost={originalPost}
      onReposterPress={(userId) => navigation?.navigate('Profile', { userId })}
      onOriginalPostPress={(postId) => navigation?.navigate('PostDetails', { postId })}
    >
      <View style={styles.container}>
        {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
          {user.profilePicture ? (
            <Image
              source={{ uri: getImageUrl(user.profilePicture) }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={18} color="#8E8E93" />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.username}>{user.displayName || user.username || 'Unknown'}</Text>
            <View style={styles.userMetaRow}>
              {user.username && (
                <Text style={styles.userHandle}>@{user.username}</Text>
              )}
              {user.username && (
                <Text style={styles.metaDot}> • </Text>
              )}
              <Text style={styles.timestamp}>
                {niceDate(post.createdAt || post.uploadDate)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {/* Follow Button or Three-dot menu */}
        {!isOwner && currentUserId && user._id && String(user._id) !== String(currentUserId) ? (
          <TouchableOpacity 
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={handleFollow}
            disabled={isCheckingFollow}
            activeOpacity={0.7}
          >
            {isCheckingFollow ? (
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                ...
              </Text>
            ) : (
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        ) : isOwner ? (
          <View style={styles.moreButtonContainer}>
            <TouchableOpacity 
              ref={moreButtonRef}
              style={styles.moreButton}
              onPress={handleMoreOptions}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#8E8E93" />
            </TouchableOpacity>
            
            {/* Options Menu */}
            <Modal
              visible={showOptionsMenu}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowOptionsMenu(false)}
            >
              <TouchableOpacity
                style={styles.menuOverlay}
                activeOpacity={1}
                onPress={() => setShowOptionsMenu(false)}
              >
                <View 
                  style={[styles.menuWrapper, { 
                    top: menuPosition.top, 
                    left: menuPosition.left,
                    right: menuPosition.right 
                  }]}
                  onStartShouldSetResponder={() => true}
                >
                  <View style={styles.menuContainer}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={handleEditOption}
                    >
                      <Ionicons name="create-outline" size={20} color="#000000" />
                      <Text style={styles.menuItemText}>Edit</Text>
                    </TouchableOpacity>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity
                      style={[styles.menuItem, styles.menuItemDestructive]}
                      onPress={handleDeleteOption}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ED4956" />
                      <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        ) : null}
      </View>

      {/* Content */}
      <TouchableOpacity 
        style={styles.content}
        onPress={handlePostPress}
        activeOpacity={0.95}
      >
        {/* Text Content */}
        {textContent && (
          <View style={styles.textContainer}>
            <Text style={styles.textContent}>{displayText}</Text>
            {shouldTruncate && (
              <TouchableOpacity onPress={() => setShowFullText(!showFullText)}>
                <Text style={styles.showMoreText}>
                  {showFullText ? 'Show less' : 'Show more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Review Card */}
        {post.review && (
          <View style={styles.reviewCardContainer}>
            <ReviewCard review={post.review} />
          </View>
        )}

        {/* Photo(s) - Instagram-style carousel */}
        {post.paths && post.paths.length > 0 && (
          <View style={styles.imagesContainer}>
            <PhotoCarousel
              photos={post.paths}
              width={IMAGE_WIDTH - 68 - 16} // Account for left padding (68) and right margin (16)
              onPhotoPress={() => handlePostPress()}
              showIndicators={post.paths.length > 1}
            />
          </View>
        )}

        {/* Location */}
        {post.location && post.location.name && (
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={14} color="#8E8E93" />
            <Text style={styles.locationText}>{post.location.name}</Text>
          </View>
        )}

        {/* Event Tag */}
        {post.event && (
          <TouchableOpacity
            style={styles.eventTag}
            onPress={() => navigation?.navigate('EventDetailsScreen', { eventId: post.event._id || post.event })}
          >
            <Ionicons name="calendar" size={14} color="#3797EF" />
            <Text style={styles.eventTagText}>
              {typeof post.event === 'object' ? post.event.title : 'Event'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Engagement Bar */}
      <View style={styles.engagementBar}>
        <TouchableOpacity
          style={styles.engagementButton}
          onPress={handleLike}
          disabled={isLiking}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#ED4956" : "#000000"}
          />
          {likeCount > 0 && (
            <Text style={[styles.engagementCount, isLiked && styles.engagementCountLiked]}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={handleComment}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#000000" />
          {commentCount > 0 && (
            <Text style={styles.engagementCount}>{commentCount}</Text>
          )}
        </TouchableOpacity>

        {/* ✅ NEW: Repost button */}
        <RepostButton
          postId={post._id}
          repostCount={repostCount}
          hasReposted={hasReposted}
          onRepostChange={handleRepostChange}
          showQuoteOption={true}
        />

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={20} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* ✅ NEW: Quote Repost Modal */}
      <QuoteRepostModal
        visible={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        post={isRepost && originalPost ? originalPost : post}
        onRepostCreated={handleQuoteRepostCreated}
      />
    </View>
    </RepostWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 20,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 6,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userHandle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
  },
  metaDot: {
    fontSize: 13,
    color: '#8E8E93',
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
  },
  moreButtonContainer: {
    position: 'relative',
  },
  moreButton: {
    padding: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuWrapper: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuItemDestructive: {
    // Destructive styling
  },
  menuItemText: {
    fontSize: 17,
    color: '#000000',
    fontWeight: '500',
  },
  menuItemTextDestructive: {
    color: '#ED4956',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E1E1E1',
  },
  content: {
    paddingLeft: 0,
    paddingRight: 20,
  },
  textContainer: {
    marginBottom: 12,
    paddingLeft: 58, // Align with username (header padding 12 + avatar width 40 + margin 6)
    paddingRight: 20,
  },
  reviewCardContainer: {
    paddingLeft: 58, // Align with username (header padding 12 + avatar width 40 + margin 6)
    paddingRight: 20,
    marginBottom: 12,
  },
  textContent: {
    fontSize: 17,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '500',
  },
  showMoreText: {
    fontSize: 16,
    color: '#3797EF',
    marginTop: 4,
  },
  imagesContainer: {
    marginBottom: 12,
    marginLeft: 58, // Align with username (header padding 12 + avatar width 40 + margin 6)
    marginRight: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingLeft: 58, // Align with username (header padding 12 + avatar width 40 + margin 6)
    gap: 6,
  },
  locationText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  eventTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    paddingLeft: 58, // Align with username (header padding 12 + avatar width 40 + margin 6)
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  eventTagText: {
    fontSize: 15,
    color: '#3797EF',
    fontWeight: '500',
  },
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 58, // Align with username (header padding 12 + avatar width 40 + margin 6)
    paddingRight: 20,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 24,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engagementCount: {
    fontSize: 15,
    color: '#000000',
  },
  engagementCountLiked: {
    color: '#ED4956',
  },
  
  // Follow Button Styles
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#000000',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#000000',
  },
});

