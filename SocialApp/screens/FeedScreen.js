// screens/FeedScreen.js - Fixed with proper refresh and navigation
import React, { useLayoutEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  SafeAreaView,
  Alert,
  RefreshControl,
  ScrollView
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import EnhancedPostsFeed from '../components/PostsFeed';
import EventsHub from '../components/EventsHub';

const Tab = createMaterialTopTabNavigator();

export default function FeedScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Posts');
  const postsRef = useRef(null);
  const eventsRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, // We'll create our own header
    });
  }, [navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh the active tab
      if (activeTab === 'Posts' && postsRef.current?.refresh) {
        await postsRef.current.refresh();
      } else if (activeTab === 'Events' && eventsRef.current?.refresh) {
        await eventsRef.current.refresh();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNotificationPress = () => {
    // Check if NotificationScreen exists in navigation
    try {
      navigation.navigate('NotificationScreen');
    } catch (error) {
      // If NotificationScreen is not in current stack, try other approaches
      console.warn('NotificationScreen not found in current navigator');
      
      // Try to navigate through main app navigation
      try {
        navigation.getParent()?.navigate('NotificationScreen');
      } catch (parentError) {
        // Show alert or handle gracefully
        Alert.alert(
          'Feature Coming Soon',
          'Notifications feature is currently being updated. Please check back later.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    }
  };

  // Create custom tab components that support refresh
  function PostsFeed({ navigation, jumpTo }) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        scrollEventThrottle={16}
      >
        <EnhancedPostsFeed navigation={navigation} ref={postsRef} />
      </ScrollView>
    );
  }

  function EventsFeed({ navigation, jumpTo }) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        scrollEventThrottle={16}
      >
        <EventsHub navigation={navigation} ref={eventsRef} />
      </ScrollView>
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
              onPress={() => navigation.navigate('SearchScreen')}
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
          },
          tabBarPressColor: '#F2F2F7',
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
          children={(props) => <PostsFeed {...props} />}
          options={{
            tabBarLabel: 'Posts',
          }}
        />
        <Tab.Screen 
          name="Events" 
          children={(props) => <EventsFeed {...props} />}
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
    paddingVertical: 12,
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
    gap: 16,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
});