// components/ActivityList.js - Clean UI rendering component (EventsHub pattern)
import React, { useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

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
import PostActivityComponent from './PostActivityComponent';
import FriendRecommendations from './FriendRecommendations';
import NoFriendsEmptyState from './EmptyStates/NoFriendsEmptyState';
import NoActivityEmptyState from './EmptyStates/NoActivityEmptyState';

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
  friendsCount = 0, // Note: This is actually followingCount now, kept as friendsCount for backward compatibility
  currentUserId,
  scrollEventThrottle = 16,
  ListHeaderComponent, // Optional custom header component (e.g., PostComposer)
}) {
  
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

  const renderEmptyState = () => {
    // Note: friendsCount is actually followingCount now
    const followingCount = friendsCount;
    console.log('🎯 ActivityList: Rendering empty state, followingCount:', followingCount);
    
    // Don't show empty state if we have a ListHeaderComponent (PostComposer) - let it show
    // Only show empty state when loading is complete and no activities
    if (loading) {
      return null; // Don't show empty state while loading
    }
    
    // Check if user is following anyone (was: friendsCount, now: followingCount)
    if (followingCount === 0) {
      return <NoFriendsEmptyState navigation={navigation} />;
    } else {
      return <NoActivityEmptyState navigation={navigation} />;
    }
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
        />
      }
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={!loading && activities.length === 0 ? renderEmptyState : null}
      ListFooterComponent={renderFooter}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={activities.length === 0 && !loading && !ListHeaderComponent ? styles.emptyContentContainer : styles.contentContainer}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10,
      }}
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
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
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
});
