// navigation/MainTabNavigator.js - Modern Glassmorphic Bottom Tab Navigator
import React, { useLayoutEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// Tab Screens
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Create Screens
import CreateEventScreen from '../screens/CreateEventScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import CreateMemoryScreen from '../screens/CreateMemoryScreen';
import PostPublishedScreen from '../screens/PostPublishedScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Custom Tab Bar Component with Glassmorphism
function CustomTabBar({ state, descriptors, navigation }) {
  // Check if we're on CreatePost screen - hide tab bar
  const isCreatePost = React.useMemo(() => {
    const createTab = state.routes.find(r => r.name === 'Create');
    if (createTab?.state?.routes) {
      const currentRoute = createTab.state.routes[createTab.state.index];
      const isPost = currentRoute?.name === 'CreatePost';
      // Also check nested state
      if (currentRoute?.state?.routes) {
        const nestedRoute = currentRoute.state.routes[currentRoute.state.index];
        return isPost || nestedRoute?.name === 'CreatePost';
      }
      return isPost;
    }
    return false;
  }, [state]);

  if (isCreatePost) {
    return null; // Hide tab bar completely when on CreatePost
  }

  return (
    <View style={styles.tabBarContainer}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} style={styles.tabBarBlur}>
          <View style={styles.tabBarContent}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const label = options.tabBarLabel !== undefined 
                ? options.tabBarLabel 
                : options.title !== undefined 
                ? options.title 
                : route.name;

              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              // Icon mapping with special handling for Create
              let iconName;
              let iconSize = 28;
              let iconColor;
              
              switch (route.name) {
                case 'Feed':
                  iconName = isFocused ? 'home' : 'home-outline';
                  iconColor = isFocused ? '#0D47A1' : '#212121';
                  break;
                case 'Create':
                  iconName = isFocused ? 'add-circle' : 'add-circle-outline';
                  iconSize = 34; // Slightly smaller but still prominent
                  iconColor = isFocused ? '#1565C0' : '#1976D2'; // Always blue to stand out
                  break;
                case 'Profile':
                  iconName = isFocused ? 'person' : 'person-outline';
                  iconColor = isFocused ? '#0D47A1' : '#212121';
                  break;
                default:
                  iconName = 'help-outline';
                  iconColor = '#212121';
              }

              return (
                <View key={route.key} style={styles.tabItem}>
                  <TouchableOpacity 
                    style={[
                      styles.tabButton,
                      isFocused && styles.activeTabButton
                    ]}
                    onPress={onPress}
                    activeOpacity={1} // Remove dark square feedback
                    underlayColor="transparent" // Remove any underlay
                  >
                    <Ionicons 
                      name={iconName} 
                      size={iconSize} 
                      color={iconColor}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </BlurView>
      ) : (
        // Android fallback with glass-like styling
        <View style={[styles.tabBarBlur, styles.androidGlass]}>
          <View style={styles.tabBarContent}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              let iconName;
              let iconSize = 28;
              let iconColor;
              
              switch (route.name) {
                case 'Feed':
                  iconName = isFocused ? 'home' : 'home-outline';
                  iconColor = isFocused ? '#0D47A1' : '#212121';
                  break;
                case 'Create':
                  iconName = isFocused ? 'add-circle' : 'add-circle-outline';
                  iconSize = 34; // Slightly smaller but still prominent
                  iconColor = isFocused ? '#1565C0' : '#1976D2'; // Always blue to stand out
                  break;
                case 'Profile':
                  iconName = isFocused ? 'person' : 'person-outline';
                  iconColor = isFocused ? '#0D47A1' : '#212121';
                  break;
                default:
                  iconName = 'help-outline';
                  iconColor = '#212121';
              }

              return (
                <View key={route.key} style={styles.tabItem}>
                  <View style={[
                    styles.tabButton,
                    isFocused && styles.activeTabButton
                  ]}>
                    <Ionicons 
                      name={iconName} 
                      size={28} 
                      color={isFocused ? '#1976D2' : '#424242'}
                      onPress={onPress}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// Profile Stack Navigator
function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="MyProfile" 
        component={ProfileScreen}
        initialParams={{ userId: null }}
      />
    </Stack.Navigator>
  );
}

// Create Stack Navigator
function CreateStackNavigator({ navigation }) {
  // Hide tab bar when CreatePost screen is active
  useLayoutEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      const state = navigation.getState();
      const currentRoute = state.routes[state.index];
      const isCreatePost = currentRoute.name === 'CreatePost';
      
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        tabNavigator.setOptions({
          tabBarStyle: isCreatePost ? { display: 'none' } : undefined,
        });
      }
    });
    
    return unsubscribe;
  }, [navigation]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen} 
        options={{ headerShown: true, title: 'New Event' }} 
      />
      <Stack.Screen 
        name="CreateMemory" 
        component={CreateMemoryScreen} 
        options={{ headerShown: true }} 
      />
      <Stack.Screen 
        name="PostPublished" 
        component={PostPublishedScreen} 
        options={{ gestureEnabled: false }} 
      />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator({ onLogout }) {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Feed" 
        component={FeedScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      
      <Tab.Screen 
        name="Create" 
        component={CreateStackNavigator}
        options={{
          tabBarLabel: 'Create',
        }}
      />
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0, // Connect to bottom
    left: 0, // Connect to left side
    right: 0, // Connect to right side
    height: 85, // Reduced from 110px to more reasonable size
    // Only curve the top corners
    borderTopLeftRadius: 20, // Slightly smaller radius
    borderTopRightRadius: 20, // Slightly smaller radius
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'visible', // Changed from 'hidden' to allow content to breathe
    // Enhanced shadow only on top and sides
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4, // Shadow above the tab bar
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  
  tabBarBlur: {
    flex: 1,
    // Only curved upper corners
    borderTopLeftRadius: 20, // Matching container radius
    borderTopRightRadius: 20, // Matching container radius
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden', // Keep clipping on the blur view itself
    // Subtle top border for glass effect
    borderTopWidth: 1,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.25)' 
      : 'rgba(255, 255, 255, 0.2)',
  },
  
  // Android fallback styling
  androidGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(30px)',
  },
  
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 15, // Reduced padding
    paddingBottom: Platform.OS === 'ios' ? 25 : 15, // Reduced bottom padding
  },
  
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8, // Much less vertical padding
    minHeight: 50, // Smaller minimum height
  },
  
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8, // Less vertical padding
    minWidth: 50,
    minHeight: 50, // Smaller minimum height
    // Clean, minimal design - no background or borders
    backgroundColor: 'transparent',
    // Smooth micro-interaction
    transform: [{ scale: 1 }],
  },
  
  activeTabButton: {
    // Subtle scale for active feedback only
    transform: [{ scale: 1.08 }],
  },
});