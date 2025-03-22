import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Button } from 'react-native';
import api from '../services/api';
import { API_BASE_URL } from '@env';
import PostItem from '../components/PostItem'; 
import { AuthContext } from '../services/AuthContext';

export default function FeedScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id;      
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchFeed(1);
  }, []);

  const fetchFeed = async (pageNum) => {
    try {
      setLoading(true);
      const res = await api.get(`/feed?page=${pageNum}&limit=10`);
      setFeed(pageNum === 1 ? res.data.feed : [...feed, ...res.data.feed]);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error(error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (page < totalPages) {
      fetchFeed(page + 1);
    }
  };

  const renderItem = ({ item }) => {
    // If it's a post (item.uploadDate exists) => show PostItem
    if (item.uploadDate) {
      return (
        <PostItem
          post={item}
          currentUserId={currentUserId} // now defined
          navigation={navigation}
          hideUserInfo={false}
        />
      );
    }
    // If it's an event (item.time exists) => show event
    else if (item.time) {
      return (
        <View style={styles.eventItem}>
          <Text>Event: {item.title}</Text>
          <Text>Host: {item.host?.username}</Text>
        </View>
      );
    }

    // Fallback
    return (
      <View>
        <Text>Unknown feed item</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading && page === 1 ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item, index) => item._id || index.toString()}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Create Post & Create Event buttons */}
      <Button
        title="Create Post"
        onPress={() => navigation.navigate('CreatePostScreen')}
      />
      <Button
        title="Create Event"
        onPress={() => navigation.navigate('CreateEvent')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  eventItem: {
    marginBottom: 16,
    backgroundColor: '#eee',
    padding: 10,
  },
});