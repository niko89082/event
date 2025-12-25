// components/PostCard.js - Display all post types (text, photo, review)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import ReviewCard from './ReviewCard';

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

export default function PostCard({ post, currentUserId, navigation, onLike, onComment, profileUser }) {
  const [showFullText, setShowFullText] = useState(false);
  // ✅ FIX: Use profileUser as fallback if post.user is missing
  const user = post.user || profileUser || {};
  const isLiked = post.userLiked || (post.likes && post.likes.includes && post.likes.includes(currentUserId));
  const likeCount = post.likeCount || (post.likes ? post.likes.length : 0);
  const commentCount = post.commentCount || (post.comments ? post.comments.length : 0);
  const repostCount = post.repostCount || 0;
  
  const postType = post.postType || 'photo';
  const textContent = post.textContent || post.caption || '';
  const TEXT_LIMIT = 300;
  const shouldTruncate = textContent.length > TEXT_LIMIT;
  const displayText = showFullText || !shouldTruncate ? textContent : textContent.substring(0, TEXT_LIMIT) + '...';

  const handleLike = () => {
    if (onLike) {
      onLike(post._id);
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

  const handleRepost = () => {
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

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `http://${API_BASE_URL}:3000${path}`;
  };

  return (
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
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.username}>{user.username || 'Unknown'}</Text>
            <Text style={styles.timestamp}>
              {niceDate(post.createdAt || post.uploadDate)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
        </TouchableOpacity>
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
        {post.review && <ReviewCard review={post.review} />}

        {/* Photo(s) */}
        {post.paths && post.paths.length > 0 && (
          <View style={styles.imagesContainer}>
            {post.paths.length === 1 ? (
              <Image
                source={{ uri: getImageUrl(post.paths[0]) }}
                style={styles.singleImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.multiImageContainer}>
                {post.paths.slice(0, 4).map((path, index) => (
                  <Image
                    key={index}
                    source={{ uri: getImageUrl(path) }}
                    style={[
                      styles.multiImage,
                      post.paths.length > 2 && index === 3 && styles.lastImageOverlay
                    ]}
                    resizeMode="cover"
                  />
                ))}
                {post.paths.length > 4 && (
                  <View style={styles.moreImagesOverlay}>
                    <Text style={styles.moreImagesText}>+{post.paths.length - 4}</Text>
                  </View>
                )}
              </View>
            )}
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
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={22}
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
          <Ionicons name="chatbubble-outline" size={22} color="#000000" />
          {commentCount > 0 && (
            <Text style={styles.engagementCount}>{commentCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={handleRepost}
          activeOpacity={0.7}
        >
          <Ionicons name="repeat-outline" size={22} color="#000000" />
          {repostCount > 0 && (
            <Text style={styles.engagementCount}>{repostCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={22} color="#000000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 16,
  },
  textContainer: {
    marginBottom: 12,
  },
  textContent: {
    fontSize: 15,
    lineHeight: 20,
    color: '#000000',
  },
  showMoreText: {
    fontSize: 15,
    color: '#3797EF',
    marginTop: 4,
  },
  imagesContainer: {
    marginBottom: 12,
  },
  singleImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_WIDTH,
    borderRadius: 12,
    backgroundColor: '#E1E1E1',
  },
  multiImageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  multiImage: {
    width: (IMAGE_WIDTH - 4) / 2,
    height: (IMAGE_WIDTH - 4) / 2,
    borderRadius: 8,
    backgroundColor: '#E1E1E1',
  },
  lastImageOverlay: {
    position: 'relative',
  },
  moreImagesOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreImagesText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  eventTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  eventTagText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 32,
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
});

