// screens/FeedScreen.js - Fixed with SafeArea handling
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
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
        height: 100 + insets.top, // Add safe area to header height
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 24,
        color: '#000000',
      },
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Social</Text>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('SearchScreen')}
          >
            <Ionicons name="search-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Messages')}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      ),
      headerLeft: () => null,
    });
  }, [navigation, insets.top]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Custom header to ensure proper spacing */}
      <View style={[styles.customHeader, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Social</Text>
          <View style={styles.headerRightContainer}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('SearchScreen')}
            >
              <Ionicons name="search-outline" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('Messages')}
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
          component={PostsFeed}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'grid' : 'grid-outline'} 
                size={20} 
                color={color} 
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
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
  },
});