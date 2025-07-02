import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Switch, 
  Alert,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UserSettingsScreen({ navigation }) {
  const { currentUser, logout } = useContext(AuthContext);
  const [isPublic, setIsPublic] = useState(true);
  const [profilePicture, setProfilePicture] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestLibraryPermission();
    fetchSettings();
  }, []);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your camera roll to update your profile picture.');
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/profile');
      setIsPublic(res.data.isPublic);
      
      if (res.data.profilePicture) {
        setProfilePicture(`http://${API_BASE_URL}:3000${res.data.profilePicture}`);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error.response?.data || error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setSelectedImages(result.assets);
    }
  };

  const handleUploadProfilePicture = async () => {
    if (!selectedImages.length) {
      Alert.alert('No Image Selected', 'Please select an image first');
      return;
    }

    const img = selectedImages[0];
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('profilePicture', {
        uri: img.uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      const response = await api.post('/profile/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Uploaded new profile pic:', response.data);
      Alert.alert('Success', 'Profile picture updated!');
      
      // Refresh settings to show new image
      await fetchSettings();
      setSelectedImages([]);
    } catch (error) {
      console.error('Error uploading profile pic:', error.response?.data || error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handlePrivacyToggle = async (val) => {
    try {
      setIsPublic(val);
      await api.put('/profile/visibility', { isPublic: val });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update visibility');
      // Revert the toggle
      setIsPublic(!val);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Navigation will be handled automatically by AuthContext
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfileScreen');
  };

  const handleManageEvents = () => {
    navigation.navigate('SelectShareableEventsScreen');
  };

  const handlePrivacyPolicy = () => {
    Alert.alert('Privacy Policy', 'This would open the privacy policy.');
  };

  const handleTermsOfService = () => {
    Alert.alert('Terms of Service', 'This would open the terms of service.');
  };

  const handleSupport = () => {
    Alert.alert('Support', 'This would open support options.');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          
          {/* Profile Picture Card */}
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <Image
                source={{
                  uri: selectedImages.length > 0 
                    ? selectedImages[0].uri 
                    : profilePicture || 'https://placehold.co/80x80.png?text=👤'
                }}
                style={styles.profileImage}
              />
              
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{currentUser?.username || 'User'}</Text>
                <Text style={styles.profileSubtext}>
                  {selectedImages.length > 0 ? 'New photo selected' : 'Tap to change photo'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={pickImage}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-outline" size={20} color="#3797EF" />
              </TouchableOpacity>
            </View>
            
            {selectedImages.length > 0 && (
              <TouchableOpacity
                style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                onPress={handleUploadProfilePicture}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>Update Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleEditProfile}
            activeOpacity={0.8}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#3797EF' }]}>
                <Ionicons name="person-outline" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.menuItemText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <View style={styles.card}>
            <View style={styles.privacyRow}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#34C759' }]}>
                  <Ionicons name={isPublic ? "eye-outline" : "eye-off-outline"} size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.menuItemText}>Public Profile</Text>
                  <Text style={styles.menuItemSubtext}>
                    {isPublic ? 'Anyone can see your profile' : 'Only followers can see your profile'}
                  </Text>
                </View>
              </View>
              <Switch 
                value={isPublic} 
                onValueChange={handlePrivacyToggle}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E5EA"
              />
            </View>
          </View>
        </View>

        {/* Events Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Events</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleManageEvents}
            activeOpacity={0.8}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.menuItemText}>Manage Shared Events</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.menuItemInCard}
              onPress={handleSupport}
              activeOpacity={0.8}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#5856D6' }]}>
                  <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.menuItemText}>Help & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity
              style={styles.menuItemInCard}
              onPress={handlePrivacyPolicy}
              activeOpacity={0.8}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#AF52DE' }]}>
                  <Ionicons name="shield-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.menuItemText}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity
              style={styles.menuItemInCard}
              onPress={handleTermsOfService}
              activeOpacity={0.8}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#FF2D92' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.menuItemText}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  
  // Section Styles
  section: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6D6D70',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  
  // Card Styles
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  
  // Profile Styles
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F6F6F6',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  profileSubtext: {
    fontSize: 13,
    color: '#8E8E93',
  },
  changePhotoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Menu Item Styles
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  menuItemInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  menuItemSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  
  // Privacy Styles
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  // Separator
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  
  // Logout Styles
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Version
  versionContainer: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  versionText: {
    fontSize: 13,
    color: '#8E8E93',
  },
});