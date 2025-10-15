// components/FriendRecommendations.js - Compact Friend Recommendations (Instagram-style)
import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';

export default function FriendRecommendations({ navigation, onFriendAdded }) {
  const { currentUser } = useContext(AuthContext);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequests, setSendingRequests] = useState(new Set());

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      
      // Fetch friend recommendations from the API
      const response = await api.get('/api/friends/recommendations', {
        params: { limit: 4 } // Reduced to 4 for more compact design
      });
      
      setRecommendations(response.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching friend recommendations:', error);
      // Fallback to mock data if API fails
      setRecommendations(getMockRecommendations());
    } finally {
      setLoading(false);
    }
  };

  const getMockRecommendations = () => [
    {
      _id: 'mock1',
      username: 'alex_johnson',
      firstName: 'Alex',
      lastName: 'Johnson',
      profilePicture: null,
      mutualFriends: 3,
      reason: 'You both attended Tech Meetup events'
    },
    {
      _id: 'mock2', 
      username: 'sarah_chen',
      firstName: 'Sarah',
      lastName: 'Chen',
      profilePicture: null,
      mutualFriends: 2,
      reason: 'Mutual friends: Emma, Mike'
    },
    {
      _id: 'mock3',
      username: 'david_kim',
      firstName: 'David',
      lastName: 'Kim',
      profilePicture: null,
      mutualFriends: 1,
      reason: 'Similar interests in Music'
    },
    {
      _id: 'mock4',
      username: 'maya_patel',
      firstName: 'Maya',
      lastName: 'Patel',
      profilePicture: null,
      mutualFriends: 2,
      reason: 'You both attended Art Gallery events'
    }
  ];

  const handleSendFriendRequest = async (user) => {
    try {
      setSendingRequests(prev => new Set(prev).add(user._id));
      
      await api.post('/api/friends/request', {
        recipientId: user._id,
        message: `Hi ${user.displayName || user.username}! I'd love to connect.`
      });
      
      Alert.alert(
        'Friend Request Sent!',
        `Your friend request has been sent to ${user.displayName || user.username}.`,
        [{ text: 'OK' }]
      );
      
      // Remove from recommendations
      setRecommendations(prev => prev.filter(rec => rec._id !== user._id));
      
      // Notify parent component
      if (onFriendAdded) {
        onFriendAdded(user);
      }
      
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert(
        'Error',
        'Failed to send friend request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(user._id);
        return newSet;
      });
    }
  };

  const renderRecommendationItem = (item) => {
    const isSendingRequest = sendingRequests.has(item._id);
    
    return (
      <View key={item._id} style={styles.recommendationCard}>
        <View style={styles.avatarContainer}>
          {item.profilePicture ? (
            <Image 
              source={{ uri: item.profilePicture }} 
              style={styles.avatar}
            />
          ) : (
            <View style={styles.defaultAvatar}>
              <Ionicons name="person" size={24} color="#8E8E93" />
            </View>
          )}
        </View>
        
        <View style={styles.userDetails}>
          <Text style={styles.displayName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.username}>@{item.username}</Text>
          <Text style={styles.reason}>{item.reason}</Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.addButton,
            isSendingRequest && styles.addButtonDisabled
          ]}
          onPress={() => handleSendFriendRequest(item)}
          disabled={isSendingRequest}
          activeOpacity={0.7}
        >
          {isSendingRequest ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.addButtonText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3797EF" />
        <Text style={styles.loadingText}>Finding people you might know...</Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return null; // Don't show anything if no recommendations
  }

  return (
    <View style={styles.container}>
      {/* Compact header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>People you may know</Text>
        <TouchableOpacity
          style={styles.seeAllButton}
          onPress={() => navigation.navigate('SearchScreen', { tab: 'users' })}
          activeOpacity={0.7}
        >
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
      
      {/* Vertical recommendations list */}
      <View style={styles.verticalList}>
        {recommendations.map(item => renderRecommendationItem(item))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  
  seeAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  
  seeAllText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  
  verticalList: {
    paddingHorizontal: 16,
  },
  
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  avatarContainer: {
    marginRight: 12,
  },
  
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  userDetails: {
    flex: 1,
    marginRight: 12,
  },
  
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  
  username: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  
  reason: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 16,
  },
  
  addButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  
  addButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
});
