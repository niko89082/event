// screens/ChatInfoScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Button, TextInput,
  ScrollView, // <-- Import
} from 'react-native';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';
import UserProfileRow from '../components/UserProfileRow';
import SharedPostSnippet from '../components/SharedPostSnippet';
import SharedEventSnippet from '../components/SharedEventSnippet';

export default function ChatInfoScreen({ route, navigation }) {
  const { conversationId } = route.params || {};
  const { currentUser } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [chatInfo, setChatInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChatInfo();
  }, [conversationId]);

  const fetchChatInfo = async () => {
    if (!conversationId) {
      setError('No conversationId provided');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // We assume the route now returns conversation, group, recentPhotos, recentShares
      const res = await api.get(`/messages/conversation/${conversationId}/info`);
      setChatInfo(res.data);
    } catch (err) {
      console.error('ChatInfoScreen => fetchChatInfo => error:', err.response?.data || err);
      setError(err.response?.data?.message || 'Failed to load chat info');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading chat info...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: 'red' }}>Error: {error}</Text>
      </View>
    );
  }
  if (!chatInfo) {
    return (
      <View style={styles.centered}>
        <Text>No info available.</Text>
      </View>
    );
  }

  const { conversation, group, recentPhotos, recentShares } = chatInfo;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {group ? (
        <View>
          <Text style={styles.title}>{group.name}</Text>
          {/* rename logic if needed */}
        </View>
      ) : (
        <Text>Direct Chat</Text>
      )}

      {/* 1) Participants */}
      <Text style={styles.label}>Members:</Text>
      {conversation?.participants?.map((user) => {
        return (
          <UserProfileRow
            key={user._id}
            user={user}
            onPress={() => navigation.navigate('ProfileScreen', { userId: user._id })}
          />
        );
      })}

      {/* 2) Recent Photos */}
      <Text style={styles.label}>Recent Photos:</Text>
      {(!recentPhotos || recentPhotos.length === 0) ? (
        <Text style={styles.noPhotosText}>No recent photos</Text>
      ) : (
        <ScrollView horizontal style={styles.photosList}>
          {recentPhotos.map((p, i) => {
            const path = p.startsWith('/') ? p : `/${p}`;
            const url = `http://${API_BASE_URL}:3000${path}`;
            return (
              <Image
                key={`photo-${i}`}
                source={{ uri: url }}
                style={styles.photoItem}
              />
            );
          })}
        </ScrollView>
      )}

      {/* 3) Recent Shares => posts / events */}
      <Text style={styles.label}>Recent Shares:</Text>
      {(!recentShares || recentShares.length === 0) ? (
        <Text style={styles.noPhotosText}>No recent shares</Text>
      ) : (
        recentShares.map((msg) => {
          if (msg.shareType === 'post') {
            return <SharedPostSnippet key={msg._id} message={msg} senderName="(someone)" />;
          } else if (msg.shareType === 'event') {
            return <SharedEventSnippet key={msg._id} message={msg} senderName="(someone)" />;
          }
          // if you add 'memory' or others, handle them similarly
          return null;
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 16,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontWeight: '600', marginVertical: 8 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  noPhotosText: { color: '#999', fontStyle: 'italic', marginBottom: 8 },
  photosList: { marginBottom: 8 },
  photoItem: {
    width: 80, height: 80, borderRadius: 4, marginRight: 8,
  },
});