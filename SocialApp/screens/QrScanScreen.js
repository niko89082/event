// screens/QrScanScreen.js - Phase 1: Fixed Individual QR Scanning
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
  const [processing, setProcessing] = useState(false);

  // Form status
  const [requiresForm, setRequiresForm] = useState(false);
  const [eventData, setEventData] = useState(null);

  // Animation
  const scanLineAnimation = useState(new Animated.Value(0))[0];

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    if (isEventCheckin) {
      fetchEventData();
    }

    startScanLineAnimation();
    return () => scanLineAnimation.stopAnimation();
  }, []);

  const fetchEventData = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}`);
      console.log('✅ Event data response:', response.data);
      
      // ✅ FIXED: Handle different response formats
      const event = response.data.event || response.data;
      
      if (event) {
        setEventData(event);
        setRequiresForm(event.requiresFormForCheckIn && !!event.checkInForm);
        console.log('✅ Event data loaded:', {
          eventId: event._id,
          requiresForm: event.requiresFormForCheckIn,
          hasForm: !!event.checkInForm
        });
      } else {
        console.error('❌ No event data in response');
      }
    } catch (error) {
      console.error('❌ Error fetching event data:', error);
      // Continue anyway - the app can still function for basic check-in
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

  const resetScanner = () => {
    setScanned(false);
    setProcessing(false);
    setShowConfirmation(false);
    setPendingUser(null);
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  // ✅ FIXED: Unified QR parsing function
  const parseQRData = (rawData) => {
  console.log('🔍 Parsing QR data:', rawData);
  
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(rawData);
    console.log('✅ Successfully parsed JSON:', parsed);
    
    // Validate QR code type
    if (parsed.type === 'event_mass_checkin') {
      // This is a mass check-in QR code
      if (!parsed.eventId || !parsed.token) {
        throw new Error('Invalid event check-in QR code format');
      }
    } else if (parsed.type === 'user_profile') {
      // This is a user profile QR code
      if (!parsed.shareCode && !parsed.userId) {
        throw new Error('Invalid user profile QR code format');
      }
    }
    
    return parsed;
  } catch (parseError) {
    console.log('📝 QR data is not JSON, treating as string');
    // Not JSON, treat as direct shareCode (legacy format)
    return {
      type: 'legacy_shareCode',
      shareCode: rawData,
      raw: rawData
    };
  }
};


  // ✅ FIXED: Unified user resolution function
  const resolveUserFromQR = async (qrData) => {
    console.log('🎯 Resolving user from QR data:', qrData);
    
    try {
      // Use the enhanced /api/qr/scan endpoint
      const response = await api.post('/api/qr/scan', {
        qrData: typeof qrData === 'string' ? qrData : JSON.stringify(qrData)
      });

      if (response.data.success) {
        console.log('✅ User resolved:', response.data.user.username);
        return response.data.user;
      } else {
        throw new Error(response.data.message || 'Failed to resolve user');
      }
    } catch (error) {
      console.error('❌ User resolution error:', error);
      
      if (error.response?.status === 404) {
        throw new Error('User not found or QR code is invalid');
      } else if (error.response?.data?.errorCode === 'SCANNING_OWN_CODE') {
        throw new Error('You cannot scan your own QR code');
      } else {
        throw new Error(error.response?.data?.message || 'Failed to scan QR code');
      }
    }
  };

  // ✅ FIXED: Simplified scan handler
  const handleBarCodeScanned = ({ type, data }) => {
  if (scanned || processing) return;

  setScanned(true);
  setProcessing(true);
  Vibration.vibrate(100);

  console.log('📊 QR Code Scanned:', { type, data });

  const processQR = async () => {
    try {
      // Step 1: Parse QR data
      const qrData = parseQRData(data);
      
      // Step 2: Handle different QR types
      if (qrData.type === 'event_mass_checkin') {
        // This is a mass check-in QR code - user is checking themselves in
        await handleEventCheckInQR(qrData);
      } else if (qrData.type === 'user_profile' || qrData.type === 'legacy_shareCode') {
        // This is a user profile QR code
        if (isEventCheckin) {
          // Host is scanning user for event check-in
          await handleUserCheckIn(qrData);
        } else {
          // General user profile scanning (follow/view profile)
          await handleUserProfileScan(qrData);
        }
      } else {
        throw new Error('Unsupported QR code format');
      }
    } catch (error) {
      console.error('❌ QR processing error:', error);
      showErrorAlert(error.message || 'Failed to process QR code');
    } finally {
      setProcessing(false);
    }
  };

  processQR();
};


  // ✅ FIXED: Handle user check-in for events
  const handleUserCheckIn = async (qrData) => {
    console.log('👥 Processing user check-in for event:', eventId);
    
    try {
      // Step 1: Resolve user from QR
      const user = await resolveUserFromQR(qrData);
      
      // Step 2: Attempt check-in
      const response = await api.post(`/api/events/${eventId}/checkin`, {
        qrCode: JSON.stringify({
          type: 'user_profile',
          userId: user._id,
          shareCode: user.shareCode,
          username: user.username
        })
      });

      if (response.data.success) {
        showSuccessAlert(response.data);
      } else {
        // Handle specific error cases
        if (response.data.errorCode === 'USER_NOT_REGISTERED') {
          // User is not registered for event - show confirmation
          showNonAttendeeConfirmation(user);
        } else if (response.data.errorCode === 'FORM_REQUIRED') {
          // Form is required for check-in
          showFormRequiredAlert(user, response.data.formId);
        } else {
          throw new Error(response.data.message);
        }
      }
    } catch (error) {
      console.error('❌ User check-in error:', error);
      
      // ✅ FIXED: Handle API error responses properly
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        
        if (errorData.errorCode === 'USER_NOT_REGISTERED' && errorData.requiresConfirmation) {
          // User is not registered - show confirmation modal
          console.log('🎯 Showing non-attendee confirmation for:', errorData.user.username);
          showNonAttendeeConfirmation(errorData.user);
        } else if (errorData.errorCode === 'FORM_REQUIRED') {
          // Form is required for check-in
          showFormRequiredAlert(errorData.user, errorData.formId);
        } else if (errorData.errorCode === 'ALREADY_CHECKED_IN') {
          // User is already checked in
          Alert.alert(
            '⚠️ Already Checked In',
            `${errorData.user.username} is already checked in to this event.`,
            [
              { text: 'Scan Another', onPress: resetScanner },
              { text: 'Done', onPress: () => navigation.goBack() }
            ]
          );
        } else {
          showErrorAlert(errorData.message || 'Check-in failed');
        }
      } else {
        showErrorAlert(error.message || 'Check-in failed');
      }
    }
  };

  // ✅ FIXED: Handle general user profile scanning
  const handleUserProfileScan = async (qrData) => {
    console.log('👤 Processing user profile scan');
    
    try {
      const user = await resolveUserFromQR(qrData);
      
      Alert.alert(
        '👤 User Found',
        `${user.username}${user.bio ? `\n"${user.bio}"` : ''}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: resetScanner },
          {
            text: user.isFollowing ? 'View Profile' : 'Follow',
            onPress: user.isFollowing ? 
              () => navigation.navigate('ProfileScreen', { userId: user._id }) :
              () => handleQuickFollow(user.shareCode),
          }
        ]
      );
    } catch (error) {
      console.error('❌ User profile scan error:', error);
      showErrorAlert(error.message || 'Failed to scan user profile');
    }
  };

  // ✅ NEW: Show confirmation for non-registered users
  const showNonAttendeeConfirmation = (user) => {
    setPendingUser(user);
    setShowConfirmation(true);
  };

  // ✅ NEW: Handle form requirement
  const showFormRequiredAlert = (user, formId) => {
    Alert.alert(
      '📋 Form Required',
      `${user.username} needs to complete a form before checking in.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: resetScanner },
        {
          text: 'Open Form',
          onPress: () => {
            navigation.navigate('FormSubmissionScreen', {
              formId: formId,
              eventId: eventId,
              userId: user._id,
              isCheckIn: true,
              onSubmissionComplete: () => {
                navigation.goBack();
                showSuccessAlert({ 
                  user: { username: user.username },
                  message: 'Form completed and user checked in successfully'
                });
              }
            });
          }
        }
      ]
    );
  };

  // ✅ NEW: Handle non-attendee entry confirmation
  const confirmNonAttendeeEntry = async () => {
    try {
      const response = await api.post(`/api/events/${eventId}/checkin`, {
        qrCode: JSON.stringify({
          type: 'user_profile',
          userId: pendingUser._id,
          shareCode: pendingUser.shareCode,
          username: pendingUser.username
        }),
        confirmEntry: true // ✅ Tell backend to allow non-registered user
      });

      setShowConfirmation(false);
      setPendingUser(null);

      if (response.data.success) {
        showSuccessAlert({
          ...response.data,
          wasAdded: true // Indicate user was added to attendees
        });
      } else {
        showErrorAlert(response.data.message);
      }
    } catch (error) {
      console.error('❌ Confirm entry error:', error);
      showErrorAlert('Failed to confirm entry. Please try again.');
    }
  };

  const rejectNonAttendeeEntry = () => {
    setShowConfirmation(false);
    setPendingUser(null);
    Alert.alert(
      '❌ Entry Rejected',
      `${pendingUser?.username || 'User'} was not allowed to enter.`,
      [{ text: 'Scan Another', onPress: resetScanner }]
    );
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
const handleEventCheckInQR = async (qrData) => {
  console.log('📅 Processing event check-in QR:', qrData);
  
  try {
    // This is an event mass check-in QR code that the user scanned
    const response = await api.post(`/api/events/${qrData.eventId}/self-checkin`, {
      qrToken: qrData.token
    });

    if (response.data.success) {
      // Show success message with stats
      Alert.alert(
        '✅ Welcome!',
        `You've been checked in to ${qrData.eventTitle}!${response.data.wasAdded ? '\n(Added to attendees)' : ''}`,
        [
          { 
            text: 'View Event', 
            onPress: () => navigation.navigate('EventDetailsScreen', { eventId: qrData.eventId })
          },
          { text: 'Done', onPress: resetScanner }
        ]
      );
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('❌ Event check-in error:', error);
    
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      
      if (errorData.errorCode === 'FORM_REQUIRED') {
        // User needs to complete form first
        Alert.alert(
          '📋 Form Required',
          'You need to complete a form before checking in to this event.',
          [
            { text: 'Cancel', style: 'cancel', onPress: resetScanner },
            {
              text: 'Complete Form',
              onPress: () => {
                navigation.navigate('FormSubmissionScreen', {
                  formId: errorData.formId,
                  eventId: qrData.eventId,
                  isCheckIn: true,
                  onSubmissionComplete: () => {
                    navigation.goBack();
                    // Try check-in again after form completion
                    setTimeout(() => {
                      handleEventCheckInQR(qrData);
                    }, 500);
                  }
                });
              }
            }
          ]
        );
      } else if (errorData.errorCode === 'ALREADY_CHECKED_IN') {
        Alert.alert(
          '⚠️ Already Checked In',
          'You are already checked in to this event!',
          [
            { 
              text: 'View Event', 
              onPress: () => navigation.navigate('EventDetailsScreen', { eventId: qrData.eventId })
            },
            { text: 'Done', onPress: resetScanner }
          ]
        );
      } else if (errorData.errorCode === 'NOT_REGISTERED') {
        Alert.alert(
          '❌ Not Registered',
          'You must be registered for this event to check in. Please contact the event organizer.',
          [{ text: 'OK', onPress: resetScanner }]
        );
      } else if (errorData.errorCode === 'INVALID_TOKEN') {
        Alert.alert(
          '❌ Invalid Code',
          'This check-in code is invalid or has expired. Please ask the event organizer for a new one.',
          [{ text: 'OK', onPress: resetScanner }]
        );
      } else {
        showErrorAlert(errorData.message || 'Check-in failed');
      }
    } else {
      showErrorAlert(error.message || 'Check-in failed');
    }
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

  const showErrorAlert = (message) => {
    Alert.alert(
      '❌ Error',
      message,
      [
        { text: 'Try Again', onPress: resetScanner },
        { text: 'Cancel', onPress: () => navigation.goBack() }
      ]
    );
  };

  // Permission handling
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#667eea" />
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
        />
        {/* ✅ FIXED: Overlay moved outside CameraView to fix warning */}
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
              {processing ? 'Processing...' :
                isEventCheckin
                  ? requiresForm
                    ? 'Scan attendee QR codes to check them in\nForm will be required after scanning'
                    : 'Scan attendee QR codes to check them in'
                  : 'Point your camera at a QR code to scan'
              }
            </Text>
          </View>

          {/* Form Status Indicator */}
          {requiresForm && (
            <View style={styles.formStatusIndicator}>
              <Ionicons name="document-text" size={16} color="#FFFFFF" />
              <Text style={styles.formStatusText}>Form required for check-in</Text>
            </View>
          )}
        </View>
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
              navigation.replace('AttendeeListScreen', { eventId });
            }}
          >
            <Ionicons name="list" size={24} color="#FFFFFF" />
            <Text style={styles.manualButtonText}>Manual</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ NEW: Non-Attendee Confirmation Modal */}
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
                onPress={rejectNonAttendeeEntry}
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
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Camera styles
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'none', // Allow camera interactions to pass through
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00FF00',
    borderRadius: 12,
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
  
  // Bottom controls
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
  
  // Permission screen
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
  
  // Confirmation modal
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