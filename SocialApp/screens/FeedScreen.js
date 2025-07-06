// SocialApp/screens/FeedScreen.js - Complete file with translucent header implementation
import React, { useLayoutEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  SafeAreaView,
  Alert,
  Animated,
  Platform, // Added for platform-specific styling
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import PostsFeed from '../components/PostsFeed';
import EventsHub from '../components/EventsHub';
import { useAnimatedHeader } from '../hooks/useAnimatedHeader';

const Tab = createMaterialTopTabNavigator();

export default function FeedScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Posts');
  const [refreshing, setRefreshing] = useState(false);
  const postsRef = useRef(null);
  const eventsRef = useRef(null);

  // Animated header hook with tab bar support
  const { handleScroll, resetHeader, getHeaderStyle, getTabBarStyle } = useAnimatedHeader();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, // We handle our own header
    });
  }, [navigation]);

  // Reset header when switching tabs
  const handleTabChange = useCallback((newTab) => {
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      resetHeader();
    }
  }, [activeTab, resetHeader]);

  const handleNotificationPress = () => {
    try {
      navigation.navigate('NotificationScreen');
    } catch (error) {
      console.warn('NotificationScreen not found in current navigator');
      Alert.alert(
        'Feature Coming Soon',
        'Notifications feature is currently being updated. Please check back later.',
        [{ text: 'OK', style: 'default' }]
      );
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
    // Reset header to visible during refresh
    resetHeader();
    
    try {
      if (activeTab === 'Posts' && postsRef.current?.refresh) {
        await postsRef.current.refresh();
      } else if (activeTab === 'Events' && eventsRef.current?.refresh) {
        await eventsRef.current.refresh();
      }
    } catch (error) {
      console.error('Global refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Enhanced tab components with scroll handling
  function PostsTabScreen({ navigation }) {
    return (
      <View style={styles.tabScreenContainer}>
        <PostsFeed 
          navigation={navigation} 
          ref={postsRef}
          refreshing={refreshing}
          onRefresh={handleGlobalRefresh}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      </View>
    );
  }

  function EventsTabScreen({ navigation }) {
    return (
      <View style={styles.tabScreenContainer}>
        <EventsHub 
          navigation={navigation} 
          ref={eventsRef}
          refreshing={refreshing}
          onRefresh={handleGlobalRefresh}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* 🔄 UPDATED: Translucent Animated Header */}
      <Animated.View style={[styles.animatedHeaderContainer, getHeaderStyle()]}>
        <SafeAreaView style={styles.safeAreaHeader}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Social</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={handleSearchPress}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search-outline" size={24} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={handleNotificationPress}
                  activeOpacity={0.8}
                >
                  <Ionicons name="notifications-outline" size={24} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* 🔄 UPDATED: Translucent Animated Tab Bar */}
      <Animated.View style={[styles.animatedTabBarContainer, getTabBarStyle()]}>
        <View style={styles.customTabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Posts' && styles.activeTabButton]}
            onPress={() => handleTabChange('Posts')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabButtonText,
              activeTab === 'Posts' && styles.activeTabButtonText
            ]}>
              Posts
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Events' && styles.activeTabButton]}
            onPress={() => handleTabChange('Events')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabButtonText,
              activeTab === 'Events' && styles.activeTabButtonText
            ]}>
              Events
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab indicator - Fixed positioning */}
        <Animated.View 
          style={[
            styles.tabIndicator,
            {
              transform: [
                { 
                  translateX: activeTab === 'Posts' ? -70 : 10
                }
              ],
            }
          ]} 
        />
      </Animated.View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Static spacers for header and tab bar when visible */}
        <View style={styles.headerSpacer} />
        <View style={styles.tabBarSpacer} />
        
        {/* Active Tab Content */}
        <View style={styles.tabContentContainer}>
          {activeTab === 'Posts' ? (
            <PostsTabScreen navigation={navigation} />
          ) : (
            <EventsTabScreen navigation={navigation} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // 🔄 UPDATED: Translucent Animated Header Styles
  animatedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    // 🔄 CHANGE: Platform-specific translucent background
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.85)' 
      : 'rgba(255, 255, 255, 0.95)', // Slightly more opaque on Android for readability
    // 🔄 CHANGE: Add blur effect for iOS
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(10px)',
    }),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(225, 225, 225, 0.6)', // Translucent border
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05, // Reduced shadow opacity for translucent effect
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  safeAreaHeader: {
    backgroundColor: 'transparent', // Let parent handle background
  },
  
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  // 🔄 UPDATED: Header buttons with better contrast for translucent background
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.08)', // Slightly more visible on translucent background
  },

  // 🔄 UPDATED: Transparent Tab Bar Styles
  animatedTabBarContainer: {
    position: 'absolute',
    top: 100, // Position below header
    left: 0,
    right: 0,
    zIndex: 999,
    // 🔄 CHANGE: Completely transparent background
    backgroundColor: 'transparent',
    // Remove all borders and shadows for clean transparent look
    borderBottomWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },

  // 🔄 UPDATED: Transparent Tab Bar with proper spacing for indicator
  customTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 8,
    position: 'relative',
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 20,
  },

  activeTabButton: {
    // Active state styling handled by text color
  },

  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },

  activeTabButtonText: {
    color: '#3797EF',
  },

  tabIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 60, // Fixed width
    height: 2,
    backgroundColor: '#3797EF',
    borderRadius: 1,
    // Positioning will be handled in JSX
  },

  // 🔄 NEW: Swipe Container Styles
  swipeableContainer: {
    flexDirection: 'row',
    flex: 1,
    // Width will be set dynamically in JSX
  },

  tabContentWrapper: {
    // Width will be set dynamically in JSX
    flex: 1,
  },

  // Content Container Styles
  contentContainer: {
    flex: 1,
  },
  
  headerSpacer: {
    height: 100, // Space for header when visible
  },

  tabBarSpacer: {
    height: 35, // Reduced space for smaller transparent tab bar
  },

  tabContentContainer: {
    flex: 1,
  },

  tabScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

// 🔄 ALTERNATIVE OPACITY OPTIONS:
// For more translucency: backgroundColor: 'rgba(255, 255, 255, 0.7)'
// For frosted glass effect: backgroundColor: 'rgba(255, 255, 255, 0.8)'
// For subtle effect: backgroundColor: 'rgba(255, 255, 255, 0.9)'