// screens/FeedScreen.js - Updated with notifications button, no chat button
import React, { useLayoutEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, SafeAreaView } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import EnhancedPostsFeed from '../components/PostsFeed';
import EventsHub from '../components/EventsHub';

const Tab = createMaterialTopTabNavigator();

export default function FeedScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const postsRef = useRef(null);
  const eventsRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, // We'll create our own header
    });
  }, [navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger refresh on active tab components
    setRefreshing(false);
  };

  function PostsFeed({ navigation }) {
    return <EnhancedPostsFeed navigation={navigation} ref={postsRef} />;
  }

  function EventsFeed({ navigation }) {
    return <EventsHub navigation={navigation} ref={eventsRef} />;
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
              onPress={() => navigation.navigate('NotificationScreen')}
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
          tabBarActiveTintColor: '#3797EF', // Changed to blue
          tabBarInactiveTintColor: '#8E8E93',
          tabBarIndicatorStyle: {
            backgroundColor: '#3797EF', // Changed to blue
            height: 2,
          },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0.33,
            borderBottomColor: '#E1E1E1',
          },
          tabBarLabelStyle: {
            fontSize: 16,
            fontWeight: '600',
            textTransform: 'none',
          },
          tabBarShowIcon: false, // Remove icons, only show text
        }}
      >
        <Tab.Screen 
          name="Posts" 
          component={PostsFeed}
          initialParams={{ navigation }}
        />
        <Tab.Screen 
          name="Events" 
          component={EventsFeed}
          initialParams={{ navigation }}
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
    borderBottomWidth: 0.33,
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
  },
  headerButton: {
    marginLeft: 16,
    padding: 8,
    borderRadius: 20,
  },
  tabContent: {
    flex: 1,
  },
});