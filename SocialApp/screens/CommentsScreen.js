// screens/CommentsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  Button, Image, TouchableOpacity,
} from 'react-native';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function CommentsScreen({ route, navigation }) {
  const { postId } = route.params || {};
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchPhoto();
  }, [postId]);

  const fetchPhoto = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const res = await api.get(`/photos/${postId}`);
      setPhoto(res.data);
    } catch (error) {
      console.error('CommentsScreen => fetchPhoto => error:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    try {
      // Post the new comment
      const res = await api.post(`/photos/comment/${postId}`, { text: newComment });
      // The response is the entire updated photo, with all comments
      setPhoto(res.data);  // Replace photo in state with the updated doc
      setNewComment('');
    } catch (error) {
      console.error(error);
    }
  };

  // Press on a commenter's username => navigate to their profile
  const handlePressUser = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading comments...</Text>
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={styles.centered}>
        <Text>Photo not found or error loading.</Text>
      </View>
    );
  }

  // Show the photo preview at the top
  let finalPath = photo.paths?.[0] || '';
  if (finalPath && !finalPath.startsWith('/')) {
    finalPath = '/' + finalPath;
  }
  const imageUrl = finalPath ? `http://${API_BASE_URL}:3000${finalPath}` : null;

  const renderCommentItem = ({ item }) => (
    <View style={styles.commentItem}>
      <TouchableOpacity onPress={() => handlePressUser(item.user?._id)}>
        <Text style={styles.commentUser}>{item.user?.username || '??'}:</Text>
      </TouchableOpacity>
      <Text style={styles.commentText}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Photo preview */}
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.photo}
        />
      )}

      <Text style={styles.title}>Comments</Text>

      <FlatList
        data={photo.comments || []}
        keyExtractor={(c, index) => `${c._id}-${index}`}
        renderItem={renderCommentItem}
        style={styles.commentsList}
      />

      {/* New comment input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Write a comment..."
          value={newComment}
          onChangeText={setNewComment}
        />
        <Button title="Post" onPress={handleAddComment} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: 200, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  commentsList: { flex: 1 },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  commentUser: {
    fontWeight: 'bold',
    marginRight: 6,
  },
  commentText: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  input: {
    flex: 1,
    borderWidth: 1, borderColor: '#ccc',
    borderRadius: 4, padding: 8, marginRight: 6,
  },
});