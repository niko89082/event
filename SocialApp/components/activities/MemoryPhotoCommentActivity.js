// components/activities/MemoryPhotoCommentActivity.js - NEW: Memory Photo Comment Activity
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

const MemoryPhotoCommentActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { comment, photo, memory, commenter, photoUploader } = data;

  // Helper function to get proper image URL
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    // Replace with your actual API base URL
    return `http://YOUR_API_BASE_URL:3000${cleanPath}`;
  };

  const handleViewPhoto = () => {
    console.log('🎯 Navigating to memory photo details:', photo._id);
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'memory',
      openKeyboard: false,
      post: {
        ...photo,
        postType: 'memory',
        user: photoUploader,
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

  const handleViewCommenter = () => {
    console.log('🎯 Navigating to commenter profile:', commenter._id);
    navigation.navigate('ProfileScreen', { userId: commenter._id });
  };

  const handleViewPhotoUploader = () => {
    console.log('🎯 Navigating to photo uploader profile:', photoUploader._id);
    navigation.navigate('ProfileScreen', { userId: photoUploader._id });
  };

  const handleReplyToComment = () => {
    console.log('💬 Opening reply to memory photo comment:', comment._id);
    navigation.navigate('UnifiedDetailsScreen', { 
      postId: photo._id,
      postType: 'memory',
      openKeyboard: true,
      post: {
        ...photo,
        postType: 'memory',
        user: photoUploader,
        createdAt: timestamp,
        memoryInfo: {
          memoryId: memory._id,
          memoryTitle: memory.title
        }
      }
    });
  };

  const formatCommentTime = (createdAt) => {
    const now = new Date();
    const commentTime = new Date(createdAt);
    const diffMinutes = Math.floor((now - commentTime) / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
    return `${Math.floor(diffMinutes / 1440)}d`;
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={commenter}
        timestamp={timestamp}
        activityType="memory_photo_comment"
        onUserPress={handleViewCommenter}
        customIcon={{ name: 'chatbubble', color: '#FF9500' }}
      />

      {/* Comment Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{commenter.username}</Text>
          <Text> commented on </Text>
          <TouchableOpacity onPress={handleViewPhotoUploader}>
            <Text style={[styles.boldText, styles.uploaderLink]}>
              {photoUploader._id === currentUserId ? 'your' : `${photoUploader.username}'s`}
            </Text>
          </TouchableOpacity>
          <Text> photo in </Text>
          <TouchableOpacity onPress={handleViewMemory}>
            <Text style={[styles.boldText, styles.memoryLink]}>{memory.title}</Text>
          </TouchableOpacity>
        </Text>
      </View>

      {/* Photo Preview with Comment */}
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
        
        {/* Comment Overlay */}
        <View style={styles.commentOverlay}>
          <View style={styles.commentBubble}>
            <Text style={styles.commentText} numberOfLines={3}>
              {comment.text}
            </Text>
            <Text style={styles.commentTime}>
              {formatCommentTime(comment.createdAt)}
            </Text>
          </View>
        </View>
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

      {/* Photo Caption Context */}
      {photo.caption && (
        <View style={styles.photoContext}>
          <Text style={styles.photoCaption} numberOfLines={2}>
            "{photo.caption}"
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <ActivityActionButton
          title="View Photo"
          onPress={handleViewPhoto}
          variant="primary"
          icon="eye-outline"
          compact
        />
        
        <ActivityActionButton
          title="Reply"
          onPress={handleReplyToComment}
          variant="ghost"
          icon="chatbubble-outline"
          compact
        />
        
        <ActivityActionButton
          title="View Memory"
          onPress={handleViewMemory}
          variant="ghost"
          icon="book-outline"
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
  uploaderLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
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
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#E1E4E8',
  },
  commentOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  commentBubble: {
    backgroundColor: 'rgba(255, 149, 0, 0.9)', // Orange theme for memory
    borderRadius: 12,
    padding: 12,
    maxWidth: '85%',
  },
  commentText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
    color: '#FFE6CC',
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
  photoContext: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 12,
  },
  photoCaption: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});

export default MemoryPhotoCommentActivity;