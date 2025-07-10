// SocialApp/screens/FeedScreen.js - PROPER STYLING + VISIBLE TEXT + SCROLL ANIMATION
import React, { useLayoutEffect, useState, useRef, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  SafeAreaView,
  Alert,
  Animated,
  Platform,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PostsFeed from '../components/PostsFeed';
import EventsHub from '../components/EventsHub';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['Posts', 'Events'];
const ANIMATION_DURATION = 250;

// Calculate constants outside component
const TAB_WIDTH = SCREEN_WIDTH / 2;
const INDICATOR_WIDTH = 60;
const INDICATOR_OFFSET = (TAB_WIDTH - INDICATOR_WIDTH) / 2;

// ANIMATION CONSTANTS
const TAB_BAR_HEIGHT = 44;
const SCROLL_THRESHOLD = 50;
const SHOW_THRESHOLD = 30;

export default function FeedScreen({ navigation }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const postsRef = useRef(null);
  const eventsRef = useRef(null);
  const isAnimating = useRef(false);

  // FIXED: Use ref to avoid closure issues in pan responder
  const currentTabIndex = useRef(0);

  // Initialize animated values for horizontal swiping
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabIndicatorPosition = useRef(new Animated.Value(INDICATOR_OFFSET)).current;

  // RESTORED: Animation values for scroll-based hiding/showing with OPACITY
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current; // NEW: Opacity for complete invisibility
  const subTabTranslateY = useRef(new Animated.Value(0)).current; // NEW: For sub-tabs
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const isTabBarVisible = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Update ref whenever state changes to fix closure issue
  useEffect(() => {
    currentTabIndex.current = activeTabIndex;
  }, [activeTabIndex]);

  // RESTORED: Original scroll animation logic with opacity
  const animateTabBars = useCallback((mainTabOpacity, subTabToValue) => {
    Animated.parallel([
      Animated.timing(tabBarOpacity, {
        toValue: mainTabOpacity,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(subTabTranslateY, {
        toValue: subTabToValue,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start();
  }, [tabBarOpacity, subTabTranslateY]);

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;

    // Determine scroll direction
    if (scrollDelta > 5) {
      scrollDirection.current = 'down';
    } else if (scrollDelta < -5) {
      scrollDirection.current = 'up';
    }

    // Handle tab bar visibility logic - ORIGINAL PERFECT ALIGNMENT
    if (currentScrollY <= 0) {
      // At the top - show main tabs, hide sub-tabs in original position
      if (!isTabBarVisible.current) {
        isTabBarVisible.current = true;
        animateTabBars(1, 0); // Main tabs: visible, Sub tabs: original position
      }
    } else if (scrollDirection.current === 'down' && currentScrollY > SCROLL_THRESHOLD) {
      // Scrolling down - COMPLETELY HIDE main tabs, move sub-tabs up to replace them
      if (isTabBarVisible.current) {
        isTabBarVisible.current = false;
        animateTabBars(0, -44); // Main tabs: INVISIBLE, Sub tabs: move up 44px (ORIGINAL LOGIC)
      }
    } else if (scrollDirection.current === 'up' && Math.abs(scrollDelta) > SHOW_THRESHOLD) {
      // Scrolling up - show main tabs, move sub-tabs back to original position
      if (!isTabBarVisible.current) {
        isTabBarVisible.current = true;
        animateTabBars(1, 0); // Main tabs: visible, Sub tabs: original position
      }
    }

    lastScrollY.current = currentScrollY;
  }, [animateTabBars]);

  const resetTabBar = useCallback(() => {
    // Reset to visible state (for tab switches, refreshes, etc.)
    isTabBarVisible.current = true;
    lastScrollY.current = 0;
    animateTabBars(1, 0); // Main tabs: visible, Sub tabs: original position
  }, [animateTabBars]);

  // Tab switching with proper state management
  const switchToTab = useCallback((index) => {
    const targetIndex = Math.max(0, Math.min(TABS.length - 1, index));
    
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    
    const targetContentOffset = -targetIndex * SCREEN_WIDTH;
    const targetIndicatorPosition = targetIndex * TAB_WIDTH + INDICATOR_OFFSET;
    
    // Update state first
    setActiveTabIndex(targetIndex);
    resetTabBar(); // Reset tab bar to visible when switching tabs
    
    // Then animate horizontal movement
    Animated.parallel([
      Animated.timing(scrollX, {
        toValue: targetContentOffset,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(tabIndicatorPosition, {
        toValue: targetIndicatorPosition,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      })
    ]).start((finished) => {
      if (finished) {
        isAnimating.current = false;
      }
    });
  }, [resetTabBar]);

  // Handle tab button press
  const handleTabPress = useCallback((index) => {
    switchToTab(index);
  }, [switchToTab]);

  // FIXED: Pan Responder using currentTabIndex ref
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.5 && !isAnimating.current;
      },
      onPanResponderGrant: () => {
        scrollX.stopAnimation();
        tabIndicatorPosition.stopAnimation();
        isAnimating.current = false;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isAnimating.current) return;
        
        const { dx } = gestureState;
        const currentTab = currentTabIndex.current;
        const baseOffset = -currentTab * SCREEN_WIDTH;
        let newOffset = baseOffset + dx;
        
        // Add resistance at boundaries
        const minOffset = -(TABS.length - 1) * SCREEN_WIDTH;
        const maxOffset = 0;
        const RESISTANCE_FACTOR = 0.25;
        
        if (newOffset > maxOffset) {
          newOffset = maxOffset + (newOffset - maxOffset) * RESISTANCE_FACTOR;
        } else if (newOffset < minOffset) {
          newOffset = minOffset + (newOffset - minOffset) * RESISTANCE_FACTOR;
        }
        
        if (Number.isFinite(newOffset)) {
          scrollX.setValue(newOffset);
          
          const progress = Math.max(0, Math.min(TABS.length - 1, -newOffset / SCREEN_WIDTH));
          const indicatorPos = progress * TAB_WIDTH + INDICATOR_OFFSET;
          
          if (Number.isFinite(indicatorPos)) {
            tabIndicatorPosition.setValue(indicatorPos);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (isAnimating.current) return;
        
        const { dx, vx } = gestureState;
        const currentTab = currentTabIndex.current;
        let targetIndex = currentTab;
        
        const DISTANCE_THRESHOLD = 80;
        const VELOCITY_THRESHOLD = 0.4;
        
        const shouldSwipe = Math.abs(dx) > DISTANCE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD;
        
        if (shouldSwipe) {
          if (dx > 0 && currentTab > 0) {
            // Swiping RIGHT -> previous tab
            targetIndex = currentTab - 1;
          } else if (dx < 0 && currentTab < TABS.length - 1) {
            // Swiping LEFT -> next tab
            targetIndex = currentTab + 1;
          }
        }
        
        switchToTab(targetIndex);
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        isAnimating.current = false;
      },
    })
  ).current;

  const handleNotificationPress = () => {
    try {
      navigation.navigate('NotificationScreen');
    } catch (error) {
      Alert.alert('Feature Coming Soon', 'Notifications feature is currently being updated.');
    }
  };

  const handleSearchPress = () => {
    try {
      navigation.navigate('SearchScreen');
    } catch (error) {
      navigation.getParent()?.navigate('SearchScreen');
    }
  };

  const handleGlobalRefresh = async () => {
    setRefreshing(true);
    resetTabBar(); // Reset tab bar when refreshing
    
    try {
      if (activeTabIndex === 0 && postsRef.current?.refresh) {
        await postsRef.current.refresh();
      } else if (activeTabIndex === 1 && eventsRef.current?.refresh) {
        await eventsRef.current.refresh();
      }
    } catch (error) {
      console.error('Global refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getSubTabStyle = useCallback(() => {
    // For EventsHub sub-tabs - they move up MORE to take main tab position when main tabs hide
    return {
      transform: [{ 
        translateY: tabBarTranslateY.interpolate({
          inputRange: [-150, 0], // Match the new main tab hiding distance
          outputRange: [-100, 0], // Move sub-tabs up to where main tabs used to be
          extrapolate: 'clamp'
        })
      }]
    };
  }, [tabBarTranslateY]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* PHASE 1: Fixed Transparent Header - Always Visible */}
      <View style={styles.fixedHeaderContainer}>
        <SafeAreaView style={styles.safeAreaHeader}>
          <View style={styles.fixedHeader}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleSearchPress}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={24} color="#3797EF" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Social</Text>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleNotificationPress}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={24} color="#3797EF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* PHASE 3: Main Tabs - OPACITY BASED HIDING (stay in place, just become invisible) */}
      <Animated.View style={[
        styles.animatedTabBarContainer, 
        { 
          opacity: tabBarOpacity, // INVISIBLE when scrolling down, visible when scrolling up
        }
      ]}>
        <View style={styles.transparentTabBar}>
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabButton}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.tabButtonText,
                activeTabIndex === index && styles.activeTabButtonText
              ]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* REMOVED: Blue underline indicator */}
        </View>
      </Animated.View>

      {/* PHASE 2: Full-Screen Content - Starts from top, flows under headers */}
      <View 
        style={styles.contentContainer}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[
          styles.swipeableContent,
          { transform: [{ translateX: scrollX }] }
        ]}>
          {/* Posts Tab */}
          <View style={[styles.tabContentWrapper, { width: SCREEN_WIDTH }]}>
            <PostsFeed 
              navigation={navigation}
              ref={postsRef}
              refreshing={refreshing}
              onRefresh={handleGlobalRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          </View>
          
          {/* Events Tab */}
          <View style={[styles.tabContentWrapper, { width: SCREEN_WIDTH }]}>
            <EventsHub 
              navigation={navigation}
              ref={eventsRef}
              refreshing={refreshing}
              onRefresh={handleGlobalRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              getSubTabStyle={getSubTabStyle} // Pass sub-tab animation style
              subTabTranslateY={subTabTranslateY} // PASS the actual animated value
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // PHASE 1: Fixed Transparent Header Styles with UNIFIED BLUR
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.7)' // UNIFIED transparency
      : 'rgba(255, 255, 255, 0.8)',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px) saturate(150%) contrast(110%)', // UNIFIED blur effect
    }),
    // REMOVED: Individual shadows - will blend seamlessly
  },
  
  safeAreaHeader: {
    backgroundColor: 'transparent',
  },
  
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    height: 56, // Fixed height for consistent spacing
  },
  
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3797EF', // BLUE THEME
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(55, 151, 239, 0.1)', // BLUE THEME
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // PHASE 3: Animated Tab Bar Styles - UNIFIED BLUR with header
  animatedTabBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 90, // Position below fixed header
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.7)' // EXACT SAME as header
      : 'rgba(255, 255, 255, 0.8)',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px) saturate(150%) contrast(110%)', // EXACT SAME as header
    }),
    // REMOVED: Individual shadows and borders - seamless blend
  },

  transparentTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // CENTER the tabs
    paddingHorizontal: 0,
    paddingVertical: 12,
    position: 'relative',
    height: 44, // Fixed height
    gap: 20, // REDUCED from 40 - tabs closer together
  },

  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    minHeight: 32, // Ensure proper text rendering space
    minWidth: 60,
  },

  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B9EF5', // LIGHT BLUE for inactive tabs
    textAlign: 'center',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  activeTabButtonText: {
    color: '#3797EF', // BLUE THEME for active
    fontWeight: '800', // BOLD for active state
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // PHASE 2: Content Layout - Starts from top, flows naturally
  contentContainer: {
    flex: 1,
    paddingTop: 0, // CRITICAL FIX: No padding, content starts from top
  },

  swipeableContent: {
    flexDirection: 'row',
    height: '100%',
    width: SCREEN_WIDTH * TABS.length,
  },

  tabContentWrapper: {
    backgroundColor: 'transparent', // TRANSPARENT!
    flex: 1,
  }, 
});