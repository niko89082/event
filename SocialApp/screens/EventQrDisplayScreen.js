// screens/EventQRDisplayScreen.js - Full-screen QR display for mass check-in
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal,
  SafeAreaView, StatusBar, Dimensions, Animated, Share,
  ActivityIndicator, Platform, AppState
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function EventQRDisplayScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { eventId, eventTitle } = route.params;

  // QR Management State
  const [qrData, setQrData] = useState(null);
  const [qrExpiry, setQrExpiry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // UI State
  const [showControls, setShowControls] = useState(true);
  const [isProjectionMode, setIsProjectionMode] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    
    // Keep screen awake
    KeepAwake.activateKeepAwake();
    
    // Start with QR generation
    generateQR();
    
    // Set up stats polling
    const statsInterval = setInterval(fetchStats, 5000); // Every 5 seconds
    
    // Handle app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        fetchStats(); // Refresh when app becomes active
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      KeepAwake.deactivateKeepAwake();
      clearInterval(statsInterval);
      subscription?.remove();
      
      // Reset orientation
      ScreenOrientation.unlockAsync();
    };
  }, []);

  useEffect(() => {
    // Start pulse animation
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

    if (qrData) {
      startPulse();
    }
  }, [qrData]);

  const generateQR = async () => {
  try {
    setLoading(true);
    
    const response = await api.post(`/api/events/${eventId}/generate-mass-checkin-qr`, {
      validityHours: 24,
      allowNonRegistered: true  // ✅ Always true - anyone can check in
    });

    if (response.data.success) {
      setQrData(JSON.stringify(response.data.qrData));
      setQrExpiry(new Date(response.data.expiresAt));
      console.log('✅ Mass check-in QR generated (open to everyone)');
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('❌ QR generation error:', error);
    Alert.alert('Error', 'Failed to generate QR code. Please try again.');
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

  const deactivateQR = async () => {
    Alert.alert(
      'Deactivate QR Code',
      'Are you sure you want to stop mass check-in? People will no longer be able to check themselves in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/events/${eventId}/deactivate-mass-checkin-qr`);
              Alert.alert('Success', 'Mass check-in has been deactivated', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to deactivate QR code');
            }
          }
        }
      ]
    );
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
      await Share.share({
        message: `Join ${eventTitle}! Scan this QR code when you arrive to check in automatically.\n\nEvent check-in expires at: ${qrExpiry?.toLocaleString()}`,
        title: `${eventTitle} - Check-in QR`
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const getTimeRemaining = () => {
    if (!qrExpiry) return '';
    
    const now = new Date();
    const diff = qrExpiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `Expires in ${hours}h ${minutes}m`;
    }
    return `Expires in ${minutes}m`;
  };

  const renderControls = () => {
    if (!showControls) return null;

    return (
      <Animated.View style={[styles.controlsContainer, { opacity: controlsOpacity }]}>
        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {eventTitle}
            </Text>
            <Text style={styles.subtitle}>Mass Check-in</Text>
          </View>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowStatsModal(true)}
          >
            <Ionicons name="stats-chart" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => generateQR(false)}
          >
            <Ionicons name="refresh" size={20} color="#667eea" />
            <Text style={styles.actionButtonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={shareQR}
          >
            <Ionicons name="share" size={20} color="#667eea" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.projectionButton]}
            onPress={toggleProjectionMode}
          >
            <Ionicons 
              name={isProjectionMode ? "contract" : "expand"} 
              size={20} 
              color="#FFFFFF" 
            />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
              {isProjectionMode ? 'Exit' : 'Project'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deactivateButton]}
            onPress={deactivateQR}
          >
            <Ionicons name="stop" size={20} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Stop</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderQRCode = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Generating QR Code...</Text>
        </View>
      );
    }

    if (!qrData) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#FF6B6B" />
          <Text style={styles.errorText}>Failed to generate QR code</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => generateQR()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const qrSize = isProjectionMode ? 
      Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7 : 
      SCREEN_WIDTH * 0.7;

    return (
      <Animated.View 
        style={[
          styles.qrContainer,
          { transform: [{ scale: pulseAnim }] }
        ]}
      >
        <View style={styles.qrWrapper}>
          <QRCode
            value={qrData}
            size={qrSize}
            backgroundColor="white"
            color="black"
            logoMargin={2}
            logoSize={qrSize * 0.15}
          />
          
          {/* Corner indicators */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        {!isProjectionMode && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>
              Scan to Check In
            </Text>
            <Text style={styles.instructionsText}>
              Point your phone camera at this QR code to check in automatically
            </Text>
            {stats && (
              <Text style={styles.statsText}>
                {stats.checkedInCount} of {stats.totalAttendees} checked in
              </Text>
            )}
            <Text style={styles.expiryText}>
              {getTimeRemaining()}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderStatsModal = () => {
    return (
      <Modal
        visible={showStatsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Check-in Statistics</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {stats && (
              <View style={styles.statsContent}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Attendees</Text>
                  <Text style={styles.statValue}>{stats.totalAttendees}</Text>
                </View>
                
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Checked In</Text>
                  <Text style={[styles.statValue, { color: '#34C759' }]}>
                    {stats.checkedInCount}
                  </Text>
                </View>
                
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Not Checked In</Text>
                  <Text style={[styles.statValue, { color: '#FF6B6B' }]}>
                    {stats.notCheckedInCount}
                  </Text>
                </View>
                
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Check-in Rate</Text>
                  <Text style={styles.statValue}>{stats.checkInRate}%</Text>
                </View>

                {stats.lastCheckInTime && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Last Check-in</Text>
                    <Text style={styles.statValue}>
                      {new Date(stats.lastCheckInTime).toLocaleTimeString()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowStatsModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#000000"
        hidden={isProjectionMode}
      />
      
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.background}
      >
        <View style={styles.content}>
          {renderQRCode()}
        </View>
        
        {renderControls()}
        {renderStatsModal()}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  
  // Controls
  controlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  
  // Bottom Controls
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
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
    backgroundColor: '#667eea',
  },
  deactivateButton: {
    backgroundColor: '#FF6B6B',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#667eea',
    marginTop: 4,
  },
  
  // QR Code
  qrContainer: {
    alignItems: 'center',
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
  },
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
    marginTop: 30,
  },
  instructionsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  statsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  expiryText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  
  // Loading and Error States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 15,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  errorText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 15,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Stats Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    margin: 20,
    minWidth: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  statsContent: {
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});