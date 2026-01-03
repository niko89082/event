// components/activities/PostLikeActivity.js - Post Like Activity with bulk grouping
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

const PostLikeActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp, user } = activity;
  
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Activity data unavailable</Text>
      </View>
    );
  }
  
  const { post, postOwner, likers = [] } = data;
  
  // Support bulk grouping - use likers array if available, otherwise single user
  const displayUsers = likers.length > 0 ? likers : (user ? [user] : []);
  
  if (!post || !postOwner) {
    return (
      <View style={styles.container}>
        <ActivityHeaderRedesigned
          users={displayUsers}
          user={user}
          timestamp={timestamp}
          activityType="post_like"
          onUserPress={(userId) => navigation.navigate('ProfileScreen', { userId })}
          onUsersPress={(users) => {
            // Could navigate to a users list screen
            console.log('View likers:', users);
          }}
        />
        <Text style={styles.errorText}>Post data incomplete</Text>
      </View>
    );
  }

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  const handleViewPost = () => {
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: post._id,
      postType: post.postType || 'regular',
      openKeyboard: false
    });
  };

  const handleViewPostOwner = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  const getActivityText = () => {
    if (displayUsers.length === 1) {
      return (
        <Text style={styles.activityText}>
          <Text style={styles.boldText}>{displayUsers[0].username}</Text>
          <Text> liked </Text>
          <Text style={styles.boldText}>{postOwner._id === currentUserId ? 'your' : `${postOwner.username}'s`}</Text>
          <Text> post</Text>
        </Text>
      );
    }

    // Multiple users
    const firstName = displayUsers[0].username;
    const secondName = displayUsers.length > 1 ? displayUsers[1].username : null;
    const remainingCount = displayUsers.length - 2;

    if (displayUsers.length === 2) {
      return (
        <Text style={styles.activityText}>
          <Text style={styles.boldText}>{firstName}</Text>
          <Text> and </Text>
          <Text style={styles.boldText}>{secondName}</Text>
          <Text> liked </Text>
          <Text style={styles.boldText}>{postOwner._id === currentUserId ? 'your' : `${postOwner.username}'s`}</Text>
          <Text> post</Text>
        </Text>
      );
    }

    return (
      <Text style={styles.activityText}>
        <Text style={styles.boldText}>{firstName}</Text>
        {secondName && (
          <>
            <Text>, </Text>
            <Text style={styles.boldText}>{secondName}</Text>
          </>
        )}
        <Text> and </Text>
        <Text style={styles.boldText}>{remainingCount} other{remainingCount > 1 ? 's' : ''}</Text>
        <Text> liked </Text>
        <Text style={styles.boldText}>{postOwner._id === currentUserId ? 'your' : `${postOwner.username}'s`}</Text>
        <Text> post</Text>
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {/* Activity Header with Bulk Grouping */}
      <ActivityHeaderRedesigned
        users={displayUsers}
        user={user}
        timestamp={timestamp}
        activityType="post_like"
        onUserPress={(userId) => navigation.navigate('ProfileScreen', { userId })}
        onUsersPress={(users) => {
          // Could navigate to a users list screen
          console.log('View likers:', users);
        }}
      />

      {/* Activity Text */}
      <View style={styles.activityTextContainer}>
        {getActivityText()}
      </View>

      {/* Nested Post Card */}
      <TouchableOpacity 
        style={styles.postCard}
        onPress={handleViewPost}
        activeOpacity={0.95}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.postAuthorContainer}>
            {postOwner.profilePicture ? (
              <Image
                source={{ uri: getImageUrl(postOwner.profilePicture) }}
                style={styles.postAuthorAvatar}
              />
            ) : (
              <View style={[styles.postAuthorAvatar, styles.placeholderAvatar]}>
                <Text style={styles.avatarInitials}>
                  {(postOwner.fullName || postOwner.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.postAuthorInfo}>
              <Text style={styles.postAuthorName}>
                {postOwner.fullName || postOwner.username}
              </Text>
              <Text style={styles.postAuthorUsername}>
                @{postOwner.username}
              </Text>
            </View>
          </View>
        </View>

        {/* Post Caption */}
        {post.caption && (
          <Text style={styles.postCaption} numberOfLines={3}>
            {post.caption}
          </Text>
        )}

        {/* Post Image */}
        {post.paths && post.paths.length > 0 && (
          <Image
            source={{ uri: getImageUrl(post.paths[0]) }}
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
    paddingLeft: 58, // Match PostActivityComponent alignment
    paddingRight: 20,
    paddingTop: 0,
    paddingBottom: 12,
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
  postCard: {
    backgroundColor: '#FFFFFF',
    marginLeft: 58, // Match PostActivityComponent alignment
    marginRight: 20,
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

export default PostLikeActivity;

