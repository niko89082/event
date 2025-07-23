// SocialApp/screens/FeedScreen.js - UPDATED: Activity Feed with All Original Features
import React, { useLayoutEffect, useState, useRef, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  SafeAreaView,
  Alert,
  Animated,
  Platform,
  Dimensions,
  PanResponder,
  PixelRatio,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActivityFeed from '../components/ActivityFeed'; // ✅ CHANGED: Import ActivityFeed instead of PostsFeed
import EventsHub from '../components/EventsHub';
import { useDynamicType } from '../hooks/useDynamicType';
import ResponsiveText from '../components/ResponsiveText';

// Disable automatic font scaling - we handle it manually
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;

TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TABS = ['Activity', 'Events']; // ✅ CHANGED: Updated tab names from ['Posts', 'Events'] to ['Activity', 'Events']
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
  const insets = useSafeAreaInsets();
  const { getScaledSpacing, getScaledLineHeight, fontScale } = useDynamicType();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const activityRef = useRef(null); // ✅ CHANGED: Renamed from postsRef to activityRef
  const eventsRef = useRef(null);
  const isAnimating = useRef(false);

  // FIXED: Use ref to avoid closure issues in pan responder
  const currentTabIndex = useRef(0);

  // Initialize animated values for horizontal swiping
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabIndicatorPosition = useRef(new Animated.Value(INDICATOR_OFFSET)).current;

  // RESTORED: Animation values for scroll-based hiding/showing with OPACITY
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current;
  const subTabTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const isTabBarVisible = useRef(true);

  // COMPREHENSIVE DEBUG: Track all positioning values
  const FIXED_HEADER_HEIGHT = 56;
  const SAFE_AREA_TOP = insets.top;
  
  // ADJUSTED: Move main tabs up slightly from previous position
  const MAIN_TAB_POSITION = SAFE_AREA_TOP + FIXED_HEADER_HEIGHT - 2; // MOVED UP from +4 to -2 (6px adjustment)
  
  const SUB_TAB_ORIGINAL_POSITION = 144;
  const SUB_TAB_MOVE_DISTANCE = SUB_TAB_ORIGINAL_POSITION - MAIN_TAB_POSITION;

  // COMPREHENSIVE POSITION DEBUGGING
  console.log('🔍 ACTIVITY FEED SCREEN DEBUG:', {
    '=== UPDATED INFO ===': {
      tabNames: TABS,
      activityFeedUsed: true,
      originalFeatures: 'All preserved',
    },
    '=== DEVICE INFO ===': {
      fontScale: fontScale,
      safeAreaTop: SAFE_AREA_TOP,
      screenWidth: SCREEN_WIDTH,
      screenHeight: SCREEN_HEIGHT,
      deviceModel: Platform.constants?.systemName + ' ' + Platform.Version,
    },
    '=== HEADER CALCULATIONS ===': {
      fixedHeaderHeight: FIXED_HEADER_HEIGHT,
      headerStartsAt: SAFE_AREA_TOP,
      headerEndsAt: SAFE_AREA_TOP + FIXED_HEADER_HEIGHT,
      socialTitleContainerHeight: Math.ceil(getScaledLineHeight(27, 1.4)),
    },
    '=== MAIN TAB CALCULATIONS ===': {
      mainTabPosition: MAIN_TAB_POSITION,
      mainTabHeight: 34,
      mainTabStartsAt: MAIN_TAB_POSITION,
      mainTabEndsAt: MAIN_TAB_POSITION + 34,
      gapFromHeader: MAIN_TAB_POSITION - (SAFE_AREA_TOP + FIXED_HEADER_HEIGHT),
    },
    '=== SUB TAB CALCULATIONS ===': {
      subTabOriginalPosition: SUB_TAB_ORIGINAL_POSITION,
      subTabMoveDistance: SUB_TAB_MOVE_DISTANCE,
      clearanceBetweenMainAndSub: SUB_TAB_ORIGINAL_POSITION - (MAIN_TAB_POSITION + 34),
    },
    '=== OVERLAP DETECTION ===': {
      headerOverlap: MAIN_TAB_POSITION < (SAFE_AREA_TOP + FIXED_HEADER_HEIGHT) ? 'YES - OVERLAPPING!' : 'No',
      subTabOverlap: (MAIN_TAB_POSITION + 34) > SUB_TAB_ORIGINAL_POSITION ? 'YES - OVERLAPPING!' : 'No',
    }
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Update ref whenever state changes to fix closure issue
  useEffect(() => {
    currentTabIndex.current = activeTabIndex;
  }, [activeTabIndex]);

  // FIXED: Animation logic with proper distances
  const animateTabBars = useCallback((mainTabOpacity, subTabToValue) => {
    console.log('🎬 ANIMATING TAB BARS:', {
      mainTabOpacity,
      subTabToValue,
      subTabMoveDistance: SUB_TAB_MOVE_DISTANCE,
    });
    
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
    ]).start(() => {
      console.log('🎬 ANIMATION COMPLETE:', {
        mainTabVisible: mainTabOpacity === 1,
        subTabPosition: subTabToValue,
      });
    });
  }, [tabBarOpacity, subTabTranslateY, SUB_TAB_MOVE_DISTANCE]);

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;

    // Determine scroll direction
    if (scrollDelta > 5) {
      scrollDirection.current = 'down';
    } else if (scrollDelta < -5) {
      scrollDirection.current = 'up';
    }

    // Handle tab bar visibility logic
    if (currentScrollY <= 0) {
      // At the top - show main tabs, sub-tabs in original position
      if (!isTabBarVisible.current) {
        console.log('📍 SCROLL: Showing main tabs (at top)');
        isTabBarVisible.current = true;
        animateTabBars(1, 0); // Main tabs: visible, Sub tabs: original position
      }
    } else if (scrollDirection.current === 'down' && currentScrollY > SCROLL_THRESHOLD) {
      // Scrolling down - HIDE main tabs, move sub-tabs to main tab position
      if (isTabBarVisible.current) {
        console.log('📍 SCROLL: Hiding main tabs, moving sub-tabs to main position');
        isTabBarVisible.current = false;
        animateTabBars(0, -SUB_TAB_MOVE_DISTANCE); // Sub-tabs move to main tab position
      }
    } else if (scrollDirection.current === 'up' && Math.abs(scrollDelta) > SHOW_THRESHOLD) {
      // Scrolling up - show main tabs, sub-tabs back to original position
      if (!isTabBarVisible.current) {
        console.log('📍 SCROLL: Showing main tabs, sub-tabs to original position');
        isTabBarVisible.current = true;
        animateTabBars(1, 0); // Main tabs: visible, Sub tabs: original position
      }
    }

    lastScrollY.current = currentScrollY;
  }, [animateTabBars, SUB_TAB_MOVE_DISTANCE]);

  const resetTabBar = useCallback(() => {
    console.log('🔄 RESETTING TAB BAR');
    isTabBarVisible.current = true;
    lastScrollY.current = 0;
    animateTabBars(1, 0);
  }, [animateTabBars]);

  // Tab switching with proper state management
  const switchToTab = useCallback((index) => {
    const targetIndex = Math.max(0, Math.min(TABS.length - 1, index));
    
    if (isAnimating.current) return;
    
    console.log('📱 SWITCHING TAB:', { from: activeTabIndex, to: targetIndex, tabName: TABS[targetIndex] });
    
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
  }, [resetTabBar, activeTabIndex]);

  // Handle tab button press
  const handleTabPress = useCallback((index) => {
    switchToTab(index);
  }, [switchToTab]);

  // FIXED: Create dynamic styles with conservative scaling and sub-tab awareness
  const createDynamicStyles = () => {
    // Limit font scaling for UI elements to prevent oversized containers
    const conservativeFontScale = Math.min(fontScale, 1.2);
    const scaledPadding = Math.ceil(6 * conservativeFontScale); // Reduced from 8
    const scaledTabHeight = Math.ceil(32 * conservativeFontScale);
    
    const styles = StyleSheet.create({
      // More compact container to prevent sub-tab covering
      animatedTabBarContainer: {
        height: 34, // REDUCED from 38 to 34 to make more compact
      },
      
      transparentTabBar: {
        paddingVertical: scaledPadding,
        height: 34, // REDUCED from 38 to 34
      },
      
      tabButton: {
        paddingVertical: Math.max(2, scaledPadding - 4), // REDUCED padding further
        paddingHorizontal: getScaledSpacing(12), // REDUCED horizontal padding
        minHeight: Math.min(scaledTabHeight, 28), // REDUCED from 32 to 28
        maxHeight: 28, // REDUCED from 32 to 28
        minWidth: 60,
      },
      
      // Container for Social title - ENHANCED for cross-device compatibility
      headerTitleContainer: {
        minHeight: Math.ceil(getScaledLineHeight(26, 1.5)), // UPDATED to match new values
        paddingVertical: Math.max(14, Math.ceil(12 * Math.min(conservativeFontScale, 1.0))), // INCREASED base from 12 to 14, limited scaling
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        flexDirection: 'column',
        // ENSURE VISIBILITY
        overflow: 'visible',
        backgroundColor: 'transparent',
      },
    });

    console.log('🎨 ACTIVITY FEED DYNAMIC STYLES DEBUG:', {
      '=== FONT SCALING ===': {
        originalFontScale: fontScale,
        conservativeFontScale,
        scaledPadding,
        scaledTabHeight,
      },
      '=== CONTAINER SIZES ===': {
        tabContainerHeight: 34,
        maxTabButtonHeight: 28,
        headerMinHeight: Math.ceil(getScaledLineHeight(26, 1.5)),
        headerPadding: Math.max(14, Math.ceil(12 * Math.min(conservativeFontScale, 1.0))),
      },
      '=== POSITIONING RESULTS ===': {
        mainTabBottomPosition: MAIN_TAB_POSITION + 34,
        subTabStartPosition: SUB_TAB_ORIGINAL_POSITION,
        clearance: SUB_TAB_ORIGINAL_POSITION - (MAIN_TAB_POSITION + 34),
      },
      '=== ADJUSTMENTS MADE ===': {
        tabUpdate: 'Posts -> Activity',
        componentUpdate: 'PostsFeed -> ActivityFeed',
        refUpdate: 'postsRef -> activityRef',
      }
    });

    return styles;
  };

  const dynamicStyles = createDynamicStyles();

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
            targetIndex = currentTab - 1;
          } else if (dx < 0 && currentTab < TABS.length - 1) {
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
    resetTabBar();
    
    try {
      if (activeTabIndex === 0 && activityRef.current?.refresh) { // ✅ CHANGED: Updated from postsRef to activityRef
        console.log('🔄 Refreshing Activity Feed');
        await activityRef.current.refresh();
      } else if (activeTabIndex === 1 && eventsRef.current?.refresh) {
        console.log('🔄 Refreshing Events Hub');
        await eventsRef.current.refresh();
      }
    } catch (error) {
      console.error('Global refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getSubTabStyle = useCallback(() => {
    return {
      transform: [{ 
        translateY: tabBarTranslateY.interpolate({
          inputRange: [-150, 0],
          outputRange: [-100, 0],
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
            
            <View 
              style={[
                styles.headerTitleContainer, 
                dynamicStyles.headerTitleContainer,
              ]}
              onLayout={(event) => {
                const { height, width } = event.nativeEvent.layout;
                console.log('🔍 SOCIAL CONTAINER (Activity Feed):', {
                  containerHeight: height,
                  containerWidth: width,
                  activeTab: TABS[activeTabIndex],
                  feedType: activeTabIndex === 0 ? 'ActivityFeed' : 'EventsHub'
                });
              }}
            >
              <ResponsiveText 
                style={[
                  styles.headerTitle,
                  {
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    includeFontPadding: true,
                  }
                ]}
                fontSize={27}
                lineHeightMultiplier={1.4}
                onLayout={(event) => {
                  const { height, width } = event.nativeEvent.layout;
                  console.log('🔍 SOCIAL TEXT (Activity Feed):', {
                    textHeight: height,
                    textWidth: width,
                    currentTab: TABS[activeTabIndex],
                    feedComponent: activeTabIndex === 0 ? 'ActivityFeed' : 'EventsHub'
                  });
                }}
              >
                Social
              </ResponsiveText>
            </View>
            
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

      {/* PHASE 3: Main Tabs - COMPACT POSITIONING */}
      <Animated.View style={[
        styles.animatedTabBarContainer,
        dynamicStyles.animatedTabBarContainer,
        { 
          top: MAIN_TAB_POSITION,
          opacity: tabBarOpacity,
        }
      ]}>
        <View style={[styles.transparentTabBar, dynamicStyles.transparentTabBar]}>
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, dynamicStyles.tabButton]}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.8}
            >
              <ResponsiveText
                style={[
                  styles.tabButtonText,
                  activeTabIndex === index && styles.activeTabButtonText
                ]}
                fontSize={14}
                lineHeightMultiplier={1.1}
                onLayout={(event) => {
                  const { height, width } = event.nativeEvent.layout;
                  console.log(`🔍 TAB LAYOUT (${tab}):`, {
                    textHeight: height,
                    textWidth: width,
                    isActive: activeTabIndex === index,
                    tabIndex: index,
                    tabName: tab,
                  });
                }}
              >
                {tab}
              </ResponsiveText>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* PHASE 2: Full-Screen Content */}
      <View 
        style={styles.contentContainer}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[
          styles.swipeableContent,
          { transform: [{ translateX: scrollX }] }
        ]}>
          {/* Activity Tab - ✅ CHANGED: Using ActivityFeed instead of PostsFeed */}
          <View style={[styles.tabContentWrapper, { width: SCREEN_WIDTH }]}>
            <ActivityFeed 
              navigation={navigation}
              ref={activityRef} // ✅ CHANGED: Updated ref name
              refreshing={refreshing}
              onRefresh={handleGlobalRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          </View>
          
          {/* Events Tab - UNCHANGED */}
          <View style={[styles.tabContentWrapper, { width: SCREEN_WIDTH }]}>
            <EventsHub 
              navigation={navigation}
              ref={eventsRef}
              refreshing={refreshing}
              onRefresh={handleGlobalRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              getSubTabStyle={getSubTabStyle}
              subTabTranslateY={subTabTranslateY}
              subTabMoveDistance={SUB_TAB_MOVE_DISTANCE}
              debugInfo={{
                mainTabPosition: MAIN_TAB_POSITION,
                mainTabHeight: 34,
                mainTabBottomPosition: MAIN_TAB_POSITION + 34,
                subTabOriginal: SUB_TAB_ORIGINAL_POSITION,
                clearanceBetweenTabs: SUB_TAB_ORIGINAL_POSITION - (MAIN_TAB_POSITION + 34),
                fontScale: fontScale,
                ResponsiveTextComponent: ResponsiveText,
              }}
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
  
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
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
    height: 56, // Fixed height
  },
  
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  headerTitle: {
    fontWeight: '700',
    color: '#3797EF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.25)' 
      : 'rgba(255, 255, 255, 0.3)',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px) saturate(180%)',
    }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(31, 38, 135, 0.37)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },

  // Fixed height containers to prevent excessive growth
  animatedTabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
  },

  transparentTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    position: 'relative',
    gap: 24, // Increased gap between tabs for better spacing
  },

  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabButtonText: {
    fontWeight: '600',
    color: '#6B9EF5',
    textAlign: 'center',
  },

  activeTabButtonText: {
    color: '#3797EF',
    fontWeight: '800',
    textAlign: 'center',
  },

  contentContainer: {
    flex: 1,
    paddingTop: 0,
  },

  swipeableContent: {
    flexDirection: 'row',
    height: '100%',
    width: SCREEN_WIDTH * TABS.length,
  },

  tabContentWrapper: {
    backgroundColor: 'transparent',
    flex: 1,
  }, 
});