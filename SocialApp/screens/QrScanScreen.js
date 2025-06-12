// // screens/QrScanScreen.js
// import React, { useState } from 'react';
// import { View, Text, Button, StyleSheet, TouchableOpacity, Image } from 'react-native';
// import {
//   CameraView,
//   CameraType,
//   useCameraPermissions
// } from 'expo-camera'; // "expo-camera"
// import api from '../services/api';
// import { useRoute, useNavigation } from '@react-navigation/native';

// export default function QrScanScreen() {
//   const route = useRoute();
//   const navigation = useNavigation();

//   // We'll expect route.params.eventId if scanning is for an event check-in
//   const { eventId } = route.params || {};

//   // Request camera permissions
//   const [permission, requestPermission] = useCameraPermissions();
//   // Which camera? front or back
//   const [cameraType, setCameraType] = useState('back');

//   // Whether scanning is active
//   const [scanned, setScanned] = useState(false);
//   const [scannedData, setScannedData] = useState('');

//   // If you want to display checkin results (success/not_attendee)
//   const [checkInResult, setCheckInResult] = useState(null);

//   if (!permission) {
//     // Permission is still loading
//     return <View />;
//   }

//   if (!permission.granted) {
//     // Permission not granted yet
//     return (
//       <View style={styles.permissionContainer}>
//         <Text style={styles.permissionText}>We need your permission to use the camera</Text>
//         <Button title="Grant Permission" onPress={requestPermission} />
//       </View>
//     );
//   }

//   // Flip camera front/back
//   const toggleCameraFacing = () => {
//     setCameraType((prev) => (prev === 'back' ? 'front' : 'back'));
//   };

//   // Called whenever the camera successfully scans a code
//   // By default, it scans many barcodes, but we filter to "qr" with `barcodeScannerSettings`
//   const handleBarcodeScanned = async (scanningResult) => {
//     // scanningResult has shape: { data, type, ... }
//     if (scanned) return; // If we've already scanned, ignore further scans

//     setScanned(true);
//     const { data: scannedUserId } = scanningResult;

//     setScannedData(scannedUserId || '');

//     // If we're doing event check-in logic:
//     if (eventId) {
//       try {
//         // Suppose your endpoint is /events/:eventId/checkin
//         const res = await api.post(`/events/${eventId}/checkin`, {
//           scannedUserId,
//         });
//         setCheckInResult(res.data); // e.g. { status: 'success', user: {...} } or not_attendee
//       } catch (err) {
//         console.log('Check-in error =>', err.response?.data || err);
//         setCheckInResult({
//           status: 'error',
//           message: err.response?.data?.message || 'Failed to check in user.',
//         });
//       }
//     }
//   };

//   // For scanning again or closing popup
//   const resetScan = () => {
//     setScanned(false);
//     setScannedData('');
//     setCheckInResult(null);
//   };

//   // If user wants to override or add an attendee
//   const handleOverride = async () => {
//     if (!checkInResult?.user?._id || !eventId) return;
//     try {
//       // e.g. /events/:eventId/attend
//       await api.post(`/events/${eventId}/attend`, {
//         userId: checkInResult.user._id,
//       });
//       // Switch status to success
//       setCheckInResult((prev) => ({
//         ...prev,
//         status: 'success',
//       }));
//     } catch (err) {
//       console.log('Override error =>', err.response?.data || err);
//     }
//   };

//   // Go to user profile if success
//   const handleViewProfile = () => {
//     if (checkInResult?.user?._id) {
//       navigation.navigate('ProfileScreen', { userId: checkInResult.user._id });
//     }
//     resetScan();
//   };

//   // Render the final "Pop-up" or result info if we have checkInResult
//   const renderCheckInPopup = () => {
//     if (!checkInResult) return null;

//     // If "success"
//     if (checkInResult.status === 'success') {
//       return (
//         <View style={[styles.resultContainer, styles.successBg]}>
//           <Text style={styles.resultText}>Checked In!</Text>
//           {checkInResult.user?.profilePicture && (
//             <Image
//               source={{ uri: checkInResult.user.profilePicture }}
//               style={styles.profilePic}
//             />
//           )}
//           <Text style={styles.resultName}>{checkInResult.user?.username}</Text>
//           <Button title="View Profile" onPress={handleViewProfile} />
//           <Button title="Close" onPress={resetScan} />
//         </View>
//       );
//     }

//     // If "not_attendee"
//     if (checkInResult.status === 'not_attendee') {
//       return (
//         <View style={[styles.resultContainer, styles.errorBg]}>
//           <Text style={styles.resultText}>User not in Attendees</Text>
//           {checkInResult.user?.profilePicture && (
//             <Image
//               source={{ uri: checkInResult.user.profilePicture }}
//               style={styles.profilePic}
//             />
//           )}
//           <Text style={styles.resultName}>{checkInResult.user?.username}</Text>
//           <Text style={styles.resultText}>Allow them in anyway?</Text>
//           <View style={styles.actionRow}>
//             <Button title="Yes" onPress={handleOverride} />
//             <Button title="No" onPress={resetScan} />
//           </View>
//         </View>
//       );
//     }

//     // If "error"
//     if (checkInResult.status === 'error') {
//       return (
//         <View style={[styles.resultContainer, styles.errorBg]}>
//           <Text style={styles.resultText}>Error: {checkInResult.message}</Text>
//           <Button title="Close" onPress={resetScan} />
//         </View>
//       );
//     }

//     return null;
//   };

//   // If we have scanned but no checkInResult => show scanned data
//   if (scanned && !checkInResult && scannedData) {
//     return (
//       <View style={styles.container}>
//         <Text style={styles.resultText}>Scanned: {scannedData}</Text>
//         <Button title="Scan Again" onPress={resetScan} />
//         <Button title="Go Back" onPress={() => navigation.goBack()} />
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       {/* The camera preview, only if we haven't scanned or we want to keep scanning */}
//       {!scanned && !checkInResult && (
//         <CameraView
//           style={styles.camera}
//           facing={cameraType} // 'front' or 'back'
//           onBarcodeScanned={handleBarcodeScanned}
//           // Only scan QR codes
//           barcodeScannerSettings={{
//             barcodeTypes: ['qr'],
//           }}
//         >
//           <View style={styles.overlay}>
//             <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
//               <Text style={styles.flipText}>Flip Camera</Text>
//             </TouchableOpacity>
//           </View>
//         </CameraView>
//       )}

//       {/* Render pop-up if we have checkInResult (success, not_attendee, or error) */}
//       {renderCheckInPopup()}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#000' },
//   permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
//   permissionText: { marginBottom: 12, textAlign: 'center' },

//   camera: { flex: 1 },
//   overlay: {
//     flex: 1,
//     backgroundColor: 'transparent',
//     justifyContent: 'flex-end',
//     margin: 20,
//   },
//   flipButton: {
//     alignSelf: 'flex-end',
//     backgroundColor: 'rgba(0,0,0,0.3)',
//     padding: 10,
//     borderRadius: 8,
//   },
//   flipText: {
//     color: '#fff',
//     fontSize: 16,
//   },

//   // CheckIn result container popup
//   resultContainer: {
//     position: 'absolute',
//     top: '25%',
//     left: '10%',
//     right: '10%',
//     padding: 16,
//     borderRadius: 10,
//     alignItems: 'center',
//     zIndex: 999,
//   },
//   successBg: {
//     backgroundColor: 'rgba(0, 200, 0, 0.9)',
//   },
//   errorBg: {
//     backgroundColor: 'rgba(200, 0, 0, 0.9)',
//   },
//   resultText: {
//     fontSize: 18,
//     color: '#fff',
//     marginBottom: 12,
//     textAlign: 'center',
//   },
//   resultName: {
//     fontSize: 16,
//     color: '#fff',
//     marginBottom: 12,
//   },
//   profilePic: {
//     width: 80, height: 80,
//     borderRadius: 40,
//     marginBottom: 12,
//   },
//   actionRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     width: '60%',
//     marginTop: 10,
//   },
// });

// screens/QrScanScreen.js - Optimized QR Scanner
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  SafeAreaView, StatusBar, Dimensions, Animated,
  Platform, Vibration
} from 'react-native';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function QrScanScreen() {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scanningActive, setScanningActive] = useState(true);
  
  // Animation values
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    getCameraPermissions();
    startAnimations();
    
    // Fade in the interface
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const startAnimations = () => {
    // Scanning line animation
    const scanAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // Pulse animation for corners
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    scanAnimation.start();
    pulseAnimation.start();
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || !scanningActive) return;

    setScanned(true);
    setScanningActive(false);
    
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Vibration.vibrate();
    } else {
      Vibration.vibrate(100);
    }

    try {
      let qrData;
      
      // Try to parse as JSON first
      try {
        qrData = JSON.parse(data);
      } catch {
        // If not JSON, treat as direct share code
        qrData = data;
      }

      // Call the optimized scan API
      const response = await api.post('/api/qr/scan', {
        qrData: qrData
      });

      if (response.data.success) {
        const user = response.data.user;
        
        Alert.alert(
          'User Found!',
          `Connect with ${user.username}?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resetScanner(),
            },
            {
              text: 'View Profile',
              onPress: () => {
                navigation.navigate('ProfileScreen', { userId: user._id });
              },
            },
            {
              text: user.isFollowing ? 'Already Following' : 'Follow',
              onPress: user.isFollowing ? 
                () => navigation.navigate('ProfileScreen', { userId: user._id }) :
                () => handleQuickFollow(qrData),
              style: user.isFollowing ? 'default' : 'destructive'
            },
          ]
        );
      } else {
        Alert.alert(
          'Invalid QR Code',
          response.data.message || 'This QR code is not recognized.',
          [{ text: 'Try Again', onPress: resetScanner }]
        );
      }
    } catch (error) {
      console.error('QR scan error:', error);
      
      let errorMessage = 'Unable to process this QR code. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert(
        'Scan Error',
        errorMessage,
        [{ text: 'Try Again', onPress: resetScanner }]
      );
    }
  };

  const handleQuickFollow = async (qrData) => {
    try {
      let shareCode;
      
      if (typeof qrData === 'string') {
        shareCode = qrData;
      } else if (qrData && qrData.shareCode) {
        shareCode = qrData.shareCode;
      }

      const response = await api.post('/api/qr/quick-follow', {
        shareCode: shareCode
      });

      if (response.data.success) {
        const action = response.data.action;
        const message = action === 'followed' 
          ? 'You are now following this user!'
          : 'Follow request sent successfully!';

        Alert.alert(
          'Success!',
          message,
          [
            {
              text: 'View Profile',
              onPress: () => {
                // We need to get the user ID from the scan response
                // Let's navigate back and let them manually navigate
                navigation.goBack();
              },
            },
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Quick follow error:', error);
      Alert.alert(
        'Follow Error',
        error.response?.data?.message || 'Unable to follow this user. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setScanningActive(true);
  };

  const toggleFlash = () => {
    setIsFlashOn(!isFlashOn);
  };

  const renderPermissionRequest = () => (
    <View style={styles.permissionContainer}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.permissionBackground}
      >
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={80} color="#FFFFFF" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            We need access to your camera to scan QR codes and connect with other users.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={getCameraPermissions}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.headerButton}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Scan QR Code</Text>
      
      <TouchableOpacity
        onPress={toggleFlash}
        style={[styles.headerButton, isFlashOn && styles.flashActive]}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={isFlashOn ? "flash" : "flash-off"} 
          size={24} 
          color="#FFFFFF" 
        />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderScanningOverlay = () => (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Top overlay */}
      <View style={styles.overlayTop}>
        <Text style={styles.instructionText}>
          Position the QR code within the frame
        </Text>
      </View>

      {/* Middle section with scanning frame */}
      <View style={styles.overlayMiddle}>
        <View style={styles.overlayLeft} />
        
        <View style={styles.scanFrame}>
          {/* Corner indicators */}
          <Animated.View style={[styles.cornerContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </Animated.View>

          {/* Scanning line */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [
                  {
                    translateY: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 200],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        
        <View style={styles.overlayRight} />
      </View>

      {/* Bottom overlay */}
      <View style={styles.overlayBottom}>
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('QrScreen')}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>My QR</Text>
          </TouchableOpacity>

          {scanned && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={resetScanner}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.helpText}>
          Point your camera at a QR code to scan it
        </Text>
      </View>
    </Animated.View>
  );

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }

  if (hasPermission === false) {
    return renderPermissionRequest();
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <Camera
        style={styles.camera}
        type={Camera.Constants.Type.back}
        flashMode={isFlashOn ? Camera.Constants.FlashMode.torch : Camera.Constants.FlashMode.off}
        onBarCodeScanned={scanningActive ? handleBarCodeScanned : undefined}
        barCodeScannerSettings={{
          barCodeTypes: ['qr'],
        }}
      >
        {renderHeader()}
        {renderScanningOverlay()}
      </Camera>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  // Camera
  camera: {
    flex: 1,
  },

  // Permission Request
  permissionContainer: {
    flex: 1,
  },
  permissionBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashActive: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 250,
  },
  overlayLeft: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayRight: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 30,
  },

  // Instruction Text
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Scan Frame
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#00FF88',
    borderWidth: 4,
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

  // Scan Line
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00FF88',
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  // Bottom Actions
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 80,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  helpText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
});