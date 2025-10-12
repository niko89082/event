import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function EditProfileScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [newAsset, setNewAsset] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/api/profile');
      setDisplayName(data.username || '');
      setBio(data.bio || '');
      if (data.profilePicture) {
        setAvatarUri(
          `http://${API_BASE_URL}:3000${
            data.profilePicture.startsWith('/') ? '' : '/'
          }${data.profilePicture}`,
        );
      }
    } catch (e) {
      console.error('EditProfile fetch:', e.response?.data || e);
      Alert.alert('Error', 'Could not load profile');
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      // Note: expo-image-picker doesn't support circular crop natively
      // The aspect ratio of 1:1 creates a square crop that will be displayed as circular
    });
    if (!res.canceled) {
      setNewAsset(res.assets[0]);
      setAvatarUri(res.assets[0].uri);
    }
  };

  const uploadAvatar = async () => {
    if (!newAsset) return null;
    const fd = new FormData();
    fd.append('profilePicture', {
      uri: newAsset.uri,
      name: 'avatar.jpg',
      type: newAsset.type ?? 'image/jpeg',
    });
    const up = await api.post('/api/profile/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return up.data.profilePicture;
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    setLoading(true);
    try {
      let avatarPath = null;
      if (newAsset) avatarPath = await uploadAvatar();

      await api.put('/api/profile', {
        bio,
        displayName: displayName.trim(),
        ...(avatarPath ? { profilePicture: avatarPath } : {}),
      });

      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (e) {
      console.error('EditProfile save:', e.response?.data || e);
      Alert.alert('Error', 'Could not save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will:\n\n• Delete all your photos\n• Remove you from all events\n• Delete all your data\n\nThis cannot be reversed.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/api/profile/delete');
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
              navigation.goBack();
            } catch (e) {
              console.error('Delete account error:', e.response?.data || e);
              Alert.alert('Error', 'Could not delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header with Title */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Edit Profile</Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.headerButton, loading && styles.headerButtonDisabled]}
            disabled={loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Photo */}
            <View style={styles.photoSection}>
              <TouchableOpacity 
                onPress={pickPhoto} 
                activeOpacity={0.7} 
                style={styles.photoTouchable}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.profilePhoto} />
                ) : (
                  <View style={[styles.profilePhoto, styles.photoPlaceholder]}>
                    <Ionicons name="person" size={40} color="#999" />
                  </View>
                )}
                <View style={styles.cameraButton}>
                  <Ionicons name="camera" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.fieldsContainer}>
              {/* Display Name */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor="#aaa"
                  maxLength={30}
                />
              </View>

              {/* Bio */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <TextInput
                  style={[styles.textInput, styles.bioInput]}
                  multiline
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="#aaa"
                  maxLength={150}
                  textAlignVertical="top"
                />
                <Text style={styles.characterCount}>{bio.length}/150</Text>
              </View>
            </View>

            {/* Danger Zone */}
            <View style={styles.dangerZone}>
              <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={handleDeleteAccount}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={styles.deleteButtonText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'right',
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Photo Section
  photoSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  photoTouchable: {
    position: 'relative',
  },
  profilePhoto: {
    width: 110,
    height: 110,
    borderRadius: 55, // Perfect circle (half of width/height)
    backgroundColor: '#f5f5f5',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },

  // Fields
  fieldsContainer: {
    paddingHorizontal: 20,
  },
  fieldWrapper: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    fontSize: 17,
    color: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  bioInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
  },

  // Danger Zone
  dangerZone: {
    marginTop: 40,
    marginHorizontal: 20,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  dangerZoneTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
