// components/SwipeableRow.js - Enhanced swipe-to-delete component
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  Text,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60; // Distance needed to reveal delete button
const ACTION_WIDTH = 80; // Width of the delete button area
const ANIMATION_DURATION = 200;

export default function SwipeableRow({
  children,
  onDelete,
  disabled = false,
  deleteText = 'Remove',
  deleteColor = '#FF3B30',
  style = {},
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset position when disabled changes
  useEffect(() => {
    if (disabled && isRevealed) {
      closeRow();
    }
  }, [disabled, isRevealed]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes when not disabled
        if (disabled) return false;
        
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMovement = Math.abs(gestureState.dx) > 10;
        
        return isHorizontal && hasMovement;
      },
      
      onPanResponderGrant: () => {
        if (disabled) return;
        
        // Provide light haptic feedback when gesture starts
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },

      onPanResponderMove: (evt, gestureState) => {
        if (disabled) return;
        
        // Only allow left swipe (negative dx)
        const newTranslateX = Math.min(0, Math.max(-ACTION_WIDTH * 1.2, gestureState.dx));
        translateX.setValue(newTranslateX);
        
        // Trigger haptic feedback when threshold is crossed
        if (!isRevealed && Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setIsRevealed(true);
        } else if (isRevealed && Math.abs(gestureState.dx) < SWIPE_THRESHOLD) {
          setIsRevealed(false);
        }
      },

      onPanResponderRelease: (evt, gestureState) => {
        if (disabled) return;
        
        const shouldReveal = Math.abs(gestureState.dx) > SWIPE_THRESHOLD || 
                            Math.abs(gestureState.vx) > 0.5;
        
        if (shouldReveal) {
          // Reveal delete button
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start();
          setIsRevealed(true);
        } else {
          // Snap back to original position
          closeRow();
        }
      },

      onPanResponderTerminate: () => {
        if (!disabled && isRevealed) {
          closeRow();
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
    }).start(() => {
      setIsRevealed(false);
    });
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    // Strong haptic feedback for delete action
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      await onDelete();
      
      // Animate row removal
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: ANIMATION_DURATION,
        useNativeDriver: false,
      }).start();
      
    } catch (error) {
      // Reset state on error
      setIsDeleting(false);
      closeRow();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Delete Action Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: deleteColor }]}
          onPress={handleDelete}
          disabled={isDeleting}
          activeOpacity={0.8}
        >
          {isDeleting ? (
            <View style={styles.loadingContainer}>
              <View style={styles.spinner} />
            </View>
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}>{deleteText}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ translateX }],
          },
        ]}
        {...(disabled ? {} : panResponder.panHandlers)}
      >
        <View style={[styles.content, isRevealed && styles.contentRevealed]}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  actionContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: ACTION_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
    // Note: You'll need to add rotation animation for the spinner
  },
  contentContainer: {
    backgroundColor: '#FFFFFF',
  },
  content: {
    backgroundColor: '#FFFFFF',
  },
  contentRevealed: {
    // Subtle shadow to indicate elevated state
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});