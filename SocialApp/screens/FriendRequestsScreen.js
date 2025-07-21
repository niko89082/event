// screens/FriendRequestsScreen.js - FIXED: Navigation and error handling
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, 
  TouchableOpacity, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';

export default function FriendRequestsScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const [requestCounts, setRequestCounts] = useState({
    received: 0,
    sent: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.33,
        borderBottomColor: '#E1E1E1',
        height: 88,
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: 'Friend Requests',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    fetchRequestCounts();
  }, []);

  const fetchRequestCounts = async () => {
    try {
      setLoading(true);
      
      // Use the correct unified endpoint
      const res = await api.get('/api/friends/requests?type=all');
      const allRequests = res.data.requests || [];
      
      const receivedCount = allRequests.filter(req => req.type === 'received').length;
      const sentCount = allRequests.filter(req => req.type === 'sent').length;

      setRequestCounts({
        received: receivedCount,
        sent: sentCount
      });

    } catch (error) {
      console.error('Error fetching request counts:', error);
      // Fallback: try individual endpoints if unified endpoint fails
      try {
        const [receivedRes, sentRes] = await Promise.all([
          api.get('/api/friends/requests?type=received'),
          api.get('/api/friends/requests?type=sent')
        ]);

        setRequestCounts({
          received: receivedRes.data.requests?.length || 0,
          sent: sentRes.data.requests?.length || 0
        });
      } catch (fallbackError) {
        console.error('Error with fallback request counts:', fallbackError);
        setRequestCounts({ received: 0, sent: 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  const navigateToRequests = (mode) => {
    navigation.navigate('FriendsListScreen', {
      userId: currentUser._id,
      mode: mode
    });
  };

  const navigateToFindFriends = () => {
    // Navigate to search or discover friends screen
    navigation.navigate('SearchScreen');
  };

  // FIXED: Handle friend suggestions properly
  const navigateToFriendSuggestions = async () => {
    try {
      // First check if suggestions are available
      const { data } = await api.get('/api/friends/suggestions?limit=1');
      
      if (data.suggestions && data.suggestions.length > 0) {
        // Since FriendSuggestionsScreen doesn't exist, navigate to SearchScreen with a flag
        // or create a simple suggestions view within SearchScreen
        navigation.navigate('SearchScreen', { showSuggestions: true });
      } else {
        Alert.alert('No Suggestions', 'No friend suggestions available at the moment.');
      }
    } catch (error) {
      console.error('Error checking suggestions:', error);
      // Fallback to search screen
      navigation.navigate('SearchScreen', { showSuggestions: true });
    }
  };

  // NEW: Add refresh functionality
  const handleRefresh = () => {
    fetchRequestCounts();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
      >
        
        {/* Pending Requests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          
          <TouchableOpacity
            style={styles.requestCard}
            onPress={() => navigateToRequests('requests')}
            activeOpacity={0.95}
          >
            <View style={styles.requestCardContent}>
              <View style={styles.requestCardLeft}>
                <View style={[styles.requestIcon, { backgroundColor: '#FF9500' }]}>
                  <Ionicons name="mail" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.requestCardInfo}>
                  <Text style={styles.requestCardTitle}>Friend Requests</Text>
                  <Text style={styles.requestCardSubtitle}>
                    {requestCounts.received === 0 
                      ? 'No pending requests'
                      : `${requestCounts.received} pending request${requestCounts.received !== 1 ? 's' : ''}`
                    }
                  </Text>
                </View>
              </View>
              
              <View style={styles.requestCardRight}>
                {requestCounts.received > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{requestCounts.received}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.requestCard}
            onPress={() => navigateToRequests('sent')}
            activeOpacity={0.95}
          >
            <View style={styles.requestCardContent}>
              <View style={styles.requestCardLeft}>
                <View style={[styles.requestIcon, { backgroundColor: '#8E8E93' }]}>
                  <Ionicons name="paper-plane" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.requestCardInfo}>
                  <Text style={styles.requestCardTitle}>Sent Requests</Text>
                  <Text style={styles.requestCardSubtitle}>
                    {requestCounts.sent === 0 
                      ? 'No sent requests'
                      : `${requestCounts.sent} pending request${requestCounts.sent !== 1 ? 's' : ''}`
                    }
                  </Text>
                </View>
              </View>
              
              <View style={styles.requestCardRight}>
                {requestCounts.sent > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#8E8E93' }]}>
                    <Text style={styles.badgeText}>{requestCounts.sent}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Discover Friends Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discover Friends</Text>
          
          <TouchableOpacity
            style={styles.discoverCard}
            onPress={navigateToFindFriends}
            activeOpacity={0.95}
          >
            <View style={styles.discoverCardContent}>
              <View style={styles.discoverCardLeft}>
                <View style={[styles.discoverIcon, { backgroundColor: '#3797EF' }]}>
                  <Ionicons name="search" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.discoverCardInfo}>
                  <Text style={styles.discoverCardTitle}>Find Friends</Text>
                  <Text style={styles.discoverCardSubtitle}>
                    Search for people you know
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.discoverCard}
            onPress={navigateToFriendSuggestions}
            activeOpacity={0.95}
          >
            <View style={styles.discoverCardContent}>
              <View style={styles.discoverCardLeft}>
                <View style={[styles.discoverIcon, { backgroundColor: '#34C759' }]}>
                  <Ionicons name="people" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.discoverCardInfo}>
                  <Text style={styles.discoverCardTitle}>Suggestions</Text>
                  <Text style={styles.discoverCardSubtitle}>
                    People you might know
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Your Friends Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Network</Text>
          
          <TouchableOpacity
            style={styles.discoverCard}
            onPress={() => navigation.navigate('FriendsListScreen', {
              userId: currentUser._id,
              mode: 'friends'
            })}
            activeOpacity={0.95}
          >
            <View style={styles.discoverCardContent}>
              <View style={styles.discoverCardLeft}>
                <View style={[styles.discoverIcon, { backgroundColor: '#007AFF' }]}>
                  <Ionicons name="people-circle" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.discoverCardInfo}>
                  <Text style={styles.discoverCardTitle}>My Friends</Text>
                  <Text style={styles.discoverCardSubtitle}>
                    View all your friends
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('QrScreen')}
              activeOpacity={0.8}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="qr-code" size={24} color="#3797EF" />
              </View>
              <Text style={styles.quickActionText}>My QR Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={navigateToFindFriends}
              activeOpacity={0.8}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="add-circle" size={24} color="#34C759" />
              </View>
              <Text style={styles.quickActionText}>Add Friends</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },

  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    marginHorizontal: 20,
  },

  // Request Cards
  requestCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  requestCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  requestCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestCardInfo: {
    flex: 1,
  },
  requestCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  requestCardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  requestCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Discover Cards
  discoverCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  discoverCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  discoverCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  discoverIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  discoverCardInfo: {
    flex: 1,
  },
  discoverCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  discoverCardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Quick Actions
  quickActions: {
    marginBottom: 32,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
});