// SocialApp/screens/FeedScreen.js - FIXED: Restore pull-to-refresh functionality
import React, { useLayoutEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  SafeAreaView,
  Alert,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import PostsFeed from '../components/PostsFeed';
import EventsHub from '../components/EventsHub';

const Tab = createMaterialTopTabNavigator();

export default function FeedScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Posts');
  const [refreshing, setRefreshing] = useState(false);
  const postsRef = useRef(null);
  const eventsRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, // We'll create our own header
    });
  }, [navigation]);

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
      // Try through parent navigator
      navigation.getParent()?.navigate('SearchScreen');
    }
  };

  // FIXED: Enhanced refresh handling for both tabs
  const handleGlobalRefresh = async () => {
    setRefreshing(true);
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

  // FIXED: Tab components with proper refresh support
  function PostsTabScreen({ navigation }) {
    return (
      <PostsFeed 
        navigation={navigation} 
        ref={postsRef}
        refreshing={refreshing}
        onRefresh={handleGlobalRefresh}
      />
    );
  }

  function EventsTabScreen({ navigation }) {
    return (
      <EventsHub 
        navigation={navigation} 
        ref={eventsRef}
        refreshing={refreshing}
        onRefresh={handleGlobalRefresh}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Custom Header */}
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

      {/* Tab Navigator for Posts and Events */}
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#3797EF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarIndicatorStyle: {
            backgroundColor: '#3797EF',
            height: 2,
          },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#E1E1E1',
          },
          tabBarLabelStyle: {
            fontSize: 16,
            fontWeight: '600',
            textTransform: 'none',
            marginTop: 0,
            marginBottom: 0,
          },
          tabBarPressColor: '#F2F2F7',
          tabBarContentContainerStyle: {
            paddingHorizontal: 16,
          },
        }}
        screenListeners={{
          state: (e) => {
            // Track which tab is active for refresh purposes
            const state = e.data.state;
            if (state) {
              const activeIndex = state.index;
              const routeName = state.routes[activeIndex].name;
              setActiveTab(routeName);
            }
          },
        }}
      >
        <Tab.Screen 
          name="Posts" 
          component={PostsTabScreen}
          options={{
            tabBarLabel: 'Posts',
          }}
        />
        <Tab.Screen 
          name="Events" 
          component={EventsTabScreen}
          options={{
            tabBarLabel: 'Events',
          }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
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
  },
});