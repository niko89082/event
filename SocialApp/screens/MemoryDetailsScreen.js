// screens/MemoryDetailsScreen.js - FIXED: Safe navigation parameter handling
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function MemoryDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  
  // ✅ SAFE: Handle undefined route params
  const routeParams = route?.params || {};
  const { memoryId, memory: passedMemory } = routeParams;
  
  // State
  const [memory, setMemory] = useState(passedMemory || null);
  const [loading, setLoading] = useState(!passedMemory);
  const [error, setError] = useState(null);

  // ✅ VALIDATION: Check if we have a memoryId
  useEffect(() => {
    if (!memoryId) {
      console.error('❌ No memoryId provided to MemoryDetailsScreen');
      Alert.alert(
        'Error',
        'Memory ID is missing. Please try again.',
        [
          {
            text: 'Go Back',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }

    // Only fetch if we don't have memory data already
    if (!memory) {
      fetchMemoryDetails();
    }
  }, [memoryId, memory]);

  // ✅ NAVIGATION: Set header options safely
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: memory?.title || 'Memory Details',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleMenuPress}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, memory]);

  const fetchMemoryDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching memory details for ID:', memoryId);
      
      const response = await api.get(`/api/memories/${memoryId}`);
      setMemory(response.data.memory);
      
      console.log('✅ Memory details loaded successfully');
    } catch (error) {
      console.error('❌ Error fetching memory details:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to load memory details';
      setError(errorMessage);
      
      if (error.response?.status === 404) {
        Alert.alert(
          'Memory Not Found',
          'This memory no longer exists or you don\'t have access to it.',
          [
            {
              text: 'Go Back',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else if (error.response?.status === 403) {
        Alert.alert(
          'Access Denied',
          'You don\'t have permission to view this memory.',
          [
            {
              text: 'Go Back',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMenuPress = () => {
    if (!memory || !currentUser) return;

    const isCreator = memory.creator?._id === currentUser._id;
    const isParticipant = memory.participants?.some(p => p._id === currentUser._id);

    const options = [];

    if (isCreator) {
      options.push('Edit Memory');
      options.push('Add Photos');
      options.push('Manage Participants');
      options.push('Delete Memory');
    } else if (isParticipant) {
      options.push('Add Photos');
      options.push('Leave Memory');
    }

    options.push('Cancel');

    Alert.alert(
      'Memory Options',
      'Choose an action',
      options.map((option, index) => ({
        text: option,
        style: option === 'Delete Memory' || option === 'Leave Memory' ? 'destructive' : 'default',
        onPress: () => handleMenuOption(option),
      }))
    );
  };

  const handleMenuOption = (option) => {
    switch (option) {
      case 'Edit Memory':
        // Navigate to edit screen
        break;
      case 'Add Photos':
        // Navigate to photo picker
        break;
      case 'Manage Participants':
        // Navigate to participant management
        break;
      case 'Delete Memory':
        handleDeleteMemory();
        break;
      case 'Leave Memory':
        handleLeaveMemory();
        break;
    }
  };

  const handleDeleteMemory = () => {
    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/memories/${memoryId}`);
              Alert.alert('Success', 'Memory deleted successfully');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete memory');
            }
          },
        },
      ]
    );
  };

  const handleLeaveMemory = () => {
    Alert.alert(
      'Leave Memory',
      'Are you sure you want to leave this memory?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/memories/${memoryId}/participants/${currentUser._id}`);
              Alert.alert('Success', 'You have left the memory');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to leave memory');
            }
          },
        },
      ]
    );
  };

  const renderPhoto = ({ item }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => {
        // Navigate to photo viewer
        console.log('Photo pressed:', item._id);
      }}
      activeOpacity={0.8}
    >
      <Image
        source={{
          uri: item.fullUrl || `http://${API_BASE_URL}:3000${item.url}`
        }}
        style={styles.photoImage}
        resizeMode="cover"
      />
      {item.caption && (
        <View style={styles.photoCaptionOverlay}>
          <Text style={styles.photoCaption} numberOfLines={2}>
            {item.caption}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderParticipant = ({ item }) => (
    <TouchableOpacity style={styles.participantItem} activeOpacity={0.8}>
      <Image
        source={{
          uri: item.profilePicture
            ? `http://${API_BASE_URL}:3000${item.profilePicture}`
            : 'https://placehold.co/40x40/C7C7CC/FFFFFF?text=' + 
              (item.username?.charAt(0).toUpperCase() || '?')
        }}
        style={styles.participantAvatar}
      />
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{item.username}</Text>
        {item.fullName && (
          <Text style={styles.participantFullName}>{item.fullName}</Text>
        )}
      </View>
      {memory.creator?._id === item._id && (
        <View style={styles.creatorBadge}>
          <Text style={styles.creatorBadgeText}>Creator</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ✅ LOADING STATE
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading memory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ ERROR STATE
  if (error || !memory) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Memory</Text>
          <Text style={styles.errorMessage}>
            {error || 'Memory not found or invalid memory ID'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              if (memoryId) {
                fetchMemoryDetails();
              } else {
                navigation.goBack();
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>
              {memoryId ? 'Try Again' : 'Go Back'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ SUCCESS STATE
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Memory Header */}
        <View style={styles.headerSection}>
          <Text style={styles.memoryTitle}>{memory.title}</Text>
          {memory.description && (
            <Text style={styles.memoryDescription}>{memory.description}</Text>
          )}
          <View style={styles.memoryMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {new Date(memory.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {(memory.participants?.length || 0) + 1} participants
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="lock-closed-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>Private</Text>
            </View>
          </View>
        </View>

        {/* Photos Section */}
        {memory.photos && memory.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({memory.photos.length})</Text>
            <FlatList
              data={memory.photos}
              renderItem={renderPhoto}
              keyExtractor={(item) => item._id}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.photosGrid}
            />
          </View>
        )}

        {/* Participants Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Participants ({(memory.participants?.length || 0) + 1})
          </Text>
          
          {/* Creator */}
          {memory.creator && (
            <View style={styles.participantsList}>
              {renderParticipant({ item: memory.creator })}
            </View>
          )}
          
          {/* Other Participants */}
          {memory.participants && memory.participants.length > 0 && (
            <FlatList
              data={memory.participants}
              renderItem={renderParticipant}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Add Photos Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={() => {
              // Navigate to photo picker
              console.log('Add photos pressed');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={24} color="#3797EF" />
            <Text style={styles.addPhotoButtonText}>Add Photos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSection: {
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  memoryTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  memoryDescription: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 24,
    marginBottom: 16,
  },
  memoryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  photosGrid: {
    gap: 8,
  },
  photoItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  photoCaptionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
  },
  photoCaption: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  participantsList: {
    marginBottom: 16,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F6F6F6',
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  participantFullName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  creatorBadge: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionSection: {
    padding: 20,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3797EF',
    gap: 8,
  },
  addPhotoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
});