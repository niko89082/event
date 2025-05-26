// components/SharedMemorySnippet.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedMemorySnippet({ message, senderName, navigation }) {
  const [memory, setMemory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (message.shareId) {
      fetchMemory(message.shareId);
    }
  }, [message]);

  const fetchMemory = async (memoryId) => {
    try {
      const res = await api.get(`/memories/${memoryId}`);
      setMemory(res.data.memory);
    } catch (err) {
      console.error('SharedMemorySnippet => fetchMemory error:', err);
      setError(err.response?.data?.message || 'Error loading memory');
    }
  };

  const handleViewMemory = () => {
    if (!memory) return;
    // Example: navigate to some "MemoryDetailsScreen"
    // passing the memoryId
    navigation.navigate('MemoryDetailsScreen', { memoryId: memory._id });
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared a memory...</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!memory) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared a memory...</Text>
        <Text>Loading memory...</Text>
      </View>
    );
  }

  // Show a small preview of the memory's photos
  // For demonstration, let's just show the first photo if it exists
  let previewUri = null;
  if (memory.photos?.length) {
    const p = memory.photos[0];
    if (p.paths?.[0]) {
      let finalPath = p.paths[0];
      if (!finalPath.startsWith('/')) {
        finalPath = '/' + finalPath;
      }
      previewUri = `http://${API_BASE_URL}:3000${finalPath}`;
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sender}>{senderName} shared a memory:</Text>
      <Text style={styles.title}>{memory.title}</Text>

      {previewUri && (
        <Image source={{ uri: previewUri }} style={styles.previewImage} />
      )}

      <TouchableOpacity onPress={handleViewMemory}>
        <Text style={styles.viewLink}>View Full Memory</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ddf',
    padding: 8,
    marginVertical: 4,
    borderRadius: 6,
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 6,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
  },
  viewLink: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: 'red',
  },
});