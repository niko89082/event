// screens/EventsHubScreen.js - Events Hub screen with header for bottom tab navigation
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContext } from 'react';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';
import EventsHub from '../components/EventsHub';

export default function EventsHubScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(AuthContext);

  const handleProfilePress = () => {
    try {
      navigation.navigate('Profile', { screen: 'MyProfile' });
    } catch (error) {
      navigation.getParent()?.navigate('Profile', { screen: 'MyProfile' });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <SafeAreaView style={styles.safeAreaHeader}>
        <View style={styles.header}>
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
                <Ionicons name="person" size={16} color="#8E8E93" />
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              <Text style={styles.headerTitlePrimary}>Social</Text>
              <Text style={styles.headerTitleSecondary}>Events</Text>
            </Text>
          </View>
          
          <View style={styles.placeholderButton} />
        </View>
      </SafeAreaView>
      
      {/* Events Hub Content */}
      <View style={styles.contentContainer}>
        <EventsHub 
          navigation={navigation}
          refreshing={false}
          onRefresh={() => {}}
          onScroll={() => {}}
          scrollEventThrottle={16}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeAreaHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 56,
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  profilePicture: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profilePicturePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerTitlePrimary: {
    color: '#000000',
  },
  headerTitleSecondary: {
    color: '#000000',
  },
  placeholderButton: {
    width: 40,
    height: 40,
  },
  contentContainer: {
    flex: 1,
  },
});

