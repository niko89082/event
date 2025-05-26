// screens/SelectShareableEventsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Button, StyleSheet, FlatList } from 'react-native';
import api from '../services/api';

export default function SelectShareableEventsScreen({ route, navigation }) {
  const { userId } = route.params || {};

  const [allAttended, setAllAttended] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set()); // which events are "shared"

  useEffect(() => {
    fetchAttended();
    fetchCurrentlyShared();
  }, [userId]);

  const fetchAttended = async () => {
    try {
      const res = await api.get(`/profile/${userId}/attended-events`);
      // res.data => { events: [...] }
      setAllAttended(res.data.events || []);
    } catch (err) {
      console.error('SelectShareable => fetchAttended =>', err.response?.data || err);
    }
  };

  const fetchCurrentlyShared = async () => {
    try {
      // GET /profile/:userId/shared-events => returns IDs
      const res = await api.get(`/profile/${userId}/shared-events`);
      const existing = res.data.events || [];
      const setOfIds = new Set(existing.map(e => e._id));
      setSelectedIds(setOfIds);
    } catch (err) {
      console.error('fetchCurrentlyShared =>', err.response?.data || err);
    }
  };

  const handleToggle = (evtId) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(evtId)) {
      newSet.delete(evtId);
    } else {
      newSet.add(evtId);
    }
    setSelectedIds(newSet);
  };

  const handleSave = async () => {
    try {
      // Convert selectedIds to array
      const arr = Array.from(selectedIds);
      // PUT /profile/:userId/shared-events => pass { eventIds: [...] }
      await api.put(`/profile/${userId}/shared-events`, { eventIds: arr });
      navigation.goBack();
    } catch (err) {
      console.error('handleSave =>', err.response?.data || err);
    }
  };

  const renderEventItem = ({ item }) => {
    const isSelected = selectedIds.has(item._id);
    return (
      <TouchableOpacity
        style={[styles.itemRow, isSelected && styles.itemRowSelected]}
        onPress={() => handleToggle(item._id)}
      >
        <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
        <Text style={{ color: '#666', fontSize: 12 }}>
          {new Date(item.time).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Events to Share Publicly</Text>
      <FlatList
        data={allAttended}
        keyExtractor={e => e._id}
        renderItem={renderEventItem}
      />
      <Button title="Save" onPress={handleSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  itemRow: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  itemRowSelected: {
    backgroundColor: '#ccc',
  },
});