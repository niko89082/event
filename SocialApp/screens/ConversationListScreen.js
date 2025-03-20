// ConversationListScreen.js

import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef
} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';

import api from '../services/api';

// IMPORTANT: If you have an .env for API_BASE_URL
// or you hardcode the domain/IP for your socket server:
import { io } from 'socket.io-client';
import { API_BASE_URL } from '@env';

export default function ConversationListScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const { currentUser } = useContext(AuthContext);

  // We'll store our socket instance in a ref
  const socketRef = useRef(null);

  useEffect(() => {
    // 1) Connect the socket
    const socket = io(`http://${API_BASE_URL}:3000`, {
      // Optionally include auth
      // auth: { token: <JWT_TOKEN> },
    });
    socketRef.current = socket;

    // 2) Listen for new messages
    //    In order to update the conversation's last message in real time.
    socket.on('message', (newMessage) => {
      const { conversationId } = newMessage;
      if (!conversationId) return;

      setConversations((prev) => {
        // Check if conversation exists in our state
        const existing = prev.find((c) => c._id === conversationId);

        if (!existing) {
          // Possibly fetch the new conversation or just trigger a full refetch
          // if you want a simpler approach:
          fetchConversations();
          return prev;
        }

        // If found, update that conversation's last message
        const updated = prev.map((c) => {
          if (c._id === conversationId) {
            return {
              ...c,
              lastMessage: newMessage,
            };
          }
          return c;
        });

        return updated;
      });
    });

    // 3) Listen for brand-new conversation creations
    //    e.g. a user starts a conversation with you for the first time.
    socket.on('conversationCreated', (newConvo) => {
      // Insert this new conversation at the top of the list
      setConversations((prev) => [newConvo, ...prev]);
    });

    // Optionally, you might want to "join" all existing conversations
    // so that you receive 'message' events for them specifically.
    // (If your server requires joining rooms.)
    // You could do something like:
    // fetchConversations -> once you have the conversation IDs, 
    // emit "joinRoom" for each conversation ID.

    // 4) Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // This is the same from your existing code, used to refetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/messages/my-conversations');
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handlePressConversation = (conversation) => {
    if (conversation.isGroup) {
      navigation.navigate('ChatScreen', {
        groupId: conversation.group?._id,
        conversationId: conversation._id,
      });
    } else {
      // DM
      navigation.navigate('ChatScreen', {
        conversationId: conversation._id,
      });
    }
  };

  const getConversationTitle = (conversation) => {
    if (conversation.isGroup) {
      return conversation.group?.name || 'Group Chat';
    } else {
      // direct message
      const other = conversation.participants?.find(
        (u) => u._id !== currentUser?._id
      );
      return other ? `DM with ${other.username}` : 'DM with ???';
    }
  };

  const renderConversationItem = ({ item }) => {
    const title = getConversationTitle(item);
    return (
      <TouchableOpacity
        style={styles.convoItem}
        onPress={() => handlePressConversation(item)}
      >
        <Text style={styles.convoTitle}>{title}</Text>
        {item.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage.content}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c._id}
        renderItem={renderConversationItem}
      />

      {/* Button to start new DM or group */}
      <TouchableOpacity
        style={styles.newChatButton}
        onPress={() => navigation.navigate('NewChatScreen')}
      >
        <Text style={styles.newChatText}>New Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  convoItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  convoTitle: { fontWeight: 'bold' },
  lastMessage: { color: '#666', marginTop: 4 },
  newChatButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 25,
  },
  newChatText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});