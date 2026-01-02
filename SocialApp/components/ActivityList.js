// components/ActivityList.js - Clean UI rendering component (EventsHub pattern)
import React, { useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import activity components
import CompletePostItem from './PostItem';
import MemoryPostActivityComponent from './MemoryPostActivityComponent';
import EventInvitationActivity from './activities/EventInvitationActivity';
import EventPhotoActivity from './activities/EventPhotoActivity';
import FriendEventActivity from './activities/FriendEventActivity';
import EventReminderActivity from './activities/EventReminderActivity';
import MemoryCreatedActivity from './activities/MemoryCreatedActivity';
import EventCreatedActivity from './activities/EventCreatedActivity';
import EventCreatedActivityAlternative from './activities/EventCreatedActivityAlternative';
import FriendEventActivityRedesigned from './activities/FriendEventActivityRedesigned';
import FriendEventActivityAlternative from './activities/FriendEventActivityAlternative';
import MemoryPhotoUploadActivity from './activities/MemoryPhotoUploadActivity';
import PhotoCommentActivity from './activities/PhotoCommentActivity';
import MemoryPhotoCommentActivity from './activities/MemoryPhotoCommentActivity';
import FriendCohostAddedActivity from './activities/FriendCohostAddedActivity';
import PostActivityComponent from './PostActivityComponent';
import FriendRecommendations from './FriendRecommendations';

// Testing toggles
const USE_ALTERNATIVE_LAYOUT = true;
const USE_REDESIGNED_JOIN = true;

export default function ActivityList({
  navigation,
  activities = [],
  loading = false,
  refreshing = false,
  onRefresh,
  onScroll,
  onLoadMore,
  onActivityAction,
  onActivityLike, // New callback for like updates
  friendsCount = 0, // Note: This is actually followingCount now, kept as friendsCount for backward compatibility
  currentUserId,
  scrollEventThrottle = 16,
  ListHeaderComponent, // Optional custom header component (e.g., PostComposer)
  debugValues = {}, // Debug values from FeedScreen
}) {
  const insets = useSafeAreaInsets();
  
  // Calculate header height to match FeedScreen - use debug values if available
  const FIXED_HEADER_HEIGHT = debugValues.fixedHeaderHeight || 52;
  const TAB_BAR_HEIGHT = debugValues.tabBarHeight || 40;
  const HEADER_HEIGHT = debugValues.totalHeaderHeight || (insets.top + FIXED_HEADER_HEIGHT + TAB_BAR_HEIGHT);
  
  // Render different activity types
  const renderActivity = useCallback(({ item }) => {
    console.log('🎯 ActivityList: Rendering activity:', {
      activityId: item._id,
      activityType: item.activityType,
      currentUserId: currentUserId,
    });
    
    // Common props for all activity components
    const commonProps = {
      activity: item,
      currentUserId: currentUserId,
      navigation: navigation,
      onAction: onActivityAction,
    };

    switch (item.activityType) {
      case 'regular_post':
      case 'text_post':
      case 'review_post':
      case 'memory_post':
        return (
          <View style={styles.activityWrapper}>
            <PostActivityComponent 
              activity={item} 
              currentUserId={currentUserId}
              navigation={navigation}
              onCommentAdded={(comment) => {
                console.log('💬 Comment added to post:', item._id, comment);
              }}
              onLike={(postId, isLiked, likeCount) => {
                if (onActivityLike) {
                  onActivityLike(postId, isLiked, likeCount);
                }
              }}
            />
          </View>
        );

      case 'memory_photo_upload':
        return (
          <View style={styles.activityWrapper}>
            <MemoryPostActivityComponent 
              activity={item} 
              currentUserId={currentUserId}
              navigation={navigation}
              onCommentAdded={(comment) => {
                console.log('💬 Comment added to memory photo:', item._id, comment);
              }}
            />
          </View>
        );

      case 'event_invitation':
        return (
          <View style={styles.activityWrapper}>
            <EventInvitationActivity {...commonProps} />
          </View>
        );

      case 'event_created':
        return (
          <View style={styles.activityWrapper}>
            {USE_ALTERNATIVE_LAYOUT ? (
              <EventCreatedActivityAlternative {...commonProps} />
            ) : (
              <EventCreatedActivity {...commonProps} />
            )}
          </View>
        );

      case 'event_photo_upload':
        return (
          <View style={styles.activityWrapper}>
            <EventPhotoActivity {...commonProps} />
          </View>
        );

      case 'friend_event_join':
        return (
          <View style={styles.activityWrapper}>
            {USE_ALTERNATIVE_LAYOUT ? (
              <FriendEventActivityAlternative {...commonProps} />
            ) : (
              USE_REDESIGNED_JOIN ? (
                <FriendEventActivityRedesigned {...commonProps} />
              ) : (
                <FriendEventActivity {...commonProps} />
              )
            )}
          </View>
        );

      // Friend request activities removed - using follower-following system

      case 'event_reminder':
        return (
          <View style={styles.activityWrapper}>
            <EventReminderActivity {...commonProps} />
          </View>
        );

      case 'memory_created':
        return (
          <View style={styles.activityWrapper}>
            <MemoryCreatedActivity {...commonProps} />
          </View>
        );

      case 'photo_comment':
        return (
          <View style={styles.activityWrapper}>
            <PhotoCommentActivity {...commonProps} />
          </View>
        );

      case 'memory_photo_comment':
        return (
          <View style={styles.activityWrapper}>
            <MemoryPhotoCommentActivity {...commonProps} />
          </View>
        );

      case 'friend_cohost_added':
        return (
          <View style={styles.activityWrapper}>
            <FriendCohostAddedActivity {...commonProps} />
          </View>
        );

      default:
        console.warn('⚠️ Unknown activity type:', item.activityType);
        return (
          <View style={styles.unknownActivityWrapper}>
            <Text style={styles.unknownActivityText}>
              Unknown activity type: {item.activityType}
            </Text>
          </View>
        );
    }
  }, [navigation, currentUserId, onActivityAction]);

  const renderFooter = () => {
    if (!loading || activities.length === 0) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3797EF" />
        <Text style={styles.footerText}>Loading more activities...</Text>
      </View>
    );
  };

  // Render skeleton loading placeholders
  const renderSkeletonLoader = () => {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3].map((index) => (
          <View key={index} style={styles.skeletonPost}>
            {/* Header skeleton */}
            <View style={styles.skeletonHeader}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonHeaderText}>
                <View style={styles.skeletonUsername} />
                <View style={styles.skeletonMeta} />
              </View>
            </View>
            {/* Content skeleton */}
            <View style={styles.skeletonContent}>
              <View style={styles.skeletonTextLine} />
              <View style={[styles.skeletonTextLine, { width: '80%' }]} />
              <View style={[styles.skeletonTextLine, { width: '60%' }]} />
            </View>
            {/* Image skeleton */}
            <View style={styles.skeletonImage} />
            {/* Engagement bar skeleton */}
            <View style={styles.skeletonEngagement}>
              <View style={styles.skeletonButton} />
              <View style={styles.skeletonButton} />
              <View style={styles.skeletonButton} />
            </View>
          </View>
        ))}
      </View>
    );
  };


  const renderHeader = () => {
    console.log('🎯 ActivityList: Rendering header, activities.length:', activities.length);
    
    // If custom header component provided (e.g., PostComposer), use it
    if (ListHeaderComponent) {
      return (
        <View>
          {ListHeaderComponent}
          {activities.length > 0 && (
            <FriendRecommendations 
              navigation={navigation}
              displayMode="header"
              onFriendAdded={(user) => {
                console.log('🎉 Friend added:', user.username);
                // Trigger refresh
                if (onRefresh) onRefresh();
              }}
            />
          )}
        </View>
      );
    }
    
    // Only show friend recommendations in header when activities exist
    if (activities.length > 0) {
      return (
        <FriendRecommendations 
          navigation={navigation}
          displayMode="header"
          onFriendAdded={(user) => {
            console.log('🎉 Friend added:', user.username);
            // Trigger refresh
            if (onRefresh) onRefresh();
          }}
        />
      );
    }
    return null;
  };

  // Calculate content container style with proper padding for header
  const getContentContainerStyle = () => {
    // Add padding to account for fixed header so PostComposer isn't covered
    // Add small gap to lower PostComposer slightly and match bottom padding
    const gap = 10; // Match PostComposer's paddingBottom for balanced spacing
    const paddingTop = HEADER_HEIGHT + gap;
    
    return [styles.contentContainer, { paddingTop }];
  };

  // Show skeleton loaders on initial load
  if (loading && activities.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        {renderHeader()}
        <View style={getContentContainerStyle()}>
          {renderSkeletonLoader()}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      keyExtractor={(item) => item._id}
      renderItem={renderActivity}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.1}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3797EF"
          colors={["#3797EF"]}
          title="Pull to refresh activities"
          titleColor="#8E8E93"
          progressBackgroundColor="#FFFFFF"
          progressViewOffset={HEADER_HEIGHT + 10}
        />
      }
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={getContentContainerStyle()}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      nestedScrollEnabled={true}
      scrollEnabled={true}
      bounces={true}
      alwaysBounceVertical={true}
      removeClippedSubviews={false}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={10}
      style={{ backgroundColor: 'transparent', flex: 1 }}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 0, // No extra padding - header handles spacing
    paddingBottom: 20,
    backgroundColor: 'transparent', // Transparent to avoid white blocking
    minHeight: '100%',
  },
  
  // Activity wrappers
  activityWrapper: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF', // White background for activity items
    borderRadius: 0,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1', // Subtle border
  },
  unknownActivityWrapper: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  unknownActivityText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Footer loading
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  // Skeleton loading styles
  skeletonContainer: {
    paddingTop: 10,
  },
  skeletonPost: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
    marginRight: 12,
  },
  skeletonHeaderText: {
    flex: 1,
  },
  skeletonUsername: {
    width: 120,
    height: 16,
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonMeta: {
    width: 80,
    height: 12,
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
  },
  skeletonContent: {
    paddingLeft: 68,
    paddingRight: 16,
    marginBottom: 12,
  },
  skeletonTextLine: {
    height: 14,
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    marginBottom: 8,
    width: '100%',
  },
  skeletonImage: {
    marginLeft: 68,
    marginRight: 16,
    height: 300,
    backgroundColor: '#E1E1E1',
    borderRadius: 16,
    marginBottom: 12,
  },
  skeletonEngagement: {
    flexDirection: 'row',
    paddingLeft: 68,
    paddingRight: 16,
    gap: 24,
  },
  skeletonButton: {
    width: 60,
    height: 20,
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
  },
});
