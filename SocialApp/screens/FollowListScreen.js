// screens/FollowListScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../services/api';
import UserProfileRow from '../components/UserProfileRow'

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

  const handlePressUser = (clickedUser) => {
    // clickedUser => { _id, username, profilePicture? ... }
    navigation.navigate('ProfileScreen', { userId: clickedUser._id });
  };

  const renderItem = ({ item }) => {
    return (
      <UserProfileRow user={item} onPress={handlePressUser} />
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});