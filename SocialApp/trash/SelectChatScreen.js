// screens/SelectChatScreen.js
import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';

export default function SelectChatScreen({ route, navigation }) {
  const { shareType, shareId } = route.params || {};

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id;

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      // use the route that returns user’s conversation list
      const res = await api.get('/messages/my-conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Error fetching conversations:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  // Decide the conversation label
  const getConversationTitle = (conv) => {
    if (conv.isGroup) {
      return conv.group?.name || 'Group Chat';
    } else {
      // DM => find the "other" user
      const other = conv.participants?.find((u) => u._id !== currentUserId);
      if (other) {
        return `DM with ${other.username}`;
      }
      return 'DM';
    }
  };

  const handleSelectConversation = async (conversationId) => {
    try {
      // Send a share message
      await api.post(`/messages/send`, {
        conversationId,
        shareType,
        shareId,
        content: '',
      });
      // Then navigate to that conversation (ChatScreen)
      // We do nested navigation: go to "ChatTab" => "ChatScreen"
      navigation.navigate('ChatTab', {
        screen: 'ChatScreen',
        params: { conversationId },
      });
    } catch (err) {
      console.error('Error sharing:', err.response?.data || err);
    }
  };

  const renderItem = ({ item }) => {
    const title = getConversationTitle(item);
    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => handleSelectConversation(item._id)}
      >
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!conversations.length) {
    return (
      <View style={styles.centered}>
        <Text>No conversations found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select a Conversation</Text>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  convItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
});