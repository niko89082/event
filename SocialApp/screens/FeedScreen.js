// SocialApp/screens/FeedScreen.js - FIXED: Combined headers with proper spacing
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
import { useAnimatedHeader } from '../hooks/useAnimatedHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['Posts', 'Events'];
const ANIMATION_DURATION = 250;

// Calculate constants outside component
const TAB_WIDTH = SCREEN_WIDTH / 2;
const INDICATOR_WIDTH = 60;
const INDICATOR_OFFSET = (TAB_WIDTH - INDICATOR_WIDTH) / 2;

export default function FeedScreen({ navigation }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const postsRef = useRef(null);
  const eventsRef = useRef(null);
  const isAnimating = useRef(false);

  // FIXED: Use ref to avoid closure issues in pan responder
  const currentTabIndex = useRef(0);

  // Initialize animated values
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabIndicatorPosition = useRef(new Animated.Value(INDICATOR_OFFSET)).current;

  // Animated header hook - pass the activeTabIndex for EventsHub to use
  const { handleScroll, resetHeader, getHeaderStyle } = useAnimatedHeader();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Update ref whenever state changes to fix closure issue
  useEffect(() => {
    currentTabIndex.current = activeTabIndex;
  }, [activeTabIndex]);

  // Tab switching with proper state management
  const switchToTab = useCallback((index) => {
    const targetIndex = Math.max(0, Math.min(TABS.length - 1, index));
    
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    
    const targetContentOffset = -targetIndex * SCREEN_WIDTH;
    const targetIndicatorPosition = targetIndex * TAB_WIDTH + INDICATOR_OFFSET;
    
    // Update state first
    setActiveTabIndex(targetIndex);
    resetHeader();
    
    // Then animate
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
  }, [resetHeader]);

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
    resetHeader();
    
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* COMBINED HEADER - Social + Tab Names + Tab Bar */}
      <Animated.View style={[styles.animatedHeaderContainer, getHeaderStyle()]}>
        <SafeAreaView style={styles.safeAreaHeader}>
          {/* Top Section: Social + Search/Notifications */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Social</Text>
                <Text style={styles.headerSubtitle}>{TABS[activeTabIndex]}</Text>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={handleSearchPress}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search-outline" size={22} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={handleNotificationPress}
                  activeOpacity={0.8}
                >
                  <Ionicons name="notifications-outline" size={22} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {/* Bottom Section: Tab Bar */}
          <View style={styles.tabBarSection}>
            <View style={styles.customTabBar}>
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
            </View>
            
            <Animated.View 
              style={[
                styles.tabIndicator,
                {
                  transform: [{ translateX: tabIndicatorPosition }],
                }
              ]} 
            />
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* FIXED: Content with proper animated positioning */}
      <View style={styles.contentWrapper}>
        {/* Static spacer for initial header space */}
        <View style={styles.headerSpacer} />
        
        {/* Animated content that moves with header */}
        <Animated.View style={[
          styles.animatedContent,
          {
            // Move content up when header moves up
            transform: [{ 
              translateY: getHeaderStyle().transform[0].translateY 
            }]
          }
        ]}>
          <View 
            style={styles.swipeContainer}
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
                  headerStyle={getHeaderStyle()} // Pass header animation to EventsHub
                />
              </View>
            </Animated.View>
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
  
  // COMBINED HEADER: Contains both the title section and tab bar
  animatedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.85)' 
      : 'rgba(255, 255, 255, 0.95)',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(10px)',
    }),
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(225, 225, 225, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
  },
  
  safeAreaHeader: {
    backgroundColor: 'transparent',
  },
  
  // Top part of combined header: Social + subtitle + buttons
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  headerLeft: {
    flex: 1,
  },
  
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 26,
  },
  
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3797EF',
    marginTop: 1,
  },
  
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  headerButton: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom part of combined header: Tab bar
  tabBarSection: {
    backgroundColor: 'transparent',
    position: 'relative',
  },

  customTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 6,
    position: 'relative',
    backgroundColor: 'transparent',
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },

  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },

  activeTabButtonText: {
    color: '#3797EF',
  },

  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 60,
    height: 3,
    backgroundColor: '#3797EF',
    borderRadius: 1.5,
  },

  // FIXED: Content Layout with proper animated positioning
  contentWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  headerSpacer: {
    height: Platform.OS === 'ios' ? 120 : 110, // Static space for header
    backgroundColor: 'transparent',
  },

  animatedContent: {
    flex: 1,
  },

  swipeContainer: {
    flex: 1,
    overflow: 'hidden',
  },

  swipeableContent: {
    flexDirection: 'row',
    height: '100%',
    width: SCREEN_WIDTH * TABS.length,
  },

  tabContentWrapper: {
    backgroundColor: '#FFFFFF',
  },
});