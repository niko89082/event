// components/PostItem.js
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import api from '../services/api';
import { API_BASE_URL } from '@env';
import UserProfileRow from './UserProfileRow';

export default function PostItem({
  post,
  currentUserId,
  hideUserInfo = false,
  navigation,
  onDeletePost, // <-- new callback prop
}) {
  let finalPath = post.paths?.[0] || '';
  if (finalPath && !finalPath.startsWith('/')) {
    finalPath = '/' + finalPath;
  }
  const imageUrl = finalPath ? `http://${API_BASE_URL}:3000${finalPath}` : null;

  const initialLikeCount = post.likes?.length || 0;
  const isInitiallyLiked = post.likes?.some(
    (userId) => String(userId) === String(currentUserId)
  );

  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(isInitiallyLiked);

  const handleToggleLike = async () => {
    try {
      const res = await api.post(`/photos/like/${post._id}`);
      const { likes, likeCount: newCount } = res.data;
      setIsLiked(likes.map(String).includes(String(currentUserId)));
      setLikeCount(newCount);
    } catch (error) {
      console.error('Error toggling like:', error.response?.data || error);
    }
  };

  const handlePressComments = () => {
    if (!navigation) return;
    navigation.navigate('CommentsScreen', { postId: post._id });
  };

  const canShowUser = !hideUserInfo && post.user;
  const handlePressUser = (clickedUser) => {
    if (!navigation) return;
    navigation.navigate('ProfileScreen', { userId: clickedUser._id });
  };

  const isOwner = String(post.user?._id) === String(currentUserId);

  const handleDelete = async () => {
    try {
      await api.delete(`/photos/${post._id}`);
      console.log('Post deleted successfully.');
      // Remove from local list by calling the parent's callback
      if (onDeletePost) {
        onDeletePost(post._id);
      }
    } catch (error) {
      console.error('Error deleting post:', error.response?.data || error);
    }
  };

  return (
    <View style={styles.postContainer}>
      {canShowUser && (
        <UserProfileRow user={post.user} onPress={handlePressUser} />
      )}

      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.postImage} />
      ) : (
        <View style={styles.placeholder}>
          <Text>No Image</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={handleToggleLike} style={styles.actionBtn}>
          <Text style={styles.actionText}>
            {isLiked ? 'Unlike' : 'Like'} ({likeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePressComments} style={styles.actionBtn}>
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        {isOwner && (
          <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  postContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
  },
  postImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  placeholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  actionBtn: {
    marginRight: 16,
  },
  actionText: {
    fontWeight: '600',
    color: '#333',
  },
});