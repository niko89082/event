// components/SharedPostSnippet.js - FIXED API route
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedPostSnippet({ message, senderName }) {
  const navigation = useNavigation();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (message.shareId) {
      fetchPost(message.shareId);
    }
  }, [message]);

  const fetchPost = async (postId) => {
    try {
      console.log('🟡 SharedPostSnippet: Fetching post:', postId);
      // FIXED: Use the correct API route with /api prefix
      const res = await api.get(`/api/photos/${postId}`);
      console.log('🟢 SharedPostSnippet: Post loaded successfully');
      setPost(res.data);
    } catch (error) {
      console.error('❌ SharedPostSnippet => fetch error:', error.response?.data || error.message);
      setError(error.response?.data?.message || 'Error loading post');
    }
  };

  const handleViewPost = () => {
    if (!post) return;
    navigation.navigate('PostDetailsScreen', { postId: post._id });
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared a post...</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared a post...</Text>
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  // FIXED: Better image path handling
  let imageUrl = null;
  if (post.paths && post.paths.length > 0) {
    let finalPath = post.paths[0];
    if (!finalPath.startsWith('/')) {
      finalPath = '/' + finalPath;
    }
    imageUrl = `http://${API_BASE_URL}:3000${finalPath}`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sender}>{senderName} shared a post:</Text>
      
      <TouchableOpacity 
        style={styles.postCard} 
        onPress={handleViewPost}
        activeOpacity={0.8}
      >
        {imageUrl && (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.postImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.postContent}>
          {post.caption && (
            <Text style={styles.caption} numberOfLines={2}>
              {post.caption}
            </Text>
          )}
          
          <View style={styles.postMeta}>
            <Text style={styles.username}>
              by {post.user?.username || 'Unknown'}
            </Text>
            {post.likes?.length > 0 && (
              <Text style={styles.likes}>
                ❤️ {post.likes.length}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    marginVertical: 6,
    borderRadius: 12,
    maxWidth: '80%',
  },
  sender: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F6F6F6',
  },
  postContent: {
    padding: 12,
  },
  caption: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
    lineHeight: 18,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  likes: {
    fontSize: 12,
    color: '#8E8E93',
  },
  loadingText: {
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
  },
});