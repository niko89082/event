// components/SwipeableRow.js - Reusable swipe-to-delete component
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Vibration,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 40; // Reduced threshold for easier swiping
const ACTION_WIDTH = 80; // Width of the action button area

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
  const [isSwiping, setIsSwiping] = useState(false);

  console.log('🔧 [SWIPE] SwipeableRow rendered:', { disabled, deleteText });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        console.log('🚀 [SWIPE] onStartShouldSetPanResponder called');
        return false;
      },
      
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes and if not disabled
        const shouldRespond = !disabled && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5;
        console.log('👆 [SWIPE] onMoveShouldSetPanResponder:', {
          disabled,
          dx: gestureState.dx,
          dy: gestureState.dy,
          absDx: Math.abs(gestureState.dx),
          absDy: Math.abs(gestureState.dy),
          horizontalCheck: Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
          minimumCheck: Math.abs(gestureState.dx) > 5,
          shouldRespond
        });
        return shouldRespond;
      },
      
      onPanResponderGrant: () => {
        console.log('🎯 [SWIPE] onPanResponderGrant - Starting swipe');
        setIsSwiping(true);
      },

      onPanResponderMove: (evt, gestureState) => {
        if (disabled) {
          console.log('⛔ [SWIPE] onPanResponderMove - Disabled, ignoring');
          return;
        }
        
        // Only allow left swipe (negative dx) and limit the distance
        const newTranslateX = Math.min(0, Math.max(-ACTION_WIDTH * 1.2, gestureState.dx));
        console.log('↔️ [SWIPE] onPanResponderMove:', {
          dx: gestureState.dx,
          newTranslateX,
          maxDistance: -ACTION_WIDTH * 1.2
        });
        translateX.setValue(newTranslateX);
      },

      onPanResponderRelease: (evt, gestureState) => {
        console.log('🔚 [SWIPE] onPanResponderRelease:', {
          dx: gestureState.dx,
          vx: gestureState.vx,
          threshold: SWIPE_THRESHOLD * 0.6,
          velocityThreshold: 0.3
        });
        
        setIsSwiping(false);
        
        if (disabled) {
          console.log('⛔ [SWIPE] Release - Disabled, ignoring');
          return;
        }

        const { dx, vx } = gestureState;
        
        // Determine if swipe threshold was met (reduced threshold for easier swiping)
        const shouldReveal = Math.abs(dx) > SWIPE_THRESHOLD * 0.6 || Math.abs(vx) > 0.3;
        console.log('🤔 [SWIPE] Should reveal?', {
          distanceCheck: Math.abs(dx) > SWIPE_THRESHOLD * 0.6,
          velocityCheck: Math.abs(vx) > 0.3,
          shouldReveal,
          isLeftSwipe: dx < 0
        });
        
        if (shouldReveal && dx < 0) {
          // Reveal delete button
          console.log('✅ [SWIPE] Revealing delete button');
          setIsRevealed(true);
          Vibration.vibrate(10); // Light haptic feedback
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: false,
            tension: 150,
            friction: 8,
          }).start();
        } else {
          // Snap back to original position
          console.log('↩️ [SWIPE] Snapping back to original position');
          hideActions();
        }
      },
    })
  ).current;

  const hideActions = () => {
    console.log('🙈 [SWIPE] Hiding actions');
    setIsRevealed(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleDelete = () => {
    console.log('🗑️ [SWIPE] Delete button pressed');
    Vibration.vibrate(50); // Medium haptic feedback
    hideActions();
    setTimeout(() => {
      console.log('🔥 [SWIPE] Calling onDelete callback');
      onDelete && onDelete();
    }, 150); // Small delay for smooth animation
  };

  return (
    <View style={[styles.container, style]}>
      {/* Delete Action Background */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.deleteAction, { backgroundColor: deleteColor }]}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          <Text style={styles.deleteText}>{deleteText}</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>

      {/* Overlay to close swipe when tapped elsewhere */}
      {isRevealed && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={hideActions}
          activeOpacity={1}
        />
      )}
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
  
  deleteAction: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  
  deleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  
  content: {
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
});