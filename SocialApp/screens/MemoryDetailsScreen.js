// screens/MemoryDetailsScreen.js
import React, { useEffect, useState } from 'react';
import { 
  View, Text, Image, StyleSheet, Button, TextInput, FlatList,
  TouchableOpacity, Alert
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '@env';
import * as ImagePicker from 'expo-image-picker';   // <--- For picking photos
import api from '../services/api';

export default function MemoryDetailsScreen() {
  const route = useRoute();
  const { memoryId } = route.params || {};

  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  
  // For storing a selected local photo before upload
  const [localPhotoUri, setLocalPhotoUri] = useState(null);

  useEffect(() => {
    if (memoryId) {
      fetchMemory();
    }
  }, [memoryId]);

  // ================== 1) Fetch memory details ==================
  const fetchMemory = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/memories/${memoryId}`);
      setMemory(res.data.memory);
    } catch (err) {
      console.error('MemoryDetailsScreen => fetchMemory =>', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  // ================== 2) Pick a photo from library ==================
  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) {
        setLocalPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Pick photo error =>', err);
    }
  };

  // ================== 3) Upload a photo to memory ==================
  const handleAddPhoto = async () => {
    if (!localPhotoUri) return;
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: localPhotoUri,
        type: 'image/jpeg',
        name: 'memoryPhoto.jpg'
      });
      // POST /memories/:memoryId/photo
      const res = await api.post(`/memories/${memoryId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Alert.alert('Success', 'Photo added to memory!');
      setLocalPhotoUri(null);
      fetchMemory(); // re-fetch memory to see the new photo
    } catch (err) {
      console.error('handleAddPhoto =>', err.response?.data || err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to add photo');
    }
  };

  // ================== 4) Like or unlike photo ==================
  const handleLikePhoto = async (photoId) => {
    try {
      await api.post(`/memories/${memoryId}/photo/${photoId}/like`);
      fetchMemory(); // re-fetch to update likes
    } catch (err) {
      console.error('handleLikePhoto =>', err.response?.data || err);
    }
  };

  // ================== 5) Post a comment on a photo ==================
  const handleCommentOnPhoto = async (photoId) => {
    if (!commentText.trim()) return;
    try {
      await api.post(`/memories/${memoryId}/photo/${photoId}/comment`, { text: commentText });
      setCommentText('');
      fetchMemory();
    } catch (err) {
      console.error('handleCommentOnPhoto =>', err.response?.data || err);
    }
  };

  // ============ Rendering each photo in the memory ============
  const renderPhotoItem = ({ item: photo }) => {
    // photo => { _id, paths, user (uploader), comments, likes }
    let photoUrl = null;
    if (photo.path) {
      const p = photo.path;
      photoUrl = `http://${API_BASE_URL}:3000${
        p.startsWith('/') ? '' : '/'
      }${p}`;
    }

    return (
      <View style={styles.photoBox}>
        {photoUrl && (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        )}
        {/* Show who uploaded the photo */}
        <Text>Uploaded by {photo.user?.username || 'Unknown'}</Text>
        <Text>Likes: {photo.likes?.length || 0}</Text>
        <Button 
          title="Like / Unlike" 
          onPress={() => handleLikePhoto(photo._id)} 
        />

        {/* Comments */}
        {(photo.comments || []).map((c) => (
          <Text key={c._id} style={styles.commentText}>
            {c.user?.username}: {c.text}
          </Text>
        ))}

        {/* Input row to comment on THIS photo */}
        <View style={styles.commentRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={commentText}
            onChangeText={setCommentText}
          />
          <Button
            title="Post"
            onPress={() => handleCommentOnPhoto(photo._id)}
          />
        </View>
      </View>
    );
  };

  // ============ Return the UI =============
  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading memory...</Text>
      </View>
    );
  }
  if (!memory) {
    return (
      <View style={styles.centered}>
        <Text>No memory found or failed to load.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.memoryTitle}>{memory.title}</Text>

      {/* ============ Add Photo UI ============ */}
      {localPhotoUri && (
        <View style={styles.previewRow}>
          <Image source={{ uri: localPhotoUri }} style={styles.previewImg} />
          <Button title="Upload to Memory" onPress={handleAddPhoto} />
        </View>
      )}
      {!localPhotoUri && (
        <Button 
          title="Add Photo to Memory" 
          onPress={handlePickPhoto} 
        />
      )}

      {/* ============ Display Photos ============ */}
      <FlatList
        data={memory.photos || []}
        keyExtractor={(photo) => photo._id}
        renderItem={renderPhotoItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 16 },
  memoryTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8
  },
  previewImg: {
    width: 80, height: 80, marginRight: 8, borderRadius: 6
  },
  photoBox: {
    backgroundColor: '#eee', padding: 8, borderRadius: 6,
    marginVertical: 8,
  },
  photo: {
    width: '100%', height: 200, borderRadius: 6, marginBottom: 4,
  },
  commentText: { marginVertical: 2 },
  commentRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 6,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1, borderColor: '#ccc', borderRadius: 4,
    padding: 6, marginRight: 6,
  },
});