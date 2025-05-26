import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedProfileSnippet({ message, senderName }) {
  const nav = useNavigation();

  // message.shareId may be a User document (populated) or just an ObjectId
  const [user, setUser] = useState(
    typeof message.shareId === 'object' ? message.shareId : null
  );

  // fetch user if we only received the id string
  useEffect(() => {
    async function fetchUser() {
      if (!user && typeof message.shareId === 'string') {
        try {
          const { data } = await api.get(`/profile/${message.shareId}`);
          setUser(data);
        } catch (e) {
          console.warn('Could not fetch shared profile:', e.response?.data || e);
        }
      }
    }
    fetchUser();
  }, [message.shareId]);

  if (!user) return null;

  const picturePath = user.profilePicture?.startsWith('/')
    ? user.profilePicture
    : `/${user.profilePicture || ''}`;

  const uri = user.profilePicture
    ? `http://${API_BASE_URL}:3000${picturePath}`
    : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sender}>{senderName} shared a profile:</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => nav.navigate('ProfileScreen', { userId: user._id })}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.ph]} />
        )}

        <View>
          <Text style={styles.name}>{user.username}</Text>
          {!!user.pronouns && <Text style={styles.pronouns}>{user.pronouns}</Text>}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { marginVertical: 6, maxWidth: '80%' },
  sender:   { fontWeight: 'bold', marginBottom: 4 },
  card:     {
    flexDirection: 'row',
    alignItems:     'center',
    backgroundColor:'#F3F4F6',
    padding:        12,
    borderRadius:   14
  },
  avatar:   { width: 48, height: 48, borderRadius: 12, marginRight: 10 },
  ph:       { backgroundColor: '#ccc' },
  name:     { fontWeight: '700' },
  pronouns: { color: '#6B7280', fontSize: 12 },
});