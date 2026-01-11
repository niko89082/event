// SocialApp/screens/FeedScreen.js - Redesigned with simplified structure
import React, { useLayoutEffect, useState, useRef, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  SafeAreaView,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import ActivityFeed from '../components/ActivityFeed';
import ForYouFeed from '../components/ForYouFeed';
import api from '../services/api';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import { useContext } from 'react';
import { API_BASE_URL } from '@env';

// Disable automatic font scaling
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['For You', 'Activity'];

export default function FeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { currentUser } = useContext(AuthContext);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const scrollViewRef = useRef(null);
  const activityRef = useRef(null);
  const forYouRef = useRef(null);
  
  // Header scroll animation - only translateY, no opacity (solid color)
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const isHeaderVisible = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

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

  // Handle scroll view momentum end to detect tab changes
  const handleScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    
    if (newIndex !== activeTabIndex) {
      setActiveTabIndex(newIndex);
    }
  }, [activeTabIndex]);

  // Handle tab button press
  const handleTabPress = useCallback((index) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
    setActiveTabIndex(index);
  }, []);

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

  const handleNotificationLongPress = () => {
    try {
      navigation.navigate('NotificationExamples');
    } catch (error) {
      console.error('Error navigating to NotificationExamples:', error);
    }
  };

  const handleProfilePress = () => {
    try {
      navigation.navigate('Profile', { screen: 'MyProfile' });
    } catch (error) {
      navigation.getParent()?.navigate('Profile', { screen: 'MyProfile' });
    }
  };

  const handleActivityTabLongPress = () => {
    try {
      navigation.navigate('ActivityDebugScreen');
    } catch (error) {
      console.error('Error navigating to ActivityDebugScreen:', error);
    }
  };

  const handleGlobalRefresh = async () => {
    try {
      if (activeTabIndex === 0 && forYouRef.current?.refresh) {
        await forYouRef.current.refresh();
      } else if (activeTabIndex === 1 && activityRef.current?.refresh) {
        await activityRef.current.refresh();
      }
    } catch (error) {
      console.error('Global refresh error:', error);
    }
  };

  // Handle vertical scroll for header hiding - solid color, translate up/down only
  const handleVerticalScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;
    
    // Scroll threshold for hiding header
    const SCROLL_HIDE_THRESHOLD = 50;
    
    // Determine scroll direction
    const SCROLL_DELTA_THRESHOLD = 3;
    if (Math.abs(scrollDelta) > SCROLL_DELTA_THRESHOLD) {
      scrollDirection.current = scrollDelta > 0 ? 'down' : 'up';
    }
    
    const headerHeight = SAFE_AREA_TOP + HEADER_HEIGHT + TAB_BAR_HEIGHT;
    const shouldHide = scrollDirection.current === 'down' && currentScrollY > SCROLL_HIDE_THRESHOLD;
    const shouldShow = scrollDirection.current === 'up' || currentScrollY <= 10;
    
    // Animate header - only translateY, no opacity (solid color)
    // Translate up more to ensure it's completely off screen
    if (shouldHide && isHeaderVisible.current) {
      isHeaderVisible.current = false;
      Animated.timing(headerTranslateY, {
        toValue: -(headerHeight + 20), // Add extra 20px to go up more
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else if (shouldShow && !isHeaderVisible.current) {
      isHeaderVisible.current = true;
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
    
    lastScrollY.current = currentScrollY;
  }, [SAFE_AREA_TOP, HEADER_HEIGHT, TAB_BAR_HEIGHT]);

  const SAFE_AREA_TOP = insets.top;
  const HEADER_HEIGHT = 52;
  const TAB_BAR_HEIGHT = 32; // Reduced further to eliminate white space
  const TOTAL_HEADER_HEIGHT = SAFE_AREA_TOP + HEADER_HEIGHT + TAB_BAR_HEIGHT;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Fixed Header - Solid White Background, Translates Up/Down */}
      <Animated.View
        style={[
          styles.fixedHeaderContainer,
          {
            transform: [{ translateY: headerTranslateY }],
          }
        ]}
      >
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
                onLongPress={handleNotificationLongPress}
                activeOpacity={0.8}
              >
                <View style={styles.notificationIconContainer}>
                  <Ionicons 
                    name="notifications-outline" 
                    size={28} 
                    color={unreadNotificationCount > 0 ? "#3797EF" : "#000000"} 
                  />
                  {unreadNotificationCount > 0 ? (
                    unreadNotificationCount > 9 ? (
                      <View style={styles.notificationBadgeBlue}>
                        <Text style={styles.notificationBadgeText}>
                          9+
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.notificationBadgeBlue}>
                        <Text style={styles.notificationBadgeText}>
                          {unreadNotificationCount}
                        </Text>
                      </View>
                    )
                  ) : null}
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
                  onLongPress={index === 1 ? handleActivityTabLongPress : undefined}
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
      </Animated.View>

      {/* Swipeable Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* For You Tab */}
        <View style={styles.tabContentWrapper}>
          <ForYouFeed 
            navigation={navigation}
            ref={forYouRef}
            onRefresh={handleGlobalRefresh}
            scrollEventThrottle={16}
            onScroll={handleVerticalScroll}
            debugValues={{
              totalHeaderHeight: TOTAL_HEADER_HEIGHT,
              fixedHeaderHeight: HEADER_HEIGHT,
              tabBarHeight: TAB_BAR_HEIGHT,
            }}
          />
        </View>
        
        {/* Activity Tab */}
        <View style={styles.tabContentWrapper}>
          <ActivityFeed 
            navigation={navigation}
            ref={activityRef}
            onRefresh={handleGlobalRefresh}
            onScroll={handleVerticalScroll}
            scrollEventThrottle={16}
            debugValues={{
              totalHeaderHeight: TOTAL_HEADER_HEIGHT,
              fixedHeaderHeight: HEADER_HEIGHT,
              tabBarHeight: TAB_BAR_HEIGHT,
            }}
          />
        </View>
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
    backgroundColor: '#FFFFFF', // Solid white background - no blur
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
    backgroundColor: '#FFFFFF', // Solid white - no translucency
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
  
  tabBarContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 0,
    paddingTop: 2,
    paddingBottom: 0,
    minHeight: 36,
    backgroundColor: '#FFFFFF',
  },
  
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingTop: 4,
    paddingBottom: 0,
  },
  
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.015,
    color: '#8E8E93',
    marginBottom: 6,
  },
  
  tabTextActive: {
    color: '#000000',
  },
  
  tabIndicator: {
    height: 2,
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 2,
    marginTop: 0,
  },
  
  notificationIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  notificationBadgeBlue: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#3797EF',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
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

  scrollViewContent: {
    flexDirection: 'row',
  },

  tabContentWrapper: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
});
