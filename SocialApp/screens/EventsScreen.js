// screens/EventsScreen.js - Redesigned Events screen with Featured Events section
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Image,
  ScrollView, Alert, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';
import api from '../services/api';
import EventsTabBar from '../components/events/EventsTabBar';
import FeaturedEventsSection from '../components/events/FeaturedEventsSection';
import EventsFeedSection from '../components/events/EventsFeedSection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['friends', 'for-you', 'attending', 'hosting'];

export default function EventsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('for-you');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const scrollViewRef = useRef(null);
  const activeTabIndex = TABS.indexOf(activeTab);

  // Fetch unread notification count when screen is focused
  useEffect(() => {
    if (isFocused) {
      fetchUnreadNotificationCount();
    }
    
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadNotificationCount();
    });
    
    return unsubscribe;
  }, [isFocused, navigation]);

  const fetchUnreadNotificationCount = async () => {
    try {
      const response = await api.get('/api/notifications/unread-count');
      const count = response.data.total || 0;
      setUnreadNotificationCount(count);
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
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

  const handleTabChange = (tab) => {
    const tabIndex = TABS.indexOf(tab);
    setActiveTab(tab);
    
    // Scroll to the corresponding tab content
    if (scrollViewRef.current && tabIndex !== -1) {
      scrollViewRef.current.scrollTo({
        x: tabIndex * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  // Handle horizontal scroll to detect tab changes
  const handleScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    
    if (newIndex >= 0 && newIndex < TABS.length && newIndex !== activeTabIndex) {
      setActiveTab(TABS[newIndex]);
    }
  }, [activeTabIndex]);

  const SAFE_AREA_TOP = insets.top;
  const HEADER_HEIGHT = 52;

  // Sync scroll position when activeTab changes from tab bar
  useEffect(() => {
    const tabIndex = TABS.indexOf(activeTab);
    if (scrollViewRef.current && tabIndex !== -1) {
      scrollViewRef.current.scrollTo({
        x: tabIndex * SCREEN_WIDTH,
        animated: true,
      });
    }
  }, [activeTab]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Fixed Header - Match FeedScreen style */}
      <View style={[styles.fixedHeaderContainer, { paddingTop: SAFE_AREA_TOP }]}>
        <View style={styles.solidHeaderContainer}>
          <SafeAreaView style={styles.safeAreaHeader}>
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
            <EventsTabBar 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </SafeAreaView>
        </View>
      </View>

      {/* Swipeable Tab Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.horizontalScrollContent}
        directionalLockEnabled={true}
      >
        {TABS.map((tab) => (
          <View key={tab} style={styles.tabContentWrapper}>
            <ScrollView
              style={styles.verticalScrollView}
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {/* Featured Events Section */}
              <FeaturedEventsSection navigation={navigation} />
              
              {/* Feed Section */}
              <EventsFeedSection 
                navigation={navigation}
                activeTab={tab}
                currentUserId={currentUser?._id}
              />
            </ScrollView>
          </View>
        ))}
      </ScrollView>
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
    backgroundColor: '#FFFFFF',
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
  
  solidHeaderContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  safeAreaHeader: {
    backgroundColor: 'transparent',
  },
  
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 20,
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
    color: '#000000',
  },
  
  headerTitleSecondary: {
    color: '#000000',
  },
  
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#3797EF',
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

  scrollView: {
    flex: 1,
  },

  horizontalScrollContent: {
    flexDirection: 'row',
  },

  tabContentWrapper: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  verticalScrollView: {
    flex: 1,
  },

  scrollViewContent: {
    paddingTop: 160, // Account for header + tabs (increased more to prevent overlap)
    paddingBottom: 100,
  },
});

