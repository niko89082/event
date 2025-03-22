// screens/ChatInfoScreen.js
import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, Button, TextInput } from 'react-native';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';
import UserProfileRow from '../components/UserProfileRow'; 


export default function ChatInfoScreen({ route, navigation }) {
  // We expect route.params.conversationId (or groupId if relevant)
  const { conversationId } = route.params || {};

  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id;

  const [loading, setLoading] = useState(true);
  const [chatInfo, setChatInfo] = useState(null);
  const [error, setError] = useState(null);

  // If you want to rename the group, etc.:
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    fetchChatInfo();
  }, [conversationId]);

  // ===========================================
  // GET /messages/conversation/:conversationId/info (example endpoint)
  // Return => { conversation: {...}, group: {...}, recentPhotos: [...] }
  // ===========================================
  const fetchChatInfo = async () => {
    if (!conversationId) {
      setError('No conversationId provided');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/messages/conversation/${conversationId}/info`);
      setChatInfo(res.data);
    } catch (err) {
      console.error('ChatInfoScreen => fetchChatInfo => error:', err.response?.data || err);
      setError(err.response?.data?.message || 'Failed to load chat info');
    } finally {
      setLoading(false);
    }
  };

  // Optionally rename group
  const handleRenameGroup = async () => {
    try {
      if (!chatInfo?.group?._id) return;

      // Suppose you have an endpoint: POST /group/:groupId/rename { newName }
      const groupId = chatInfo.group._id;
      await api.post(`/group/${groupId}/rename`, { newName: newGroupName });

      // Refresh chat info if you want
      fetchChatInfo();
      setNewGroupName('');
    } catch (err) {
      console.error('Rename group error:', err.response?.data || err);
    }
  };

  // Navigate to a user’s profile
  const handlePressUser = (user) => {
    // E.g., if you have a "ProfileScreen" in your nav:
    navigation.navigate('ProfileScreen', { userId: user._id });
  };

  // Render each participant
  const renderParticipantItem = ({ item }) => (
    <UserProfileRow
      user={item}
      onPress={(u) => {
        navigation.navigate('ProfileScreen', { userId: u._id });
      }}
    />
  );

  // Render each photo in a small horizontal list
  const renderPhotoItem = ({ item }) => {
    // item might be the content path, e.g. /uploads/photos/xxxx.jpg
    const finalPath = item.startsWith('/') ? item : `/${item}`;
    const photoUrl = `http://${API_BASE_URL}:3000${finalPath}`;

    return (
      <Image
        source={{ uri: photoUrl }}
        style={styles.photoItem}
      />
    );
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

  const { conversation, group, recentPhotos } = chatInfo;
  const isGroup = !!group; // if we have a group object => it's a group chat

  return (
    <View style={styles.container}>
      {/* If group chat => show group name, maybe rename if user is admin */}
      {isGroup ? (
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>{group.name}</Text>
          {/* If you want rename logic, show an input and button: */}
          <Text style={styles.label}>Rename Group:</Text>
          <View style={styles.renameRow}>
            <TextInput
              style={styles.renameInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Enter new group name"
            />
            <Button title="Rename" onPress={handleRenameGroup} />
          </View>
        </View>
      ) : (
        <Text style={styles.label}>Direct Chat</Text>
      )}

      {/* Participants */}
      <Text style={styles.label}>Members:</Text>
      <FlatList
        data={conversation?.participants || []}
        keyExtractor={(item) => item._id}
        renderItem={renderParticipantItem}
        style={styles.participantsList}
      />

      {/* Recent photos */}
      <Text style={styles.label}>Recent Photos:</Text>
      {(!recentPhotos || recentPhotos.length === 0) ? (
        <Text style={styles.noPhotosText}>No recent photos.</Text>
      ) : (
        <FlatList
          data={recentPhotos}
          keyExtractor={(item, index) => `${index}`}
          renderItem={renderPhotoItem}
          horizontal
          style={styles.photosList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  groupHeader: { marginBottom: 16 },
  groupTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  label: { fontWeight: '600', marginVertical: 8 },
  renameRow: { flexDirection: 'row', alignItems: 'center' },
  renameInput: {
    flex: 1,
    borderWidth: 1, borderColor: '#ccc',
    padding: 8, marginRight: 6, borderRadius: 4
  },
  participantsList: {
    maxHeight: 150, // or something that works for your layout
    marginBottom: 16,
  },
  participantItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  participantName: { fontSize: 16 },
  photosList: {
    marginTop: 8,
  },
  photoItem: {
    width: 80, height: 80,
    borderRadius: 4,
    marginRight: 8,
  },
  noPhotosText: {
    color: '#999', fontStyle: 'italic',
  },
});