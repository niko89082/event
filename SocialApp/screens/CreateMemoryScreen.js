// screens/CreateMemoryScreen.js - Enhanced create memory with 4-step process
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function CreateMemoryScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  
  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
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
  }, [currentStep, title, selectedUsers, creating]);

  // Search for users with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length > 1) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchUsers = async () => {
    try {
      setSearching(true);
      const response = await api.get('/api/users/search', {
        params: { q: searchQuery, limit: 20 }
      });
      
      // Filter out current user and already selected users
      const results = response.data.filter(user => 
        user._id !== currentUser._id &&
        !selectedUsers.some(selected => selected._id === user._id)
      );
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return title.trim().length > 0;
      case 2:
        return true; // Users are optional
      case 3:
        return true; // Photos are optional
      case 4:
        return title.trim().length > 0;
      default:
        return false;
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      navigation.goBack();
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        if (prev.length >= 14) {
          Alert.alert('Limit Reached', 'You can add up to 14 people to a memory');
          return prev;
        }
        return [...prev, user];
      }
    });
  };

  const removeUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u._id !== userId));
  };

  const handlePhotoPicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10 - selectedPhotos.length,
      });

      if (!result.canceled) {
        setSelectedPhotos(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select photos');
    }
  };

  const removePhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateMemory = async () => {
    if (!title.trim() || creating) return;

    try {
      setCreating(true);

      // Create memory
      const memoryData = {
        title: title.trim(),
        description: description.trim(),
        participantIds: selectedUsers.map(u => u._id),
        isPrivate,
      };

      const response = await api.post('/api/memories', memoryData);
      const memory = response.data.memory;

      // Upload photos if any
      if (selectedPhotos.length > 0) {
        for (const photo of selectedPhotos) {
          const formData = new FormData();
          formData.append('photo', {
            uri: photo.uri,
            type: 'image/jpeg',
            name: 'memory-photo.jpg',
          });

          await api.post(`/api/memories/${memory._id}/photos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      Alert.alert(
        'Memory Created! 🎉',
        'Your memory has been created successfully!',
        [
          {
            text: 'View Memory',
            onPress: () => {
              navigation.replace('MemoryDetailsScreen', { memoryId: memory._id });
            }
          },
          {
            text: 'Go to Profile',
            onPress: () => {
              navigation.navigate('ProfileScreen');
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

  const renderBasicInfoStep = () => (
    <KeyboardAvoidingView
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.stepHeader}>
          <Ionicons name="library" size={48} color="#3797EF" />
          <Text style={styles.stepTitle}>Create a Memory</Text>
          <Text style={styles.stepSubtitle}>
            Give your memory a title and description to help people remember this special moment
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Memory Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Beach Trip 2024, Birthday Party..."
            placeholderTextColor="#8E8E93"
            maxLength={50}
            autoFocus
          />
          <Text style={styles.charCount}>{title.length}/50</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What made this moment special?"
            placeholderTextColor="#8E8E93"
            multiline
            maxLength={250}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/250</Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Private Memory</Text>
              <Text style={styles.switchDescription}>
                Only you and people you add can see this memory
              </Text>
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
    </KeyboardAvoidingView>
  );

  const renderUserSelectionStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="people" size={48} color="#3797EF" />
        <Text style={styles.stepTitle}>Add People</Text>
        <Text style={styles.stepSubtitle}>
          Add up to 14 friends to share this memory with (you can skip this step)
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for friends..."
          placeholderTextColor="#8E8E93"
        />
        {searching && (
          <ActivityIndicator size="small" color="#8E8E93" style={styles.searchSpinner} />
        )}
      </View>

      {selectedUsers.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedTitle}>
            Added ({selectedUsers.length}/14)
          </Text>
          <FlatList
            data={selectedUsers}
            horizontal
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.selectedUser}>
                <TouchableOpacity
                  onPress={() => removeUser(item._id)}
                  style={styles.removeUserButton}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Image
                  source={{
                    uri: item.profilePicture
                      ? `${API_BASE_URL}${item.profilePicture}`
                      : 'https://via.placeholder.com/60x60/C7C7CC/FFFFFF?text=' + 
                        item.username.charAt(0).toUpperCase()
                  }}
                  style={styles.selectedUserAvatar}
                />
                <Text style={styles.selectedUserName} numberOfLines={1}>
                  {item.username}
                </Text>
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() => toggleUserSelection(item)}
            activeOpacity={0.7}
          >
            <Image
              source={{
                uri: item.profilePicture
                  ? `${API_BASE_URL}${item.profilePicture}`
                  : 'https://via.placeholder.com/44x44/C7C7CC/FFFFFF?text=' + 
                    item.username.charAt(0).toUpperCase()
              }}
              style={styles.userAvatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.username}</Text>
              {item.displayName && (
                <Text style={styles.userDisplayName}>{item.displayName}</Text>
              )}
            </View>
            <Ionicons name="add-circle-outline" size={24} color="#3797EF" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyUsers}>
            <Ionicons name="people-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyUsersText}>
              {searchQuery.length > 1 ? 'No users found' : 'Search for friends to add'}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderPhotoSelectionStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="camera" size={48} color="#3797EF" />
        <Text style={styles.stepTitle}>Add Photos</Text>
        <Text style={styles.stepSubtitle}>
          Add some photos to start your memory (you can add more later)
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.photoButton} 
        onPress={handlePhotoPicker}
        activeOpacity={0.8}
      >
        <Ionicons name="images-outline" size={32} color="#3797EF" />
        <Text style={styles.photoButtonText}>Select Photos</Text>
        <Text style={styles.photoButtonSubtext}>Choose up to 10 photos</Text>
      </TouchableOpacity>

      {selectedPhotos.length > 0 && (
        <View style={styles.photoGrid}>
          <Text style={styles.selectedTitle}>
            Selected Photos ({selectedPhotos.length}/10)
          </Text>
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
                  <Ionicons name="close" size={14} color="#FFFFFF" />
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
        <Ionicons name="checkmark-circle" size={48} color="#34C759" />
        <Text style={styles.stepTitle}>Review Memory</Text>
        <Text style={styles.stepSubtitle}>
          Review your memory details before creating
        </Text>
      </View>

      <View style={styles.reviewCard}>
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
          <View style={styles.privacyIndicator}>
            <Ionicons 
              name={isPrivate ? "lock-closed" : "globe"} 
              size={16} 
              color={isPrivate ? "#FF9500" : "#34C759"} 
            />
            <Text style={styles.reviewValue}>
              {isPrivate ? 'Private' : 'Participants only'}
            </Text>
          </View>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>People</Text>
          <Text style={styles.reviewValue}>
            You + {selectedUsers.length} {selectedUsers.length === 1 ? 'person' : 'people'}
          </Text>
          {selectedUsers.length > 0 && (
            <View style={styles.selectedUsersPreview}>
              {selectedUsers.slice(0, 5).map((user, index) => (
                <Image
                  key={user._id}
                  source={{
                    uri: user.profilePicture
                      ? `${API_BASE_URL}${user.profilePicture}`
                      : 'https://via.placeholder.com/24x24/C7C7CC/FFFFFF?text=' + 
                        user.username.charAt(0).toUpperCase()
                  }}
                  style={[styles.previewAvatar, { marginLeft: index > 0 ? -8 : 0 }]}
                />
              ))}
              {selectedUsers.length > 5 && (
                <View style={[styles.previewAvatar, styles.moreUsers]}>
                  <Text style={styles.moreUsersText}>+{selectedUsers.length - 5}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {selectedPhotos.length > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Photos</Text>
            <Text style={styles.reviewValue}>
              {selectedPhotos.length} {selectedPhotos.length === 1 ? 'photo' : 'photos'} selected
            </Text>
            <View style={styles.photosPreview}>
              {selectedPhotos.slice(0, 4).map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo.uri }}
                  style={styles.previewPhoto}
                />
              ))}
              {selectedPhotos.length > 4 && (
                <View style={[styles.previewPhoto, styles.morePhotos]}>
                  <Text style={styles.morePhotosText}>+{selectedPhotos.length - 4}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <View style={styles.createNote}>
        <Ionicons name="information-circle-outline" size={16} color="#8E8E93" />
        <Text style={styles.createNoteText}>
          Once created, all participants can add photos to this memory
        </Text>
      </View>
    </ScrollView>
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.progressDot,
              step <= currentStep && styles.progressDotActive,
              step < currentStep && styles.progressDotCompleted
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
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
  },
  progressDotActive: {
    backgroundColor: '#3797EF',
  },
  progressDotCompleted: {
    backgroundColor: '#34C759',
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
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
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginRight: 16,
  },
  switchDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
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
  selectedSection: {
    marginBottom: 20,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  selectedUser: {
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  removeUserButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  selectedUserAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
  },
  selectedUserName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
    maxWidth: 60,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  userDisplayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  emptyUsers: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyUsersText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
    textAlign: 'center',
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 32,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  photoButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3797EF',
    marginTop: 12,
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
    margin: 4,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  reviewSection: {
    marginBottom: 16,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
  },
  reviewValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedUsersPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  previewAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreUsers: {
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreUsersText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photosPreview: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  previewPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  morePhotos: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  createNoteText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
    lineHeight: 20,
  },
});