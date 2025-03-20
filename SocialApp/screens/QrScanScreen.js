// screens/QrScanScreen.js
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
  CameraView,
  CameraType,
  useCameraPermissions
} from 'expo-camera'; // "expo-camera"
import api from '../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function QrScanScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // We'll expect route.params.eventId if scanning is for an event check-in
  const { eventId } = route.params || {};

  // Request camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  // Which camera? front or back
  const [cameraType, setCameraType] = useState('back');

  // Whether scanning is active
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState('');

  // If you want to display checkin results (success/not_attendee)
  const [checkInResult, setCheckInResult] = useState(null);

  if (!permission) {
    // Permission is still loading
    return <View />;
  }

  if (!permission.granted) {
    // Permission not granted yet
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to use the camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  // Flip camera front/back
  const toggleCameraFacing = () => {
    setCameraType((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // Called whenever the camera successfully scans a code
  // By default, it scans many barcodes, but we filter to "qr" with `barcodeScannerSettings`
  const handleBarcodeScanned = async (scanningResult) => {
    // scanningResult has shape: { data, type, ... }
    if (scanned) return; // If we've already scanned, ignore further scans

    setScanned(true);
    const { data: scannedUserId } = scanningResult;

    setScannedData(scannedUserId || '');

    // If we're doing event check-in logic:
    if (eventId) {
      try {
        // Suppose your endpoint is /events/:eventId/checkin
        const res = await api.post(`/events/${eventId}/checkin`, {
          scannedUserId,
        });
        setCheckInResult(res.data); // e.g. { status: 'success', user: {...} } or not_attendee
      } catch (err) {
        console.log('Check-in error =>', err.response?.data || err);
        setCheckInResult({
          status: 'error',
          message: err.response?.data?.message || 'Failed to check in user.',
        });
      }
    }
  };

  // For scanning again or closing popup
  const resetScan = () => {
    setScanned(false);
    setScannedData('');
    setCheckInResult(null);
  };

  // If user wants to override or add an attendee
  const handleOverride = async () => {
    if (!checkInResult?.user?._id || !eventId) return;
    try {
      // e.g. /events/:eventId/attend
      await api.post(`/events/${eventId}/attend`, {
        userId: checkInResult.user._id,
      });
      // Switch status to success
      setCheckInResult((prev) => ({
        ...prev,
        status: 'success',
      }));
    } catch (err) {
      console.log('Override error =>', err.response?.data || err);
    }
  };

  // Go to user profile if success
  const handleViewProfile = () => {
    if (checkInResult?.user?._id) {
      navigation.navigate('ProfileScreen', { userId: checkInResult.user._id });
    }
    resetScan();
  };

  // Render the final "Pop-up" or result info if we have checkInResult
  const renderCheckInPopup = () => {
    if (!checkInResult) return null;

    // If "success"
    if (checkInResult.status === 'success') {
      return (
        <View style={[styles.resultContainer, styles.successBg]}>
          <Text style={styles.resultText}>Checked In!</Text>
          {checkInResult.user?.profilePicture && (
            <Image
              source={{ uri: checkInResult.user.profilePicture }}
              style={styles.profilePic}
            />
          )}
          <Text style={styles.resultName}>{checkInResult.user?.username}</Text>
          <Button title="View Profile" onPress={handleViewProfile} />
          <Button title="Close" onPress={resetScan} />
        </View>
      );
    }

    // If "not_attendee"
    if (checkInResult.status === 'not_attendee') {
      return (
        <View style={[styles.resultContainer, styles.errorBg]}>
          <Text style={styles.resultText}>User not in Attendees</Text>
          {checkInResult.user?.profilePicture && (
            <Image
              source={{ uri: checkInResult.user.profilePicture }}
              style={styles.profilePic}
            />
          )}
          <Text style={styles.resultName}>{checkInResult.user?.username}</Text>
          <Text style={styles.resultText}>Allow them in anyway?</Text>
          <View style={styles.actionRow}>
            <Button title="Yes" onPress={handleOverride} />
            <Button title="No" onPress={resetScan} />
          </View>
        </View>
      );
    }

    // If "error"
    if (checkInResult.status === 'error') {
      return (
        <View style={[styles.resultContainer, styles.errorBg]}>
          <Text style={styles.resultText}>Error: {checkInResult.message}</Text>
          <Button title="Close" onPress={resetScan} />
        </View>
      );
    }

    return null;
  };

  // If we have scanned but no checkInResult => show scanned data
  if (scanned && !checkInResult && scannedData) {
    return (
      <View style={styles.container}>
        <Text style={styles.resultText}>Scanned: {scannedData}</Text>
        <Button title="Scan Again" onPress={resetScan} />
        <Button title="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* The camera preview, only if we haven't scanned or we want to keep scanning */}
      {!scanned && !checkInResult && (
        <CameraView
          style={styles.camera}
          facing={cameraType} // 'front' or 'back'
          onBarcodeScanned={handleBarcodeScanned}
          // Only scan QR codes
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Text style={styles.flipText}>Flip Camera</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      )}

      {/* Render pop-up if we have checkInResult (success, not_attendee, or error) */}
      {renderCheckInPopup()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  permissionText: { marginBottom: 12, textAlign: 'center' },

  camera: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    margin: 20,
  },
  flipButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 10,
    borderRadius: 8,
  },
  flipText: {
    color: '#fff',
    fontSize: 16,
  },

  // CheckIn result container popup
  resultContainer: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 999,
  },
  successBg: {
    backgroundColor: 'rgba(0, 200, 0, 0.9)',
  },
  errorBg: {
    backgroundColor: 'rgba(200, 0, 0, 0.9)',
  },
  resultText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultName: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  profilePic: {
    width: 80, height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
    marginTop: 10,
  },
});