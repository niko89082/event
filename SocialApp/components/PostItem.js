// components/PostItem.js
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function PostItem({ post, currentUserId, onPressComments }) {
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const isInitiallyLiked = post.likes?.some(
    (userId) => userId.toString() === currentUserId
  );
  const [isLiked, setIsLiked] = useState(isInitiallyLiked);

  const [imgErr, setImgErr] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // If post.paths has at least 1 image path
  let finalPath = post.paths?.[0] || '';
  if (finalPath && !finalPath.startsWith('/')) {
    finalPath = '/' + finalPath;
  }

  const imageUrl = finalPath
    ? `http://${API_BASE_URL}:3000${finalPath}`
    : null;

  const handleToggleLike = async () => {
    try {
      const res = await api.post(`/photos/like/${post._id}`);
      const { likes, likeCount: newCount } = res.data;
      const userLiked = likes.includes(currentUserId);

      setIsLiked(userLiked);
      setLikeCount(newCount);
    } catch (error) {
      console.error('Error toggling like:', error.response?.data || error);
    }
  };

  const handlePressComments = () => {
    if (onPressComments) {
      onPressComments(post);
    }
  };

  return (
    <View style={styles.postContainer}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.postImage}
          onError={(err) => setImgErr(err.nativeEvent.error)}
          onLoad={() => setImgLoaded(true)}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text>No Image</Text>
        </View>
      )}

      {imgErr && (
        <Text style={{ color: 'red' }}>
          Post image failed to load: {imgErr}
        </Text>
      )}
      {imgLoaded && (
        <Text style={{ color: 'green' }}>
          Post image loaded successfully!
        </Text>
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