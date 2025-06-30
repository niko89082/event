// screens/CreateMemoryScreen.js - Combined: Working user search + No privacy toggle
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
  }, [navigation, currentStep, creating, title, canProceed]);

  // User search with proper error handling
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const searchUsers = async () => {
  try {
    setSearching(true);
    console.log('🔍 Searching for users with query:', searchQuery.trim());
    
    // Use the correct users search endpoint
    const response = await api.get(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
    console.log('✅ Search response from /api/users/search:', response.data);
    
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
    
    // Filter out current user and already selected users
    const excludeIds = [currentUser._id, ...selectedUsers.map(u => u._id)];
    const filteredUsers = users.filter(user => 
      user && user._id && !excludeIds.includes(user._id)
    );
    
    console.log('📊 Filtered users found:', filteredUsers.length);
    setSearchResults(filteredUsers);
    
  } catch (error) {
    console.error('❌ Error searching users:', error.response?.data || error);
    setSearchResults([]);
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
        // Be more conservative - limit to 13 since creator makes 14 total
        if (prev.length >= 13) {
          Alert.alert('Limit Reached', 'You can add up to 13 people to a memory (including yourself makes 14 total)');
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
        selectionLimit: Math.max(1, 10 - selectedPhotos.length),
      });

      if (!result.canceled) {
        setSelectedPhotos(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Photo picker error:', error);
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
      console.log('🚀 Creating memory...');

      // Validate participant count before sending
      const totalParticipants = selectedUsers.length + 1; // +1 for creator
      if (totalParticipants > 15) {
        Alert.alert('Too Many Participants', `You can only have up to 15 total participants. You currently have ${totalParticipants}.`);
        setCreating(false);
        return;
      }

      const memoryData = {
        title: title.trim(),
        description: description.trim(),
        participantIds: selectedUsers.map(u => u._id),
      };

      console.log('📡 API Request Data:', memoryData);
      console.log('🔍 Total participants will be:', totalParticipants, '(Creator + ' + selectedUsers.length + ' selected users)');

      const response = await api.post('/api/memories', memoryData);
      const memory = response.data.memory;

      console.log('✅ Memory created:', memory._id);

      // Upload photos if any
      if (selectedPhotos.length > 0) {
        console.log(`📸 Uploading ${selectedPhotos.length} photos...`);
        
        for (let i = 0; i < selectedPhotos.length; i++) {
          const photo = selectedPhotos[i];
          
          try {
            const formData = new FormData();
            formData.append('photo', {
              uri: photo.uri,
              type: 'image/jpeg',
              name: `memory-photo-${i}.jpg`,
            });

            await api.post(`/api/memories/${memory._id}/photos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            
            console.log(`✅ Photo ${i + 1} uploaded`);
          } catch (photoError) {
            console.error(`❌ Failed to upload photo ${i + 1}:`, photoError);
          }
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
      console.error('❌ Error creating memory:', error);
      console.log('❌ API Response Error:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 'Failed to create memory';
      Alert.alert('Error', errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((step) => (
        <View
          key={step}
          style={[
            styles.progressDot,
            step < currentStep && styles.progressDotCompleted,
            step === currentStep && styles.progressDotActive,
          ]}
        />
      ))}
    </View>
  );

  const renderBasicInfoStep = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <KeyboardAvoidingView
        style={styles.stepContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.stepHeader}>
          <Ionicons name="library" size={48} color="#3797EF" />
          <Text style={styles.stepTitle}>Create a Memory</Text>
          <Text style={styles.stepSubtitle}>
            Memories are private collections that only you and people you add can see
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

        <View style={styles.privacyInfo}>
          <View style={styles.privacyIcon}>
            <Ionicons name="lock-closed" size={20} color="#FF9500" />
          </View>
          <View style={styles.privacyText}>
            <Text style={styles.privacyTitle}>Private by Design</Text>
            <Text style={styles.privacyDescription}>
              Only you and people you add can see this memory
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScrollView>
  );

  const renderUserSelectionStep = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Ionicons name="people" size={48} color="#3797EF" />
          <Text style={styles.stepTitle}>Add People</Text>
          <Text style={styles.stepSubtitle}>
            Add up to 13 friends to share this memory with (you can skip this step)
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
              Added ({selectedUsers.length}/13)
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedUsersContainer}
            >
              {selectedUsers.map((user) => (
                <View key={user._id} style={styles.selectedUser}>
                  <TouchableOpacity
                    onPress={() => removeUser(user._id)}
                    style={styles.removeUserButton}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Image
                    source={{
                      uri: user.profilePicture
                        ? `http://${API_BASE_URL}:3000${user.profilePicture}`
                        : 'https://placehold.co/48x48/C7C7CC/FFFFFF?text=' + 
                          (user.username?.charAt(0).toUpperCase() || '?')
                    }}
                    style={styles.selectedUserImage}
                  />
                  <Text style={styles.selectedUserName} numberOfLines={1}>
                    {user.username}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView style={styles.searchResultsContainer} showsVerticalScrollIndicator={false}>
          {searchResults.map((user) => {
            const isSelected = selectedUsers.some(u => u._id === user._id);
            
            return (
              <TouchableOpacity
                key={user._id}
                style={styles.userItem}
                onPress={() => toggleUserSelection(user)}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri: user.profilePicture
                      ? `http://${API_BASE_URL}:3000${user.profilePicture}`
                      : 'https://placehold.co/40x40/C7C7CC/FFFFFF?text=' + 
                        (user.username?.charAt(0).toUpperCase() || '?')
                  }}
                  style={styles.userAvatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.username}</Text>
                  {(user.displayName || user.fullName) && (
                    <Text style={styles.userDisplayName}>{user.displayName || user.fullName}</Text>
                  )}
                </View>
                {!isSelected && (
                  <View style={styles.addButton}>
                    <Ionicons name="add" size={20} color="#3797EF" />
                  </View>
                )}
                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {searchQuery.trim() && searchResults.length === 0 && !searching && (
            <View style={styles.emptySearchResults}>
              <Ionicons name="search-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptySearchText}>No users found</Text>
            </View>
          )}

          {!searchQuery.trim() && (
            <View style={styles.emptySearchResults}>
              <Ionicons name="search-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptySearchText}>Search for friends to add</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ScrollView>
  );

  const renderPhotoSelectionStep = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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
          <View style={styles.selectedPhotosSection}>
            <Text style={styles.selectedTitle}>
              Selected Photos ({selectedPhotos.length}/10)
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedPhotosContainer}
            >
              {selectedPhotos.map((photo, index) => (
                <View key={index} style={styles.selectedPhotoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.selectedPhotoImage} />
                  <TouchableOpacity
                    style={styles.photoRemoveButton}
                    onPress={() => removePhoto(index)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderReviewStep = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.stepContainer}>
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
              <Ionicons name="lock-closed" size={16} color="#FF9500" />
              <Text style={styles.reviewValue}>Private</Text>
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
                        ? `http://${API_BASE_URL}:3000${user.profilePicture}`
                        : 'https://placehold.co/24x24/C7C7CC/FFFFFF?text=' + 
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
                {selectedPhotos.length} {selectedPhotos.length === 1 ? 'photo' : 'photos'}
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.reviewPhotosScroll}
              >
                {selectedPhotos.slice(0, 5).map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo.uri }}
                    style={styles.reviewPhotoPreview}
                  />
                ))}
                {selectedPhotos.length > 5 && (
                  <View style={styles.morePhotos}>
                    <Text style={styles.morePhotosText}>+{selectedPhotos.length - 5}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>
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
        return renderBasicInfoStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {renderProgressIndicator()}
      {renderStep()}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
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
    padding: 20,
    minHeight: 400,
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

  // Basic Info Step
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
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  privacyIcon: {
    marginRight: 12,
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // User Selection Step
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
  selectedUsersContainer: {
    paddingHorizontal: 4,
  },
  selectedUser: {
    alignItems: 'center',
    marginRight: 16,
    width: 64,
  },
  removeUserButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  selectedUserImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F6F6F6',
  },
  selectedUserName: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  searchResultsContainer: {
    maxHeight: 300,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F6F6F6',
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
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3797EF',
  },
  selectedIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySearchResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },

  // Photo Selection Step
  photoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#E1E1E1',
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
  selectedPhotosSection: {
    flex: 1,
  },
  selectedPhotosContainer: {
    paddingRight: 20,
  },
  selectedPhotoItem: {
    position: 'relative',
    marginRight: 12,
  },
  selectedPhotoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Review Step
  reviewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
  },
  reviewSection: {
    marginBottom: 20,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  reviewPhotosScroll: {
    marginTop: 8,
  },
  reviewPhotoPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F6F6F6',
  },
  morePhotos: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});