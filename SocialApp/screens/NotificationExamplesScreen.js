// SocialApp/screens/NotificationExamplesScreen.js - Example screen showing all notification types
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, SafeAreaView, StatusBar, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import SwipeableNotificationItem from '../components/SwipeableNotificationItem';
import FriendRequestNotificationRedesigned from '../components/notifications/FriendRequestNotificationRedesigned';

export default function NotificationExamplesScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState('all');

  // Example notifications for each type
  const exampleNotifications = {
    friend_request: {
      _id: 'example_friend_request',
      type: 'friend_request',
      category: 'social',
      title: 'New Friend Request',
      message: 'Sarah Johnson wants to be friends',
      sender: {
        _id: 'user123',
        username: 'sarahjohnson',
        displayName: 'Sarah Johnson',
        profilePicture: null,
      },
      data: {
        actionTaken: null,
        mutualFriends: 3, // Show mutual friends count
        sharedEvents: 0,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      priority: 'normal',
    },

    friend_request_with_events: {
      _id: 'example_friend_request_2',
      type: 'friend_request',
      category: 'social',
      title: 'New Friend Request',
      message: 'Mike Chen wants to be friends',
      sender: {
        _id: 'user124',
        username: 'mikechen',
        displayName: 'Mike Chen',
        profilePicture: null,
      },
      data: {
        actionTaken: null,
        mutualFriends: 0,
        sharedEvents: 2, // Show shared events count
      },
      isRead: false,
      createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      priority: 'normal',
    },

    friend_request_accepted: {
      _id: 'example_friend_accepted',
      type: 'friend_request_accepted',
      category: 'social',
      title: 'Friend Request Accepted',
      message: 'Mike Chen accepted your friend request',
      sender: {
        _id: 'user456',
        username: 'mikechen',
        displayName: 'Mike Chen',
        profilePicture: null,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      priority: 'normal',
      actionType: 'VIEW_PROFILE',
      actionData: { userId: 'user456' },
    },

    memory_invitation: {
      _id: 'example_memory_invitation',
      type: 'memory_invitation',
      category: 'social',
      title: 'Memory Invitation',
      message: 'Emily Davis invited you to "Summer BBQ 2024" memory',
      sender: {
        _id: 'user101',
        username: 'emilydavis',
        displayName: 'Emily Davis',
        profilePicture: null,
      },
      data: {
        memoryId: 'memory123',
        memoryTitle: 'Summer BBQ 2024',
      },
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      priority: 'normal',
      actionType: 'VIEW_MEMORY',
      actionData: { memoryId: 'memory123' },
    },

    memory_photo_added: {
      _id: 'example_memory_photo',
      type: 'memory_photo_added',
      category: 'social',
      title: 'New Photo Added',
      message: 'Chris Lee added a photo to "Beach Trip"',
      sender: {
        _id: 'user202',
        username: 'chrislee',
        displayName: 'Chris Lee',
        profilePicture: null,
      },
      data: {
        memoryId: 'memory456',
        memoryTitle: 'Beach Trip',
        photoCount: 1,
      },
      isRead: false,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      priority: 'normal',
      actionType: 'VIEW_MEMORY',
      actionData: { memoryId: 'memory456' },
    },

    memory_photo_batch: {
      _id: 'example_memory_batch',
      type: 'memory_photo_batch',
      category: 'social',
      title: 'New Photos Added',
      message: 'Jessica Brown and 2 others added 15 photos to "Wedding Day"',
      sender: {
        _id: 'user303',
        username: 'jessicabrown',
        displayName: 'Jessica Brown',
        profilePicture: null,
      },
      data: {
        memoryId: 'memory789',
        memoryTitle: 'Wedding Day',
        photoCount: 15,
        contributors: ['Jessica Brown', 'Tom Wilson', 'Lisa Anderson'],
      },
      isRead: true,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      priority: 'normal',
      actionType: 'VIEW_MEMORY',
      actionData: { memoryId: 'memory789' },
    },

    event_invitation: {
      _id: 'example_event_invitation',
      type: 'event_invitation',
      category: 'events',
      title: 'Event Invitation',
      message: 'David Kim invited you to "Tech Meetup 2024"',
      sender: {
        _id: 'user404',
        username: 'davidkim',
        displayName: 'David Kim',
        profilePicture: null,
      },
      data: {
        eventId: 'event123',
        eventTitle: 'Tech Meetup 2024',
        eventTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        eventLocation: 'San Francisco, CA',
      },
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      priority: 'normal',
      actionType: 'VIEW_EVENT',
      actionData: { eventId: 'event123' },
    },

    event_reminder: {
      _id: 'example_event_reminder',
      type: 'event_reminder',
      category: 'events',
      title: 'Event Tomorrow',
      message: 'Don\'t forget: "Coffee Meetup" is tomorrow at 10:00 AM',
      sender: null,
      data: {
        eventId: 'event456',
        eventTitle: 'Coffee Meetup',
        eventTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        eventLocation: 'Local Cafe',
      },
      isRead: false,
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      priority: 'high',
      actionType: 'VIEW_EVENT',
      actionData: { eventId: 'event456' },
    },

    event_reminder_1_hour: {
      _id: 'example_event_1hour',
      type: 'event_reminder_1_hour',
      category: 'events',
      title: 'Event Starting Soon',
      message: '"Birthday Party" starts in 1 hour',
      sender: null,
      data: {
        eventId: 'event789',
        eventTitle: 'Birthday Party',
        eventTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        eventLocation: '123 Main St',
      },
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      priority: 'high',
      actionType: 'VIEW_EVENT',
      actionData: { eventId: 'event789' },
    },

    event_rsvp_batch: {
      _id: 'example_event_rsvp',
      type: 'event_rsvp_batch',
      category: 'events',
      title: 'Event RSVPs',
      message: '5 people are attending your event "Game Night"',
      sender: null,
      data: {
        eventId: 'event101',
        eventTitle: 'Game Night',
        attendeeCount: 5,
        attendees: ['John', 'Sarah', 'Mike', 'Emily', 'Chris'],
      },
      isRead: true,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      priority: 'normal',
      actionType: 'VIEW_EVENT',
      actionData: { eventId: 'event101' },
    },

    post_liked: {
      _id: 'example_post_liked',
      type: 'post_liked',
      category: 'social',
      title: 'New Like',
      message: 'Rachel Green liked your post',
      sender: {
        _id: 'user505',
        username: 'rachelgreen',
        displayName: 'Rachel Green',
        profilePicture: null,
      },
      data: {
        postId: 'post123',
        postPreview: 'Had an amazing day at the beach!',
      },
      isRead: true,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      priority: 'normal',
      actionType: 'VIEW_POST',
      actionData: { postId: 'post123' },
    },

    post_commented: {
      _id: 'example_post_comment',
      type: 'post_commented',
      category: 'social',
      title: 'New Comment',
      message: 'Monica Geller commented on your post: "Looks amazing!"',
      sender: {
        _id: 'user606',
        username: 'monicageller',
        displayName: 'Monica Geller',
        profilePicture: null,
      },
      data: {
        postId: 'post456',
        comment: 'Looks amazing!',
        postPreview: 'Check out my new recipe',
      },
      isRead: false,
      createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      priority: 'normal',
      actionType: 'VIEW_POST',
      actionData: { postId: 'post456' },
    },
  };

  const notificationTypes = [
    { key: 'all', label: 'All Types', icon: 'grid-outline' },
    { key: 'friend_request', label: 'Friend Request (Mutuals)', icon: 'person-add', color: '#3797EF' },
    { key: 'friend_request_with_events', label: 'Friend Request (Events)', icon: 'person-add', color: '#3797EF' },
    { key: 'friend_request_accepted', label: 'Request Accepted', icon: 'checkmark-circle', color: '#34C759' },
    { key: 'memory_invitation', label: 'Memory Invite', icon: 'images', color: '#FF9500' },
    { key: 'memory_photo_added', label: 'Photo Added', icon: 'camera', color: '#5AC8FA' },
    { key: 'memory_photo_batch', label: 'Photos Batch', icon: 'photos', color: '#FF2D55' },
    { key: 'event_invitation', label: 'Event Invite', icon: 'calendar', color: '#3797EF' },
    { key: 'event_reminder', label: 'Event Tomorrow', icon: 'time', color: '#FF9500' },
    { key: 'event_reminder_1_hour', label: 'Event Soon', icon: 'alarm', color: '#FF3B30' },
    { key: 'event_rsvp_batch', label: 'Event RSVPs', icon: 'people', color: '#34C759' },
    { key: 'post_liked', label: 'Post Liked', icon: 'heart', color: '#FF3B30' },
    { key: 'post_commented', label: 'Post Comment', icon: 'chatbubble', color: '#5AC8FA' },
  ];

  const getNotificationIcon = (notification) => {
    const iconMap = {
      'friend_request': 'person-add',
      'friend_request_accepted': 'checkmark-circle',
      'memory_invitation': 'images',
      'memory_photo_added': 'camera',
      'memory_photo_batch': 'photos',
      'event_invitation': 'calendar',
      'event_reminder': 'time',
      'event_reminder_1_hour': 'alarm',
      'event_rsvp_batch': 'people',
      'post_liked': 'heart',
      'post_commented': 'chatbubble'
    };
    
    return iconMap[notification.type] || 'notifications';
  };

  const getNotificationColor = (notification) => {
    if (notification.priority === 'high') return '#FF3B30';
    if (notification.category === 'events') return '#3797EF';
    return '#8E44AD';
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const renderNotificationItem = (notification) => {
    const iconName = getNotificationIcon(notification);
    const iconColor = getNotificationColor(notification);
    const isFriendRequest = notification.type === 'friend_request' || notification._id.includes('friend_request');

    // For friend requests, use the redesigned component
    if (isFriendRequest) {
      return (
        <View style={styles.exampleContainer}>
          <Text style={styles.typeLabel}>{notification.type}</Text>
          <SwipeableNotificationItem
            item={notification}
            onDelete={() => console.log('Delete')}
            disabled={true}
          >
            <FriendRequestNotificationRedesigned 
              notification={notification}
              onActionComplete={() => console.log('Action complete')}
              onDelete={() => console.log('Delete')}
            />
          </SwipeableNotificationItem>
        </View>
      );
    }

    // Regular notification rendering
    return (
      <View style={styles.exampleContainer}>
        <Text style={styles.typeLabel}>{notification.type}</Text>
        <SwipeableNotificationItem
          item={notification}
          onDelete={() => console.log('Delete')}
        >
          <TouchableOpacity
            style={[
              styles.notificationItem, 
              !notification.isRead && styles.unreadNotification
            ]}
            activeOpacity={0.7}
          >
            <View style={styles.notificationRow}>
              {/* Profile Picture or Icon */}
              <View style={styles.notificationIconContainer}>
                {notification.sender?.profilePicture ? (
                  <Image 
                    source={{ uri: `${API_BASE_URL}/${notification.sender.profilePicture}` }}
                    style={styles.profilePicture}
                  />
                ) : notification.sender ? (
                  <View style={[styles.defaultIcon, { backgroundColor: iconColor + '20' }]}>
                    <Text style={[styles.initialsText, { color: iconColor }]}>
                      {notification.sender.displayName?.substring(0, 2).toUpperCase() || 'U'}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.defaultIcon, { backgroundColor: iconColor + '20' }]}>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                  </View>
                )}
                
                {/* Unread indicator */}
                {!notification.isRead && (
                  <View style={styles.unreadDot} />
                )}

                {/* Priority indicator */}
                {notification.priority === 'high' && (
                  <View style={styles.priorityBadge}>
                    <Ionicons name="alert-circle" size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Notification Content */}
              <View style={styles.notificationContent}>
                <View style={styles.notificationTextContainer}>
                  <Text style={styles.notificationTitle}>
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {getTimeAgo(notification.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Category indicator */}
              <View style={styles.categoryIndicator}>
                <View style={[styles.categoryDot, { backgroundColor: iconColor }]} />
              </View>
            </View>
          </TouchableOpacity>
        </SwipeableNotificationItem>
      </View>
    );
  };

  const getDisplayNotifications = () => {
    if (selectedType === 'all') {
      return Object.values(exampleNotifications);
    }
    return [exampleNotifications[selectedType]];
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
        <Text style={styles.headerTitle}>Notification Examples</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Type Selector */}
      <View style={styles.typeSelectorContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeSelectorContent}
        >
          {notificationTypes.map(type => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.typeChip,
                selectedType === type.key && styles.typeChipActive
              ]}
              onPress={() => setSelectedType(type.key)}
            >
              <Ionicons 
                name={type.icon} 
                size={16} 
                color={selectedType === type.key ? '#FFFFFF' : (type.color || '#8E8E93')} 
              />
              <Text style={[
                styles.typeChipText,
                selectedType === type.key && styles.typeChipTextActive
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView style={styles.scrollView}>
        {getDisplayNotifications().map(notification => (
          <React.Fragment key={notification._id}>
            {renderNotificationItem(notification)}
          </React.Fragment>
        ))}
      </ScrollView>
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
  typeSelectorContainer: {
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  typeSelectorContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    gap: 6,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  exampleContainer: {
    marginVertical: 8,
    backgroundColor: '#F8F9FA',
    paddingTop: 8,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    paddingHorizontal: 20,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  unreadNotification: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 3,
    borderLeftColor: '#3797EF',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  defaultIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3797EF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  priorityBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'column',
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    lineHeight: 20,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  categoryIndicator: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

