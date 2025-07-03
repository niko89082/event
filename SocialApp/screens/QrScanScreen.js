// File: SocialApp/screens/QrScanScreen.js
// Enhanced QR Scanner with event check-in support

import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal,
  SafeAreaView, StatusBar, Vibration, Image, Animated
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

export default function QrScanScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  
  // Route params - eventId indicates this is for event check-in
  const { eventId, eventTitle } = route.params || {};
  const isEventCheckin = !!eventId;

  // Camera state
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState('back');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanningActive, setScanningActive] = useState(true);

  // Animation
  const [scanAnimation] = useState(new Animated.Value(0));

  // Check-in state
  const [checkinResult, setCheckinResult] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    startScanAnimation();
  }, []);

  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleBarcodeScanned = ({ data }) => {
    if (scanned || !scanningActive) return;

    setScanned(true);
    setScanningActive(false);
    Vibration.vibrate(100);

    console.log('📱 QR Code scanned:', data.substring(0, 20) + '...');

    if (isEventCheckin) {
      handleEventCheckin(data);
    } else {
      handleUserProfileScan(data);
    }
  };

  const handleEventCheckin = async (qrData) => {
    try {
      console.log('🎉 Processing event check-in for:', eventId);
      
      const response = await api.post(`/api/events/${eventId}/checkin`, {
        qrCode: qrData,
        confirmEntry: false
      });

      console.log('✅ Check-in response:', response.data);

      if (response.data.success) {
        // Success - show confirmation
        setCheckinResult(response.data);
        showSuccessAlert(response.data);
      } else if (response.data.status === 'requires_confirmation') {
        // Show host confirmation dialog
        setPendingUser(response.data.user);
        setShowConfirmation(true);
      } else if (response.data.status === 'already_checked_in') {
        // Already checked in
        showAlreadyCheckedInAlert(response.data.user);
      } else {
        // Other errors
        showErrorAlert(response.data.message);
      }
    } catch (error) {
      console.error('❌ Check-in error:', error);
      const errorMessage = error.response?.data?.message || 'Check-in failed. Please try again.';
      showErrorAlert(errorMessage);
    }
  };

  const confirmNonAttendeeEntry = async () => {
    try {
      const response = await api.post(`/api/events/${eventId}/checkin`, {
        qrCode: pendingUser.shareCode || 'unknown',
        confirmEntry: true
      });

      setShowConfirmation(false);
      setPendingUser(null);

      if (response.data.success) {
        showSuccessAlert(response.data);
      } else {
        showErrorAlert(response.data.message);
      }
    } catch (error) {
      console.error('❌ Confirm entry error:', error);
      showErrorAlert('Failed to confirm entry. Please try again.');
    }
  };

  const showSuccessAlert = (data) => {
    const isGuest = data.status === 'guest_checked_in';
    const name = isGuest ? data.guestPass.guestName : data.user.username;
    const wasAdded = data.wasAdded ? ' (Added to attendees)' : '';
    
    Alert.alert(
      '✅ Check-in Successful!',
      `${name} has been checked in${wasAdded}`,
      [
        { text: 'Scan Another', onPress: resetScanner },
        { text: 'Done', onPress: () => navigation.goBack() }
      ]
    );
  };

  const showAlreadyCheckedInAlert = (user) => {
    Alert.alert(
      '⚠️ Already Checked In',
      `${user.username} is already checked in to this event.`,
      [
        { text: 'Scan Another', onPress: resetScanner },
        { text: 'Done', onPress: () => navigation.goBack() }
      ]
    );
  };

  const showErrorAlert = (message) => {
    Alert.alert(
      '❌ Check-in Error',
      message,
      [
        { text: 'Try Again', onPress: resetScanner },
        { text: 'Cancel', onPress: () => navigation.goBack() }
      ]
    );
  };

  const handleUserProfileScan = async (qrData) => {
    try {
      const response = await api.post('/api/qr/scan', {
        qrData: qrData
      });

      if (response.data.success) {
        const user = response.data.user;
        Alert.alert(
          '👤 User Found',
          `${user.username}${user.bio ? `\n"${user.bio}"` : ''}`,
          [
            { text: 'Cancel', style: 'cancel', onPress: resetScanner },
            {
              text: user.isFollowing ? 'View Profile' : 'Follow',
              onPress: user.isFollowing ? 
                () => navigation.navigate('ProfileScreen', { userId: user._id }) :
                () => handleQuickFollow(qrData),
              style: user.isFollowing ? 'default' : 'destructive'
            },
          ]
        );
      } else {
        showErrorAlert(response.data.message || 'User not found');
      }
    } catch (error) {
      console.error('❌ Profile scan error:', error);
      showErrorAlert('Unable to process QR code. Please try again.');
    }
  };

  const handleQuickFollow = async (qrData) => {
    try {
      const response = await api.post('/api/qr/quick-follow', {
        shareCode: qrData
      });

      if (response.data.success) {
        const message = response.data.action === 'followed' 
          ? 'You are now following this user!'
          : 'Follow request sent successfully!';

        Alert.alert('Success!', message, [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('❌ Quick follow error:', error);
      showErrorAlert('Unable to follow user. Please try again.');
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setScanningActive(true);
    setCheckinResult(null);
    setShowConfirmation(false);
    setPendingUser(null);
  };

  const toggleCameraFacing = () => {
    setCameraFacing(current => current === 'back' ? 'front' : 'back');
  };

  const toggleFlash = () => {
    setIsFlashOn(!isFlashOn);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.permissionContainer}
        >
          <View style={styles.permissionContent}>
            <Ionicons name="camera-outline" size={80} color="#FFFFFF" />
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionSubtitle}>
              {isEventCheckin 
                ? 'We need camera access to scan attendee QR codes for check-in.'
                : 'We need camera access to scan QR codes and connect with other users.'
              }
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isEventCheckin ? 'Event Check-in' : 'Scan QR Code'}
          </Text>
          {isEventCheckin && eventTitle && (
            <Text style={styles.headerSubtitle}>{eventTitle}</Text>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.flashButton}
          onPress={toggleFlash}
        >
          <Ionicons 
            name={isFlashOn ? "flash" : "flash-off"} 
            size={24} 
            color={isFlashOn ? "#FFD700" : "#FFFFFF"} 
          />
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={cameraFacing}
          onBarcodeScanned={scanningActive ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          flash={isFlashOn ? 'on' : 'off'}
        >
          {/* Scan Overlay */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame}>
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 200],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
            
            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                {isEventCheckin 
                  ? 'Scan attendee QR codes to check them in'
                  : 'Point your camera at a QR code to scan'
                }
              </Text>
            </View>
          </View>
        </CameraView>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={toggleCameraFacing}
        >
          <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        
        {isEventCheckin && (
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => {
              // Navigate to attendee list for manual check-in
              navigation.replace('AttendeeListScreen', { eventId });
            }}
          >
            <Ionicons name="list" size={24} color="#FFFFFF" />
            <Text style={styles.manualButtonText}>Manual</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmation}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationHeader}>
              <Ionicons name="person-add" size={40} color="#FF9500" />
              <Text style={styles.confirmationTitle}>Not Registered</Text>
            </View>
            
            {pendingUser && (
              <View style={styles.userInfo}>
                <Image
                  source={{
                    uri: pendingUser.profilePicture
                      ? `http://${API_BASE_URL}:3000${pendingUser.profilePicture}`
                      : 'https://placehold.co/60x60.png?text=👤'
                  }}
                  style={styles.userAvatar}
                />
                <Text style={styles.userName}>{pendingUser.username}</Text>
                {pendingUser.bio && (
                  <Text style={styles.userBio}>{pendingUser.bio}</Text>
                )}
              </View>
            )}
            
            <Text style={styles.confirmationMessage}>
              This person is not registered for the event. Allow them to enter?
            </Text>
            
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.rejectButton]}
                onPress={() => {
                  setShowConfirmation(false);
                  setPendingUser(null);
                  resetScanner();
                }}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, styles.allowButton]}
                onPress={confirmNonAttendeeEntry}
              >
                <Text style={styles.allowButtonText}>Allow Entry</Text>
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
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#CCCCCC',
    fontSize: 14,
    marginTop: 2,
  },
  flashButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 20,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#00FF00',
    position: 'absolute',
    top: 0,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 30,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  flipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualButton: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: '#CCCCCC',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 30,
  },
  permissionButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.8)', // Darker background to compensate for no blur
},
  confirmationModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: 'center',
    minWidth: 300,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginTop: 10,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  userBio: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 5,
  },
  confirmationMessage: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  confirmButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
  },
  rejectButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  allowButton: {
    backgroundColor: '#34C759',
  },
  rejectButtonText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  allowButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// // =============================================================================
// // File: SocialApp/screens/EventDetailsScreen.js
// // Add QR Scanner button for hosts
// // =============================================================================

// // Find the host actions section and add this button after the existing host controls

// // Add this import at the top
// import { Ionicons } from '@expo/vector-icons';

// // Add this function inside the EventDetailsScreen component
// const handleOpenScanner = () => {
//   navigation.navigate('QrScanScreen', { 
//     eventId: eventId,
//     eventTitle: event.title 
//   });
// };

// // Add this button in the host actions section (around line 600-700 in the existing JSX)
// // Look for where other host buttons are rendered and add:

// {/* QR Scanner Button for Check-in */}
// {(isHost || isCoHost) && !isPast && (
//   <TouchableOpacity
//     style={styles.actionButton}
//     onPress={handleOpenScanner}
//     activeOpacity={0.8}
//   >
//     <LinearGradient
//       colors={['#667eea', '#764ba2']}
//       style={styles.gradientButton}
//     >
//       <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
//       <Text style={styles.actionButtonText}>Check-in Scanner</Text>
//     </LinearGradient>
//   </TouchableOpacity>
// )}

// // Add these styles to the existing StyleSheet
// const additionalStyles = StyleSheet.create({
//   actionButton: {
//     marginVertical: 8,
//     borderRadius: 12,
//     overflow: 'hidden',
//   },
//   gradientButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 14,
//     paddingHorizontal: 20,
//     gap: 8,
//   },
//   actionButtonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: '600',
//   },
// });