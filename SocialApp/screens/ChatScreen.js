// screens/ChatScreen.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { API_BASE_URL } from '@env';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { io } from 'socket.io-client';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { useLayoutEffect } from 'react';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, groupId, recipientId } = route.params || {};
  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [photoPreviewUri, setPhotoPreviewUri] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const socketRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          title="Info"
          onPress={() => {
            navigation.navigate('ChatInfoScreen', { conversationId });
          }}
        />
      ),
    });
  }, [navigation, conversationId]);

  useEffect(() => {
    const socket = io(`http://${API_BASE_URL}:3000`, {});
    socketRef.current = socket;

    const roomId = groupId || conversationId || recipientId;
    if (roomId) {
      socket.emit('joinRoom', { conversationId: roomId });
    }

    socket.on('message', (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
    });

    fetchMessages(page);

    return () => {
      socket.disconnect();
    };
  }, [conversationId, groupId, recipientId]);

  // Fetch messages
  const fetchMessages = async (pageNumber, append = false) => {
    try {
      if (groupId) {
        const res = await api.get(`/messages/group/${groupId}`);
        setMessages(res.data.messages);
        setHasMore(false);
      } else if (conversationId) {
        const skip = (pageNumber - 1) * PAGE_SIZE;
        const res = await api.get(
          `/messages/conversation/byId/${conversationId}?limit=${PAGE_SIZE}&skip=${skip}`
        );
        const newMessages = res.data.messages || [];
        setMessages(append ? [...messages, ...newMessages] : newMessages);
        if (!res.data.hasMore) setHasMore(false);
      } else if (recipientId) {
        setMessages([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error(err.response?.data || err);
    }
  };

  // Pick photo for preview
  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1, // Adjust "quality" to speed up upload (lower => smaller file)
      });
      if (!result.canceled) {
        setPhotoPreviewUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Photo pick error:', err);
    }
  };

  // On "Send"
  const handleSend = async () => {
    if (photoPreviewUri) {
      await sendPhotoMessage(photoPreviewUri);
      setPhotoPreviewUri(null);
    } else if (input.trim()) {
      await sendTextMessage();
      setInput('');
    }
  };

  // Send text
  const sendTextMessage = async () => {
    try {
      if (groupId) {
        await api.post(`/messages/group/${groupId}/message`, { content: input });
      } else if (conversationId) {
        await api.post('/messages/send', { conversationId, content: input });
      } else if (recipientId) {
        await api.post('/messages/send', { recipientId, content: input });
      }
    } catch (err) {
      console.error('Send text error:', err.response?.data || err);
    }
  };

  // Send photo
  const sendPhotoMessage = async (localUri) => {
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: localUri,
        type: 'image/jpeg',
        name: 'photo.jpg'
      });

      if (conversationId) {
        formData.append('conversationId', conversationId);
        await api.post('/messages/send/photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else if (recipientId) {
        formData.append('recipientId', recipientId);
        await api.post('/messages/send/photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else if (groupId) {
        formData.append('groupId', groupId);
        await api.post('/messages/group/photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
    } catch (err) {
      console.error('Send photo error:', err.response?.data || err);
    }
  };

  // Render each message
  const renderMessageItem = ({ item }) => {
    const senderName =
      item.sender?._id === currentUserId ? 'You' : item.sender?.username || 'Unknown';

    let finalPath = item.content || '';
    if (finalPath && !finalPath.startsWith('/')) {
      finalPath = '/' + finalPath;
    }

    if (finalPath.startsWith('/uploads/photos/')) {
      const imageUrl = `http://${API_BASE_URL}:3000${finalPath}`;
      return (
        <View style={styles.messageItem}>
          <Text style={styles.senderText}>{senderName}:</Text>
          <Image source={{ uri: imageUrl }} style={styles.messageImage} />
        </View>
      );
    }

    return (
      <View style={styles.messageItem}>
        <Text style={styles.senderText}>{senderName}:</Text>
        <Text style={styles.messageText}>{item.content}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(m, i) => `${m._id}-${i}`}
        renderItem={renderMessageItem}
        style={styles.messageList}
      />

      {photoPreviewUri && (
        <View style={styles.photoPreviewContainer}>
          <Image source={{ uri: photoPreviewUri }} style={styles.photoPreview} />
          <TouchableOpacity
            style={styles.removePhotoBtn}
            onPress={() => setPhotoPreviewUri(null)}
          >
            <Text style={styles.removePhotoText}>X</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type or pick photo..."
        />
        <Button title="Pick Photo" onPress={handlePickPhoto} />
        <Button title="Send" onPress={handleSend} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageList: { flex: 1, padding: 10 },
  messageItem: {
    marginVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: '80%',
    backgroundColor: '#eee',
    padding: 8,
    borderRadius: 5,
  },
  senderText: { fontWeight: 'bold', marginBottom: 2 },
  messageText: { fontSize: 16 },
  messageImage: {
    width: 150, 
    height: 150, 
    borderRadius: 8, 
    marginTop: 4
  },
  photoPreviewContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 10, 
    marginBottom: 6
  },
  photoPreview: {
    width: 80, 
    height: 80, 
    borderRadius: 6, 
    marginRight: 8
  },
  removePhotoBtn: {
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: 'red', 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  removePhotoText: { color: '#fff', fontWeight: 'bold' },
  inputRow: {
    flexDirection: 'row', 
    padding: 6, 
    borderTopWidth: 1, 
    borderColor: '#ccc', 
    alignItems: 'center', 
    justifyContent: 'space-between'
  },
  input: {
    flex: 1, 
    borderWidth: 1, 
    borderColor: '#ccc', 
    borderRadius: 4, 
    padding: 8, 
    marginRight: 6
  },
});