// components/activities/MemoryPhotoUploadActivity.js - NEW: Memory Photo Upload Activity Component
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

const MemoryPhotoUploadActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { photo, memory, uploader } = data;

  // Helper function to get proper image URL
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    // Replace with your actual API base URL
    return `http://YOUR_API_BASE_URL:3000${cleanPath}`;
  };

  const handleViewPhoto = () => {
    console.log('🎯 Navigating to photo details:', photo._id);
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'memory',
      post: {
        ...photo,
        postType: 'memory',
        user: uploader,
        createdAt: timestamp,
        memoryInfo: {
          memoryId: memory._id,
          memoryTitle: memory.title
        }
      }
    });
  };

  const handleViewMemory = () => {
    console.log('🎯 Navigating to memory details:', memory._id);
    navigation.navigate('MemoryDetailsScreen', { memoryId: memory._id });
  };

  const handleViewProfile = () => {
    console.log('🎯 Navigating to uploader profile:', uploader._id);
    navigation.navigate('ProfileScreen', { userId: uploader._id });
  };

  const handleLikePhoto = async () => {
    try {
      console.log('❤️ Liking memory photo:', photo._id);
      if (onAction) {
        await onAction('like', {
          photoId: photo._id,
          isMemoryPhoto: true
        });
      }
    } catch (error) {
      console.error('❌ Error liking photo:', error);
    }
  };

  const handleCommentPhoto = () => {
    console.log('💬 Opening comments for memory photo:', photo._id);
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'memory',
      openKeyboard: true,
      post: {
        ...photo,
        postType: 'memory',
        user: uploader,
        createdAt: timestamp,
        memoryInfo: {
          memoryId: memory._id,
          memoryTitle: memory.title
        }
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={uploader}
        timestamp={timestamp}
        activityType="memory_photo_upload"
        onUserPress={handleViewProfile}
        customIcon={{ name: 'images-outline', color: '#32D74B' }}
      />

      {/* Upload Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{uploader.username}</Text>
          <Text> added a photo to </Text>
          <TouchableOpacity onPress={handleViewMemory}>
            <Text style={[styles.boldText, styles.memoryLink]}>{memory.title}</Text>
          </TouchableOpacity>
        </Text>
      </View>

      {/* Photo Preview */}
      <TouchableOpacity 
        style={styles.photoContainer}
        onPress={handleViewPhoto}
        activeOpacity={0.95}
      >
        <Image
          source={{ uri: getImageUrl(photo.url) }}
          style={styles.photoImage}
          resizeMode="cover"
        />
        
        {/* Photo Overlay with Stats */}
        <View style={styles.photoOverlay}>
          <View style={styles.photoStats}>
            {photo.likeCount > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="heart" size={14} color="#FF3B30" />
                <Text style={styles.statText}>{photo.likeCount}</Text>
              </View>
            )}
            
            {photo.commentCount > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="chatbubble" size={14} color="#007AFF" />
                <Text style={styles.statText}>{photo.commentCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Caption (if available) */}
        {photo.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText} numberOfLines={2}>
              {photo.caption}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Memory Context */}
      <TouchableOpacity 
        style={styles.memoryContext}
        onPress={handleViewMemory}
        activeOpacity={0.7}
      >
        <View style={styles.memoryIcon}>
          <Ionicons name="book" size={16} color="#FF9500" />
        </View>
        <Text style={styles.memoryContextText}>
          View "{memory.title}" memory
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <ActivityActionButton
          title="❤️ Like"
          onPress={handleLikePhoto}
          variant="ghost"
          icon="heart-outline"
          compact
        />
        
        <ActivityActionButton
          title="💬 Comment"
          onPress={handleCommentPhoto}
          variant="ghost"
          icon="chatbubble-outline"
          compact
        />
        
        <ActivityActionButton
          title="View Photo"
          onPress={handleViewPhoto}
          variant="primary"
          icon="eye-outline"
          compact
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#000000',
  },
  boldText: {
    fontWeight: '600',
  },
  memoryLink: {
    color: '#FF9500',
    textDecorationLine: 'underline',
  },
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  photoImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E1E4E8',
  },
  photoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  photoStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  statText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  captionContainer: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  captionText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },
  memoryContext: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5E6',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE0B3',
  },
  memoryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  memoryContextText: {
    flex: 1,
    fontSize: 14,
    color: '#D2691E',
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});

export default MemoryPhotoUploadActivity;