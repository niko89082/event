// components/CheckInDashboard.js - Real-time check-in monitoring dashboard
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Animated, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CheckInDashboard({ eventId, eventTitle, onClose }) {
  const [stats, setStats] = useState(null);
  const [recentCheckIns, setRecentCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide in animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Initial data fetch
    fetchData();

    // Set up polling for real-time updates
    const interval = setInterval(fetchData, 3000); // Every 3 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Pulse animation when stats change
    if (stats) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [stats?.checkedInCount]);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      const response = await api.get(`/api/events/${eventId}/checkin-stats`);
      
      if (response.data.success) {
        setStats(response.data.stats);
        setRecentCheckIns(response.data.recentCheckIns || []);
      }
    } catch (error) {
      console.error('❌ Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const getCheckInRateColor = (rate) => {
    if (rate >= 80) return '#34C759';
    if (rate >= 60) return '#FF9500';
    return '#FF6B6B';
  };

  const getEventStatusColor = (status) => {
    switch (status) {
      case 'active': return '#34C759';
      case 'upcoming': return '#007AFF';
      case 'ended': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const renderStatCard = (title, value, subtitle, color = '#667eea', icon) => (
    <Animated.View style={[styles.statCard, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </Animated.View>
  );

  const renderRecentCheckIn = ({ item, index }) => (
    <Animated.View 
      style={[
        styles.checkInItem,
        {
          opacity: 1 - (index * 0.1), // Fade older items
          transform: [{ scale: 1 - (index * 0.02) }] // Slightly shrink older items
        }
      ]}
    >
      <View style={styles.checkInInfo}>
        <Text style={styles.checkInName}>{item.username}</Text>
        <Text style={styles.checkInTime}>
          {item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString() : 'Just now'}
        </Text>
      </View>
      <View style={styles.checkInIndicator}>
        <Ionicons name="checkmark-circle" size={20} color="#34C759" />
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] }
      ]}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Live Dashboard</Text>
            <Text style={styles.headerSubtitle}>{eventTitle}</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {renderStatCard(
              'Checked In',
              stats?.checkedInCount || 0,
              `of ${stats?.totalAttendees || 0}`,
              '#34C759',
              'people'
            )}
            {renderStatCard(
              'Check-in Rate',
              `${stats?.checkInRate || 0}%`,
              null,
              getCheckInRateColor(stats?.checkInRate || 0),
              'stats-chart'
            )}
          </View>
          
          <View style={styles.statsRow}>
            {renderStatCard(
              'Event Status',
              stats?.eventStatus || 'Unknown',
              null,
              getEventStatusColor(stats?.eventStatus),
              'time'
            )}
            {renderStatCard(
              'Total Scans',
              stats?.totalScans || 0,
              'QR scans',
              '#FF9500',
              'qr-code'
            )}
          </View>
        </View>

        {/* Recent Check-ins */}
        <View style={styles.recentContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Check-ins</Text>
            <TouchableOpacity onPress={() => fetchData(true)}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {recentCheckIns.length > 0 ? (
            <FlatList
              data={recentCheckIns}
              renderItem={renderRecentCheckIn}
              keyExtractor={(item, index) => `${item.userId}-${index}`}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchData(true)}
                  tintColor="#FFFFFF"
                />
              }
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="hourglass-outline" size={40} color="rgba(255,255,255,0.6)" />
              <Text style={styles.emptyText}>No check-ins yet</Text>
              <Text style={styles.emptySubtext}>People will appear here as they check in</Text>
            </View>
          )}
        </View>

        {/* QR Status */}
        {stats?.massCheckInActive && (
          <View style={styles.qrStatus}>
            <View style={styles.qrStatusContent}>
              <Ionicons name="qr-code" size={20} color="#34C759" />
              <Text style={styles.qrStatusText}>Mass check-in active</Text>
            </View>
            {stats.qrExpiresAt && (
              <Text style={styles.qrExpiryText}>
                Expires {new Date(stats.qrExpiresAt).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
  },
  background: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.9)',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 15,
    backdropFilter: 'blur(10px)',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 8,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  // Recent Check-ins
  recentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  checkInItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  checkInInfo: {
    flex: 1,
  },
  checkInName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  checkInTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  checkInIndicator: {
    marginLeft: 10,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 20,
  },

  // QR Status
  qrStatus: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  qrStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
    marginLeft: 8,
  },
  qrExpiryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});