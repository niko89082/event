// SocialApp/screens/NotificationExamplesScreen.js - Template notification screen with example data
import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, SafeAreaView, StatusBar, SectionList,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import SwipeableNotificationItem from '../components/SwipeableNotificationItem';

export default function NotificationExamplesScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Template notifications matching the new design
  const templateNotifications = [
    // Follow Requests (new_follower type)
    {
      _id: 'template_follow_1',
      type: 'new_follower',
      category: 'social',
      title: 'New Follower',
      message: 'Alex Thompson started following you',
      sender: {
        _id: 'user1',
        username: 'alex_t',
        displayName: 'Alex Thompson',
        profilePicture: null,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      // User already follows this person
      _isFollowing: false, // Show "Follow" button
    },
    {
      _id: 'template_follow_2',
      type: 'new_follower',
      category: 'social',
      title: 'New Follower',
      message: 'Jordan Rivers started following you',
      sender: {
        _id: 'user2',
        username: 'jor_dan',
        displayName: 'Jordan Rivers',
        profilePicture: null,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      // User already follows this person
      _isFollowing: true, // Show "Following" button
    },
    {
      _id: 'template_follow_3',
      type: 'new_follower',
      category: 'social',
      title: 'New Follower',
      message: 'Sarah Miller started following you',
      sender: {
        _id: 'user3',
        username: 'sarah_m',
        displayName: 'Sarah Miller',
        profilePicture: null,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5h ago
      _isFollowing: false, // Show "Follow" button
    },
    {
      _id: 'template_follow_4',
      type: 'new_follower',
      category: 'social',
      title: 'New Follower',
      message: 'Marcus Chen started following you',
      sender: {
        _id: 'user4',
        username: 'marcus_c',
        displayName: 'Marcus Chen',
        profilePicture: null,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      _isFollowing: true, // Show "Following" button
    },
    
    // Today notifications
    {
      _id: 'template_event_invite',
      type: 'event_invitation_batch',
      category: 'events',
      title: 'Event Invitation',
      message: 'Summer Rooftop Party',
      sender: {
        _id: 'user5',
        username: 'eventhost',
        displayName: 'Event Host',
        profilePicture: null,
      },
      data: {
        eventId: 'event1',
        eventTitle: 'Summer Rooftop Party',
        eventTime: 'Sat, 8 PM',
        eventCover: null,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      actionType: 'VIEW_EVENT',
    },
    {
      _id: 'template_like',
      type: 'post_liked',
      category: 'social',
      title: 'Photo Liked',
      message: 'Sarah liked your review of "Inception"',
      sender: {
        _id: 'user3',
        username: 'sarah_m',
        displayName: 'Sarah Miller',
        profilePicture: null,
      },
      data: {
        postId: 'post1',
      },
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      actionType: 'VIEW_POST',
    },
    {
      _id: 'template_rating',
      type: 'post_liked',
      category: 'social',
      title: 'Rating',
      message: 'Marcus rated Blinding Lights 5 stars',
      sender: {
        _id: 'user4',
        username: 'marcus_c',
        displayName: 'Marcus Chen',
        profilePicture: null,
      },
      data: {
        postId: 'post2',
      },
      isRead: false,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4h ago
      actionType: 'VIEW_POST',
    },
    
    // Yesterday notifications
    {
      _id: 'template_comment',
      type: 'post_commented',
      category: 'social',
      title: 'New Comment',
      message: 'Elena commented on your rooftop post: "Can\'t wait for this!"',
      sender: {
        _id: 'user6',
        username: 'elena_g',
        displayName: 'Elena Gray',
        profilePicture: null,
      },
      data: {
        postId: 'post3',
      },
      isRead: true,
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000), // Yesterday, 2:15 PM
      actionType: 'VIEW_POST',
    },
    {
      _id: 'template_planning',
      type: 'event_invitation',
      category: 'events',
      title: 'Planning',
      message: 'Movie Night: Interstellar',
      sender: {
        _id: 'user7',
        username: 'movienight',
        displayName: 'Movie Night',
        profilePicture: null,
      },
      data: {
        eventId: 'event2',
        eventTitle: 'Movie Night: Interstellar',
        eventTime: 'Next Friday',
        eventCover: null,
      },
      isRead: true,
      createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000), // Yesterday
      actionType: 'VIEW_EVENT',
    },
  ];

  // Organize notifications like the real screen
  const organizedData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Separate follow requests
    const followRequests = templateNotifications.filter(n => n.type === 'new_follower');
    const otherNotifications = templateNotifications.filter(n => n.type !== 'new_follower');

    // Filter follow requests by search
    const filteredFollowRequests = searchQuery
      ? followRequests.filter(n => {
          const sender = n.sender;
          const searchLower = searchQuery.toLowerCase();
          return (
            sender?.username?.toLowerCase().includes(searchLower) ||
            sender?.displayName?.toLowerCase().includes(searchLower) ||
            n.message?.toLowerCase().includes(searchLower)
          );
        })
      : followRequests;

    // Group other notifications by date
    const todayNotifs = [];
    const yesterdayNotifs = [];
    const olderNotifs = [];

    otherNotifications.forEach(notif => {
      const notifDate = new Date(notif.createdAt);
      if (notifDate >= today) {
        todayNotifs.push(notif);
      } else if (notifDate >= yesterday && notifDate < today) {
        yesterdayNotifs.push(notif);
      } else {
        olderNotifs.push(notif);
      }
    });

    const sections = [];

    // Follow Requests section
    if (filteredFollowRequests.length > 0) {
      sections.push({
        type: 'follow_requests',
        title: 'Follow Requests',
        count: followRequests.length,
        data: filteredFollowRequests,
      });
    }

    // Today section
    if (todayNotifs.length > 0) {
      sections.push({
        type: 'date_section',
        title: 'Today',
        data: todayNotifs,
      });
    }

    // Yesterday section
    if (yesterdayNotifs.length > 0) {
      sections.push({
        type: 'date_section',
        title: 'Yesterday',
        data: yesterdayNotifs,
      });
    }

    // Older section
    if (olderNotifs.length > 0) {
      sections.push({
        type: 'date_section',
        title: 'Earlier',
        data: olderNotifs,
      });
    }

    return sections;
  }, [searchQuery]);

  const getNotificationIcon = (notification) => {
    const iconMap = {
      'new_follower': 'people',
      'memory_invitation': 'images',
      'memory_photo_added': 'camera',
      'memory_photo_batch': 'photos',
      'event_invitation': 'calendar',
      'event_invitation_batch': 'calendar',
      'event_reminder': 'time',
      'event_reminder_1_hour': 'alarm',
      'event_rsvp_batch': 'people',
      'post_liked': 'heart',
      'post_commented': 'chatbubble',
      'memory_photo_liked': 'heart',
    };
    return iconMap[notification.type] || 'notifications';
  };

  const getNotificationColor = (notification) => {
    if (notification.priority === 'high') return '#FF3B30';
    if (notification.category === 'events') return '#3797EF';
    if (notification.type === 'post_liked' || notification.type === 'memory_photo_liked') return '#FF3B30';
    if (notification.type === 'post_commented') return '#34C759';
    return '#3797EF';
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    const diffInDays = Math.floor(diffInSeconds / 86400);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderFollowRequestItem = (notification) => {
    const sender = notification.sender;
    const profilePicUrl = sender?.profilePicture 
      ? (sender.profilePicture.startsWith('http') 
          ? sender.profilePicture 
          : `http://${API_BASE_URL}:3000${sender.profilePicture.startsWith('/') ? '' : '/'}${sender.profilePicture}`)
      : null;

    // For template, show public account behavior (Follow button)
    const isPublic = true; // All accounts are public in template
    // Use _isFollowing from notification data to show different states
    const isFollowing = notification._isFollowing || false;

    return (
      <View style={styles.followRequestItem}>
        <TouchableOpacity activeOpacity={0.7}>
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={styles.followRequestAvatar} />
          ) : (
            <View style={styles.followRequestAvatarPlaceholder}>
              <Text style={styles.followRequestAvatarText}>
                {sender?.username?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.followRequestInfo}>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.followRequestName} numberOfLines={1}>
              {sender?.displayName || sender?.username || 'Unknown User'}
            </Text>
            <Text style={styles.followRequestUsername}>
              @{sender?.username || 'unknown'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.followRequestActions}>
          {isPublic ? (
            // Public account: Show Follow button
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followingButton
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.followButtonText,
                isFollowing && styles.followingButtonText
              ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          ) : (
            // Private account: Show Confirm/Delete buttons
            <>
              <TouchableOpacity
                style={styles.confirmButton}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderNotificationItem = ({ item }) => {
    const iconName = getNotificationIcon(item);
    const iconColor = getNotificationColor(item);
    const sender = item.sender;
    const profilePicUrl = sender?.profilePicture 
      ? (sender.profilePicture.startsWith('http') 
          ? sender.profilePicture 
          : `http://${API_BASE_URL}:3000${sender.profilePicture.startsWith('/') ? '' : '/'}${sender.profilePicture}`)
      : null;

    // Get icon overlay based on notification type
    let iconOverlay = null;
    if (item.type === 'post_liked' || item.type === 'memory_photo_liked') {
      iconOverlay = { name: 'heart', color: '#FF3B30' };
    } else if (item.type === 'post_commented') {
      iconOverlay = { name: 'chatbubble', color: '#34C759' };
    } else if (item.type === 'event_invitation' || item.type === 'event_invitation_batch') {
      iconOverlay = { name: 'calendar', color: '#3797EF' };
    }

    return (
      <SwipeableNotificationItem
        item={item}
        onDelete={() => {}}
        disabled={true}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem, 
            !item.isRead && styles.unreadNotification
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.notificationRow}>
            <View style={styles.notificationIconContainer}>
              {profilePicUrl ? (
                <View style={styles.profilePictureWrapper}>
                  <Image source={{ uri: profilePicUrl }} style={styles.profilePicture} />
                  {iconOverlay && (
                    <View style={[styles.iconOverlay, { backgroundColor: iconOverlay.color }]}>
                      <Ionicons name={iconOverlay.name} size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.defaultIcon, { backgroundColor: iconColor + '20' }]}>
                  <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
              )}
              {!item.isRead && (
                <View style={styles.unreadDot} />
              )}
            </View>

            <View style={styles.notificationContent}>
              <Text style={styles.notificationMessage} numberOfLines={3}>
                {item.message}
              </Text>
              <Text style={styles.notificationTime}>
                {getTimeAgo(item.createdAt)}
              </Text>
            </View>

            {/* Optional image for event notifications */}
            {item.data?.eventId && item.data?.eventCover && (
              <Image 
                source={{ uri: item.data.eventCover }}
                style={styles.notificationImage}
              />
            )}
          </View>
        </TouchableOpacity>
      </SwipeableNotificationItem>
    );
  };

  const renderSectionHeader = ({ section }) => {
    if (section.type === 'follow_requests') {
      return (
        <View style={styles.followRequestsSection}>
          <View style={styles.followRequestsHeader}>
            <Text style={styles.followRequestsTitle}>Follow Requests</Text>
            {section.count > 0 && (
              <View style={styles.followRequestsBadge}>
                <Text style={styles.followRequestsBadgeText}>
                  {section.count > 9 ? '9+' : section.count}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search requests"
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {section.count > 2 && (
            <TouchableOpacity style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>
                See all {section.count} requests
              </Text>
              <Ionicons name="chevron-down" size={16} color="#3797EF" />
            </TouchableOpacity>
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.dateSectionHeader}>
          <Text style={styles.dateSectionTitle}>{section.title}</Text>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Template Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#3797EF" />
        <Text style={styles.infoText}>
          Template view: Shows "Follow" and "Following" button states for public accounts
        </Text>
      </View>
      
      <SectionList
        sections={organizedData}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={({ item, section }) => {
          if (section.type === 'follow_requests') {
            return renderFollowRequestItem(item);
          }
          return renderNotificationItem({ item });
        }}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 20,
  },
  
  // Follow Requests Section
  followRequestsSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },
  followRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  followRequestsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  followRequestsBadge: {
    backgroundColor: '#3797EF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followRequestsBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    paddingVertical: 0,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  seeAllText: {
    color: '#3797EF',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  
  // Follow Request Item
  followRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  followRequestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  followRequestAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1E1E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  followRequestAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
  },
  followRequestInfo: {
    flex: 1,
    marginRight: 12,
  },
  followRequestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  followRequestUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Date Section Header
  dateSectionHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  dateSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  
  // Notification Item
  notificationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  unreadNotification: {
    backgroundColor: '#F8F9FA',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    marginRight: 12,
    position: 'relative',
  },
  profilePictureWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: 'relative',
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  defaultIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3797EF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationMessage: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
  },
  notificationImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
});
