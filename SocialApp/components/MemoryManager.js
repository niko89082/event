// components/MemoryManager.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Button, FlatList, TouchableOpacity,
  Image, StyleSheet
} from 'react-native';
import api from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '@env';

// Pass in a conversationId from the ChatScreen
export default function MemoryManager({ conversationId }) {
  console.log('MemoryManager => rendered with conversationId=', conversationId);

  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // If user clicks on a memory to view details/photos:
  const [viewingMemory, setViewingMemory] = useState(null);
  const [memoryPhotos, setMemoryPhotos] = useState([]);

  useEffect(() => {
    console.log('MemoryManager => useEffect: conversationId changed to', conversationId);
    if (conversationId) {
      fetchMemories();
    } else {
      console.log('MemoryManager => no conversationId, skipping fetch.');
      setLoading(false);
    }
  }, [conversationId]);

  const fetchMemories = async () => {
    try {
      console.log('MemoryManager => fetchMemories => calling GET /memories/conversation/', conversationId);
      setLoading(true);
      const res = await api.get(`/memories/conversation/${conversationId}`);
      console.log('MemoryManager => fetchMemories => response data:', res.data);
      setMemories(res.data.memories || []);
    } catch (error) {
      console.error('MemoryManager => fetchMemories => error:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMemory = async () => {
    if (!newTitle.trim()) {
      console.log('MemoryManager => handleCreateMemory => no title, returning');
      return;
    }
    try {
      console.log(`MemoryManager => handleCreateMemory => creating memory with title="${newTitle}"`);
      const res = await api.post(`/memories/conversation/${conversationId}`, {
        title: newTitle,
      });
      console.log('MemoryManager => handleCreateMemory => response.data=', res.data);

      const created = res.data.memory;
      setMemories((prev) => [created, ...prev]);
      setShowCreateForm(false);
      setNewTitle('');
    } catch (error) {
      console.error('MemoryManager => handleCreateMemory => error:', error.response?.data || error);
    }
  };

  const handleViewMemory = async (memory) => {
    console.log('MemoryManager => handleViewMemory => memoryId=', memory._id);
    try {
      setViewingMemory(null);
      setLoading(true);

      const res = await api.get(`/memories/${memory._id}`);
      console.log('MemoryManager => handleViewMemory => get single memory =>', res.data);

      const mem = res.data.memory;
      setViewingMemory(mem);
      setMemoryPhotos(mem.photos || []);
    } catch (err) {
      console.error('MemoryManager => handleViewMemory => error:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async (memoryId) => {
    console.log('MemoryManager => handleAddPhoto => memoryId=', memoryId);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled) {
        const localUri = result.assets[0].uri;
        console.log('MemoryManager => handleAddPhoto => user selected image:', localUri);

        const formData = new FormData();
        formData.append('photo', {
          uri: localUri,
          type: 'image/jpeg',
          name: 'memoryphoto.jpg'
        });

        const res = await api.post(`/memories/${memoryId}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        console.log('MemoryManager => handleAddPhoto => server response:', res.data);

        const updatedMemory = res.data.memory;
        setViewingMemory(updatedMemory);
        setMemoryPhotos(updatedMemory.photos);
      } else {
        console.log('MemoryManager => handleAddPhoto => user canceled image picker');
      }
    } catch (err) {
      console.error('MemoryManager => handleAddPhoto => error:', err.response?.data || err);
    }
  };

  if (!conversationId) {
    // DEBUG
    console.log('MemoryManager => conversationId is falsy, returning "No Conversation ID" view...');
    return (
      <View style={styles.centered}>
        <Text>No Conversation ID provided.</Text>
      </View>
    );
  }

  if (loading) {
    // DEBUG
    console.log('MemoryManager => loading is true => returning "Loading..."');
    return (
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (viewingMemory) {
    return (
      <View style={styles.container}>
        <Text style={styles.memoryTitle}>{viewingMemory.title}</Text>
        <Text style={styles.smallText}>
          Created by {viewingMemory.createdBy?.username || 'Unknown'} on{' '}
          {new Date(viewingMemory.createdAt).toLocaleDateString()}
        </Text>
        <FlatList
          data={memoryPhotos}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.photoContainer}>
              {item.path && (
                <Image
                  style={styles.photo}
                  source={{
                    uri: `http://${API_BASE_URL}:3000${
                      item.path.startsWith('/') ? '' : '/'
                    }${item.path}`,
                  }}
                />
              )}
              <Text>Uploaded by {item.user?.username || 'Unknown'}</Text>
              <Text>{new Date(item.created).toLocaleString()}</Text>
            </View>
          )}
        />
        <Button
          title="Add Photo"
          onPress={() => handleAddPhoto(viewingMemory._id)}
        />
        <Button
          title="Back to Memories"
          onPress={() => {
            setViewingMemory(null);
            setMemoryPhotos([]);
          }}
        />
      </View>
    );
  }

  // Memory list for this conversation
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Memories</Text>

      <FlatList
        data={memories}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.memoryItem}
            onPress={() => handleViewMemory(item)}
          >
            <Text style={styles.memoryTitle}>{item.title}</Text>
            <Text style={styles.smallText}>
              Created by {item.createdBy?.username}
            </Text>
            <Text style={styles.smallText}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        )}
      />

      {showCreateForm ? (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Memory Title"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <Button title="Create Memory" onPress={handleCreateMemory} />
          <Button
            title="Cancel"
            onPress={() => {
              setShowCreateForm(false);
              setNewTitle('');
            }}
          />
        </View>
      ) : (
        <Button
          title="Create a Memory"
          onPress={() => setShowCreateForm(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  memoryItem: {
    borderBottomWidth: 1, borderColor: '#ccc',
    paddingVertical: 8,
  },
  memoryTitle: { fontSize: 16, fontWeight: 'bold' },
  smallText: { color: '#666' },
  formContainer: {
    marginTop: 12,
    borderWidth: 1, borderColor: '#ccc',
    padding: 10, borderRadius: 4,
  },
  input: {
    borderWidth: 1, borderColor: '#ccc',
    padding: 8, marginBottom: 8,
    borderRadius: 4,
  },
  photoContainer: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingBottom: 6,
  },
  photo: {
    width: 200, height: 200,
    marginBottom: 6,
  },
});