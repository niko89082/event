// screens/SearchScreen.js
import React, { useState } from 'react';
import { View, TextInput, Button, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../services/api';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('users'); // or 'events'
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    try {
      if (!query.trim()) return;
      if (type === 'users') {
        const res = await api.get(`/search/users?username=${encodeURIComponent(query)}`);
        setResults(res.data);
      } else {
        const res = await api.get(`/search/events?title=${encodeURIComponent(query)}`);
        setResults(res.data);
      }
    } catch (error) {
      console.error(error.response?.data || error);
    }
  };

  const handlePressUser = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  const renderItem = ({ item }) => {
    if (type === 'users') {
      return (
        <TouchableOpacity style={styles.resultItem} onPress={() => handlePressUser(item._id)}>
          <Text>User: {item.username}</Text>
        </TouchableOpacity>
      );
    } else {
      // an event
      return (
        <View style={styles.resultItem}>
          <Text>Event: {item.title}</Text>
          <Text>Location: {item.location}</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.typeRow}>
        <Button title="Search Users" onPress={() => setType('users')} />
        <Button title="Search Events" onPress={() => setType('events')} />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Enter search term..."
        value={query}
        onChangeText={setQuery}
      />
      <Button title="Search" onPress={handleSearch} />
      <FlatList
        data={results}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 4, marginVertical: 8,
  },
  resultItem: {
    borderWidth: 1, borderColor: '#eee', marginVertical: 4, padding: 10,
  },
});