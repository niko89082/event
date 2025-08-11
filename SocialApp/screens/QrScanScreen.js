// SocialApp/screens/QrScanScreen.js - COMPREHENSIVE VERSION with all functionality

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  StatusBar,
  Animated,
  SafeAreaView
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const QrScanScreen = ({ route, navigation }) => {
  const { eventId, eventTitle, mode = 'general' } = route.params || {};
  
  // States
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  
  // Animation
  const scanLineAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startScanLineAnimation();
  }, []);

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
  };

  // Main QR scan handler
  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);
    Vibration.vibrate(100);

    console.log('📊 QR Code Scanned:', { type, data, mode, eventId });

    processQRCode(data);
  };

  // Process any QR code
  const processQRCode = async (rawData) => {
    try {
      // Parse QR data
      let qrData;
      try {
        qrData = JSON.parse(rawData);
      } catch (parseError) {
        throw new Error('Invalid QR code format');
      }

      console.log('✅ Parsed QR data:', qrData);

      // Handle based on QR type and current mode
      if (qrData.type === 'user') {
        await handleUserQR(qrData);
      } else if (qrData.type === 'event') {
        await handleEventQR(qrData);
      } else {
        throw new Error('Unsupported QR code type');
      }

    } catch (error) {
      console.error('❌ QR processing error:', error);
      Alert.alert(
        'Invalid QR Code',
        error.message || 'This QR code could not be processed.',
        [{ text: 'Try Again', onPress: resetScanner }]
      );
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // 1. HANDLE USER QR CODES
  // ============================================
  const handleUserQR = async (qrData) => {
    if (mode === 'checkin' && eventId) {
      // HOST/COHOST MODE: Scanning user for event check-in
      await hostCheckInUser(qrData);
    } else {
      // GENERAL MODE: View user profile and optionally add as friend
      await viewUserProfileAndConnect(qrData);
    }
  };

  // ============================================
  // 2. HANDLE EVENT QR CODES  
  // ============================================
  const handleEventQR = async (qrData) => {
    if (mode === 'checkin' && eventId) {
      // HOST scanning event QR (shouldn't happen, show error)
      Alert.alert(
        'Wrong QR Code',
        'You scanned an event QR code. Please scan a user QR code to check them in.',
        [{ text: 'Try Again', onPress: resetScanner }]
      );
    } else {
      // USER MODE: Join/check-in to event
      await userJoinEvent(qrData);
    }
  };

  // ============================================
  // HOST FUNCTIONALITY: Check-in users to event
  // ============================================
  const hostCheckInUser = async (qrData) => {
    try {
      console.log('🏃‍♂️ Host checking in user to event:', eventId);
      
      const response = await api.post(`/api/events/${eventId}/scan-user-qr`, {
        qrData: qrData
      });

      if (response.data.success) {
        // SUCCESS: User checked in
        Alert.alert(
          '✅ Check-in Successful',
          `${response.data.user.username} has been checked in to ${eventTitle}!`,
          [
            { text: 'Check In Another', onPress: resetScanner },
            { text: 'Done', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        // Handle different error statuses
        const responseData = response.data;
        const user = responseData.user;

        if (responseData.status === 'not_registered') {
          // USER NOT REGISTERED: Show Allow/Reject prompt
          Alert.alert(
            '❓ User Not Registered',
            `${user.username} is not registered for ${eventTitle}.\n\nWould you like to add them to the event and check them in?`,
            [
              { 
                text: 'Reject', 
                style: 'destructive', 
                onPress: resetScanner 
              },
              { 
                text: 'Allow & Check In', 
                onPress: () => addUserToEventAndCheckIn(user)
              }
            ]
          );
        } else if (responseData.status === 'already_checked_in') {
          // ALREADY CHECKED IN
          Alert.alert(
            'Already Checked In',
            `${user.username} is already checked in to ${eventTitle}.`,
            [{ text: 'OK', onPress: resetScanner }]
          );
        } else {
          // OTHER ERRORS
          Alert.alert(
            'Check-in Failed',
            responseData.message || 'An error occurred during check-in.',
            [{ text: 'Try Again', onPress: resetScanner }]
          );
        }
      }
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || error.message;
      
      if (errorData?.requiresForm) {
        Alert.alert(
          '📋 Form Required',
          'This user needs to complete the check-in form first.',
          [{ text: 'OK', onPress: resetScanner }]
        );
      } else {
        Alert.alert(
          'Check-in Failed',
          errorMessage,
          [{ text: 'Try Again', onPress: resetScanner }]
        );
      }
    }
  };

  // Add unregistered user to event and check them in
  const addUserToEventAndCheckIn = async (user) => {
    try {
      setProcessing(true);

      // Use manual check-in endpoint with confirmEntry to add and check in
      const response = await api.post(`/api/events/${eventId}/manual-checkin`, { 
        userId: user._id,
        confirmEntry: true,  // Allow adding unregistered users
        autoAdd: true        // Flag to indicate this is an auto-add scenario
      });

      if (response.data.success) {
        Alert.alert(
          '✅ Success!',
          `${user.username} has been added to the event and checked in!`,
          [
            { text: 'Check In Another', onPress: resetScanner },
            { text: 'Done', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        throw new Error(response.data.message || 'Failed to add user to event');
      }

    } catch (error) {
      console.error('❌ Error adding user to event:', error);
      const errorMessage = error.response?.data?.message || error.message;
      
      Alert.alert(
        'Failed to Add User',
        errorMessage,
        [{ text: 'Try Again', onPress: resetScanner }]
      );
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // USER FUNCTIONALITY: Join/check-in to events
  // ============================================
  const userJoinEvent = async (qrData) => {
    try {
      console.log('🎉 User joining/checking into event:', qrData.eventId);

      const response = await api.post(`/api/events/${qrData.eventId}/self-checkin`);

      if (response.data.success) {
        const isAlreadyCheckedIn = response.data.alreadyCheckedIn;
        const wasAdded = response.data.wasAdded;
        
        let message = response.data.message;
        if (wasAdded && !isAlreadyCheckedIn) {
          message += "\n\nYou've been added to the event!";
        }
          
        Alert.alert(
          '🎉 Success!',
          message,
          [
            { 
              text: 'View Event', 
              onPress: () => {
                navigation.goBack(); // Close scanner
                navigation.navigate('EventDetailsScreen', { eventId: qrData.eventId });
              }
            },
            { text: 'Done', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || error.message;
      
      if (errorData?.requiresForm) {
        const wasAddedText = errorData.wasAdded ? 
          "\n\nYou've been added to the event! " : "";
          
        Alert.alert(
          '📋 Form Required',
          `${errorMessage}${wasAddedText}`,
          [
            { text: 'Later', onPress: resetScanner },
            { 
              text: 'Complete Form', 
              onPress: () => {
                navigation.goBack(); // Close scanner first
                navigation.navigate('FormSubmissionScreen', { 
                  formId: errorData.formId,
                  eventId: qrData.eventId,
                  isCheckIn: true
                });
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Join Failed',
          errorMessage,
          [{ text: 'OK', onPress: resetScanner }]
        );
      }
    }
  };

  // ============================================
  // SOCIAL FUNCTIONALITY: View profile and add friend
  // ============================================
  const viewUserProfileAndConnect = async (qrData) => {
    try {
      console.log('👤 Viewing user profile and checking friendship status');
      
      const response = await api.post('/api/qr/scan', {
        qrData: qrData
      });

      if (response.data.success && response.data.type === 'user') {
        const user = response.data.user;
        
        // Get current friendship status to determine available actions
        let friendshipStatus = 'not-friends';
        try {
          const friendshipResponse = await api.get(`/api/friends/status/${user._id}`);
          friendshipStatus = friendshipResponse.data.status;
        } catch (friendshipError) {
          console.log('Could not fetch friendship status, defaulting to not-friends');
        }

        // Determine action buttons based on friendship status
        let actionButtons = [
          { text: 'Cancel', style: 'cancel', onPress: resetScanner }
        ];

        // Always allow viewing profile
        actionButtons.push({
          text: 'View Profile', 
          onPress: () => {
            navigation.goBack(); // Close scanner
            navigation.navigate('ProfileScreen', { userId: user._id });
          }
        });

        // Add friend-related actions based on status
        if (friendshipStatus === 'not-friends') {
          actionButtons.push({
            text: 'Add Friend',
            onPress: () => sendFriendRequest(user)
          });
        } else if (friendshipStatus === 'request-sent') {
          // Don't add button, just show in bio text
        } else if (friendshipStatus === 'request-received') {
          actionButtons.push({
            text: 'Accept Request',
            onPress: () => acceptFriendRequest(user)
          });
        }

        // Create bio text with friendship status
        let bioText = user.bio || 'No bio available';
        if (friendshipStatus === 'friends') {
          bioText += '\n\n✅ You are friends';
        } else if (friendshipStatus === 'request-sent') {
          bioText += '\n\n⏳ Friend request sent';
        } else if (friendshipStatus === 'request-received') {
          bioText += '\n\n📥 Wants to be your friend';
        }
        
        Alert.alert(
          `👤 ${user.username}`,
          bioText,
          actionButtons
        );
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      Alert.alert(
        'Scan Failed',
        errorMessage,
        [{ text: 'Try Again', onPress: resetScanner }]
      );
    }
  };

  // Send friend request
  const sendFriendRequest = async (user) => {
    try {
      const response = await api.post(`/api/friends/request/${user._id}`);
      
      if (response.data.success) {
        Alert.alert(
          '✅ Friend Request Sent',
          `Friend request sent to ${user.username}!`,
          [
            { text: 'View Profile', onPress: () => navigation.navigate('ProfileScreen', { userId: user._id }) },
            { text: 'Done', onPress: resetScanner }
          ]
        );
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      Alert.alert(
        'Failed to Send Request',
        errorMessage,
        [{ text: 'OK', onPress: resetScanner }]
      );
    }
  };

  // Accept friend request
  const acceptFriendRequest = async (user) => {
    try {
      const response = await api.post(`/api/friends/accept/${user._id}`);
      
      if (response.data.success) {
        Alert.alert(
          '🎉 Now Friends!',
          `You and ${user.username} are now friends!`,
          [
            { text: 'View Profile', onPress: () => navigation.navigate('ProfileScreen', { userId: user._id }) },
            { text: 'Done', onPress: resetScanner }
          ]
        );
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      Alert.alert(
        'Failed to Accept Request',
        errorMessage,
        [{ text: 'OK', onPress: resetScanner }]
      );
    }
  };

  // ============================================
  // UI CONTROLS
  // ============================================
  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  // ============================================
  // ERROR HANDLING
  // ============================================
  if (!eventId && mode === 'checkin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No event specified for check-in mode</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  const getInstructionText = () => {
    if (processing) return 'Processing...';
    
    if (mode === 'checkin') {
      return 'Point camera at a user QR code to check them in';
    } else {
      return 'Scan any QR code - user profiles or events';
    }
  };

  const getHeaderTitle = () => {
    switch (mode) {
      case 'checkin':
        return 'Check In Attendees';
      default:
        return 'Scan QR Code';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.title}>{getHeaderTitle()}</Text>
          {eventTitle && mode === 'checkin' && (
            <Text style={styles.subtitle}>{eventTitle}</Text>
          )}
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerAction}
            onPress={toggleFlash}
          >
            <Ionicons 
              name={flash === 'on' ? 'flash' : 'flash-off'} 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerAction}
            onPress={toggleCameraFacing}
          >
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          flash={flash}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          {/* Scan Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={styles.scanFrame}>
                {/* Corner indicators */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                
                {/* Animated scan line */}
                <Animated.View 
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        {
                          translateY: scanLineAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 200],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </CameraView>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          {getInstructionText()}
        </Text>
        
        {mode === 'general' && (
          <Text style={styles.instructionSubtext}>
            • User QR: View profile & add friend{'\n'}
            • Event QR: Join & check-in to event
          </Text>
        )}
        
        {scanned && !processing && (
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={resetScanner}
          >
            <Text style={styles.resetButtonText}>Tap to scan again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerAction: {
    padding: 8,
    marginLeft: 8,
  },

  // Camera
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  
  // Overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  
  // Corner indicators
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  
  // Scan line
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00FF00',
    shadowColor: '#00FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },

  // Instructions
  instructions: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  instructionSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 16,
  },
  resetButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3797EF',
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },
});

export default QrScanScreen;