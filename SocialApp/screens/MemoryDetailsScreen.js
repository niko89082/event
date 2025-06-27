// screens/MemoryDetailsScreen.js - Enhanced memory details with full functionality
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Dimensions,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MemoryDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { memoryId } = route.params;

  // State
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Setup navigation header
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
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
      headerTitle: memory?.title || 'Memory',
      headerRight: () => {
        if (memory?.isOwner) {
          return (
            <TouchableOpacity
              onPress={handleMoreOptions}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
            </TouchableOpacity>
          );
        }
        return null;
      },
    });
  }, [navigation, memory]);

  useEffect(() => {
    if (memoryId) {
      fetchMemory();
    }
  }, [memoryId]);

  const fetchMemory = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(`/api/memories/${memoryId}`);
      setMemory(response.data.memory);

    } catch (error) {
      console.error('Error fetching memory:', error);
      Alert.alert('Error', 'Failed to load memory');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMoreOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit Memory', 'Delete Memory'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEditMemory();
          } else if (buttonIndex === 2) {
            handleDeleteMemory();
          }
        }
      );
    } else {
      Alert.alert(
        'Memory Options',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Memory', onPress: handleEditMemory },
          { text: 'Delete Memory', style: 'destructive', onPress: handleDeleteMemory },
        ]
      );
    }
  };

  const handleEditMemory = () => {
    // Navigate to edit screen or show edit modal
    Alert.alert('Edit Memory', 'Edit functionality coming soon!');
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
          }
        }
      ]
    );
  };

  const handleAddPhoto = () => {
    setShowAddModal(true);
  };

  const handlePickFromLibrary = async () => {
    setShowAddModal(false);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const handleTakePhoto = async () => {
    setShowAddModal(false);
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadPhoto = async (photo) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('photo', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'memory-photo.jpg',
      });

      await api.post(`/api/memories/${memoryId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Photo added to memory!');
      fetchMemory(); // Refresh memory data

    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoPress = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
  };

  const renderParticipant = ({ item: participant }) => (
    <TouchableOpacity
      style={styles.participantItem}
      onPress={() => navigation.navigate('ProfileScreen', { userId: participant._id })}
      activeOpacity={0.8}
    >
      <View style={styles.participantAvatar}>
        {participant.profilePicture ? (
          <Image
            source={{ uri: `${API_BASE_URL}${participant.profilePicture}` }}
            style={styles.participantAvatarImage}
          />
        ) : (
          <View style={styles.participantAvatarPlaceholder}>
            <Text style={styles.participantAvatarText}>
              {participant.username?.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.participantName}>{participant.username}</Text>
      {participant._id === memory?.createdBy._id && (
        <View style={styles.creatorBadge}>
          <Text style={styles.creatorBadgeText}>Creator</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderPhoto = ({ item: photo }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => handlePhotoPress(photo)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: `${API_BASE_URL}${photo.path}` }}
        style={styles.photoImage}
        resizeMode="cover"
      />
      <View style={styles.photoOverlay}>
        <Text style={styles.photoUser}>{photo.user.username}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading memory...</Text>
      </SafeAreaView>
    );
  }

  if (!memory) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="library-outline" size={80} color="#C7C7CC" />
        <Text style={styles.errorTitle}>Memory not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMemory(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
      >
        {/* Memory Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{memory.title}</Text>
          {memory.description && (
            <Text style={styles.description}>{memory.description}</Text>
          )}
          
          <View style={styles.metadata}>
            <View style={styles.metadataItem}>
              <Ionicons name="people" size={16} color="#8E8E93" />
              <Text style={styles.metadataText}>
                {memory.participantCount} {memory.participantCount === 1 ? 'person' : 'people'}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Ionicons name="camera" size={16} color="#8E8E93" />
              <Text style={styles.metadataText}>
                {memory.photoCount} {memory.photoCount === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Ionicons name="time" size={16} color="#8E8E93" />
              <Text style={styles.metadataText}>{memory.timeAgo}</Text>
            </View>
          </View>
        </View>

        {/* Participants Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <FlatList
            data={memory.participants}
            keyExtractor={(item) => item._id}
            renderItem={renderParticipant}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.participantsList}
          />
        </View>

        {/* Photos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photos</Text>
            {memory.canAddPhotos && (
              <TouchableOpacity
                onPress={handleAddPhoto}
                style={styles.addPhotoButton}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#3797EF" />
                ) : (
                  <Ionicons name="add" size={20} color="#3797EF" />
                )}
              </TouchableOpacity>
            )}
          </View>

          {memory.photos && memory.photos.length > 0 ? (
            <FlatList
              data={memory.photos}
              keyExtractor={(item) => item._id}
              renderItem={renderPhoto}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.photoRow}
            />
          ) : (
            <View style={styles.emptyPhotos}>
              <Ionicons name="camera-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyPhotosText}>No photos yet</Text>
              {memory.canAddPhotos && (
                <TouchableOpacity
                  onPress={handleAddPhoto}
                  style={styles.firstPhotoButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.firstPhotoButtonText}>Add the first photo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Photo Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addPhotoModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Photo</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.photoOptions}>
              <TouchableOpacity
                style={styles.photoOption}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <View style={styles.photoOptionIcon}>
                  <Ionicons name="camera" size={24} color="#3797EF" />
                </View>
                <Text style={styles.photoOptionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoOption}
                onPress={handlePickFromLibrary}
                activeOpacity={0.8}
              >
                <View style={styles.photoOptionIcon}>
                  <Ionicons name="images" size={24} color="#3797EF" />
                </View>
                <Text style={styles.photoOptionText}>Choose from Library</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setShowPhotoModal(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          
          {selectedPhoto && (
            <Image
              source={{ uri: `${API_BASE_URL}${selectedPhoto.path}` }}
              style={styles.fullScreenPhoto}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  goBackButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  goBackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginBottom: 16,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  section: {
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  addPhotoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantsList: {
    gap: 12,
  },
  participantItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  participantAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  participantAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  participantAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  creatorBadge: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  creatorBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photoRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoItem: {
    width: (SCREEN_WIDTH - 52) / 2, // Account for padding and gap
    height: (SCREEN_WIDTH - 52) / 2,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
  },
  photoUser: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyPhotosText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
    marginBottom: 16,
  },
  firstPhotoButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  firstPhotoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  addPhotoModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  photoOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  photoOption: {
    alignItems: 'center',
    minWidth: 120,
  },
  photoOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoOptionText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    padding: 8,
  },
  fullScreenPhoto: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
});