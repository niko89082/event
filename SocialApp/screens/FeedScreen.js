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
import { Image } from 'react-native';
import { BlurView } from 'expo-blur';
import ActivityFeed from '../components/ActivityFeed';
import ForYouFeed from '../components/ForYouFeed';
import { useDynamicType } from '../hooks/useDynamicType';
import ResponsiveText from '../components/ResponsiveText';
import api from '../services/api';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import { useContext } from 'react';
import { API_BASE_URL } from '@env';

// Disable automatic font scaling - we handle it manually
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;

TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TABS = ['For You', 'Activity']; // Updated tab names to 'For You' and 'Activity'
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
  const isFocused = useIsFocused();
  const { currentUser } = useContext(AuthContext);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [headerPointerEvents, setHeaderPointerEvents] = useState('auto');
  const activityRef = useRef(null);
  const forYouRef = useRef(null);
  const isAnimating = useRef(false);

  // FIXED: Use ref to avoid closure issues in pan responder
  const currentTabIndex = useRef(0);

  // Initialize animated values for horizontal swiping
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabIndicatorPosition = useRef(new Animated.Value(INDICATOR_OFFSET)).current;

  // RESTORED: Animation values for scroll-based hiding/showing with OPACITY
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current; // New: Header opacity for scroll hiding
  const headerTranslateY = useRef(new Animated.Value(0)).current; // Header translate for hiding
  const subTabTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const isTabBarVisible = useRef(true);
  const isHeaderVisible = useRef(true);
  
  // Header sizing - Twitter-like compact design
  const FIXED_HEADER_HEIGHT = 52; // Header content height
  const TAB_BAR_HEIGHT = 40; // Tab bar height - reduced to minimize overhang
  const SAFE_AREA_TOP = insets.top;
  
  // Header includes both header content and tabs, so total height is header + tabs
  const TOTAL_HEADER_HEIGHT = SAFE_AREA_TOP + FIXED_HEADER_HEIGHT + TAB_BAR_HEIGHT;
  
  // FIXED: Keep padding constant - don't change it dynamically to prevent glitching
  // Content padding stays the same, header just overlays and translates away (Twitter-style)
  const CONTENT_PADDING_TOP = TOTAL_HEADER_HEIGHT;
  
  const SUB_TAB_ORIGINAL_POSITION = TOTAL_HEADER_HEIGHT;
  const SUB_TAB_MOVE_DISTANCE = 0; // Not used anymore since tabs are in header

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
      totalHeaderHeight: TOTAL_HEADER_HEIGHT,
      headerContentHeight: FIXED_HEADER_HEIGHT,
      tabBarHeight: TAB_BAR_HEIGHT,
      safeAreaTop: SAFE_AREA_TOP,
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

  // Fetch unread notification count when screen is focused
  // Also listen to navigation events to ensure badge updates when returning from NotificationScreen
  useEffect(() => {
    if (isFocused) {
      fetchUnreadNotificationCount();
    }
    
    // Add listener for when user returns to this screen
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('📍 FeedScreen focused - refreshing notification count');
      fetchUnreadNotificationCount();
    });
    
    return unsubscribe;
  }, [isFocused, navigation]);

  // FIXED: Animation logic with proper distances - now includes header
  const animateTabBars = useCallback((mainTabOpacity, headerOpacityValue, subTabToValue) => {
    console.log('🎬 ANIMATING TAB BARS AND HEADER:', {
      mainTabOpacity,
      headerOpacityValue,
      subTabToValue,
      subTabMoveDistance: SUB_TAB_MOVE_DISTANCE,
    });
    
    // Calculate translateY for hiding header - move it completely off screen
    const headerTranslateValue = headerOpacityValue === 0 ? -TOTAL_HEADER_HEIGHT - 10 : 0;
    
    // Update pointer events based on visibility to prevent blocking scroll
    setHeaderPointerEvents(headerOpacityValue === 0 ? 'none' : 'auto');
    
    // DON'T change padding dynamically - causes glitching/jumping
    // Keep padding constant, let header translate away (Twitter-style behavior)
    
    Animated.parallel([
      Animated.timing(tabBarOpacity, {
        toValue: mainTabOpacity,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: headerOpacityValue,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(headerTranslateY, {
        toValue: headerTranslateValue,
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
        headerVisible: headerOpacityValue === 1,
        subTabPosition: subTabToValue,
        headerTranslateValue,
        headerPointerEvents: headerOpacityValue === 0 ? 'none' : 'auto',
        debugInfo: {
          headerIsBlocking: headerOpacityValue === 0 ? 'NO - pointerEvents: none' : 'YES - pointerEvents: auto',
          headerPosition: headerTranslateValue,
          totalHeaderHeight: TOTAL_HEADER_HEIGHT,
        }
      });
    });
  }, [tabBarOpacity, headerOpacity, headerTranslateY, subTabTranslateY, TOTAL_HEADER_HEIGHT, SUB_TAB_MOVE_DISTANCE]);

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;

    // Determine scroll direction
    if (scrollDelta > 5) {
      scrollDirection.current = 'down';
    } else if (scrollDelta < -5) {
      scrollDirection.current = 'up';
    }

    // Handle tab bar and header visibility logic
    if (currentScrollY <= 0) {
      // At the top - show main tabs and header, sub-tabs in original position
      if (!isTabBarVisible.current || !isHeaderVisible.current) {
        console.log('📍 SCROLL: Showing main tabs and header (at top)', {
          currentScrollY,
          scrollDelta,
          headerPointerEvents: 'auto',
        });
        isTabBarVisible.current = true;
        isHeaderVisible.current = true;
        animateTabBars(1, 1, 0); // Main tabs: visible, Header: visible, Sub tabs: original position
      }
    } else if (scrollDirection.current === 'down' && currentScrollY > SCROLL_THRESHOLD) {
      // Scrolling down - HIDE main tabs and header, move sub-tabs to main tab position
      if (isTabBarVisible.current || isHeaderVisible.current) {
        console.log('📍 SCROLL: Hiding main tabs and header, moving sub-tabs to main position', {
          currentScrollY,
          scrollDelta,
          headerPointerEvents: 'none',
          headerTranslateY: -TOTAL_HEADER_HEIGHT - 10,
        });
        isTabBarVisible.current = false;
        isHeaderVisible.current = false;
        animateTabBars(0, 0, -SUB_TAB_MOVE_DISTANCE); // Sub-tabs move to main tab position
      }
    } else if (scrollDirection.current === 'up' && Math.abs(scrollDelta) > SHOW_THRESHOLD) {
      // Scrolling up - show main tabs and header, sub-tabs back to original position
      if (!isTabBarVisible.current || !isHeaderVisible.current) {
        console.log('📍 SCROLL: Showing main tabs and header, sub-tabs to original position', {
          currentScrollY,
          scrollDelta,
          headerPointerEvents: 'auto',
        });
        isTabBarVisible.current = true;
        isHeaderVisible.current = true;
        animateTabBars(1, 1, 0); // Main tabs: visible, Header: visible, Sub tabs: original position
      }
    }

    lastScrollY.current = currentScrollY;
  }, [animateTabBars, SUB_TAB_MOVE_DISTANCE, TOTAL_HEADER_HEIGHT]);

  const resetTabBar = useCallback(() => {
    console.log('🔄 RESETTING TAB BAR AND HEADER');
    isTabBarVisible.current = true;
    isHeaderVisible.current = true;
    lastScrollY.current = 0;
    animateTabBars(1, 1, 0);
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


  // FIXED: Pan Responder using currentTabIndex ref
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Don't capture immediately
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy, y0 } = gestureState;
        
        // ✅ FIX: Don't capture if gesture started in sub-tabs area
        const SUB_TAB_AREA_START = 120;
        const SUB_TAB_AREA_END = 220; // Increased buffer zone
        if (y0 >= SUB_TAB_AREA_START && y0 <= SUB_TAB_AREA_END) {
          console.log('🚫 PanResponder: Ignoring gesture in sub-tabs area');
          return false;
        }
        
        // ✅ FIX: Require stronger horizontal gesture (more selective)
        const isStrongHorizontalSwipe = Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * 2.5;
        return isStrongHorizontalSwipe && !isAnimating.current;
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

  const fetchUnreadNotificationCount = async () => {
    try {
      console.log('🔔 Fetching unread notification count...');
      const response = await api.get('/api/notifications/unread-count');
      const count = response.data.total || 0;
      console.log(`🔔 Unread notifications: ${count}`);
      setUnreadNotificationCount(count);
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
      // On error, set to 0 to avoid stale data
      setUnreadNotificationCount(0);
    }
  };

  const handleNotificationPress = () => {
    try {
      navigation.navigate('NotificationScreen');
    } catch (error) {
      Alert.alert('Feature Coming Soon', 'Notifications feature is currently being updated.');
    }
  };

  const handleProfilePress = () => {
    try {
      navigation.navigate('Profile', { screen: 'MyProfile' });
    } catch (error) {
      navigation.getParent()?.navigate('Profile', { screen: 'MyProfile' });
    }
  };

  const handleGlobalRefresh = async () => {
    setRefreshing(true);
    resetTabBar();
    
    try {
      if (activeTabIndex === 0 && forYouRef.current?.refresh) {
        console.log('🔄 Refreshing For You Feed');
        await forYouRef.current.refresh();
      } else if (activeTabIndex === 1 && activityRef.current?.refresh) {
        console.log('🔄 Refreshing Activity Feed');
        await activityRef.current.refresh();
      }
    } catch (error) {
      console.error('Global refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };


  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header - Solid Dark with Glassmorphic Effect */}
      <Animated.View 
        style={[
          styles.fixedHeaderContainer,
          { 
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          }
        ]}
        pointerEvents={headerPointerEvents}
        collapsable={false}
        removeClippedSubviews={false}
      >
        {Platform.OS === 'ios' ? (
          <BlurView 
            intensity={80} 
            style={styles.blurContainer}
            pointerEvents={headerPointerEvents}
          >
            <SafeAreaView 
              style={styles.safeAreaHeader}
              pointerEvents={headerPointerEvents}
            >
              <View style={styles.fixedHeader}>
                <TouchableOpacity 
                  style={styles.profileButton}
                  onPress={handleProfilePress}
                  activeOpacity={0.8}
                >
                  {currentUser?.profilePicture ? (
                    <Image
                      source={{ 
                        uri: currentUser.profilePicture.startsWith('http') 
                          ? currentUser.profilePicture 
                          : `http://${API_BASE_URL}:3000${currentUser.profilePicture.startsWith('/') ? '' : '/'}${currentUser.profilePicture}`
                      }}
                      style={styles.profilePicture}
                    />
                  ) : (
                    <View style={styles.profilePicturePlaceholder}>
                      <Ionicons name="person" size={20} color="#8E8E93" />
                    </View>
                  )}
                </TouchableOpacity>
                
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>
                    <Text style={styles.headerTitlePrimary}>Social</Text>
                    <Text style={styles.headerTitleSecondary}>Events</Text>
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.notificationButton}
                  onPress={handleNotificationPress}
                  activeOpacity={0.8}
                >
                  <View style={styles.notificationIconContainer}>
                    <Ionicons name="notifications-outline" size={28} color="#000000" />
                    {unreadNotificationCount > 0 && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              
              {/* Tab Bar */}
              <View style={styles.tabBarContainer}>
                {TABS.map((tab, index) => (
                  <TouchableOpacity
                    key={tab}
                    style={styles.tabButton}
                    onPress={() => handleTabPress(index)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.tabText,
                      activeTabIndex === index && styles.tabTextActive
                    ]}>
                      {tab}
                    </Text>
                    {activeTabIndex === index && (
                      <View style={styles.tabIndicator} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </SafeAreaView>
          </BlurView>
        ) : (
          <View 
            style={styles.androidGlassContainer}
            pointerEvents={headerPointerEvents}
          >
            <SafeAreaView 
              style={styles.safeAreaHeader}
              pointerEvents={headerPointerEvents}
            >
              <View style={styles.fixedHeader}>
                <TouchableOpacity 
                  style={styles.profileButton}
                  onPress={handleProfilePress}
                  activeOpacity={0.8}
                >
                  {currentUser?.profilePicture ? (
                    <Image
                      source={{ 
                        uri: currentUser.profilePicture.startsWith('http') 
                          ? currentUser.profilePicture 
                          : `http://${API_BASE_URL}:3000${currentUser.profilePicture.startsWith('/') ? '' : '/'}${currentUser.profilePicture}`
                      }}
                      style={styles.profilePicture}
                    />
                  ) : (
                    <View style={styles.profilePicturePlaceholder}>
                      <Ionicons name="person" size={20} color="#8E8E93" />
                    </View>
                  )}
                </TouchableOpacity>
                
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>
                    <Text style={styles.headerTitlePrimary}>Social</Text>
                    <Text style={styles.headerTitleSecondary}>Events</Text>
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.notificationButton}
                  onPress={handleNotificationPress}
                  activeOpacity={0.8}
                >
                  <View style={styles.notificationIconContainer}>
                    <Ionicons name="notifications-outline" size={28} color="#000000" />
                    {unreadNotificationCount > 0 && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              
              {/* Tab Bar */}
              <View style={styles.tabBarContainer}>
                {TABS.map((tab, index) => (
                  <TouchableOpacity
                    key={tab}
                    style={styles.tabButton}
                    onPress={() => handleTabPress(index)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.tabText,
                      activeTabIndex === index && styles.tabTextActive
                    ]}>
                      {tab}
                    </Text>
                    {activeTabIndex === index && (
                      <View style={styles.tabIndicator} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </SafeAreaView>
          </View>
        )}
      </Animated.View>


      {/* PHASE 2: Full-Screen Content - Starts at top, content scrolls under header */}
      {/* FIXED: Use constant padding to prevent glitching - Twitter-style behavior */}
      <View 
        style={[styles.contentContainer, { paddingTop: CONTENT_PADDING_TOP }]}
        {...panResponder.panHandlers}
        collapsable={false}
      >
        <Animated.View style={[
          styles.swipeableContent,
          { transform: [{ translateX: scrollX }] }
        ]}>
          {/* For You Tab */}
          <View style={[styles.tabContentWrapper, { width: SCREEN_WIDTH }]}>
            <ForYouFeed 
              navigation={navigation}
              ref={forYouRef}
              refreshing={refreshing}
              onRefresh={handleGlobalRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          </View>
          
          {/* Activity Tab */}
          <View style={[styles.tabContentWrapper, { width: SCREEN_WIDTH }]}>
            <ActivityFeed 
              navigation={navigation}
              ref={activityRef}
              refreshing={refreshing}
              onRefresh={handleGlobalRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
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
    backgroundColor: '#FFFFFF', // White background
  },
  
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  
  blurContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
    overflow: 'hidden', // Prevent overflow from blocking
  },
  
  androidGlassContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
    overflow: 'hidden', // Prevent overflow from blocking
  },
  
  safeAreaHeader: {
    backgroundColor: 'transparent',
    pointerEvents: 'box-none', // Allow touches to pass through to children only
  },
  
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 52,
  },
  
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  
  headerTitlePrimary: {
    color: '#000000', // Black
  },
  
  headerTitleSecondary: {
    color: '#000000', // Black
  },
  
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  tabBarContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 0,
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 40,
    backgroundColor: '#FFFFFF',
  },
  
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingTop: 6,
    paddingBottom: 10,
  },
  
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.015,
    color: '#8E8E93',
    marginBottom: 4,
  },
  
  tabTextActive: {
    color: '#000000',
  },
  
  tabIndicator: {
    height: 2,
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 2,
    marginTop: 4,
  },
  
  notificationIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 10,
    height: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },

  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },

  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  profilePicturePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },


  contentContainer: {
    flex: 1,
    // paddingTop will be set inline to use TOTAL_HEADER_HEIGHT constant
  },

  swipeableContent: {
    flexDirection: 'row',
    height: '100%',
    width: SCREEN_WIDTH * TABS.length,
  },

  tabContentWrapper: {
    backgroundColor: 'transparent',
    flex: 1,
    overflow: 'visible',
    // Ensure content can scroll freely
  }, 
});