// screens/FeedScreen.js - Fixed header positioning
import React, { useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, SafeAreaView } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PostsFeed from '../components/PostsFeed';
import EventsFeed from '../components/EventsFeed';

const Tab = createMaterialTopTabNavigator();

export default function FeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, // We'll create our own header for better control
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Custom header with proper positioning */}
      <View style={styles.customHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Social</Text>
          <View style={styles.headerRightContainer}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('SearchScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('Chat')}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
            borderBottomWidth: 0.33,
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
          component={PostsFeed}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'grid' : 'grid-outline'} 
                size={20} 
                color={color} 
                style={{ marginBottom: 2 }}
              />
            ),
          }}
        />
        <Tab.Screen 
          name="Events" 
          component={EventsFeed}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'calendar' : 'calendar-outline'} 
                size={20} 
                color={color} 
                style={{ marginBottom: 2 }}
              />
            ),
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
  customHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.33,
    borderBottomColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4, // Reduced top padding
    paddingBottom: 8, // Reduced bottom padding
    minHeight: 48, // Reduced minimum height
  },
  headerTitle: {
    fontSize: 22, // Slightly smaller
    fontWeight: '700',
    color: '#000000',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
});