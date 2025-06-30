// SocialApp/screens/MemoryParticipantsScreen.js - Separate participants page similar to FollowListScreen
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Image,
  TextInput, Alert, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function MemoryParticipantsScreen({ route, navigation }) {
  const { memoryId, memoryTitle } = route.params;
  const { currentUser } = useContext(AuthContext);
  
  const [memory, setMemory] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  
  // Add participants functionality
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [adding, setAdding] = useState(false);

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
      headerTitle: 'Participants',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: isCreator ? () => (
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="person-add" size={24} color="#3797EF" />
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, isCreator]);

  useEffect(() => {
    fetchMemoryParticipants();
  }, [memoryId]);

  // Helper function to get proper profile picture URL
  const getProfilePictureUrl = (profilePicture, fallbackText = '👤') => {
    if (profilePicture) {
      if (profilePicture.startsWith('http')) {
        return profilePicture;
      }
      const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
      return `http://${API_BASE_URL}:3000${cleanPath}`;
    }
    return `https://placehold.co/56x56/E1E1E1/8E8E93?text=${fallbackText}`;
  };

  const fetchMemoryParticipants = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/memories/${memoryId}`);
      const memoryData = response.data.memory;
      
      setMemory(memoryData);
      setIsCreator(memoryData.creator._id === currentUser._id);
      
      // Combine creator and participants
      const allParticipants = [
        { ...memoryData.creator, isCreator: true },
        ...(memoryData.participants || []).map(p => ({ ...p, isCreator: false }))
      ];
      
      setParticipants(allParticipants);
      
    } catch (error) {
      console.error('Error fetching memory participants:', error);
      Alert.alert('Error', 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      console.log('🔍 Searching for users with query:', query);
      
      // Use the correct users search endpoint
      const response = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      console.log('✅ Search response:', response.data);
      
      // The /api/users/search endpoint returns { users: [...] }
      let users = [];
      if (response.data && Array.isArray(response.data.users)) {
        users = response.data.users;
      } else if (Array.isArray(response.data)) {
        users = response.data;
      } else {
        console.warn('❌ Unexpected search response format:', response.data);
        users = [];
      }
      
      // Filter out current participants
      const currentParticipantIds = participants.map(p => p._id);
      const filteredResults = users.filter(user => 
        user && user._id && !currentParticipantIds.includes(user._id)
      );
      
      console.log('📊 Filtered users found:', filteredResults.length);
      setSearchResults(filteredResults);
      
    } catch (error) {
      console.error('Error searching users:', error.response?.data || error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchText);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  const addParticipant = async (userId) => {
    try {
      setAdding(true);
      await api.put(`/api/memories/${memoryId}/participants`, { userId });
      
      // Find the user in search results and add to participants
      const user = searchResults.find(u => u._id === userId);
      if (user) {
        setParticipants(prev => [...prev, { ...user, isCreator: false }]);
        setSearchResults(prev => prev.filter(u => u._id !== userId));
      }
      
      Alert.alert('Success', 'Participant added successfully!');
    } catch (error) {
      console.error('Error adding participant:', error);
      Alert.alert('Error', 'Failed to add participant');
    } finally {
      setAdding(false);
    }
  };

  const removeParticipant = async (userId) => {
    Alert.alert(
      'Remove Participant',
      'Are you sure you want to remove this participant from the memory?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/memories/${memoryId}/participants/${userId}`);
              setParticipants(prev => prev.filter(p => p._id !== userId));
              Alert.alert('Success', 'Participant removed successfully');
            } catch (error) {
              console.error('Error removing participant:', error);
              Alert.alert('Error', 'Failed to remove participant');
            }
          }
        }
      ]
    );
  };

  const handleParticipantPress = (participant) => {
    navigation.navigate('ProfileScreen', { userId: participant._id });
  };

  const renderParticipant = ({ item: participant }) => (
    <TouchableOpacity 
      style={styles.participantRow} 
      onPress={() => handleParticipantPress(participant)}
      activeOpacity={0.95}
    >
      <View style={styles.participantInfo}>
        <Image 
          source={{ 
            uri: getProfilePictureUrl(
              participant.profilePicture, 
              participant.username?.charAt(0) || 'U'
            )
          }} 
          style={styles.avatar} 
        />
        <View style={styles.participantDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{participant.username}</Text>
            {participant.isCreator && (
              <View style={styles.creatorBadge}>
                <Text style={styles.creatorBadgeText}>Creator</Text>
              </View>
            )}
          </View>
          {participant.fullName && participant.fullName !== participant.username && (
            <Text style={styles.fullName}>{participant.fullName}</Text>
          )}
        </View>
      </View>
      
      {/* Remove button for non-creator participants (only visible to creator) */}
      {isCreator && !participant.isCreator && (
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => removeParticipant(participant._id)}
          activeOpacity={0.8}
        >
          <Ionicons name="remove-circle-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      )}
      
      {/* Navigate arrow */}
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item: user }) => (
    <TouchableOpacity
      style={styles.searchResultRow}
      onPress={() => addParticipant(user._id)}
      disabled={adding}
      activeOpacity={0.8}
    >
      <View style={styles.participantInfo}>
        <Image 
          source={{ 
            uri: getProfilePictureUrl(
              user.profilePicture, 
              user.username?.charAt(0) || 'U'
            )
          }} 
          style={styles.avatar} 
        />
        <View style={styles.participantDetails}>
          <Text style={styles.username}>{user.username}</Text>
          {user.fullName && user.fullName !== user.username && (
            <Text style={styles.fullName}>{user.fullName}</Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => addParticipant(user._id)}
        disabled={adding}
      >
        <Ionicons name="add-circle" size={24} color="#3797EF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading participants...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {participants.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="people-outline" size={64} color="#C7C7CC" />
          </View>
          <Text style={styles.emptyTitle}>No participants yet</Text>
          <Text style={styles.emptySubtitle}>
            {isCreator 
              ? 'Add people to share this memory with them'
              : 'This memory doesn\'t have any participants yet'
            }
          </Text>
          {isCreator && (
            <TouchableOpacity 
              style={styles.addFirstButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addFirstButtonText}>Add Participants</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsText}>
              {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
            </Text>
            {memoryTitle && (
              <Text style={styles.memoryTitle} numberOfLines={1}>
                in "{memoryTitle}"
              </Text>
            )}
          </View>
          
          <FlatList
            data={participants}
            keyExtractor={(item) => item._id}
            renderItem={renderParticipant}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        </View>
      )}

      {/* Add Participants Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Participants</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users..."
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
              {searchLoading && (
                <ActivityIndicator size="small" color="#3797EF" style={styles.searchSpinner} />
              )}
            </View>
          </View>
          
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            renderItem={renderSearchResult}
            style={styles.searchResults}
            ListEmptyComponent={
              searchText ? (
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>
                    {searchLoading ? 'Searching...' : 'No users found'}
                  </Text>
                </View>
              ) : (
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>Search for users to add</Text>
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>
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
  memoryTitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 2,
  },
  listContainer: {
    paddingVertical: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F6F6F6',
    marginRight: 12,
  },
  participantDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  fullName: {
    fontSize: 14,
    color: '#8E8E93',
  },
  creatorBadge: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  creatorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  removeButton: {
    padding: 8,
    marginRight: 8,
  },
  
  // Empty State
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
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.33,
    borderBottomColor: '#E1E1E1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.33,
    borderBottomColor: '#E1E1E1',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  searchResults: {
    flex: 1,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  addButton: {
    padding: 8,
  },
  emptySearch: {
    padding: 40,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});