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
  /* ─── local state ─────────────────────────────────────────────── */
  const [displayName, setDisplayName] = useState('');
  const [pronouns,    setPronouns   ] = useState('');
  const [bio,         setBio        ] = useState('');
  const [avatarUri,   setAvatarUri  ] = useState(null);   // current picture
  const [newAsset,    setNewAsset   ] = useState(null);   // picked image file

  /* ─── load current profile for defaults ───────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/profile');
        setDisplayName(data.username || '');
        setPronouns   (data.pronouns || '');
        setBio        (data.bio || '');
        if (data.profilePicture)
          setAvatarUri(
            `http://${API_BASE_URL}:3000${
              data.profilePicture.startsWith('/') ? '' : '/'
            }${data.profilePicture}`,
          );
      } catch (e) {
        console.error('EditProfile fetch:', e.response?.data || e);
      }
    })();
  }, []);

  /* ─── helpers ─────────────────────────────────────────────────── */
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
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
    const up = await api.post('/profile/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return up.data.profilePicture; // server path
  };

  const handleSave = async () => {
    try {
      let avatarPath = null;
      if (newAsset) avatarPath = await uploadAvatar();

      await api.put('/profile', {
        bio,
        displayName,
        pronouns,
        ...(avatarPath ? { profilePicture: avatarPath } : {}),
      });

      navigation.goBack();
    } catch (e) {
      console.error('EditProfile save:', e.response?.data || e);
      Alert.alert('Error', 'Could not save changes.');
    }
  };

  /* ─── render ──────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe}>
      {/* header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveTxt}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* avatar */}
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPH]}>
                <Ionicons name="camera" size={28} color="#666" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.editPhotoBtn} onPress={pickPhoto}>
            <Text style={styles.editPhotoTxt}>Edit Photo</Text>
          </TouchableOpacity>

          {/* fields */}
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Text style={styles.label}>Display Pronouns</Text>
          <TextInput
            style={styles.input}
            value={pronouns}
            onChangeText={setPronouns}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            multiline
            value={bio}
            onChangeText={setBio}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── styles ─────────────────────────────────────────────────────── */
const BLUE = '#1664ff';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 20, fontWeight: '700' },
  saveTxt: { color: BLUE, fontWeight: '600', fontSize: 16 },

  avatarWrap: { alignSelf: 'center', marginTop: 10 },
  avatar: { width: 170, height: 170, borderRadius: 18 },
  avatarPH: { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' },

  editPhotoBtn: {
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 14,
  },
  editPhotoTxt: { fontWeight: '600', color: '#111' },

  label: { fontWeight: '600', marginTop: 22, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  bioInput: { height: 120, textAlignVertical: 'top' },
});