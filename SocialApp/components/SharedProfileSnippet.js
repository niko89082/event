// components/SharedProfileSnippet.js - FIXED API route
import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedProfileSnippet({ message, senderName }) {
  const nav = useNavigation();

  // message.shareId may be a User document (populated) or just an ObjectId
  const [user, setUser] = useState(
    typeof message.shareId === 'object' ? message.shareId : null
  );
  const [error, setError] = useState(null);

  // fetch user if we only received the id string
  useEffect(() => {
    async function fetchUser() {
      if (!user && typeof message.shareId === 'string') {
        try {
          console.log('🟡 SharedProfileSnippet: Fetching user:', message.shareId);
          // FIXED: Use the correct API route with /api prefix
          const { data } = await api.get(`/api/profile/${message.shareId}`);
          console.log('🟢 SharedProfileSnippet: User loaded successfully');
          setUser(data);
        } catch (e) {
          console.error('❌ SharedProfileSnippet: Could not fetch shared profile:', e.response?.data || e.message);
          if (e.response?.status === 404) {
            setError('User not found or profile unavailable.');
          } else if (e.response?.status === 403) {
            setError('This profile is private.');
          } else {
            setError('Could not load profile.');
          }
        }
      }
    }
    fetchUser();
  }, [message.shareId, user]);

  const handleViewProfile = () => {
    if (!user) return;
    nav.navigate('ProfileScreen', { userId: user._id });
  };

  if (error) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sender}>{senderName} shared a profile...</Text>
        <View style={styles.errorCard}>
          <Ionicons name="person-circle-outline" size={32} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sender}>{senderName} shared a profile...</Text>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

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
        onPress={handleViewProfile}
        activeOpacity={0.8}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person-outline" size={24} color="#8E8E93" />
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.name}>{user.username}</Text>
          {!!user.pronouns && (
            <Text style={styles.pronouns}>{user.pronouns}</Text>
          )}
          {!!user.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
          )}
          
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {user.followers?.length || 0}
              </Text>
              <Text style={styles.statLabel}>followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {user.photos?.length || 0}
              </Text>
              <Text style={styles.statLabel}>posts</Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    marginVertical: 6, 
    maxWidth: '80%',
    backgroundColor: '#F8F0FF',
    padding: 12,
    borderRadius: 12,
  },
  sender: { 
    fontWeight: '600', 
    marginBottom: 8,
    color: '#000000',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  avatarPlaceholder: { 
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  name: { 
    fontWeight: '600',
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
  },
  pronouns: { 
    color: '#8E8E93', 
    fontSize: 12,
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
    lineHeight: 18,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  statLabel: {
    fontSize: 11,
    color: '#8E8E93',
  },
  loadingText: {
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});