// screens/FollowListScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../services/api';

export default function FollowListScreen({ route, navigation }) {
  const { userId, mode } = route.params;
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchFollowList();
  }, []);

  const fetchFollowList = async () => {
    try {
      const res = await api.get(`/profile/${userId}`);
      if (mode === 'followers') {
        setUsers(res.data.followers || []);
      } else if (mode === 'following') {
        setUsers(res.data.following || []);
      }
    } catch (err) {
      console.error('Error fetching follow list:', err.response?.data || err);
    }
  };

  const handlePressUser = (anotherUserId) => {
    // Go to that user’s profile
    navigation.navigate('ProfileScreen', { userId: anotherUserId });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handlePressUser(item._id)}>
            <Text style={styles.username}>{item.username}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  username: { fontSize: 16, marginVertical: 8 },
});