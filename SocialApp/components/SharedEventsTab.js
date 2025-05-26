// components/SharedEventsTab.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../services/api';

export default function SharedEventsTab({ navigation, userId, isSelf }) {
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [events, setEvents]           = useState([]);

  /* ───────────────────────────────────── fetch */
  const fetchEvents = useCallback(async (pull = false) => {
    pull ? setRefreshing(true) : setLoading(true);
    try {
      const { data } = await api.get(`/profile/${userId}/shared-events`);
      setEvents(data.sharedEvents || []);
    } catch (err) {
      console.error('SharedEventsTab →', err.response?.data || err);
    } finally {
      pull ? setRefreshing(false) : setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  /* ───────────────────────────────────── render */
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={{ padding:12, borderBottomWidth:1, borderColor:'#eee' }}
      onPress={() =>
        navigation.navigate('EventsTab', {
          screen : 'EventDetails',
          params : { eventId: item._id },
        })}
    >
      <Text style={{ fontWeight:'700' }}>{item.title}</Text>
      <Text>{new Date(item.time).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex:1 }}>
      {isSelf && (
        <TouchableOpacity
          style={{ padding:10, backgroundColor:'#f3f4f6' }}
          onPress={() => navigation.navigate('SelectShareableEventsScreen', { userId })}
        >
          <Text style={{ fontWeight:'600' }}>Select / update events to share ↗</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop:20 }} />
      ) : events.length === 0 ? (
        <View style={{ alignItems:'center', marginTop:20 }}>
          <Text>No shared events.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={e => e._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchEvents(true)} />
          }
        />
      )}
    </View>
  );
}