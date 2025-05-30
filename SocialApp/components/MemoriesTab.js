// components/MemoriesTab.js - Past Events, Photos, and Statistics
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Image, Alert, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const MEMORY_TYPES = [
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'photos', label: 'Photos', icon: 'camera-outline' },
  { key: 'hosted', label: 'Hosted', icon: 'star-outline' },
  { key: 'attended', label: 'Attended', icon: 'checkmark-circle-outline' },
  { key: 'stats', label: 'Statistics', icon: 'analytics-outline' }
];

export default function MemoriesTab({ navigation, userId, isSelf }) {
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('recent');
  const [showStatsModal, setShowStatsModal] = useState(false);

  useEffect(() => {
    if (isSelf) {
      fetchMemories();
    }
  }, [activeFilter, isSelf]);

  const fetchMemories = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      let endpoint = '';
      const params = { limit: 20 };

      switch (activeFilter) {
        case 'photos':
          endpoint = '/api/users/event-memories';
          break;
        case 'hosted':
          endpoint = '/api/users/past-events';
          params.includeHosted = 'true';
          params.includeAttended = 'false';
          break;
        case 'attended':
          endpoint = '/api/users/past-events';
          params.includeHosted = 'false';
          params.includeAttended = 'true';
          break;
        case 'stats':
          endpoint = '/api/users/event-stats/year';
          break;
        default: // recent
          endpoint = '/api/users/past-events';
          params.includeHosted = 'true';
          params.includeAttended = 'true';
      }

      const { data } = await api.get(endpoint, { params });
      
      if (activeFilter === 'photos') {
        setMemories(data.memories || []);
      } else if (activeFilter === 'stats') {
        setStats(data);
        setMemories([]);
      } else {
        setMemories(data.events || []);
        setStats(data.stats || {});
      }

    } catch (error) {
      console.error('Error fetching memories:', error);
      Alert.alert('Error', 'Failed to load memories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderFilterTabs = () => (
    <View style={styles.filterTabs}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabsContent}
      >
        {MEMORY_TYPES.map(type => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.filterTab,
              activeFilter === type.key && styles.activeFilterTab
            ]}
            onPress={() => setActiveFilter(type.key)}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={type.icon} 
              size={16} 
              color={activeFilter === type.key ? '#FFFFFF' : '#8E8E93'} 
            />
            <Text style={[
              styles.filterTabText,
              activeFilter === type.key && styles.activeFilterTabText
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderStatsOverview = () => {
    if (activeFilter === 'stats' || Object.keys(stats).length === 0) return null;

    return (
      <TouchableOpacity 
        style={styles.statsOverview}
        onPress={() => setShowStatsModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalEvents || 0}</Text>
            <Text style={styles.statLabel}>Total Events</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.hostedEvents || 0}</Text>
            <Text style={styles.statLabel}>Hosted</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.attendedEvents || 0}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
        </View>
        <View style={styles.statsFooter}>
          <Text style={styles.statsFooterText}>Tap to view detailed statistics</Text>
          <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventMemory = ({ item }) => {
    const eventDate = new Date(item.time);
    const isHost = Boolean(item.isHost);
    const coverImage = item.coverImage 
      ? `http://${API_BASE_URL}:3000${item.coverImage}` 
      : null;

    // Calculate how long ago
    const daysPast = Math.floor((Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
    let timeAgoText = '';
    if (daysPast < 1) timeAgoText = 'Today';
    else if (daysPast === 1) timeAgoText = 'Yesterday';
    else if (daysPast < 7) timeAgoText = `${daysPast} days ago`;
    else if (daysPast < 30) timeAgoText = `${Math.floor(daysPast / 7)} weeks ago`;
    else if (daysPast < 365) timeAgoText = `${Math.floor(daysPast / 30)} months ago`;
    else timeAgoText = `${Math.floor(daysPast / 365)} years ago`;

    return (
      <TouchableOpacity
        style={styles.memoryCard}
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
        activeOpacity={0.95}
      >
        <View style={styles.memoryImageContainer}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.memoryImage} />
          ) : (
            <View style={styles.memoryImagePlaceholder}>
              <Ionicons name="calendar-outline" size={32} color="#C7C7CC" />
            </View>
          )}
          
          {/* Role Badge */}
          <View style={[
            styles.memoryRoleBadge,
            isHost ? styles.hostBadge : styles.attendedBadge
          ]}>
            <Ionicons 
              name={isHost ? "star" : "checkmark"} 
              size={12} 
              color="#FFFFFF" 
            />
          </View>

          {/* Photos Indicator */}
          {item.photoCount > 0 && (
            <TouchableOpacity
              style={styles.photosIndicator}
              onPress={() => navigation.navigate('EventPhotosScreen', { eventId: item._id })}
            >
              <Ionicons name="camera" size={12} color="#FFFFFF" />
              <Text style={styles.photosCount}>{item.photoCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.memoryContent}>
          <Text style={styles.memoryTitle} numberOfLines={2}>
            {item.title}
          </Text>
          
          <View style={styles.memoryMeta}>
            <Text style={styles.memoryDate}>
              {eventDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
              })}
            </Text>
            <Text style={styles.memoryTimeAgo}>• {timeAgoText}</Text>
          </View>

          <Text style={styles.memoryRole}>
            {isHost ? '🌟 You hosted this event' : '✅ You attended this event'}
          </Text>

          {/* Memory Actions */}
          <View style={styles.memoryActions}>
            {item.photoCount > 0 && (
              <TouchableOpacity
                style={styles.memoryAction}
                onPress={() => navigation.navigate('EventPhotosScreen', { eventId: item._id })}
                activeOpacity={0.8}
              >
                <Ionicons name="images-outline" size={14} color="#3797EF" />
                <Text style={styles.memoryActionText}>Photos</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.memoryAction}
              onPress={() => handleShareMemory(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={14} color="#3797EF" />
              <Text style={styles.memoryActionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPhotoMemory = ({ item }) => (
    <TouchableOpacity
      style={styles.photoMemoryCard}
      onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item.event._id })}
      activeOpacity={0.95}
    >
      <View style={styles.photoMemoryHeader}>
        <Text style={styles.photoMemoryEventTitle} numberOfLines={1}>
          {item.event.title}
        </Text>
        <Text style={styles.photoMemoryDate}>
          {new Date(item.event.time).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })}
        </Text>
      </View>
      
      <View style={styles.photoMemoryGrid}>
        {item.photos.slice(0, 4).map((photo, index) => (
          <TouchableOpacity
            key={photo._id}
            style={[
              styles.photoMemoryThumbnail,
              index === 3 && item.photos.length > 4 && styles.photoMemoryMoreContainer
            ]}
            onPress={() => navigation.navigate('PostDetailsScreen', { postId: photo._id })}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: `http://${API_BASE_URL}:3000${photo.paths[0]}` }}
              style={styles.photoMemoryImage}
            />
            {index === 3 && item.photos.length > 4 && (
              <View style={styles.photoMemoryMore}>
                <Text style={styles.photoMemoryMoreText}>+{item.photos.length - 3}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      <Text style={styles.photoMemoryCount}>
        {item.photoCount} {item.photoCount === 1 ? 'photo' : 'photos'}
      </Text>
    </TouchableOpacity>
  );

  const renderDetailedStats = () => (
    <Modal
      visible={showStatsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowStatsModal(false)}
    >
      <View style={styles.statsModalContainer}>
        <View style={styles.statsModalHeader}>
          <Text style={styles.statsModalTitle}>Your Event Statistics</Text>
          <TouchableOpacity
            onPress={() => setShowStatsModal(false)}
            style={styles.statsModalClose}
          >
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.statsModalContent}>
          {/* Main Stats */}
          <View style={styles.statsSection}>
            <Text style={styles.statsSectionTitle}>Overview</Text>
            <View style={styles.statsMainGrid}>
              <View style={styles.statsMainItem}>
                <Text style={styles.statsMainNumber}>{stats.totalEvents || 0}</Text>
                <Text style={styles.statsMainLabel}>Total Events</Text>
              </View>
              <View style={styles.statsMainItem}>
                <Text style={styles.statsMainNumber}>{stats.hostedEvents || 0}</Text>
                <Text style={styles.statsMainLabel}>Hosted</Text>
              </View>
              <View style={styles.statsMainItem}>
                <Text style={styles.statsMainNumber}>{stats.attendedEvents || 0}</Text>
                <Text style={styles.statsMainLabel}>Attended</Text>
              </View>
              <View style={styles.statsMainItem}>
                <Text style={styles.statsMainNumber}>{Math.round(stats.totalHours || 0)}</Text>
                <Text style={styles.statsMainLabel}>Hours</Text>
              </View>
            </View>
          </View>

          {/* Additional Stats */}
          {stats.favoriteCategory && (
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Insights</Text>
              <View style={styles.statsInsight}>
                <Ionicons name="star" size={24} color="#FFD700" />
                <View style={styles.statsInsightContent}>
                  <Text style={styles.statsInsightTitle}>Favorite Category</Text>
                  <Text style={styles.statsInsightValue}>{stats.favoriteCategory}</Text>
                </View>
              </View>
              
              {stats.uniqueLocations > 0 && (
                <View style={styles.statsInsight}>
                  <Ionicons name="location" size={24} color="#3797EF" />
                  <View style={styles.statsInsightContent}>
                    <Text style={styles.statsInsightTitle}>Unique Locations</Text>
                    <Text style={styles.statsInsightValue}>{stats.uniqueLocations}</Text>
                  </View>
                </View>
              )}

              {stats.socialScore && (
                <View style={styles.statsInsight}>
                  <Ionicons name="people" size={24} color="#34C759" />
                  <View style={styles.statsInsightContent}>
                    <Text style={styles.statsInsightTitle}>Social Score</Text>
                    <Text style={styles.statsInsightValue}>{stats.socialScore}/100</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  const handleShareMemory = (event) => {
    const eventDate = new Date(event.time);
    const shareText = `Great memory from ${event.title} on ${eventDate.toLocaleDateString()}! 📸✨`;
    
    navigation.navigate('SelectChatScreen', {
      shareType: 'memory',
      shareId: event._id,
      shareText: shareText
    });
  };

  const renderContent = () => {
    if (activeFilter === 'stats') {
      return (
        <ScrollView style={styles.statsContainer}>
          <View style={styles.statsMainView}>
            <Text style={styles.statsTitle}>Your Event Journey</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.totalEvents || 0}</Text>
                <Text style={styles.statLabel}>Total Events</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.hostedEvents || 0}</Text>
                <Text style={styles.statLabel}>Hosted</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.attendedEvents || 0}</Text>
                <Text style={styles.statLabel}>Attended</Text>
              </View>
            </View>

            {stats.totalHours > 0 && (
              <View style={styles.additionalStats}>
                <View style={styles.additionalStatItem}>
                  <Ionicons name="time-outline" size={20} color="#3797EF" />
                  <Text style={styles.additionalStatText}>
                    {Math.round(stats.totalHours)} hours of events
                  </Text>
                </View>
                
                {stats.uniqueLocations > 0 && (
                  <View style={styles.additionalStatItem}>
                    <Ionicons name="location-outline" size={20} color="#3797EF" />
                    <Text style={styles.additionalStatText}>
                      {stats.uniqueLocations} unique locations
                    </Text>
                  </View>
                )}
                
                {stats.favoriteCategory && (
                  <View style={styles.additionalStatItem}>
                    <Ionicons name="star" size={20} color="#FFD700" />
                    <Text style={styles.additionalStatText}>
                      Most attended: {stats.favoriteCategory}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      );
    }

    if (activeFilter === 'photos') {
      return (
        <FlatList
          data={memories}
          keyExtractor={item => item.event._id}
          renderItem={renderPhotoMemory}
          contentContainerStyle={styles.memoriesContainer}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    return (
      <FlatList
        data={memories}
        keyExtractor={item => item._id}
        renderItem={renderEventMemory}
        contentContainerStyle={styles.memoriesContainer}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderEmptyState = () => {
    const emptyMessages = {
      recent: {
        title: 'No recent memories',
        subtitle: 'Your past events will appear here as memories'
      },
      photos: {
        title: 'No photo memories',
        subtitle: 'Events with your photos will appear here'
      },
      hosted: {
        title: 'No hosted events',
        subtitle: 'Events you\'ve hosted will appear here'
      },
      attended: {
        title: 'No attended events',
        subtitle: 'Events you\'ve attended will appear here'
      },
      stats: {
        title: 'No statistics yet',
        subtitle: 'Participate in events to see your statistics'
      }
    };

    const message = emptyMessages[activeFilter] || emptyMessages.recent;

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons 
            name={MEMORY_TYPES.find(t => t.key === activeFilter)?.icon || 'time-outline'} 
            size={64} 
            color="#C7C7CC" 
          />
          <View style={styles.emptyIconOverlay}>
            <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.emptyTitle}>{message.title}</Text>
        <Text style={styles.emptySubtitle}>{message.subtitle}</Text>
        
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => navigation.navigate('EventListScreen')}
          activeOpacity={0.8}
        >
          <Ionicons name="compass-outline" size={20} color="#FFFFFF" />
          <Text style={styles.exploreButtonText}>Discover Events</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!isSelf) {
    return null; // Memories tab only for current user
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading memories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilterTabs()}
      {renderStatsOverview()}
      
      {memories.length === 0 && activeFilter !== 'stats' ? (
        renderEmptyState()
      ) : (
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchMemories(true)}
          tintColor="#3797EF"
          colors={["#3797EF"]}
        >
          {renderContent()}
        </RefreshControl>
      )}

      {renderDetailedStats()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Filter Tabs
  filterTabs: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  filterTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  activeFilterTab: {
    backgroundColor: '#3797EF',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },

  // Stats Overview
  statsOverview: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3797EF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  statsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statsFooterText: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },

  // Memories Container
  memoriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  // Memory Cards
  memoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  memoryImageContainer: {
    position: 'relative',
    height: 120,
  },
  memoryImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  memoryImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryRoleBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hostBadge: {
    backgroundColor: '#FF9500',
  },
  attendedBadge: {
    backgroundColor: '#34C759',
  },
  photosIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photosCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  memoryContent: {
    padding: 16,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    lineHeight: 20,
  },
  memoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memoryDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  memoryTimeAgo: {
    fontSize: 12,
    color: '#C7C7CC',
    marginLeft: 6,
  },
  memoryRole: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginBottom: 12,
  },
  memoryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  memoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memoryActionText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 6,
  },

  // Photo Memory Cards
  photoMemoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  photoMemoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoMemoryEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  photoMemoryDate: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  photoMemoryGrid: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  photoMemoryThumbnail: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoMemoryImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  photoMemoryMoreContainer: {
    position: 'relative',
  },
  photoMemoryMore: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoMemoryMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  photoMemoryCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Stats View
  statsContainer: {
    flex: 1,
  },
  statsMainView: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  additionalStats: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  additionalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalStatText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 12,
    fontWeight: '500',
  },

  // Stats Modal
  statsModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  statsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  statsModalClose: {
    padding: 8,
  },
  statsModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statsSection: {
    marginBottom: 32,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  statsMainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statsMainItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statsMainNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3797EF',
    marginBottom: 4,
  },
  statsMainLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  statsInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statsInsightContent: {
    marginLeft: 16,
  },
  statsInsightTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 2,
  },
  statsInsightValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIconOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});