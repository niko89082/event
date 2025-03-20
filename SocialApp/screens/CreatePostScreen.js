// screens/CreatePostScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';

export default function CreatePostScreen({ navigation }) {
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    requestLibraryPermission();
  }, []);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('We need access to your camera roll.');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], 
      allowsMultipleSelection: true,
    });

    console.log('ImagePicker result:', result);

    if (!result.canceled) {
      setSelectedImages(result.assets || []);
    }
  };

  const handleUpload = async () => {
    try {
      if (!selectedImages.length) {
        alert('No images selected');
        return;
      }

      const formData = new FormData();
      console.log("here");
      selectedImages.forEach((img, idx) => {
        formData.append('photos', {
          uri: img.uri,
          type: 'image/jpeg',
          name: `photo-${idx}.jpg`,
        });
      });
      console.log("i am here");
      const response = await api.post('/photos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Upload success:', response.data);
      alert('Post created!');
      navigation.goBack();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photos');
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Pick Images" onPress={pickImage} />

      <View style={styles.previewContainer}>
        {selectedImages.map((asset, idx) => (
          <Image
            key={idx}
            source={{ uri: asset.uri }}
            style={styles.previewImage}
          />
        ))}
      </View>

      <Button title="Upload Post" onPress={handleUpload} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  previewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  previewImage: {
    width: 100,
    height: 100,
    marginRight: 8,
    marginBottom: 8,
  },
});