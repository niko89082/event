// components/MemoriesTab.js - Memories tab for ProfileScreen
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import MemoryCard from './MemoryCard';

export default function MemoriesTab({ navigation, userId, isSelf }) {
  const { currentUser } = useContext(AuthContext);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchMemories(true);
  }, [userId]);

  const fetchMemories = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const targetPage = reset ? 1 : page;
      const response = await api.get(`/api/memories/user/${userId}`, {
        params: { page: targetPage, limit: 20 }
      });

      const newMemories = response.data.memories || [];
      
      if (reset) {
        setMemories(newMemories);
      } else {
        setMemories(prev => [...prev, ...newMemories]);
      }

      setHasMore(response.data.hasMore || false);
      setPage(prev => reset ? 2 : prev + 1);

    } catch (error) {
      console.error('Error fetching memories:', error);
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load memories');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMemories(true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      fetchMemories(false);
    }
  };

  const handleMemoryPress = (memory) => {
    navigation.navigate('MemoryDetailsScreen', { memoryId: memory._id });
  };

  const handleCreateMemory = () => {
    navigation.navigate('CreateMemoryScreen');
  };

  const renderMemoryCard = ({ item }) => (
    <MemoryCard
      memory={item}
      onPress={handleMemoryPress}
    />
  );

  const renderLoadingFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#3797EF" />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="library-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>
        {isSelf ? 'No memories yet' : 'No shared memories'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isSelf 
          ? 'Create your first memory to preserve special moments with friends'
          : 'You don\'t have any shared memories with this person yet'
        }
      </Text>
      {isSelf && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateMemory}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Memory</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading memories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Create Memory Button (Floating) */}
      {isSelf && memories.length > 0 && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handleCreateMemory}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <FlatList
        data={memories}
        keyExtractor={(item) => item._id}
        renderItem={renderMemoryCard}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderLoadingFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={memories.length === 0 ? styles.emptyContentContainer : styles.contentContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    paddingVertical: 8,
  },
  emptyContentContainer: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
  },
});