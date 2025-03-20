import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Image, Switch, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function UserSettingsScreen({ navigation }) {
  const [isPublic, setIsPublic] = useState(true);
  const [profilePicture, setProfilePicture] = useState('');
  // We'll store an array of selected assets (to mimic your CreatePostScreen).
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    // On mount, request media library permission & fetch user settings
    requestLibraryPermission();
    fetchSettings();
  }, []);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('We need access to your camera roll.');
    }
  };

  const fetchSettings = async () => {
    try {
      // GET /profile to load user data
      const res = await api.get('/profile');
      setIsPublic(res.data.isPublic);
      setProfilePicture(`http://${API_BASE_URL}:3000${res.data.profilePicture}` || '');
    } catch (error) {
      console.error('Error fetching user settings:', error.response?.data || error);
    }
  };

  const pickImage = async () => {
    // This example allows multiple selection, just like your CreatePostScreen
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsMultipleSelection: true,  // or false, if you only want 1 image
    });

    console.log('ImagePicker result:', result);

    if (!result.canceled) {
      setSelectedImages(result.assets || []);
    }
  };

  const handleUploadProfilePicture = async () => {
    // We’ll just take the first image from selectedImages as the "profile pic"
    if (!selectedImages.length) {
      Alert.alert('No images selected');
      return;
    }

    const img = selectedImages[0]; // pick the first
    try {
      const formData = new FormData();
      // On your server route: upload.single('profilePicture')
      formData.append('profilePicture', {
        uri: img.uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      // POST to /profile/upload
      const response = await api.post('/profile/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Uploaded new profile pic:', response.data);
      Alert.alert('Success', 'Profile picture updated!');
      // Refresh local data so the UI shows the new pic
      fetchSettings();
      // Optionally clear the selectedImages
      setSelectedImages([]);
    } catch (error) {
      console.error('Error uploading profile pic:', error.response?.data || error);
      Alert.alert('Error', 'Failed to upload profile pic');
    }
  };

  const handlePrivacyToggle = async (val) => {
    try {
      setIsPublic(val);
      // Update user isPublic in DB
      await api.put('/profile/visibility', { isPublic: val });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update visibility');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Settings</Text>

      {/* Toggle for Private/Public */}
      <View style={styles.row}>
        <Text>Account is Public?</Text>
        <Switch value={isPublic} onValueChange={handlePrivacyToggle} />
      </View>

      {/* Current Profile Pic */}
      <View style={styles.imageSection}>
        <Text>Current Profile Pic:</Text>
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.profileImage} />
        ) : (
          <Text>No current pic</Text>
        )}
      </View>

      {/* Pick new pic (like CreatePostScreen) */}
      <Button title="Pick Images" onPress={pickImage} />

      {/* Show the newly selected images (like CreatePostScreen) */}
      <View style={styles.previewContainer}>
        {selectedImages.map((asset, idx) => (
          <Image
            key={idx}
            source={{ uri: asset.uri }}
            style={styles.previewImage}
          />
        ))}
      </View>

      {/* Upload first selected image as the new profile pic */}
      <Button title="Upload Profile Pic" onPress={handleUploadProfilePicture} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  imageSection: { marginVertical: 10 },
  profileImage: { width: 80, height: 80, borderRadius: 40, marginTop: 8 },
  previewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  previewImage: {
    width: 80,
    height: 80,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
});
