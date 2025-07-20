// SocialApp/screens/EventQrDisplayScreen.js - Phase 1 Updates

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Share,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import QRCode from 'react-native-qrcode-svg';
import api from '../services/api';

const EventQrDisplayScreen = ({ route, navigation }) => {
  const { eventId, eventTitle, qrData: initialQrData } = route.params;
  
  // State management
  const [qrData, setQrData] = useState(initialQrData || null);
  const [loading, setLoading] = useState(!initialQrData);
  const [stats, setStats] = useState({ checkedIn: 0, total: 0 });
  const [isProjectionMode, setIsProjectionMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Lock to portrait initially
    const setupOrientation = async () => {
      await ScreenOrientation.unlockAsync();
    };
    setupOrientation();

    // Cleanup on unmount
    return async () => {
      await ScreenOrientation.unlockAsync();
    };
  }, []);

  useEffect(() => {
    // Start pulse animation when QR data is available
    if (qrData) {
      const startPulse = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.95,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      startPulse();
    }
  }, [qrData]);

  useEffect(() => {
    // Load QR data if not provided
    if (!qrData) {
      loadEventQR();
    }
    
    // Load initial stats
    fetchStats();
    
    // Set up stats refresh interval
    const statsInterval = setInterval(fetchStats, 10000); // Every 10 seconds
    
    return () => clearInterval(statsInterval);
  }, []);

  // TEMPORARY: Use existing QR generation route
  const loadEventQR = async () => {
    try {
      setLoading(true);
      
      const response = await api.post(`/api/events/${eventId}/generate-checkin-qr`, {
        validityHours: 24
      });

      if (response.data.success) {
        setQrData(response.data.qrData);
        console.log('✅ Event QR loaded for projection');
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('❌ QR loading error:', error);
      Alert.alert('Error', 'Failed to load QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/checkin-stats`);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('❌ Stats fetch error:', error);
    }
  };

  const toggleProjectionMode = async () => {
    if (!isProjectionMode) {
      // Enter projection mode
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsProjectionMode(true);
      
      // Hide controls after delay
      setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 3000);
    } else {
      // Exit projection mode
      await ScreenOrientation.unlockAsync();
      setIsProjectionMode(false);
      setShowControls(true);
      
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  };

  const shareQR = async () => {
    try {
      const instructions = `🎉 Join ${eventTitle}!\n\n📱 Just scan this QR code when you arrive to check in instantly!\n\nSee you there! 🎊`;

      await Share.share({
        message: instructions,
        title: `${eventTitle} - Event Check-in QR`
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleScreenTap = () => {
    if (isProjectionMode) {
      // Toggle controls visibility in projection mode
      if (showControls) {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      } else {
        setShowControls(true);
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          if (isProjectionMode) {
            Animated.timing(controlsOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }).start(() => setShowControls(false));
          }
        }, 3000);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#667eea" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading QR code...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (!qrData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#667eea" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FFFFFF" />
          <Text style={styles.errorText}>Failed to load QR code</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadEventQR}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={1} 
      onPress={handleScreenTap}
    >
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#667eea" 
        hidden={isProjectionMode} 
      />
      
      {/* Header Controls */}
      {showControls && (
        <Animated.View 
          style={[styles.header, { opacity: controlsOpacity }]}
          pointerEvents={showControls ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={shareQR}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={20} color="#667eea" />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.projectionButton]}
              onPress={toggleProjectionMode}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isProjectionMode ? "contract-outline" : "expand-outline"} 
                size={20} 
                color="#FFFFFF" 
              />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                {isProjectionMode ? 'Exit' : 'Project'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Main QR Display */}
      <View style={styles.content}>
        <View style={styles.qrContainer}>
          <Animated.View 
            style={[
              styles.qrWrapper, 
              { 
                transform: [{ scale: pulseAnim }],
                width: isProjectionMode ? 400 : 280,
                height: isProjectionMode ? 400 : 280,
              }
            ]}
          >
            {/* Corner decorations */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            <QRCode
              value={JSON.stringify(qrData)}
              size={isProjectionMode ? 360 : 240}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </Animated.View>
        </View>

        {/* Event Info */}
        <View style={styles.instructionsContainer}>
          <Text style={[
            styles.instructionsTitle,
            { fontSize: isProjectionMode ? 32 : 24 }
          ]}>
            {eventTitle}
          </Text>
          <Text style={[
            styles.instructionsText,
            { fontSize: isProjectionMode ? 20 : 16 }
          ]}>
            Scan to check in instantly
          </Text>
          <Text style={[
            styles.statsText,
            { fontSize: isProjectionMode ? 24 : 18 }
          ]}>
            {stats.checkedIn} of {stats.total} checked in
          </Text>
          <Text style={[
            styles.permanentText,
            { fontSize: isProjectionMode ? 16 : 14 }
          ]}>
            QR code expires in 24 hours
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    minWidth: 70,
  },
  projectionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#667eea',
    marginTop: 4,
  },

  // Content
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  qrWrapper: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Corner decorations
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#667eea',
    borderWidth: 3,
  },
  topLeft: {
    top: -5,
    left: -5,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -5,
    right: -5,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -5,
    left: -5,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -5,
    right: -5,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },

  // Instructions
  instructionsContainer: {
    alignItems: 'center',
  },
  instructionsTitle: {
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionsText: {
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  statsText: {
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
    textAlign: 'center',
  },
  permanentText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
};

export default EventQrDisplayScreen;