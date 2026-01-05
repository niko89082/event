// components/RepostWrapper.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';

export default function RepostWrapper({ 
  repost, 
  originalPost, 
  onReposterPress,
  onOriginalPostPress,
  children 
}) {
  if (!repost || !repost.isRepost) {
    return <>{children}</>;
  }

  const reposter = repost.user;
  const originalAuthor = originalPost?.user;

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `http://${API_BASE_URL}:3000${path}`;
  };

  return (
    <View style={styles.container}>
      {/* Repost Header */}
      <View style={styles.repostHeader}>
        <Ionicons name="repeat" size={14} color="#8E8E93" />
        <TouchableOpacity 
          onPress={() => onReposterPress && onReposterPress(reposter?._id)}
          style={styles.reposterLink}
        >
          <Text style={styles.reposterText}>
            {reposter?.username || 'Unknown'} reposted
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quote Repost Comment (if exists) */}
      {repost.repostComment && (
        <View style={styles.quoteContainer}>
          <Text style={styles.quoteText}>{repost.repostComment}</Text>
        </View>
      )}

      {/* Original Post Content */}
      <View style={styles.originalPostContainer}>
        {originalPost ? (
          <>
            {/* Original Author Info */}
            <View style={styles.originalAuthorContainer}>
              <TouchableOpacity
                onPress={() => onOriginalPostPress && onOriginalPostPress(originalPost._id)}
                style={styles.originalAuthorLink}
              >
                {originalAuthor?.profilePicture ? (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={12} color="#8E8E93" />
                  </View>
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={12} color="#8E8E93" />
                  </View>
                )}
                <Text style={styles.originalAuthorText}>
                  {originalAuthor?.username || 'Unknown'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Render the original post content */}
            {children}
          </>
        ) : (
          <View style={styles.unavailableContainer}>
            <Ionicons name="alert-circle-outline" size={20} color="#8E8E93" />
            <Text style={styles.unavailableText}>
              Original post unavailable
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9F9F9',
    gap: 6,
  },
  reposterLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reposterText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  quoteContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  quoteText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
  },
  originalPostContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#E5E5E5',
    marginLeft: 12,
    paddingLeft: 12,
  },
  originalAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalAuthorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  originalAuthorText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
  },
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  unavailableText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});

