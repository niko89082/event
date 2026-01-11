import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#607AFB',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  success: '#10B981',
};

export default function SearchPeopleCard({ 
  user, 
  onPress, 
  onFollow, 
  API_BASE_URL,
  connectionContext = null // { type: 'followed_by' | 'attending' | 'reviewed', data: {...} }
}) {
  const avatar = user.profilePicture
    ? `http://${API_BASE_URL}${user.profilePicture}`
    : `https://placehold.co/56x56/C7C7CC/FFFFFF?text=${user.username?.charAt(0).toUpperCase() || '?'}`;

  const isFollowing = user.isFollowing || false;
  const isSelf = user.isSelf || false;

  const renderConnectionDetail = () => {
    if (!connectionContext) return null;

    const { type, data } = connectionContext;
    
    switch (type) {
      case 'followed_by':
        return (
          <View style={styles.connectionRow}>
            <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.connectionText}>
              Followed by {data.name || 'someone'}{data.count > 1 ? ` + ${data.count - 1} other${data.count > 2 ? 's' : ''}` : ''}
            </Text>
          </View>
        );
      case 'attending':
        return (
          <View style={styles.connectionRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.connectionText}>
              Attending {data.eventName || 'an event'} you're interested in
            </Text>
          </View>
        );
      case 'reviewed':
        return (
          <View style={styles.connectionRow}>
            <Ionicons name="film-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.connectionText}>
              Reviewed {data.count || 0} movie{data.count !== 1 ? 's' : ''} you liked
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(user)}
      activeOpacity={0.95}
    >
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          {user.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>
        
        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {user.displayName || user.username}
            </Text>
            {user.verified && (
              <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} style={styles.verifiedIcon} />
            )}
          </View>
          <Text style={styles.username} numberOfLines={1}>
            @{user.username}
          </Text>
          {renderConnectionDetail()}
        </View>

        {/* Follow Button */}
        <TouchableOpacity
          style={[
            styles.followButton,
            isFollowing && styles.followButtonActive,
            isSelf && styles.followButtonDisabled
          ]}
          onPress={(e) => {
            e.stopPropagation();
            if (!isSelf && onFollow) {
              onFollow(user._id, user.username);
            }
          }}
          activeOpacity={0.7}
          disabled={isSelf}
        >
          <Text style={[
            styles.followButtonText,
            isFollowing && styles.followButtonTextActive,
            isSelf && styles.followButtonTextDisabled
          ]}>
            {isSelf ? 'You' : isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  username: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: COLORS.border,
  },
  followButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followButtonTextActive: {
    color: COLORS.text,
  },
  followButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
});


