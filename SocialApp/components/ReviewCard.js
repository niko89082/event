// components/ReviewCard.js - Display review in posts
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ReviewCard({ review, onPress }) {
  const [expanded, setExpanded] = useState(false);

  if (!review || !review.type) {
    return null;
  }

  const handleExternalLink = () => {
    if (review.externalUrl) {
      Linking.openURL(review.externalUrl);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={16}
          color={i <= rating ? "#FFD700" : "#E1E1E1"}
        />
      );
    }
    return stars;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={styles.reviewContent}>
        {review.poster && (
          <Image source={{ uri: review.poster }} style={styles.poster} />
        )}
        <View style={styles.reviewInfo}>
          <Text style={styles.title}>{review.title}</Text>
          {review.artist && (
            <Text style={styles.artist}>{review.artist}</Text>
          )}
          {review.year && (
            <Text style={styles.year}>{review.year}</Text>
          )}
          {review.rating && review.rating > 0 && (
            <View style={styles.ratingContainer}>
              <View style={styles.starsContainer}>
                {renderStars(review.rating)}
              </View>
              <Text style={styles.ratingText}>{review.rating}/5</Text>
            </View>
          )}
          {review.genre && review.genre.length > 0 && (
            <View style={styles.genreContainer}>
              {review.genre.slice(0, 3).map((genre, index) => (
                <View key={index} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {review.externalUrl && (
          <TouchableOpacity
            style={styles.externalButton}
            onPress={handleExternalLink}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={review.type === 'movie' ? "open-outline" : "musical-notes"}
              size={20}
              color="#3797EF"
            />
          </TouchableOpacity>
        )}
      </View>
      {expanded && review.externalUrl && (
        <TouchableOpacity
          style={styles.expandedLink}
          onPress={handleExternalLink}
        >
          <Text style={styles.expandedLinkText}>
            {review.type === 'movie' ? 'View on TMDB' : 'Open in Spotify'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#3797EF" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  reviewContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E1E1E1',
    marginRight: 12,
  },
  reviewInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  year: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  genreTag: {
    backgroundColor: '#E1E8F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  genreText: {
    fontSize: 11,
    color: '#3797EF',
    fontWeight: '500',
  },
  externalButton: {
    padding: 4,
  },
  expandedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  expandedLinkText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '600',
    marginRight: 4,
  },
});

