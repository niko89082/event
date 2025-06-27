// components/MemoryCard.js - Reusable memory card component
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MemoryCard({ memory, onPress, style }) {
  const renderParticipantAvatars = () => {
    const maxVisible = 3;
    const participants = memory.participants?.slice(0, maxVisible) || [];
    const remainingCount = Math.max(0, (memory.participantCount || 0) - maxVisible);

    return (
      <View style={styles.participantAvatars}>
        {participants.map((participant, index) => (
          <View
            key={participant._id || index}
            style={[
              styles.participantAvatar,
              { marginLeft: index > 0 ? -8 : 0, zIndex: maxVisible - index }
            ]}
          >
            {participant.profilePicture ? (
              <Image
                source={{ uri: `${API_BASE_URL}${participant.profilePicture}` }}
                style={styles.participantAvatarImage}
              />
            ) : (
              <View style={styles.participantAvatarPlaceholder}>
                <Text style={styles.participantAvatarText}>
                  {participant.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
        ))}
        {remainingCount > 0 && (
          <View style={[styles.participantAvatar, styles.remainingCount]}>
            <Text style={styles.remainingCountText}>+{remainingCount}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress(memory)}
      activeOpacity={0.9}
    >
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        {memory.coverPhoto ? (
          <Image
            source={{ uri: `${API_BASE_URL}${memory.coverPhoto}` }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="images" size={32} color="#C7C7CC" />
          </View>
        )}
        
        {/* Memory Icon Badge */}
        <View style={styles.memoryBadge}>
          <Ionicons name="library" size={16} color="#FFFFFF" />
        </View>

        {/* Photo Count */}
        {memory.photoCount > 0 && (
          <View style={styles.photoCount}>
            <Ionicons name="camera" size={12} color="#FFFFFF" />
            <Text style={styles.photoCountText}>{memory.photoCount}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {memory.title}
        </Text>
        
        <View style={styles.metadata}>
          {/* Participants */}
          <View style={styles.metadataRow}>
            {renderParticipantAvatars()}
            <Text style={styles.participantCount}>
              {memory.participantCount} {memory.participantCount === 1 ? 'person' : 'people'}
            </Text>
          </View>

          {/* Last Activity */}
          <Text style={styles.lastActivity}>
            {memory.timeAgo || 'Recently'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  coverContainer: {
    height: 150,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(55, 151, 239, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCount: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    lineHeight: 24,
  },
  metadata: {
    gap: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  participantAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  participantAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  remainingCount: {
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remainingCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  participantCount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  lastActivity: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
});