// screens/CreateMemoryScreen.js - New memory creation screen
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
  FlatList, Image, Alert, ActivityIndicator, ScrollView, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const defaultPfp = require('../assets/default-pfp.png');

export default function CreateMemoryScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  
  // User search state
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

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
      headerTitle: `Create Memory (${currentStep}/${totalSteps})`,
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: currentStep < totalSteps ? () => (
        <TouchableOpacity
          onPress={handleNext}
          style={styles.headerButton}
          activeOpacity={0.7}
          disabled={!canProceed()}
        >
          <Text style={[styles.nextButton, !canProceed() && styles.disabledButton]}>
            Next
          </Text>
        </TouchableOpacity>
      ) : () => (
        <TouchableOpacity
          onPress={handleCreateMemory}
          style={styles.headerButton}
          activeOpacity={0.7}
          disabled={creating || !title.trim()}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.nextButton, (!title.trim() || creating) && styles.disabledButton]}>
              Create
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, currentStep, title, selectedUsers, creating]);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      if (currentStep === 1) {
        // Moving to user selection step
        fetchUsers();
      }
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return title.trim().length > 0;
      case 2:
        return true; // Can proceed without selecting users
      case 3:
        return true; // Can proceed without photos
      default:
        return false;
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/search', {
        params: { q: searchQuery, limit: 50 }
      });
      
      // Filter out current user and sort by following status
      const filtered = response.data.users?.filter(user => user._id !== currentUser._id) || [];
      setUsers(filtered);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        if (prev.length >= 14) { // Max 14 because creator is automatically included
          Alert.alert('Limit Reached', 'You can only add up to 15 people (including yourself) to a memory.');
          return prev;
        }
        return [...prev, user];
      }
    });
  };

  const handlePhotoPicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled) {
        setSelectedPhotos(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Error picking photos:', error);
      Alert.alert('Error', 'Failed to select photos');
    }
  };

  const removePhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateMemory = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your memory');
      return;
    }

    try {
      setCreating(true);

      // Create memory first
      const memoryData = {
        title: title.trim(),
        description: description.trim(),
        participantIds: selectedUsers.map(u => u._id),
        isPrivate
      };

      const response = await api.post('/api/memories', memoryData);
      const memory = response.data.memory;

      // Upload photos if any
      if (selectedPhotos.length > 0) {
        for (const photo of selectedPhotos) {
          try {
            const formData = new FormData();
            formData.append('photo', {
              uri: photo.uri,
              type: 'image/jpeg',
              name: 'memory-photo.jpg'
            });

            await api.post(`/api/memories/${memory._id}/photos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (photoError) {
            console.error('Error uploading photo:', photoError);
          }
        }
      }

      Alert.alert(
        'Success! 🎉',
        'Your memory has been created successfully!',
        [
          {
            text: 'View Memory',
            onPress: () => {
              navigation.navigate('MemoryDetailsScreen', { memoryId: memory._id });
            }
          },
          {
            text: 'Create Another',
            onPress: () => {
              // Reset form and go back to step 1
              setTitle('');
              setDescription('');
              setSelectedUsers([]);
              setSelectedPhotos([]);
              setIsPrivate(false);
              setCurrentStep(1);
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error creating memory:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create memory');
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderBasicInfoStep();
      case 2:
        return renderUserSelectionStep();
      case 3:
        return renderPhotoSelectionStep();
      case 4:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderBasicInfoStep = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Memory Details</Text>
        <Text style={styles.stepSubtitle}>Give your memory a title and description</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Enter memory title..."
          placeholderTextColor="#8E8E93"
          maxLength={100}
        />
        <Text style={styles.charCount}>{title.length}/100</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this memory about?"
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </View>

      <View style={styles.formGroup}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.label}>Private Memory</Text>
            <Text style={styles.switchDescription}>Only participants can see this memory</Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: '#E5E5E7', true: '#3797EF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderUserSelectionStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Add People</Text>
        <Text style={styles.stepSubtitle}>
          Choose up to 15 people to share this memory with (optional)
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (text.length > 2) {
              fetchUsers();
            }
          }}
          placeholder="Search for people..."
          placeholderTextColor="#8E8E93"
        />
      </View>

      {selectedUsers.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedTitle}>Selected ({selectedUsers.length}/14)</Text>
          <FlatList
            data={selectedUsers}
            horizontal
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.selectedUser}
                onPress={() => toggleUserSelection(item)}
              >
                <Image
                  source={{
                    uri: item.profilePicture
                      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
                      : Image.resolveAssetSource(defaultPfp).uri
                  }}
                  style={styles.selectedUserAvatar}
                />
                <View style={styles.removeIcon}>
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </View>
                <Text style={styles.selectedUserName} numberOfLines={1}>
                  {item.username}
                </Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedList}
          />
        </View>
      )}

      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const isSelected = selectedUsers.some(u => u._id === item._id);
          const avatar = item.profilePicture
            ? `http://${API_BASE_URL}:3000${item.profilePicture}`
            : Image.resolveAssetSource(defaultPfp).uri;

          return (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => toggleUserSelection(item)}
              activeOpacity={0.7}
            >
              <View style={styles.userInfo}>
                <Image source={{ uri: avatar }} style={styles.userAvatar} />
                <View style={styles.userDetails}>
                  <Text style={styles.username}>{item.username}</Text>
                  <Text style={styles.fullName}>{item.fullName || item.email}</Text>
                </View>
              </View>
              <View style={[styles.selectionCircle, isSelected && styles.selectedCircle]}>
                {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
          );
        }}
        refreshing={loading}
        onRefresh={fetchUsers}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>Search for people</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.length > 0 ? 'No users found' : 'Type to search for friends to add'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderPhotoSelectionStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Add Photos</Text>
        <Text style={styles.stepSubtitle}>Add some photos to start your memory (optional)</Text>
      </View>

      <TouchableOpacity style={styles.photoButton} onPress={handlePhotoPicker}>
        <Ionicons name="camera-outline" size={32} color="#3797EF" />
        <Text style={styles.photoButtonText}>Select Photos</Text>
        <Text style={styles.photoButtonSubtext}>Choose up to 10 photos</Text>
      </TouchableOpacity>

      {selectedPhotos.length > 0 && (
        <View style={styles.photoGrid}>
          <Text style={styles.selectedTitle}>Selected Photos ({selectedPhotos.length})</Text>
          <FlatList
            data={selectedPhotos}
            numColumns={3}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.photoItem}>
                <Image source={{ uri: item.uri }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Review Memory</Text>
        <Text style={styles.stepSubtitle}>Review your memory before creating</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Title</Text>
        <Text style={styles.reviewValue}>{title}</Text>
      </View>

      {description.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Description</Text>
          <Text style={styles.reviewValue}>{description}</Text>
        </View>
      )}

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Privacy</Text>
        <Text style={styles.reviewValue}>{isPrivate ? 'Private' : 'Public'}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Participants ({selectedUsers.length + 1})</Text>
        <View style={styles.participantsList}>
          <Text style={styles.participantName}>You (creator)</Text>
          {selectedUsers.map(user => (
            <Text key={user._id} style={styles.participantName}>
              {user.username}
            </Text>
          ))}
        </View>
      </View>

      {selectedPhotos.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Photos ({selectedPhotos.length})</Text>
          <FlatList
            data={selectedPhotos.slice(0, 6)} // Show first 6
            numColumns={3}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <Image source={{ uri: item.uri }} style={styles.reviewPhoto} />
            )}
            scrollEnabled={false}
          />
          {selectedPhotos.length > 6 && (
            <Text style={styles.morePhotos}>+{selectedPhotos.length - 6} more photos</Text>
          )}
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index < currentStep && styles.progressDotActive
            ]}
          />
        ))}
      </View>

      {renderStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  nextButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  disabledButton: {
    color: '#C7C7CC',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E7',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#3797EF',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepHeader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
  },
  switchDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  selectedSection: {
    marginBottom: 16,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  selectedList: {
    paddingHorizontal: 4,
  },
  selectedUser: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 64,
  },
  selectedUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  removeIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedUserName: {
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
    textAlign: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  fullName: {
    fontSize: 14,
    color: '#8E8E93',
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  photoButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E7',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  photoButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3797EF',
    marginTop: 8,
  },
  photoButtonSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  photoGrid: {
    flex: 1,
  },
  photoItem: {
    flex: 1,
    margin: 2,
    aspectRatio: 1,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
  },
  participantsList: {
    marginTop: 4,
  },
  participantName: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  reviewPhoto: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 8,
  },
  morePhotos: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
});