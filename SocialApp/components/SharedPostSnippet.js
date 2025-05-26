// components/SharedPostSnippet.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedPostSnippet({ message, senderName }) {
  const [post, setPost] = useState(null);

  useEffect(() => {
    if (message.shareId) {
      fetchPost(message.shareId);
    }
  }, [message]);

  const fetchPost = async (postId) => {
    try {
      const res = await api.get(`/photos/${postId}`);
      setPost(res.data);
    } catch (error) {
      console.error('SharedPostSnippet => fetch error:', error);
    }
  };

  if (!post) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared a post...</Text>
        <Text>Loading post...</Text>
      </View>
    );
  }

  let finalPath = post.paths?.[0] || '';
  if (finalPath && !finalPath.startsWith('/')) {
    finalPath = '/' + finalPath;
  }
  const imageUrl = finalPath ? `http://${API_BASE_URL}:3000${finalPath}` : null;

  return (
    <View style={styles.container}>
      <Text style={styles.sender}>{senderName} shared a post:</Text>
      {imageUrl && <Image source={{ uri: imageUrl }} style={styles.postImage} />}
      <Text>{post.caption || 'No caption'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#eef',
    padding: 8,
    marginVertical: 4,
    borderRadius: 8,
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  postImage: {
    width: 150,
    height: 150,
    resizeMode: 'cover',
    marginVertical: 6,
  },
});