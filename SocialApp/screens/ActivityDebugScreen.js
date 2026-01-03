// ActivityDebugScreen.js - Debug screen for reviewing activity components
// This screen displays all activity types (excluding posts) with sample data for fine-tuning

import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';

// Import activity components (using redesigned versions)
import PhotoCommentActivityRedesigned from '../components/activities/PhotoCommentActivityRedesigned';
import EventInvitationActivityRedesigned from '../components/activities/EventInvitationActivityRedesigned';
import EventCreatedActivityRedesigned from '../components/activities/EventCreatedActivityRedesigned';
import FriendEventActivityRedesignedNew from '../components/activities/FriendEventActivityRedesignedNew';
import FriendCohostAddedActivityRedesigned from '../components/activities/FriendCohostAddedActivityRedesigned';
import PostLikeActivity from '../components/activities/PostLikeActivity';
import FollowActivity from '../components/activities/FollowActivity';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ActivityDebugScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id || 'current_user_id';
  
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [selectedFilters, setSelectedFilters] = useState(new Set(['all']));

  // Sample data for each activity type matching backend structure
  const sampleActivities = [
    {
      activityType: 'photo_comment',
      title: 'Photo Comment Activity',
      description: 'Shows when someone comments on a photo',
      component: PhotoCommentActivityRedesigned,
      componentFile: 'PhotoCommentActivityRedesigned.js',
      data: {
        _id: 'photo_comment_sample_1',
        activityType: 'photo_comment',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        user: {
          _id: 'commenter_id',
          username: 'johndoe',
          fullName: 'John Doe',
          profilePicture: null,
        },
        data: {
          comment: {
            _id: 'comment_id_1',
            text: 'Great photo! Love the composition and lighting.',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          photo: {
            _id: 'photo_id_1',
            url: '/uploads/photos/sample.jpg',
            caption: 'Beautiful sunset at the beach',
          },
          commenter: {
            _id: 'commenter_id',
            username: 'johndoe',
            fullName: 'John Doe',
            profilePicture: null,
          },
          photoOwner: {
            _id: 'photo_owner_id',
            username: 'photographer',
            fullName: 'Photo Owner',
            profilePicture: null,
          },
        },
        metadata: {
          actionable: true,
          grouped: false,
          priority: 'medium',
        },
        score: 1.5,
      },
    },
    {
      activityType: 'event_invitation',
      title: 'Event Invitation Activity',
      description: 'Invitation to an event from someone you follow',
      component: EventInvitationActivityRedesigned,
      componentFile: 'EventInvitationActivityRedesigned.js',
      data: {
        _id: 'event_invitation_sample_1',
        activityType: 'event_invitation',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        user: {
          _id: 'inviter_id',
          username: 'eventhost',
          fullName: 'Event Host',
          profilePicture: null,
        },
        data: {
          event: {
            _id: 'event_id_1',
            title: 'Summer Music Festival 2024',
            description: 'Join us for an amazing music festival with top artists!',
            time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            location: 'Central Park',
            coverImage: '/uploads/event-covers/festival.jpg',
            privacyLevel: 'public',
            category: 'Music',
            attendeeCount: 45,
          },
          invitedBy: {
            _id: 'inviter_id',
            username: 'eventhost',
            fullName: 'Event Host',
            profilePicture: null,
          },
          inviterCount: 1,
          isGrouped: false,
        },
        metadata: {
          actionable: true,
          grouped: false,
          priority: 'high',
        },
        score: 2.0,
      },
    },
    {
      activityType: 'event_created',
      title: 'Event Created Activity',
      description: 'Shows when someone you follow creates an event',
      component: EventCreatedActivityRedesigned,
      componentFile: 'EventCreatedActivityRedesigned.js',
      data: {
        _id: 'event_created_sample_1',
        activityType: 'event_created',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        user: {
          _id: 'creator_id',
          username: 'eventcreator',
          fullName: 'Event Creator',
          profilePicture: null,
        },
        data: {
          event: {
            _id: 'event_id_2',
            title: 'New Year Party 2025',
            description: 'Join us for an amazing New Year celebration!',
            time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            location: 'Downtown Venue',
            coverImage: '/uploads/event-covers/party.jpg',
            privacyLevel: 'public',
            category: 'Party',
            attendeeCount: 0,
          },
        },
        metadata: {
          actionable: true,
          grouped: false,
          priority: 'medium',
        },
        score: 1.3,
      },
    },
    {
      activityType: 'friend_event_join',
      title: 'Friend Event Join Activity',
      description: 'Shows when friends join an event',
      component: FriendEventActivityRedesignedNew,
      componentFile: 'FriendEventActivityRedesignedNew.js',
      data: {
        _id: 'friend_event_join_sample_1',
        activityType: 'friend_event_join',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        user: {
          _id: 'friend_id_1',
          username: 'friend1',
          fullName: 'Friend One',
          profilePicture: null,
        },
        data: {
          event: {
            _id: 'event_id_3',
            title: 'Concert Night',
            description: 'Amazing concert with live music',
            time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            location: 'Music Hall',
            coverImage: '/uploads/event-covers/concert.jpg',
            privacyLevel: 'public',
            category: 'Music',
            attendeeCount: 15,
          },
          friends: [
            {
              _id: 'friend_id_1',
              username: 'friend1',
              fullName: 'Friend One',
              profilePicture: null,
            },
            {
              _id: 'friend_id_2',
              username: 'friend2',
              fullName: 'Friend Two',
              profilePicture: null,
            },
          ],
          groupCount: 2,
          isGrouped: true,
        },
        metadata: {
          actionable: true,
          grouped: true,
          priority: 'medium',
        },
        score: 1.1,
      },
    },
    {
      activityType: 'friend_cohost_added',
      title: 'Friend Co-host Added Activity',
      description: 'Shows when a friend is added as co-host to an event',
      component: FriendCohostAddedActivityRedesigned,
      componentFile: 'FriendCohostAddedActivityRedesigned.js',
      data: {
        _id: 'friend_cohost_added_sample_1',
        activityType: 'friend_cohost_added',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        user: {
          _id: 'cohost_id',
          username: 'cohostfriend',
          fullName: 'Cohost Friend',
          profilePicture: null,
        },
        data: {
          event: {
            _id: 'event_id_4',
            title: 'Workshop Event',
            description: 'Learn new skills at this workshop',
            time: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
            location: 'Conference Center',
            coverImage: '/uploads/event-covers/workshop.jpg',
            privacyLevel: 'public',
            category: 'Workshop',
            attendeeCount: 25,
          },
          host: {
            _id: 'host_id',
            username: 'eventhost',
            fullName: 'Event Host',
            profilePicture: null,
          },
          cohost: {
            _id: 'cohost_id',
            username: 'cohostfriend',
            fullName: 'Cohost Friend',
            profilePicture: null,
          },
        },
        metadata: {
          actionable: true,
          grouped: false,
          priority: 'medium',
        },
        score: 1.3,
      },
    },
    {
      activityType: 'post_like',
      title: 'Post Like Activity',
      description: 'Shows when someone you follow likes a post',
      component: PostLikeActivity,
      componentFile: 'PostLikeActivity.js',
      data: {
        _id: 'post_like_sample_1',
        activityType: 'post_like',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        user: {
          _id: 'liker_id',
          username: 'likeruser',
          fullName: 'Liker User',
          profilePicture: null,
        },
        data: {
          post: {
            _id: 'post_id_1',
            caption: 'Amazing sunset view from my vacation!',
            paths: ['/uploads/photos/sunset.jpg'],
            postType: 'photo',
            likeCount: 42,
            commentCount: 8,
          },
          postOwner: {
            _id: 'post_owner_id',
            username: 'postowner',
            fullName: 'Post Owner',
            profilePicture: null,
          },
          likers: [
            {
              _id: 'liker_id',
              username: 'likeruser',
              fullName: 'Liker User',
              profilePicture: null,
            },
            {
              _id: 'liker_id_2',
              username: 'johndoe',
              fullName: 'John Doe',
              profilePicture: null,
            },
            {
              _id: 'liker_id_3',
              username: 'janedoe',
              fullName: 'Jane Doe',
              profilePicture: null,
            },
            {
              _id: 'liker_id_4',
              username: 'alice',
              fullName: 'Alice Smith',
              profilePicture: null,
            },
            {
              _id: 'liker_id_5',
              username: 'bob',
              fullName: 'Bob Johnson',
              profilePicture: null,
            },
          ],
        },
        metadata: {
          actionable: true,
          grouped: false,
          priority: 'medium',
        },
        score: 1.2,
      },
    },
    {
      activityType: 'follow',
      title: 'Follow Activity',
      description: 'Shows when someone follows you or someone else',
      component: FollowActivity,
      componentFile: 'FollowActivity.js',
      data: {
        _id: 'follow_sample_1',
        activityType: 'follow',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        user: {
          _id: 'follower_id',
          username: 'jessicachen',
          fullName: 'Jessica Chen',
          profilePicture: null,
        },
        data: {
          followedUser: {
            _id: 'followed_user_id',
            username: 'sarahchen',
            fullName: 'Sarah Chen',
            profilePicture: null,
          },
          isFollowingYou: false,
        },
        metadata: {
          actionable: true,
          grouped: false,
          priority: 'medium',
        },
        score: 1.0,
      },
    },
  ];

  const toggleSection = (activityType) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(activityType)) {
      newExpanded.delete(activityType);
    } else {
      newExpanded.add(activityType);
    }
    setExpandedSections(newExpanded);
  };

  const toggleFilter = (filter) => {
    const newFilters = new Set(selectedFilters);
    if (filter === 'all') {
      if (newFilters.has('all')) {
        newFilters.clear();
      } else {
        newFilters.clear();
        newFilters.add('all');
      }
    } else {
      newFilters.delete('all');
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        newFilters.add(filter);
      }
      if (newFilters.size === 0) {
        newFilters.add('all');
      }
    }
    setSelectedFilters(newFilters);
  };

  const filteredActivities = sampleActivities.filter((activity) => {
    if (selectedFilters.has('all')) return true;
    return selectedFilters.has(activity.activityType);
  });

  const renderActivityComponent = (activity) => {
    const Component = activity.component;
    
    if (!Component) {
      // Placeholder for post_like (component doesn't exist yet)
      return (
        <View style={styles.placeholderContainer}>
          <Ionicons name="heart-outline" size={48} color="#8E8E93" />
          <Text style={styles.placeholderText}>
            Component not yet implemented
          </Text>
          <Text style={styles.placeholderSubtext}>
            post_like activity component needs to be created
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.componentWrapper}>
        <Component
          activity={activity.data}
          currentUserId={currentUserId}
          navigation={navigation}
          onAction={(activityId, action, actionData) => {
            console.log('Activity action:', { activityId, action, actionData });
          }}
        />
      </View>
    );
  };

  const renderJSONViewer = (data) => {
    return (
      <View style={styles.jsonContainer}>
        <ScrollView style={styles.jsonScrollView} nestedScrollEnabled>
          <Text style={styles.jsonText}>{JSON.stringify(data, null, 2)}</Text>
        </ScrollView>
      </View>
    );
  };

  const renderActivitySection = (activity) => {
    const isExpanded = expandedSections.has(activity.activityType);
    const showJSON = isExpanded;

    return (
      <View key={activity.activityType} style={styles.activitySection}>
        {/* Section Header */}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(activity.activityType)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{activity.activityType}</Text>
            </View>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>{activity.title}</Text>
              <Text style={styles.sectionDescription}>{activity.description}</Text>
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#8E8E93"
          />
        </TouchableOpacity>

        {/* Component Preview */}
        <View style={styles.componentContainer}>
          {renderActivityComponent(activity)}
        </View>

        {/* JSON Data Viewer */}
        {showJSON && (
          <View style={styles.jsonSection}>
            <View style={styles.jsonHeader}>
              <Text style={styles.jsonHeaderText}>Raw JSON Data</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {
                  // Copy to clipboard functionality could be added here
                  console.log('Copy JSON:', JSON.stringify(activity.data, null, 2));
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#3797EF" />
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            {renderJSONViewer(activity.data)}
          </View>
        )}

        {/* Component Info */}
        <View style={styles.componentInfo}>
          <Text style={styles.componentInfoText}>
            Component: {activity.component 
              ? (activity.component.displayName || activity.component.name || activity.title)
              : 'Not implemented'}
          </Text>
          <Text style={styles.componentInfoText}>
            File: components/activities/{activity.componentFile || 'Unknown.js'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Activity Components Debug</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedFilters.has('all') && styles.filterChipActive,
          ]}
          onPress={() => toggleFilter('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilters.has('all') && styles.filterChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {sampleActivities.map((activity) => (
          <TouchableOpacity
            key={activity.activityType}
            style={[
              styles.filterChip,
              selectedFilters.has(activity.activityType) && styles.filterChipActive,
            ]}
            onPress={() => toggleFilter(activity.activityType)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFilters.has(activity.activityType) && styles.filterChipTextActive,
              ]}
            >
              {activity.activityType}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Activities List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredActivities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="filter-outline" size={48} color="#8E8E93" />
            <Text style={styles.emptyStateText}>No activities match the selected filters</Text>
          </View>
        ) : (
          filteredActivities.map(renderActivitySection)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    height: 44,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#3797EF',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  activitySection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeBadge: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#8E8E93',
  },
  componentContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  componentWrapper: {
    backgroundColor: '#FFFFFF',
  },
  placeholderContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  jsonSection: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  jsonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F0F0',
  },
  jsonHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#3797EF',
    marginLeft: 4,
  },
  jsonContainer: {
    maxHeight: 300,
    backgroundColor: '#1C1C1E',
  },
  jsonScrollView: {
    maxHeight: 300,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#FFFFFF',
    padding: 16,
  },
  componentInfo: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  componentInfoText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
});

