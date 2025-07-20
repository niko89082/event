// SocialApp/screens/QrScanScreen.js - SIMPLIFIED VERSION

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

  // SIMPLIFIED: Main QR scan handler
  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);
    Vibration.vibrate(100);

    console.log('📊 QR Code Scanned:', { type, data, mode, eventId });

    processQRCode(data);
  };

  // SIMPLIFIED: Process any QR code
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

      // Handle based on QR type and scan mode
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

  // Handle user QR codes
  const handleUserQR = async (qrData) => {
    if (mode === 'checkin' && eventId) {
      // Host scanning user for event check-in
      await checkInUserToEvent(qrData);
    } else {
      // General user profile scan
      await viewUserProfile(qrData);
    }
  };

  // Handle event QR codes
  const handleEventQR = async (qrData) => {
    if (mode === 'checkin' && eventId) {
      // This shouldn't happen - host scanning event QR while in check-in mode
      Alert.alert(
        'Wrong QR Code',
        'You scanned an event QR code. Please scan a user QR code to check them in.',
        [{ text: 'Try Again', onPress: resetScanner }]
      );
    } else {
      // User scanning event QR for self check-in
      await selfCheckInToEvent(qrData);
    }
  };

  // Check in user to event (host scanning user QR)
  const checkInUserToEvent = async (qrData) => {
    try {
      const response = await api.post(`/api/events/${eventId}/scan-user-qr`, {
        qrData: qrData
      });

      if (response.data.success) {
        Alert.alert(
          '✅ Check-in Successful',
          `${response.data.user.username} has been checked in to ${eventTitle}!`,
          [
            { text: 'Check In Another', onPress: resetScanner },
            { text: 'Done', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      
      if (error.response?.data?.requiresForm) {
        Alert.alert(
          '📋 Form Required',
          `${qrData.username} needs to complete the check-in form first.`,
          [
            { text: 'OK', onPress: resetScanner }
          ]
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

  // Self check-in to event (user scanning event QR)
  const selfCheckInToEvent = async (qrData) => {
    try {
      const response = await api.post(`/api/events/${qrData.eventId}/self-checkin`);

      if (response.data.success) {
        const message = response.data.alreadyCheckedIn ? 
          response.data.message :
          response.data.message;
          
        Alert.alert(
          '🎉 Success!',
          message,
          [
            { 
              text: 'View Event', 
              onPress: () => navigation.navigate('EventDetailsScreen', { eventId: qrData.eventId })
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
          'Check-in Failed',
          errorMessage,
          [{ text: 'OK', onPress: resetScanner }]
        );
      }
    }
  };

  // View user profile (general scan)
  const viewUserProfile = async (qrData) => {
    try {
      const response = await api.post('/api/qr/scan', {
        qrData: qrData
      });

      if (response.data.success && response.data.type === 'user') {
        const user = response.data.user;
        
        Alert.alert(
          `👤 ${user.username}`,
          `${user.bio || 'No bio available'}`,
          [
            { text: 'Cancel', style: 'cancel', onPress: resetScanner },
            { 
              text: 'View Profile', 
              onPress: () => navigation.navigate('ProfileScreen', { userId: user._id })
            }
          ]
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

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {mode === 'checkin' ? `Check-in to ${eventTitle}` : 'Scan QR Code'}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleFlash}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={flash === 'on' ? "flash" : "flash-off"} 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleCameraFacing}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          flash={flash}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />

        {/* Scan Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            {/* Corner borders */}
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
                        outputRange: [0, 250],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            {processing ? 'Processing...' : 
             mode === 'checkin' ? 'Scan user QR code to check them in' :
             'Position QR code within the frame'}
          </Text>
        </View>
      </View>

      {/* Reset button when scanned */}
      {scanned && !processing && (
        <View style={styles.resetContainer}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetScanner}
            activeOpacity={0.7}
          >
            <Text style={styles.resetText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
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
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00FF00',
    shadowColor: '#00FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  instructions: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  resetText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default QrScanScreen;