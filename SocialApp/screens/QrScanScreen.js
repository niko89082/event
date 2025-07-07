// screens/QrScanScreen.js - Phase 4: Complete Enhanced QR Scanner
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
  const { eventId, eventTitle, mode = 'general' } = route.params || {};
  const isEventCheckin = !!eventId;

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Camera state
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [scanned, setScanned] = useState(false);

  // Event check-in state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  // Form status
  const [requiresForm, setRequiresForm] = useState(false);
  const [eventData, setEventData] = useState(null);

  // Animation
  const scanLineAnimation = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Set up navigation header
    navigation.setOptions({
      headerShown: false,
    });

    // Fetch event data if this is event check-in
    if (isEventCheckin) {
      fetchEventData();
    }

    // Start scan line animation
    startScanLineAnimation();

    return () => {
      scanLineAnimation.stopAnimation();
    };
  }, []);

  const fetchEventData = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}`);
      const event = response.data.event;
      setEventData(event);
      setRequiresForm(event.requiresFormForCheckIn && !!event.checkInForm);
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  };

  const startScanLineAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const resetScanner = () => {
    setScanned(false);
    setShowConfirmation(false);
    setPendingUser(null);
  };

  // Enhanced event check-in handler with form support
  const handleEventCheckIn = async (qrData) => {
    try {
      console.log('🎯 Processing event check-in:', qrData);

      const response = await api.post(`/api/events/${eventId}/checkin`, {
        qrData: qrData
      });

      console.log('✅ Check-in response:', response.data);

      if (response.data.success) {
        if (response.data.status === 'checked_in') {
          showSuccessAlert(response.data);
        } else if (response.data.status === 'guest_checked_in') {
          showSuccessAlert(response.data);
        } else {
          showErrorAlert(response.data.message);
        }
      } else if (response.data.requiresForm) {
        // Event requires form submission - navigate to form
        Alert.alert(
          'Form Required',
          'This event requires a check-in form to be completed.',
          [
            { text: 'Cancel', style: 'cancel', onPress: resetScanner },
            {
              text: 'Complete Form',
              onPress: () => {
                navigation.navigate('FormSubmissionScreen', {
                  formId: response.data.formId,
                  eventId: eventId,
                  isCheckIn: true,
                  onSubmissionComplete: () => {
                    // After form completion, attempt check-in again
                    navigation.goBack();
                    setTimeout(() => {
                      handleEventCheckIn(qrData);
                    }, 500);
                  }
                });
              }
            }
          ]
        );
      } else {
        showErrorAlert(response.data.message || 'Check-in failed');
      }
    } catch (error) {
      console.error('❌ Event check-in error:', error);
      
      if (error.response?.data?.requiresForm) {
        // Handle form requirement from error response
        Alert.alert(
          'Form Required',
          'Please complete the check-in form first.',
          [
            { text: 'Cancel', style: 'cancel', onPress: resetScanner },
            {
              text: 'Open Form',
              onPress: () => {
                navigation.navigate('FormSubmissionScreen', {
                  formId: error.response.data.formId,
                  eventId: eventId,
                  isCheckIn: true,
                  onSubmissionComplete: () => {
                    navigation.goBack();
                    showSuccessAlert({ 
                      user: { username: 'User' },
                      message: 'Check-in completed successfully'
                    });
                  }
                });
              }
            }
          ]
        );
      } else {
        const errorMessage = error.response?.data?.message || 
          'Check-in failed. Please try again.';
        showErrorAlert(errorMessage);
      }
    }
  };

  const handleHostCheckInWithForm = async (attendeeId) => {
    try {
      // First check if the attendee needs to complete a form
      const eventResponse = await api.get(`/api/events/${eventId}`);
      const event = eventResponse.data.event;
      
      if (event.requiresFormForCheckIn && event.checkInForm) {
        // Navigate to form for this specific attendee
        navigation.navigate('FormSubmissionScreen', {
          formId: event.checkInForm._id || event.checkInForm,
          eventId: eventId,
          userId: attendeeId, // Host is filling out form for this user
          isCheckIn: true,
          onSubmissionComplete: () => {
            navigation.goBack();
            Alert.alert(
              'Check-in Complete!',
              'Attendee has been successfully checked in.',
              [
                { text: 'Scan Another', onPress: resetScanner },
                { text: 'Done', onPress: () => navigation.goBack() }
              ]
            );
          }
        });
      }
    } catch (error) {
      console.error('❌ Host check-in with form error:', error);
      showErrorAlert('Failed to load check-in form');
    }
  };

  const handleUserProfileScan = async (qrData) => {
    try {
      console.log('📱 Raw QR data scanned:', qrData);
      console.log('📱 QR data type:', typeof qrData);
      console.log('📱 QR data length:', qrData.length);

      // Try to parse if it looks like JSON
      let parsedData = null;
      try {
        parsedData = JSON.parse(qrData);
        console.log('✅ Successfully parsed QR JSON:', parsedData);
      } catch (parseError) {
        console.log('📝 QR data is not JSON, treating as direct share code');
      }

      const response = await api.post('/api/qr/scan', {
        qrData: qrData // Send raw data, let backend handle parsing
      });

      console.log('🔍 QR scan response:', response.data);

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
                () => handleQuickFollow(parsedData?.shareCode || qrData),
              style: user.isFollowing ? 'default' : 'default'
            }
          ]
        );
      } else {
        showErrorAlert(response.data.message || 'Invalid QR code');
      }
    } catch (error) {
      console.error('❌ User profile scan error:', error);
      
      if (error.response?.status === 404) {
        showErrorAlert('User not found or QR code is invalid');
      } else {
        showErrorAlert('Failed to scan QR code. Please try again.');
      }
    }
  };

  const handleQuickFollow = async (shareCode) => {
    try {
      const response = await api.post('/api/users/follow-by-code', {
        shareCode: shareCode
      });

      if (response.data.success) {
        Alert.alert(
          '✅ Followed!',
          `You are now following ${response.data.user.username}`,
          [
            { text: 'View Profile', onPress: () => navigation.navigate('ProfileScreen', { userId: response.data.user._id }) },
            { text: 'Scan Another', onPress: resetScanner }
          ]
        );
      } else {
        showErrorAlert(response.data.message);
      }
    } catch (error) {
      console.error('❌ Quick follow error:', error);
      showErrorAlert('Failed to follow user');
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;

    setScanned(true);
    Vibration.vibrate(100);

    console.log('📊 QR Code Scanned:', { type, data });

    try {
      // Try to parse the QR data
      let qrData;
      try {
        qrData = JSON.parse(data);
        console.log('📋 Parsed QR Data:', qrData);
      } catch (e) {
        // Not JSON, treat as string
        qrData = data;
        console.log('📋 Raw QR Data:', qrData);
      }

      if (isEventCheckin) {
        // Event check-in mode
        if (typeof qrData === 'object' && qrData.type === 'event_checkin') {
          // This is an event check-in QR code
          handleEventCheckIn(qrData);
        } else if (typeof qrData === 'object' && qrData.type === 'user_profile') {
          // This is a user profile QR - check them in manually
          handleHostCheckInWithForm(qrData.userId);
        } else if (typeof qrData === 'string') {
          // Could be a user share code
          handleUserProfileScan(qrData);
        } else {
          showErrorAlert('Invalid QR code for event check-in');
        }
      } else {
        // General QR scanning mode
        if (typeof qrData === 'object' && qrData.type === 'user_profile') {
          handleUserProfileScan(JSON.stringify(qrData));
        } else if (typeof qrData === 'string') {
          handleUserProfileScan(qrData);
        } else {
          showErrorAlert('Unsupported QR code format');
        }
      }
    } catch (error) {
      console.error('❌ QR scanning error:', error);
      showErrorAlert('Failed to process QR code');
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
    const name = isGuest ? data.guestPass?.guestName : data.user?.username;
    const wasAdded = data.wasAdded ? ' (Added to attendees)' : '';
    const formCompleted = data.formSubmitted ? ' (Form completed)' : '';
    
    Alert.alert(
      '✅ Check-in Successful!',
      `${name} has been checked in${wasAdded}${formCompleted}`,
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

  const renderFormStatusIndicator = () => {
    if (!requiresForm) return null;

    return (
      <View style={styles.formStatusIndicator}>
        <Ionicons name="document-text" size={16} color="#FFFFFF" />
        <Text style={styles.formStatusText}>Form required for check-in</Text>
      </View>
    );
  };

  const renderPermissionScreen = () => (
    <View style={styles.permissionContainer}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.permissionContent}>
        <Ionicons name="camera-outline" size={80} color="#FFFFFF" />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          To scan QR codes, we need access to your camera. This allows you to check in to events and connect with other users.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Check camera permissions
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#667eea" />
        {renderPermissionScreen()}
      </SafeAreaView>
    );
  }

  const scanLineTranslateY = scanLineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250],
  });

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
            {isEventCheckin ? `Check-in Scanner` : 'Scan QR Code'}
          </Text>
          {eventTitle && (
            <Text style={styles.headerSubtitle}>{eventTitle}</Text>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.flashButton}
          onPress={toggleFlash}
        >
          <Ionicons 
            name={flash === 'on' ? 'flash' : 'flash-off'} 
            size={24} 
            color={flash === 'on' ? '#FFD700' : '#FFFFFF'} 
          />
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          flash={flash}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'pdf417'],
          }}
        >
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame}>
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [{ translateY: scanLineTranslateY }],
                  },
                ]}
              />
            </View>
            
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                {isEventCheckin
                  ? requiresForm
                    ? 'Scan attendee QR codes to check them in\nForm will be required after scanning'
                    : 'Scan attendee QR codes to check them in'
                  : 'Point your camera at a QR code to scan'
                }
              </Text>
            </View>

            {/* Form Status Indicator */}
            {renderFormStatusIndicator()}
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
    lineHeight: 22,
  },
  formStatusIndicator: {
    position: 'absolute',
    top: -150,
    left: -75,
    right: -75,
    backgroundColor: 'rgba(255, 149, 0, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  formStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
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
    backgroundColor: 'rgba(0,0,0,0.8)',
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