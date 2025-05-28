// screens/FollowListScreen.js - Updated with improved UI
import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  SafeAreaView, StatusBar, ActivityIndicator, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function FollowListScreen({ route, navigation }) {
  const { userId, mode } = route.params;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.33,
        borderBottomColor: '#E1E1E1',
        height: 88,
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: mode === 'followers' ? 'Followers' : 'Following',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, mode]);

  useEffect(() => {
    fetchFollowList();
  }, []);

  const fetchFollowList = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/profile/${userId}`);
      if (mode === 'followers') {
        setUsers(res.data.followers || []);
      } else if (mode === 'following') {
        setUsers(res.data.following || []);
      }
    } catch (err) {
      console.error('Error fetching follow list:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handlePressUser = (clickedUser) => {
    navigation.navigate('ProfileScreen', { userId: clickedUser._id });
  };

  const renderItem = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
      : 'https://placehold.co/56x56.png?text=👤';

    return (
      <TouchableOpacity 
        style={styles.userRow} 
        onPress={() => handlePressUser(item)}
        activeOpacity={0.95}
      >
        <View style={styles.userInfo}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{item.username}</Text>
            {item.displayName && (
              <Text style={styles.displayName}>{item.displayName}</Text>
            )}
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.followButton}
          onPress={() => handlePressUser(item)}
          activeOpacity={0.8}
        >
          <Text style={styles.followButtonText}>View</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading {mode}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {users.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons 
              name={mode === 'followers' ? 'people-outline' : 'person-add-outline'} 
              size={64} 
              color="#C7C7CC" 
            />
          </View>
          <Text style={styles.emptyTitle}>
            No {mode === 'followers' ? 'followers' : 'following'} yet
          </Text>
          <Text style={styles.emptySubtitle}>
            {mode === 'followers' 
              ? 'When people follow this account, they\'ll appear here.'
              : 'When this account follows people, they\'ll appear here.'
            }
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsText}>
              {users.length} {mode === 'followers' ? 'followers' : 'following'}
            </Text>
          </View>
          
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },
  statsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 0.33,
    borderBottomColor: '#E1E1E1',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  listContainer: {
    paddingVertical: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16, // Square with rounded corners
    backgroundColor: '#F6F6F6',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});