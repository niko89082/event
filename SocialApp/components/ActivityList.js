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
import FriendRequestActivity from './activities/FriendRequestActivity';
import FriendRequestAcceptedActivity from './activities/FriendRequestAcceptedActivity';
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
  friendsCount = 0,
  currentUserId,
  scrollEventThrottle = 16,
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

      case 'friend_request':
        return (
          <View style={styles.activityWrapper}>
            <FriendRequestActivity {...commonProps} />
          </View>
        );

      case 'friend_request_accepted':
        return (
          <View style={styles.activityWrapper}>
            <FriendRequestAcceptedActivity {...commonProps} />
          </View>
        );

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
    console.log('🎯 ActivityList: Rendering empty state, friendsCount:', friendsCount);
    
    // Check if user has friends
    if (friendsCount === 0) {
      return <NoFriendsEmptyState navigation={navigation} />;
    } else {
      return <NoActivityEmptyState navigation={navigation} />;
    }
  };

  const renderHeader = () => {
    console.log('🎯 ActivityList: Rendering header, activities.length:', activities.length);
    
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
      ListEmptyComponent={renderEmptyState}
      ListFooterComponent={renderFooter}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={activities.length === 0 ? styles.emptyContentContainer : styles.contentContainer}
      bounces={true}
      alwaysBounceVertical={true}
      removeClippedSubviews={false}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={10}
      style={{ backgroundColor: '#F8F9FA' }}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 120, // Account for header + tabs
    paddingBottom: 20,
    backgroundColor: '#F8F9FA',
    minHeight: '100%',
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#F8F9FA',
    minHeight: '100%',
  },
  
  // Activity wrappers
  activityWrapper: {
    marginBottom: 8,
    backgroundColor: '#F8F9FA', // Match screen background
    borderRadius: 0,
    marginHorizontal: 0,
    borderWidth: 0.5, // Very slight border
    borderColor: '#E5E5E7', // Very subtle border color
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
