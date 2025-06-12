// screens/QrScreen.js - Optimized with Dynamic QR Generation
import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Dimensions, Alert, Share,
  Animated, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function QrScreen() {
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const [qrData, setQrData] = useState(null);
  const [shareCode, setShareCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    fetchQrData();
  }, []);

  useEffect(() => {
    if (qrData) {
      // Animate in the QR code
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [qrData]);

  const fetchQrData = async () => {
    try {
      const response = await api.get('/api/qr/my-code');
      const { qrData: data, shareCode: code } = response.data;
      
      setQrData(JSON.stringify(data));
      setShareCode(code);
    } catch (error) {
      console.error('Error fetching QR data:', error);
      Alert.alert(
        'Error',
        'Unable to load your QR code. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScan = () => {
    navigation.navigate('QrScanScreen');
  };

  const handleShare = async () => {
    try {
      const shareOptions = {
        message: `Connect with ${currentUser?.username || 'me'} on our social app! Use code: ${shareCode}`,
        title: 'Connect with me',
      };

      await Share.share(shareOptions);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyCode = async () => {
    // For demo purposes - in a real app you'd copy to clipboard
    Alert.alert(
      'Share Code',
      `Your share code: ${shareCode}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Copy', 
          onPress: () => {
            // In a real app, you'd copy to clipboard using @react-native-clipboard/clipboard
            Alert.alert('Copied', 'Share code copied to clipboard');
          }
        }
      ]
    );
  };

  const handleRegenerateCode = async () => {
    Alert.alert(
      'Regenerate QR Code',
      'This will create a new QR code and invalidate your current one. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Regenerate', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await api.post('/api/qr/regenerate');
              const { qrData: data, shareCode: code } = response.data;
              
              setQrData(JSON.stringify(data));
              setShareCode(code);
              
              Alert.alert('Success', 'Your QR code has been regenerated');
            } catch (error) {
              console.error('Error regenerating QR code:', error);
              Alert.alert('Error', 'Failed to regenerate QR code');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>My QR Code</Text>
      
      <TouchableOpacity
        onPress={handleShare}
        style={styles.shareButton}
        activeOpacity={0.8}
      >
        <Ionicons name="share-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderProfileInfo = () => (
    <View style={styles.profileSection}>
      <View style={styles.profileImagePlaceholder}>
        <Ionicons name="person" size={40} color="#667eea" />
      </View>
      <Text style={styles.username}>@{currentUser?.username || 'user'}</Text>
      <Text style={styles.shareCodeText}>Share Code: {shareCode}</Text>
      <Text style={styles.subtitle}>
        Scan this code to connect with me instantly
      </Text>
    </View>
  );

  const renderQRCode = () => {
    if (loading) {
      return (
        <View style={styles.qrContainer}>
          <View style={styles.qrCodePlaceholder}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Generating QR Code...</Text>
          </View>
        </View>
      );
    }

    if (!qrData) {
      return (
        <View style={styles.qrContainer}>
          <View style={styles.qrCodeError}>
            <Ionicons name="alert-circle-outline" size={60} color="#FF6B6B" />
            <Text style={styles.errorText}>Unable to load QR Code</Text>
            <TouchableOpacity
              onPress={fetchQrData}
              style={styles.retryButton}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <Animated.View
        style={[
          styles.qrContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.qrWrapper}>
          <View style={styles.qrCodeBackground}>
            <QRCode
              value={qrData}
              size={220}
              color="#000000"
              backgroundColor="#FFFFFF"
              logo={require('../assets/icon.png')} // Add your app icon
              logoSize={30}
              logoBackgroundColor="transparent"
            />
          </View>
          
          {/* QR Code Frame Corners */}
          <View style={[styles.frameCorner, styles.topLeft]} />
          <View style={[styles.frameCorner, styles.topRight]} />
          <View style={[styles.frameCorner, styles.bottomLeft]} />
          <View style={[styles.frameCorner, styles.bottomRight]} />
        </View>
        
        <Text style={styles.qrInstructions}>
          Ask someone to scan this code with their camera
        </Text>
      </Animated.View>
    );
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        onPress={handleScan}
        style={styles.primaryActionButton}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradientButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="scan" size={24} color="#FFFFFF" />
          <Text style={styles.primaryActionButtonText}>Scan QR Code</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.secondaryActionsRow}>
        <TouchableOpacity
          onPress={handleCopyCode}
          style={styles.secondaryActionButton}
          activeOpacity={0.8}
        >
          <Ionicons name="copy-outline" size={20} color="#667eea" />
          <Text style={styles.secondaryActionButtonText}>Copy Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRegenerateCode}
          style={styles.secondaryActionButton}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={20} color="#667eea" />
          <Text style={styles.secondaryActionButtonText}>Regenerate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {renderHeader()}
        
        <View style={styles.content}>
          {renderProfileInfo()}
          {renderQRCode()}
        </View>
        
        {renderActionButtons()}
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  
  // Profile Section
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  shareCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // QR Code Container
  qrContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  qrWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  qrCodeBackground: {
    width: 260,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Frame Corners
  frameCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#667eea',
    borderWidth: 3,
  },
  topLeft: {
    top: -10,
    left: -10,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -10,
    right: -10,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -10,
    left: -10,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -10,
    right: -10,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  
  qrInstructions: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Placeholder States
  qrCodePlaceholder: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#667eea',
    fontWeight: '500',
  },
  qrCodeError: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Action Buttons
  actionButtonsContainer: {
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  primaryActionButton: {
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  secondaryActionButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});