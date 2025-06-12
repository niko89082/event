// screens/FeedScreen.js - Updated home structure with proper header and pull-to-refresh
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
              onPress={() => navigation.navigate('ChatTab')}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('Create')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tab Navigator */}
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#000000',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarIndicatorStyle: {
            backgroundColor: '#000000',
            height: 2,
          },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0.5,
            borderBottomColor: '#E1E1E1',
          },
          tabBarLabelStyle: {
            fontSize: 16,
            fontWeight: '600',
            textTransform: 'none',
          },
          tabBarPressColor: 'transparent',
        }}
      >
        <Tab.Screen 
          name="Posts" 
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'grid' : 'grid-outline'} 
                size={20} 
                color={color} 
              />
            ),
          }}
        >
          {(props) => (
            <EnhancedPostsFeed 
              {...props} 
              ref={postsRef}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Events" 
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'calendar' : 'calendar-outline'} 
                size={20} 
                color={color} 
              />
            ),
          }}
        >
          {(props) => (
            <EventsHub 
              {...props} 
              ref={eventsRef}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Custom Header
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
  },
});
