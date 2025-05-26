import React, { useState } from 'react';
import {
  View, TextInput, Button, FlatList, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import api from '../services/api';

export default function SearchScreen({ navigation }) {
  const [query,   setQuery]   = useState('');
  const [tab,     setTab]     = useState('users');   // users | events
  const [results, setResults] = useState([]);

  const runSearch = async () => {
    if (!query.trim()) return;
    const route = tab === 'users' ? '/search/users' : '/search/events';
    const res   = await api.get(`${route}?q=${encodeURIComponent(query)}`);
    setResults(res.data);
  };

  const render = ({ item }) =>
    tab === 'users' ? (
      <TouchableOpacity style={styles.item}
        onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}>
        <Text>{item.username}</Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity style={styles.item}
        onPress={() =>
          navigation.navigate('EventStack', {
            screen: 'EventDetails',
            params: { eventId: item._id },
          })
        }>
        <Text>{item.title}</Text>
        <Text>{item.location}</Text>
      </TouchableOpacity>
    );

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Button title="Users"  onPress={() => setTab('users')}  />
        <Button title="Events" onPress={() => setTab('events')} />
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search…"
        style={styles.input}
        onSubmitEditing={runSearch}
      />
      <Button title="Search" onPress={runSearch} />
      <FlatList data={results} keyExtractor={(i) => i._id} renderItem={render} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  tabRow:{ flexDirection:'row', justifyContent:'space-evenly' },
  input:{ borderWidth:1, borderColor:'#ccc', borderRadius:6, padding:8, marginVertical:8 },
  item:{ padding:10, borderBottomWidth:.5, borderColor:'#ddd' },
});