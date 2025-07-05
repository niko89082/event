// SocialApp/screens/FeedScreen.js - Enhanced with animated header AND tab bar
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Animated Header */}
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

      {/* Animated Tab Bar */}
      <Animated.View style={[styles.animatedTabBarContainer, getTabBarStyle()]}>
        <View style={styles.customTabBar}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Posts' && styles.activeTabButton
            ]}
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
            style={[
              styles.tabButton,
              activeTab === 'Events' && styles.activeTabButton
            ]}
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
        
        {/* Tab Indicator */}
        <Animated.View 
          style={[
            styles.tabIndicator,
            {
              left: activeTab === 'Posts' ? '12.5%' : '62.5%',
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
  
  // Animated Header Styles
  animatedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  safeAreaHeader: {
    backgroundColor: '#FFFFFF',
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
  
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },

  // Animated Tab Bar Styles
  animatedTabBarContainer: {
    position: 'absolute',
    top: 100, // Position below header (adjust based on actual header height)
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },

  customTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
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
    bottom: 0,
    width: '25%',
    height: 2,
    backgroundColor: '#3797EF',
    borderRadius: 1,
  },

  // Content Container Styles
  contentContainer: {
    flex: 1,
  },
  
  headerSpacer: {
    height: 100, // Space for header when visible
  },

  tabBarSpacer: {
    height: 50, // Space for tab bar when visible
  },

  tabContentContainer: {
    flex: 1,
  },

  tabScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});