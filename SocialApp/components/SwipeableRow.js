// SocialApp/components/SwipeableRow.js - Apple iMessages-style with multiple actions and debugging
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  Text,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REVEAL_THRESHOLD = 60; // Distance to reveal first action
const SECOND_ACTION_THRESHOLD = 120; // Distance to reveal second action
const AUTO_DELETE_THRESHOLD = 180; // Distance to auto-trigger delete
const FIRST_ACTION_WIDTH = 80; // Width of check-in button
const SECOND_ACTION_WIDTH = 80; // Width of delete button
const TOTAL_ACTIONS_WIDTH = FIRST_ACTION_WIDTH + SECOND_ACTION_WIDTH;

export default function SwipeableRow({
  children,
  onDelete,
  onCheckIn,
  deleteText = 'Remove',
  checkInText = 'Check In',
  deleteColor = '#FF3B30',
  checkInColor = '#34C759',
  disabled = false,
  isCheckedIn = false,
  isCheckInLoading = false,
  style = {},
  debugMode = true,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isFirstActionRevealed, setIsFirstActionRevealed] = useState(false);
  const [isSecondActionRevealed, setIsSecondActionRevealed] = useState(false);
  const [shouldAutoDelete, setShouldAutoDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debug logging function
  const debugLog = (message, data = {}) => {
    if (debugMode) {
      console.log(`🔧 SwipeableRow: ${message}`, data);
    }
  };

  // Debug the props on component mount
  useEffect(() => {
    debugLog('SwipeableRow initialized with props', {
      hasOnDelete: typeof onDelete === 'function',
      hasOnCheckIn: typeof onCheckIn === 'function',
      isCheckedIn,
      isCheckInLoading,
      disabled,
      deleteText,
      checkInText
    });
  }, [onDelete, onCheckIn, isCheckedIn, isCheckInLoading, disabled, deleteText, checkInText]);

  // Reset position when disabled changes
  useEffect(() => {
    if (disabled && (isFirstActionRevealed || isSecondActionRevealed)) {
      debugLog('Disabled state changed, closing row');
      closeRow();
    }
  }, [disabled, isFirstActionRevealed, isSecondActionRevealed]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        debugLog('onStartShouldSetPanResponder called');
        return false;
      },
      
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (disabled || isDeleting) {
          debugLog('Movement rejected - disabled or deleting', { disabled, isDeleting });
          return false;
        }
        
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMinMovement = Math.abs(gestureState.dx) > 15;
        const shouldRespond = isHorizontal && hasMinMovement;
        
        debugLog('Movement detection', {
          dx: gestureState.dx,
          dy: gestureState.dy,
          isHorizontal,
          hasMinMovement,
          shouldRespond
        });
        
        return shouldRespond;
      },
      
      onPanResponderGrant: () => {
        if (disabled || isDeleting) return;
        
        debugLog('Gesture granted - starting swipe');
        
        // MINIMAL: No haptic feedback on gesture start (too much)
        // Removed haptic feedback to reduce vibration
        
        // Stop any running animations smoothly
        translateX.stopAnimation();
      },

      onPanResponderMove: (evt, gestureState) => {
        if (disabled || isDeleting) return;
        
        // FIXED: Handle right swipes to close revealed actions
        if (gestureState.dx > 0) {
          debugLog('Right swipe detected', { 
            dx: gestureState.dx, 
            isFirstActionRevealed, 
            isSecondActionRevealed,
            actionsRevealed: isFirstActionRevealed || isSecondActionRevealed
          });
          
          // If actions are revealed and user swipes right, close them
          if (isFirstActionRevealed || isSecondActionRevealed) {
            debugLog('Right swipe to close actions', { dx: gestureState.dx });
            
            // Calculate how much to close based on swipe distance
            const maxCloseDistance = TOTAL_ACTIONS_WIDTH;
            const closeAmount = Math.min(gestureState.dx, maxCloseDistance);
            const newTranslateX = -TOTAL_ACTIONS_WIDTH + closeAmount;
            
            translateX.setValue(Math.min(0, newTranslateX));
            
            // Close actions if swiped far enough right
            if (closeAmount > REVEAL_THRESHOLD) {
              debugLog('Right swipe past threshold - closing actions');
              setIsFirstActionRevealed(false);
              setIsSecondActionRevealed(false);
              setShouldAutoDelete(false);
            }
          } else {
            debugLog('Right swipe ignored - no actions to close', { dx: gestureState.dx });
          }
          return;
        }
        
        // Left swipe logic (existing)
        const newTranslateX = Math.min(0, Math.max(-AUTO_DELETE_THRESHOLD * 1.2, gestureState.dx));
        translateX.setValue(newTranslateX);
        
        const absDistance = Math.abs(gestureState.dx);
        
        debugLog('Left swipe move', {
          dx: gestureState.dx,
          absDistance,
          newTranslateX,
          isFirstActionRevealed,
          isSecondActionRevealed,
          thresholds: {
            reveal: REVEAL_THRESHOLD,
            autoDelete: AUTO_DELETE_THRESHOLD
          }
        });
        
        // UPDATED: Simplified state management with MINIMAL haptics
        if (!isFirstActionRevealed && absDistance > REVEAL_THRESHOLD) {
          debugLog('Actions revealed');
          // REDUCED: Minimal haptic for action reveal
          if (Haptics.impactAsync) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          setIsFirstActionRevealed(true);
          setIsSecondActionRevealed(true);
          setShouldAutoDelete(false);
        }
        
        // Auto-delete threshold with minimal haptic
        if (isFirstActionRevealed && !shouldAutoDelete && absDistance > AUTO_DELETE_THRESHOLD) {
          debugLog('Auto-delete threshold reached');
          // REDUCED: Light haptic instead of Medium
          if (Haptics.impactAsync) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          setShouldAutoDelete(true);
        }
        
        // Reset auto-delete if user swipes back (no haptic)
        if (shouldAutoDelete && absDistance < AUTO_DELETE_THRESHOLD) {
          debugLog('Auto-delete cancelled');
          setShouldAutoDelete(false);
        }
        
        // Reset states when swiping back to closed (no haptic)
        if (isFirstActionRevealed && absDistance < REVEAL_THRESHOLD) {
          debugLog('Actions hidden');
          setIsFirstActionRevealed(false);
          setIsSecondActionRevealed(false);
        }
      },

      onPanResponderRelease: (evt, gestureState) => {
        if (disabled || isDeleting) return;
        
        // FIXED: Handle right swipes to close actions
        if (gestureState.dx > 0) {
          debugLog('Right swipe released', { 
            dx: gestureState.dx, 
            isFirstActionRevealed, 
            isSecondActionRevealed,
            threshold: REVEAL_THRESHOLD * 0.5
          });
          
          // If actions are revealed and user swipes right enough, close them
          if ((isFirstActionRevealed || isSecondActionRevealed) && gestureState.dx > REVEAL_THRESHOLD * 0.5) {
            debugLog('Right swipe closing actions');
            closeRow();
          } else if (isFirstActionRevealed || isSecondActionRevealed) {
            debugLog('Right swipe not far enough - keeping actions revealed');
            revealActions(); // Snap back to revealed state
          } else {
            debugLog('Right swipe with no actions revealed - ignoring');
          }
          return;
        }
        
        const absDistance = Math.abs(gestureState.dx);
        const velocity = Math.abs(gestureState.vx);
        
        debugLog('Left swipe released', {
          dx: gestureState.dx,
          absDistance,
          velocity,
          thresholds: {
            reveal: REVEAL_THRESHOLD,
            autoDelete: AUTO_DELETE_THRESHOLD
          }
        });
        
        // Auto-delete if swiped far enough
        if (absDistance > AUTO_DELETE_THRESHOLD || (velocity > 2.0 && absDistance > REVEAL_THRESHOLD * 1.5)) {
          debugLog('Triggering auto-delete');
          handleAutoDelete();
          return;
        }
        
        // Reveal both actions or close
        if (absDistance > REVEAL_THRESHOLD || velocity > 1.0) {
          debugLog('Revealing both actions (no half-way state)');
          revealActions();
        } else {
          debugLog('Closing row');
          closeRow();
        }
      },

      onPanResponderTerminate: () => {
        debugLog('Gesture terminated - auto-resolving state');
        
        // FIXED: When gesture terminates, decide what to do based on current position
        if (!disabled && !isDeleting) {
          const currentTranslateX = translateX._value;
          const absDistance = Math.abs(currentTranslateX);
          
          debugLog('Resolving terminated gesture', { 
            currentTranslateX, 
            absDistance,
            threshold: REVEAL_THRESHOLD 
          });
          
          // If we're past the reveal threshold, show actions
          if (absDistance > REVEAL_THRESHOLD) {
            debugLog('Terminated past threshold - revealing actions');
            revealActions();
          } else {
            debugLog('Terminated before threshold - closing row');
            closeRow();
          }
        }
      },

      onPanResponderTerminationRequest: () => {
        debugLog('Termination requested - allowing if not in critical gesture');
        // Allow termination if we're not in the middle of a meaningful swipe
        const currentTranslateX = translateX._value;
        const absDistance = Math.abs(currentTranslateX);
        return absDistance < REVEAL_THRESHOLD * 0.5; // Only allow termination if barely swiped
      },
    })
  ).current;

  const revealActions = () => {
    debugLog('Animating to reveal both actions');
    Animated.spring(translateX, {
      toValue: -TOTAL_ACTIONS_WIDTH,
      useNativeDriver: false,
      tension: 150, // INCREASED: Snappier animation
      friction: 10, // INCREASED: Less bouncy, more controlled
      overshootClamping: true,
    }).start(() => {
      debugLog('Actions reveal animation complete');
    });
    setIsFirstActionRevealed(true);
    setIsSecondActionRevealed(true);
    setShouldAutoDelete(false);
  };

  const closeRow = () => {
    debugLog('Animating to close row');
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      tension: 100, // REDUCED: Less snappy, more graceful
      friction: 9,  // REDUCED: Slightly more bounce for natural feel
      overshootClamping: false, // CHANGED: Allow slight overshoot for more natural feel
    }).start(() => {
      debugLog('Close animation complete');
      setIsFirstActionRevealed(false);
      setIsSecondActionRevealed(false);
      setShouldAutoDelete(false);
    });
  };

  const handleAutoDelete = async () => {
    if (isDeleting) return;
    
    debugLog('Starting auto-delete');
    setIsDeleting(true);
    
    // Strong haptic feedback for auto-delete
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    
    try {
      // Animate to full delete position
      await new Promise((resolve) => {
        Animated.timing(translateX, {
          toValue: -SCREEN_WIDTH,
          duration: 250,
          useNativeDriver: false,
        }).start(resolve);
      });
      
      debugLog('Auto-delete animation complete, calling onDelete');
      await onDelete();
      
    } catch (error) {
      debugLog('Auto-delete error', { error: error.message });
      setIsDeleting(false);
      closeRow();
    }
  };

  const handleCheckIn = async () => {
    if (isCheckInLoading || isDeleting) return;
    
    debugLog('Check-in button pressed');
    
    // Medium haptic feedback for button press
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      await onCheckIn();
      debugLog('Check-in completed successfully');
      // Close row after successful check-in
      setTimeout(() => closeRow(), 300);
    } catch (error) {
      debugLog('Check-in error', { error: error.message });
    }
  };

  const handleManualDelete = async () => {
    if (isDeleting) return;
    
    debugLog('Delete button pressed');
    setIsDeleting(true);
    
    // Medium haptic feedback for button press
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      await onDelete();
      debugLog('Manual delete completed successfully');
      
      // Animate out after successful delete
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: false,
      }).start();
      
    } catch (error) {
      debugLog('Manual delete error', { error: error.message });
      setIsDeleting(false);
      closeRow();
    }
  };

  // Close row when tapped outside
  const handleContentPress = () => {
    if ((isFirstActionRevealed || isSecondActionRevealed) && !isDeleting) {
      debugLog('Content pressed, closing row');
      closeRow();
    }
  };

  // Determine check-in button text and icon
  const checkInButtonText = isCheckedIn ? 'Undo' : checkInText;
  const checkInIcon = isCheckedIn ? 'close-circle' : 'checkmark-circle';
  const checkInButtonColor = isCheckedIn ? '#FF9500' : checkInColor;

  return (
    <View style={[styles.container, style]}>
      {/* Action Buttons Background */}
      <View style={styles.actionsContainer}>
        {/* ENHANCED: Full-width delete during auto-delete (like iMessages) */}
        {shouldAutoDelete ? (
          // Full-width delete button during auto-delete
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.fullWidthDeleteButton,
              { backgroundColor: deleteColor }
            ]}
            onPress={handleManualDelete}
            disabled={isDeleting}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
                <Text style={[styles.actionButtonText, styles.fullWidthDeleteText]}>
                  Release to {deleteText}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          // Normal dual-action layout
          <>
            {/* Check-in Action (First Action) */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.checkInButton,
                { 
                  backgroundColor: checkInButtonColor,
                  width: FIRST_ACTION_WIDTH 
                }
              ]}
              onPress={handleCheckIn}
              disabled={isCheckInLoading || isDeleting}
              activeOpacity={0.8}
            >
              {isCheckInLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name={checkInIcon} size={20} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>{checkInButtonText}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Delete Action (Second Action) */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.deleteButton,
                { 
                  backgroundColor: deleteColor,
                  width: SECOND_ACTION_WIDTH 
                }
              ]}
              onPress={handleManualDelete}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>{deleteText}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Main Content with Swipe Handler */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ translateX }],
            backgroundColor: shouldAutoDelete ? '#FFE5E5' : '#FFFFFF',
          },
        ]}
        {...(disabled || isDeleting ? {} : panResponder.panHandlers)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleContentPress}
          style={styles.touchableContent}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>

      {/* Debug Overlay (only in debug mode) */}
      {debugMode && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>
            Actions: {isFirstActionRevealed ? '✅' : '❌'} | 
            Auto: {shouldAutoDelete ? '🔥' : '❌'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  
  actionsContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    width: TOTAL_ACTIONS_WIDTH,
  },
  
  actionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  
  checkInButton: {
    // Check-in button styles handled by dynamic backgroundColor
  },
  
  deleteButton: {
    // Delete button styles handled by dynamic backgroundColor
  },

  // ENHANCED: Full-width delete button for auto-delete state
  fullWidthDeleteButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  fullWidthDeleteText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 0,
    marginLeft: 8,
  },
  
  contentContainer: {
    minHeight: 60,
  },
  
  touchableContent: {
    flex: 1,
  },

  // Debug styles
  debugOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1000,
  },
  
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});