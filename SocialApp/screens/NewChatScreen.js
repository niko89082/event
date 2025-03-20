import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Button
} from 'react-native';
import api from '../services/api';

export default function NewChatScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    // Fetch all users (or an initial set) when the screen mounts
    fetchUsers('');
  }, []);

  // Fetch users from your search endpoint
  // If `text` is empty, the backend can return all users
  const fetchUsers = async (text = '') => {
    try {
      // If the user typed something, call /search/users?username=...
      // Otherwise, call /search/users with no query param to fetch all
      const url = text.trim()
        ? `/search/users?username=${text.trim()}`
        : '/search/users';

      const res = await api.get(url);
      setUsers(res.data);
    } catch (error) {
      console.error(error.response?.data || error);
    }
  };

  // Called whenever the user types in the search box
  const handleSearchChange = (text) => {
    setSearch(text);
    // Perform a search with typed text
    fetchUsers(text);
  };

  const handleSelectUser = (userId) => {
    // Toggle selecting/unselecting a user
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleStartDM = async (userId) => {
    try {
      // Navigate to the ChatScreen with a recipientId
      navigation.navigate('ChatScreen', { recipientId: userId });
    } catch (error) {
      console.error(error.response?.data || error);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      return; // need at least 2 people for a group
    }
    try {
      // 1) create a group
      const groupData = {
        name: 'New Group Chat', // or prompt user for a group name
      };
      const createGroupRes = await api.post('/group/create', groupData);
      const groupId = createGroupRes.data._id;

      // 2) Invite each selected user (or pass all userIds in one request)
      await api.post(`/group/${groupId}/invite`, { userIds: selectedUsers });

      // 3) Navigate to ChatScreen with groupId
      navigation.navigate('ChatScreen', { groupId });
    } catch (err) {
      console.error(err.response?.data || err);
    }
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.includes(item._id);
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleSelectUser(item._id)}
      >
        <Text style={{ color: isSelected ? 'blue' : '#000' }}>
          {item.username}
        </Text>
        <Button
          title="DM"
          onPress={() => handleStartDM(item._id)}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        value={search}
        onChangeText={handleSearchChange}
      />

      {/* List of users */}
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderUserItem}
      />

      {/* Button to create a group (only if 2+ selected) */}
      {selectedUsers.length > 1 && (
        <View style={styles.createGroupContainer}>
          <Button
            title={`Create Group with (${selectedUsers.length}) users`}
            onPress={handleCreateGroup}
          />
        </View>
      )}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  searchInput: {
    borderWidth: 1, borderColor: '#ccc', padding: 8,
    borderRadius: 4, marginBottom: 8,
  },
  userItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createGroupContainer: {
    marginVertical: 10,
  },
});