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
  Dimensions,
  Modal,
  TextInput
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
  
  // Payment states
  const [paymentMethods, setPaymentMethods] = useState({});
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    requestLibraryPermission();
    fetchSettings();
    fetchPaymentMethods();
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
      const res = await api.get('/api/profile');
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

  const fetchPaymentMethods = async () => {
    try {
      const response = await api.get('/profile/payment-methods');
      console.log('Payment methods response:', response.data);
      setPaymentMethods(response.data.paymentMethods || {});
      
      // Set current PayPal email if exists
      if (response.data.paymentMethods?.paypal?.email) {
        setPaypalEmail(response.data.paymentMethods.paypal.email);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      // Initialize empty payment methods if API fails
      setPaymentMethods({});
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

  // Payment functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your photos, events, and data will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: showPasswordConfirmation
        }
      ]
    );
  };

  const showPasswordConfirmation = () => {
    Alert.prompt(
      'Enter Password',
      'Please enter your password to confirm account deletion',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: (password) => {
            if (!password || password.trim().length === 0) {
              Alert.alert('Error', 'Password is required');
              return;
            }
            showFinalConfirmation(password);
          }
        }
      ],
      'secure-text'
    );
  };

  const showFinalConfirmation = (password) => {
    Alert.prompt(
      'Final Confirmation',
      'Type "DELETE" to permanently delete your account',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: (confirmText) => {
            if (confirmText === 'DELETE') {
              performAccountDeletion(password);
            } else {
              Alert.alert('Error', 'Please type "DELETE" exactly to confirm');
            }
          }
        }
      ]
    );
  };

  const performAccountDeletion = async (password) => {
    try {
      Alert.alert('Deleting Account', 'Please wait while we delete your account...', [], { cancelable: false });
      
      // Verify password first (you'll need to add this endpoint)
      await api.post('/auth/verify-password', { password });
      
      // Perform deletion
      await api.delete('/profile/delete');
      
      // Logout and redirect
      Alert.alert(
        'Account Deleted',
        'Your account has been successfully deleted.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
              // Navigation will be handled by AuthContext
            }
          }
        ],
        { cancelable: false }
      );
      
    } catch (error) {
      console.error('Delete account error:', error);
      const message = error.response?.data?.message || 'Failed to delete account. Please try again.';
      Alert.alert('Error', message);
    }
  };
  const handlePayPalUpdate = async () => {
    if (!validateEmail(paypalEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setPaymentLoading(true);
      setEmailError('');

      const isNewSetup = !paymentMethods.paypal?.connected;
      const endpoint = isNewSetup ? '/profile/setup-paypal' : '/profile/paypal-email';
      const method = isNewSetup ? 'POST' : 'PUT';

      const response = await api.request({
        method,
        url: endpoint,
        data: { paypalEmail: paypalEmail.trim() }
      });

      if (response.data.success) {
        Alert.alert(
          'Success!', 
          isNewSetup ? 'PayPal account connected successfully!' : 'PayPal email updated successfully!',
          [{ text: 'OK', onPress: () => setShowPayPalModal(false) }]
        );
        fetchPaymentMethods(); // Refresh data
      }

    } catch (error) {
      console.error('PayPal update error:', error);
      const message = error.response?.data?.message || 'Failed to update PayPal account';
      Alert.alert('Error', message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRemovePayPal = () => {
    Alert.alert(
      'Remove PayPal Account',
      'Are you sure you want to remove your PayPal account? You won\'t be able to receive payments until you add a new payment method.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              setPaymentLoading(true);
              await api.delete('/profile/paypal');
              Alert.alert('Success', 'PayPal account removed successfully');
              fetchPaymentMethods();
            } catch (error) {
              console.error('Remove PayPal error:', error);
              Alert.alert('Error', 'Failed to remove PayPal account');
            } finally {
              setPaymentLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSetPrimary = async (provider) => {
    try {
      setPaymentLoading(true);
      await api.put('/profile/primary-payment', { provider });
      Alert.alert('Success', `${provider === 'paypal' ? 'PayPal' : 'Stripe'} is now your primary payment method`);
      fetchPaymentMethods();
    } catch (error) {
      console.error('Set primary error:', error);
      Alert.alert('Error', 'Failed to update primary payment method');
    } finally {
      setPaymentLoading(false);
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

  const handlePaymentSettings = () => {
    navigation.navigate('PaymentSettingsScreen');
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

        {/* Payments Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments</Text>
          
          {/* Payment Status Overview */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handlePaymentSettings}
            activeOpacity={0.8}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.menuItemText}>Payment Methods</Text>
                <Text style={styles.menuItemSubtext}>
                  {paymentMethods.primary?.canReceivePayments 
                    ? `Connected: ${paymentMethods.primary.type === 'paypal' ? 'PayPal' : 'Stripe'}`
                    : 'Set up payment methods'
                  }
                </Text>
              </View>
            </View>
            <View style={styles.paymentStatusRow}>
              {paymentMethods.primary?.canReceivePayments ? (
                <View style={styles.connectedBadge}>
                  <Ionicons name="checkmark" size={16} color="#34C759" />
                </View>
              ) : (
                <View style={styles.setupRequiredBadge}>
                  <Ionicons name="alert-circle" size={16} color="#FF9500" />
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </View>
          </TouchableOpacity>

          {/* Quick PayPal Setup (if not connected) */}
          {!paymentMethods.paypal?.connected && (
            <View style={styles.card}>
              <View style={styles.quickSetupHeader}>
                <Ionicons name="logo-paypal" size={24} color="#0070BA" />
                <Text style={styles.quickSetupTitle}>Quick PayPal Setup</Text>
              </View>
              <Text style={styles.quickSetupDescription}>
                Connect your PayPal email to start receiving payments in 30 seconds
              </Text>
              <TouchableOpacity
                style={styles.quickSetupButton}
                onPress={() => setShowPayPalModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.quickSetupButtonText}>Connect PayPal</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Earnings Quick View (if user has earnings) */}
          {paymentMethods.earnings?.total > 0 && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handlePaymentSettings}
              activeOpacity={0.8}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#34C759' }]}>
                  <Ionicons name="trending-up-outline" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.menuItemText}>Earnings</Text>
                  <Text style={styles.menuItemSubtext}>
                    Total: ${(paymentMethods.earnings.total / 100).toFixed(2)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          )}
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
              <View style={[styles.menuIcon, { backgroundColor: '#5856D6' }]}>
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.menuItemText}>Manage Shared Events</Text>
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
                <View style={[styles.menuIcon, { backgroundColor: '#FF2D92' }]}>
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
                <View style={[styles.menuIcon, { backgroundColor: '#007AFF' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.menuItemText}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <View style={styles.deleteAccountContent}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#FF3B30' }]}>
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.deleteAccountText}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </View>
          </TouchableOpacity>
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

      {/* PayPal Setup/Edit Modal */}
      <Modal
        visible={showPayPalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPayPalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {paymentMethods.paypal?.connected ? 'Update PayPal Email' : 'Connect PayPal Account'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowPayPalModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter your PayPal email address. Payments will be sent directly to this account.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>PayPal Email</Text>
              <TextInput
                style={[styles.emailInput, emailError && styles.inputError]}
                placeholder="your-email@example.com"
                value={paypalEmail}
                onChangeText={(text) => {
                  setPaypalEmail(text);
                  setEmailError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
              {emailError && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{emailError}</Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPayPalModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, (!paypalEmail.trim() || paymentLoading) && styles.buttonDisabled]}
                onPress={handlePayPalUpdate}
                disabled={!paypalEmail.trim() || paymentLoading}
              >
                {paymentLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {paymentMethods.paypal?.connected ? 'Update' : 'Connect'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  
  // Payment specific styles
  paymentInfo: {
    flex: 1,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F9F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  setupRequiredBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  
  // Quick Setup Styles
  quickSetupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickSetupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  quickSetupDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  quickSetupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0070BA',
    borderRadius: 8,
    paddingVertical: 12,
  },
  quickSetupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 24,
  },

  // Input Styles
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#FF3B30',
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteAccountButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  deleteAccountContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  deleteAccountText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
});