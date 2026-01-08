import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with padding

const COLORS = {
  primary: '#607AFB',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  surface: '#FFFFFF',
  border: '#E5E7EB',
};

// Gradient colors for different movie genres
const GENRE_GRADIENTS = {
  'Sci-Fi': ['#8B5CF6', '#6366F1'],
  'Action': ['#EF4444', '#DC2626'],
  'Drama': ['#1F2937', '#111827'],
  'Comedy': ['#F59E0B', '#F97316'],
  'Adventure': ['#10B981', '#059669'],
  default: ['#6366F1', '#8B5CF6'],
};

export default function SearchMovieCard({ movie, onPress }) {
  const posterUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;

  // Determine genre for gradient
  const genre = movie.genre_ids?.[0] || movie.genres?.[0]?.name || 'default';
  const gradientColors = GENRE_GRADIENTS[genre] || GENRE_GRADIENTS.default;
  
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const genreText = movie.genres?.[0]?.name || 'Movie';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(movie)}
      activeOpacity={0.95}
    >
      {/* Movie Card with Gradient Background */}
      <View style={styles.cardContainer}>
        {posterUrl ? (
          <View style={styles.posterContainer}>
            <Image source={{ uri: posterUrl }} style={styles.poster} />
            {rating && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            )}
          </View>
        ) : (
          <LinearGradient
            colors={gradientColors}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="film-outline" size={40} color="rgba(255, 255, 255, 0.8)" />
            {rating && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            )}
          </LinearGradient>
        )}
      </View>
      
      {/* Movie Title */}
      <Text style={styles.title} numberOfLines={1}>
        {movie.title || movie.name}
      </Text>
      
      {/* Genre and Year */}
      <Text style={styles.meta} numberOfLines={1}>
        {genreText}{year ? ` • ${year}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: 12,
    marginBottom: 16,
  },
  cardContainer: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  posterContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
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
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});

