// components/SwipeableNotificationItem.js - Phase 2: Swipe-to-delete component
import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Text,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Try to import Haptics, fallback gracefully if not available
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (error) {
  console.log('Haptics not available, using fallback');
  Haptics = {
    impactAsync: () => Promise.resolve(),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }
  };
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80; // Distance needed to trigger delete
const DELETE_BUTTON_WIDTH = 80;

export default function SwipeableNotificationItem({
  children,
  onDelete,
  disabled = false,
  item, // The notification item
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (disabled || isDeleting) return false;
        
        // Only respond to horizontal swipes
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMovement = Math.abs(gestureState.dx) > 10;
        
        return isHorizontal && hasMovement;
      },
      
      onPanResponderGrant: () => {
        if (disabled || isDeleting) return;
        
        // Light haptic feedback when gesture starts
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
          // Silently handle haptics error
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        if (disabled || isDeleting) return;
        
        // Only allow left swipe (negative dx) to reveal delete
        const newTranslateX = Math.min(0, Math.max(-DELETE_BUTTON_WIDTH * 1.5, gestureState.dx));
        translateX.setValue(newTranslateX);
        
        // Trigger haptic feedback when threshold is crossed
        if (!isRevealed && Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (error) {
            // Silently handle haptics error
          }
          setIsRevealed(true);
        } else if (isRevealed && Math.abs(gestureState.dx) < SWIPE_THRESHOLD) {
          setIsRevealed(false);
        }
      },

      onPanResponderRelease: (evt, gestureState) => {
        if (disabled || isDeleting) return;
        
        const shouldReveal = Math.abs(gestureState.dx) > SWIPE_THRESHOLD;
        
        if (shouldReveal) {
          // Reveal delete button
          Animated.spring(translateX, {
            toValue: -DELETE_BUTTON_WIDTH,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start();
          setIsRevealed(true);
        } else {
          // Snap back to original position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start();
          setIsRevealed(false);
        }
      },
    })
  ).current;

  const closeRow = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
    setIsRevealed(false);
  };

  const handleDelete = () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    // Haptic feedback for delete action
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      // Silently handle haptics error
    }
    
    // Animate out and then call delete
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(new Animated.Value(1), {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start(() => {
      onDelete(item._id);
    });
  };

  const handleLongPress = () => {
    if (disabled || isDeleting) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      // Silently handle haptics error
    }
    
    Alert.alert(
      'Notification Options',
      'What would you like to do with this notification?',
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: handleDelete
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Delete button background */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={24} color="white" />
          <Text style={styles.deleteText}>Remove</Text>
        </TouchableOpacity>
      </View>
      
      {/* Main notification content */}
      <Animated.View
        style={[
          styles.notificationWrapper,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onLongPress={handleLongPress}
          delayLongPress={500}
          activeOpacity={1}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#FFFFFF', // Match your notification background
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BUTTON_WIDTH,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  deleteText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  notificationWrapper: {
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
});