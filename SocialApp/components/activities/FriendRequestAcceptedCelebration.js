// components/activities/FriendRequestAcceptedCelebration.js - Congratulatory Activity
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FriendRequestAcceptedCelebration = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { accepter, requester } = data;
  
  const [celebrationAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));

  useEffect(() => {
    // Start celebration animation
    Animated.sequence([
      Animated.timing(celebrationAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      )
    ]).start();
  }, []);

  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: accepter._id });
  };

  const handleSendMessage = () => {
    // Navigate to chat or message screen
    navigation.navigate('ChatScreen', { userId: accepter._id });
  };

  const handleDismiss = () => {
    // Remove this celebration activity
    onAction?.('dismiss', activity._id);
  };

  const celebrationScale = celebrationAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const celebrationOpacity = celebrationAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={accepter}
        timestamp={timestamp}
        activityType="friend_request_accepted"
        onUserPress={handleViewProfile}
        customIcon={{ name: 'people', color: '#34C759' }}
      />

      {/* Celebration Card */}
      <Animated.View 
        style={[
          styles.celebrationCard,
          {
            transform: [
              { scale: celebrationScale },
              { scale: pulseAnimation }
            ],
            opacity: celebrationOpacity,
          }
        ]}
      >
        <LinearGradient
          colors={['#34C759', '#30B04A', '#2BA043']}
          style={styles.celebrationGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Success Icon */}
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={32} color="#FFFFFF" />
          </View>

          {/* Celebration Text */}
          <Text style={styles.celebrationTitle}>🎉 You're now friends!</Text>
          <Text style={styles.celebrationSubtitle}>
            You and {accepter.username} are now connected
          </Text>

          {/* Friend Preview */}
          <TouchableOpacity 
            style={styles.friendPreview}
            onPress={handleViewProfile}
            activeOpacity={0.8}
          >
            <View style={styles.friendInfo}>
              {accepter.profilePicture ? (
                <Image
                  source={{ 
                    uri: accepter.profilePicture.startsWith('http') 
                      ? accepter.profilePicture 
                      : `http://${API_BASE_URL}:3000${accepter.profilePicture}` 
                  }}
                  style={styles.friendAvatar}
                />
              ) : (
                <View style={styles.defaultFriendAvatar}>
                  <Text style={styles.defaultFriendText}>
                    {accepter.username?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              
              <View style={styles.friendDetails}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {accepter.fullName || accepter.username}
                </Text>
                <Text style={styles.friendUsername} numberOfLines={1}>
                  @{accepter.username}
                </Text>
              </View>
            </View>
            
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSendMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble" size={18} color="#34C759" />
              <Text style={styles.actionButtonText}>Send Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleViewProfile}
              activeOpacity={0.8}
            >
              <Ionicons name="person" size={18} color="#34C759" />
              <Text style={styles.actionButtonText}>View Profile</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Dismiss Button */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        activeOpacity={0.7}
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginVertical: 8,
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  
  celebrationCard: {
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#34C759',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  celebrationGradient: {
    padding: 24,
    alignItems: 'center',
  },
  
  successIconContainer: {
    marginBottom: 16,
  },
  
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  celebrationSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  friendPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  
  defaultFriendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  
  defaultFriendText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  friendDetails: {
    flex: 1,
  },
  
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  
  friendUsername: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  
  actionButtonText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
  },
  
  dismissButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  
  dismissText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FriendRequestAcceptedCelebration;
