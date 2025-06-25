
// screens/AttendeeListScreen.js - Fixed layout and organization
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

export default function AttendeeListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { eventId } = route.params;

  // State
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [checkedInCount, setCheckedInCount] = useState(0);

  useEffect(() => {
    fetchAttendees();
  }, [eventId]);

  const fetchAttendees = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Use the correct endpoint that we fixed in the backend
      const response = await api.get(`/api/events/${eventId}/attendees`);
      const data = response.data;

      setAttendees(data.attendees || []);
      setCheckedInCount(data.checkedInCount || 0);
      setIsHost(data.canManage || false);

    } catch (error) {
      console.error('Error fetching attendees:', error);
      
      // Handle specific 404 error
      if (error.response?.status === 404) {
        Alert.alert('Error', 'Event not found or you do not have permission to view attendees');
      } else {
        Alert.alert('Error', 'Failed to load attendees');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemoveAttendee = async (userId) => {
    Alert.alert(
      'Remove Attendee',
      'Are you sure you want to remove this person from the event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/events/${eventId}/remove-attendee/${userId}`);
              // Refresh the list
              fetchAttendees(true);
              Alert.alert('Success', 'Attendee removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove attendee');
            }
          }
        }
      ]
    );
  };

  const handleManualCheckIn = async (userId) => {
    try {
      await api.post(`/api/events/${eventId}/checkin`, {
        userId,
        manualCheckIn: true
      });
      
      // Refresh to show updated status
      fetchAttendees(true);
      Alert.alert('Success', 'User checked in manually');
    } catch (error) {
      console.error('Manual check-in error:', error);
      Alert.alert('Error', 'Failed to check in user');
    }
  };

  const renderAttendeeItem = ({ item }) => {
    const isCheckedIn = item.isCheckedIn;
    
    return (
      <View style={styles.attendeeItem}>
        <TouchableOpacity
          style={styles.attendeeInfo}
          onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
          activeOpacity={0.8}
        >
          <Image
            source={{
              uri: item.profilePicture
                ? `http://${API_BASE_URL}:3000${item.profilePicture}`
                : 'https://placehold.co/48x48.png?text=👤'
            }}
            style={styles.profileImage}
          />
          
          <View style={styles.attendeeDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.attendeeName}>{item.username}</Text>
              {isCheckedIn && (
                <View style={styles.checkMarkContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                </View>
              )}
            </View>
            {item.bio && (
              <Text style={styles.attendeeBio} numberOfLines={1}>
                {item.bio}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Host actions */}
        {isHost && (
          <View style={styles.hostActions}>
            {!isCheckedIn && (
              <TouchableOpacity
                style={styles.checkInButton}
                onPress={() => handleManualCheckIn(item._id)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#34C759" />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveAttendee(item._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{attendees.length}</Text>
          <Text style={styles.statLabel}>Attending</Text>
        </View>
        {checkedInCount > 0 && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.checkedInNumber]}>{checkedInCount}</Text>
              <Text style={styles.statLabel}>Checked In</Text>
            </View>
          </>
        )}
      </View>
      
      {isHost && (
        <View style={styles.hostNote}>
          <Ionicons name="information-circle-outline" size={16} color="#3797EF" />
          <Text style={styles.hostNoteText}>
            Tap the checkmark to manually check in attendees
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No attendees yet</Text>
      <Text style={styles.emptySubtitle}>
        People who join this event will appear here
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading attendees...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={attendees}
        keyExtractor={item => item._id}
        renderItem={renderAttendeeItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAttendees(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={attendees.length === 0 ? styles.emptyList : styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  list: {
    paddingBottom: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
  
  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  checkedInNumber: {
    color: '#34C759',
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E1E1E1',
    marginHorizontal: 24,
  },
  hostNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  hostNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  
  // Attendee Items
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  attendeeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 12, // Square with curved edges
    marginRight: 12,
  },
  attendeeDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  checkMarkContainer: {
    marginLeft: 8,
  },
  attendeeBio: {
    fontSize: 14,
    color: '#8E8E93',
  },
  
  // Host Actions
  hostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  checkInButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});