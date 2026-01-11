import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#607AFB',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  surface: '#FFFFFF',
  border: '#E5E7EB',
};

export default function SearchSongCard({ 
  song, 
  onPress, 
  onAction,
  hasReview = false // Whether user has reviewed this song
}) {
  const albumArt = song.album?.images?.[0]?.url || song.images?.[0]?.url;
  const artistName = song.artists?.[0]?.name || 'Unknown Artist';
  const albumName = song.album?.name || '';
  const rating = song.rating || song.vote_average || null;
  const genre = song.genre || 'Pop';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(song)}
      activeOpacity={0.95}
    >
      {/* Album Art */}
      <View style={styles.albumArtContainer}>
        {albumArt ? (
          <>
            <Image source={{ uri: albumArt }} style={styles.albumArt} />
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </View>
          </>
        ) : (
          <View style={styles.albumArtPlaceholder}>
            <Ionicons name="musical-notes" size={32} color={COLORS.textSecondary} />
          </View>
        )}
      </View>
      
      {/* Song Info */}
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.artistAlbum} numberOfLines={1}>
          {artistName}{albumName ? ` • ${albumName}` : ''}
        </Text>
        <View style={styles.metaRow}>
          {rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
          {genre && (
            <Text style={styles.genreTag}>{genre}</Text>
          )}
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={(e) => {
          e.stopPropagation();
          if (onAction) {
            onAction(song);
          }
        }}
        activeOpacity={0.7}
      >
        {hasReview ? (
          <Text style={styles.reviewButtonText}>Review</Text>
        ) : (
          <View style={styles.addButton}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  albumArtContainer: {
    position: 'relative',
    marginRight: 12,
  },
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumArtPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  artistAlbum: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  genreTag: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  actionButton: {
    marginLeft: 8,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


