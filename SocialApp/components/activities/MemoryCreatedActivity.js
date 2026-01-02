// components/activities/MemoryCreatedActivity.js - FIXED: Navigation to MemoryDetailsScreen
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';

const MemoryCreatedActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  
  // Safety checks
  if (!data) {
    console.error('❌ MemoryCreatedActivity: No data found', { activity });
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Activity data unavailable</Text>
      </View>
    );
  }
  
  const { memory, event, creator } = data;
  
  // Safety check for memory
  if (!memory) {
    console.error('❌ MemoryCreatedActivity: No memory data found', { activity });
    return (
      <View style={styles.container}>
        <ActivityHeader
          user={creator || activity.user}
          timestamp={timestamp}
          activityType="memory_created"
          onUserPress={() => {}}
        />
        <Text style={styles.errorText}>Memory information unavailable</Text>
      </View>
    );
  }
  
  // Safety check for creator
  if (!creator) {
    console.error('❌ MemoryCreatedActivity: No creator data found', { activity });
    return null;
  }

  // ✅ FIXED: Change navigation from 'MemoryScreen' to 'MemoryDetailsScreen'
  const handleViewMemory = () => {
    console.log('🎯 Navigating to MemoryDetailsScreen with memoryId:', memory._id);
    navigation.navigate('MemoryDetailsScreen', { memoryId: memory._id });
  };

  const handleViewEvent = () => {
    if (event) {
      console.log('🎯 Navigating to EventDetailsScreen with eventId:', event._id);
      navigation.navigate('EventDetailsScreen', { eventId: event._id });
    }
  };

  const handleViewProfile = () => {
    console.log('🎯 Navigating to ProfileScreen with userId:', creator._id);
    navigation.navigate('ProfileScreen', { userId: creator._id });
  };

  const formatEventDate = (eventTime) => {
    const date = new Date(eventTime);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={creator}
        timestamp={timestamp}
        activityType="memory_created"
        onUserPress={handleViewProfile}
        customIcon={{ name: 'book-outline', color: '#FF9500' }}
      />

      {/* Creation Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{creator.username}</Text>
          <Text> created a memory</Text>
          {event && (
            <>
              <Text> from </Text>
              <TouchableOpacity onPress={handleViewEvent}>
                <Text style={[styles.boldText, styles.eventLink]}>{event.title}</Text>
              </TouchableOpacity>
            </>
          )}
        </Text>
      </View>

      {/* Memory Card - ✅ FIXED: Updated onPress handler */}
      <TouchableOpacity 
        style={styles.memoryCard}
        onPress={handleViewMemory}
        activeOpacity={0.95}
      >
        <View style={styles.memoryContent}>
          {/* Memory Icon */}
          <View style={styles.memoryIcon}>
            <Ionicons name="book" size={24} color="#FF9500" />
          </View>

          {/* Memory Details */}
          <View style={styles.memoryInfo}>
            <Text style={styles.memoryTitle} numberOfLines={2}>
              {memory.title}
            </Text>
            
            {memory.description && (
              <Text style={styles.memoryDescription} numberOfLines={2}>
                {memory.description}
              </Text>
            )}

            <View style={styles.memoryMeta}>
              {/* Photo Count */}
              <View style={styles.metaItem}>
                <Ionicons name="images-outline" size={14} color="#8E8E93" />
                <Text style={styles.metaText}>
                  {memory.photoCount} {memory.photoCount === 1 ? 'photo' : 'photos'}
                </Text>
              </View>

              {/* Event Context */}
              {event && (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
                  <Text style={styles.metaText}>
                    {formatEventDate(event.time)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* View Arrow */}
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </View>
        </View>

        {/* Memory Preview Strip */}
        <View style={styles.previewStrip}>
          <View style={styles.previewItem}>
            <Ionicons name="camera-outline" size={16} color="#FF9500" />
          </View>
          <View style={styles.previewItem}>
            <Ionicons name="heart-outline" size={16} color="#FF9500" />
          </View>
          <View style={styles.previewItem}>
            <Ionicons name="chatbubble-outline" size={16} color="#FF9500" />
          </View>
          <View style={styles.previewDots}>
            <Text style={styles.dotsText}>•••</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Related Event Card */}
      {event && (
        <TouchableOpacity 
          style={styles.eventContext}
          onPress={handleViewEvent}
          activeOpacity={0.7}
        >
          <View style={styles.eventInfo}>
            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            <View style={styles.eventDetails}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.eventDate}>
                {formatEventDate(event.time)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
        </TouchableOpacity>
      )}

      {/* Action Button - ✅ FIXED: Updated onPress handler */}
      <View style={styles.actionContainer}>
        <ActivityActionButton
          title="View Memory"
          onPress={handleViewMemory}
          variant="primary"
          icon="book-outline"
          fullWidth={true}
          style={styles.viewMemoryButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },
  
  // Message
  messageContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '600',
  },
  eventLink: {
    color: '#3797EF',
  },

  // Memory Card
  memoryCard: {
    marginHorizontal: 0,
    borderRadius: 0,
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE066',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  memoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  // Memory Icon
  memoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE066',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  // Memory Info
  memoryInfo: {
    flex: 1,
    marginRight: 12,
  },
  memoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  memoryDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 8,
  },
  memoryMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#8E8E93',
  },

  // Arrow
  arrowContainer: {
    padding: 4,
  },

  // Preview Strip
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFBF0',
    borderTopWidth: 1,
    borderTopColor: '#FFE066',
    gap: 12,
  },
  previewItem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  previewDots: {
    flex: 1,
    alignItems: 'center',
  },
  dotsText: {
    fontSize: 16,
    color: '#FF9500',
    fontWeight: 'bold',
  },

  // Event Context
  eventContext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 13,
    color: '#8E8E93',
  },

  // Action
  actionContainer: {
    paddingHorizontal: 16,
  },
  viewMemoryButton: {
    backgroundColor: '#FF9500',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
});

export default MemoryCreatedActivity;