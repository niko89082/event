// components/activities/PhotoCommentActivityRedesigned.js - Redesigned to match new style
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeaderRedesigned from './ActivityHeaderRedesigned';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PhotoCommentActivityRedesigned = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Activity data unavailable</Text>
      </View>
    );
  }
  
  const { comment, photo, commenter, photoOwner } = data;
  
  if (!comment || !photo || !commenter || !photoOwner) {
    return (
      <View style={styles.container}>
        <ActivityHeaderRedesigned
          user={commenter || activity.user}
          timestamp={timestamp}
          activityType="photo_comment"
          onUserPress={(userId) => navigation.navigate('ProfileScreen', { userId })}
        />
        <Text style={styles.errorText}>Comment data incomplete</Text>
      </View>
    );
  }

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  const handleViewPhoto = () => {
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'regular',
      openKeyboard: false
    });
  };

  const handleViewCommenter = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  const handleViewPostOwner = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeaderRedesigned
        user={commenter}
        timestamp={timestamp}
        activityType="photo_comment"
        onUserPress={handleViewCommenter}
      />

      {/* Activity Text */}
      <View style={styles.activityTextContainer}>
        <Text style={styles.activityText}>
          <Text style={styles.boldText}>{commenter.username}</Text>
          <Text> commented on </Text>
          <Text style={styles.boldText}>{photoOwner._id === currentUserId ? 'your' : `${photoOwner.username}'s`}</Text>
          <Text> post</Text>
        </Text>
      </View>

      {/* Comment Text */}
      <View style={styles.commentContainer}>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>

      {/* Nested Post Card */}
      <TouchableOpacity 
        style={styles.postCard}
        onPress={handleViewPhoto}
        activeOpacity={0.95}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.postAuthorContainer}>
            {photoOwner.profilePicture ? (
              <Image
                source={{ uri: getImageUrl(photoOwner.profilePicture) }}
                style={styles.postAuthorAvatar}
              />
            ) : (
              <View style={[styles.postAuthorAvatar, styles.placeholderAvatar]}>
                <Text style={styles.avatarInitials}>
                  {(photoOwner.fullName || photoOwner.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.postAuthorInfo}>
              <Text style={styles.postAuthorName}>
                {photoOwner.fullName || photoOwner.username}
              </Text>
              <Text style={styles.postAuthorUsername}>
                @{photoOwner.username}
              </Text>
            </View>
          </View>
        </View>

        {/* Post Caption */}
        {photo.caption && (
          <Text style={styles.postCaption} numberOfLines={3}>
            {photo.caption}
          </Text>
        )}

        {/* Post Image */}
        {photo.url && (
          <Image
            source={{ uri: getImageUrl(photo.url) }}
            style={styles.postImage}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  activityTextContainer: {
    paddingLeft: 68, // Match PostActivityComponent alignment (16px + 40px avatar + 12px margin)
    paddingRight: 16,
    paddingTop: 0,
    paddingBottom: 8,
  },
  activityText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#000000',
  },
  commentContainer: {
    paddingLeft: 68,
    paddingRight: 16,
    paddingBottom: 12,
  },
  commentText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
    fontWeight: '400',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    marginLeft: 68, // Match PostActivityComponent alignment
    marginRight: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  postAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAuthorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  placeholderAvatar: {
    backgroundColor: '#AF52DE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  postAuthorInfo: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  postAuthorUsername: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
  },
  postCaption: {
    fontSize: 17,
    color: '#000000',
    lineHeight: 24,
    fontWeight: '500',
    padding: 12,
  },
  postImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F6F6F6',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
});

export default PhotoCommentActivityRedesigned;

