// screens/MoviePageScreen.js - Movie review page matching the design image
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, FlatList, Dimensions, SafeAreaView,
  StatusBar, Share, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MoviePageScreen({ navigation }) {
  const route = useRoute();
  const { tmdbId } = route.params || {};
  const { currentUser } = useContext(AuthContext);
  
  const [movie, setMovie] = useState(null);
  const [allReviews, setAllReviews] = useState([]);
  const [followingReviews, setFollowingReviews] = useState([]);
  const [followingWatched, setFollowingWatched] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    if (tmdbId) {
      fetchMovieDetails();
      fetchAllReviews();
      fetchFollowingReviews();
      fetchFollowingWatched();
    }
  }, [tmdbId]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/reviews/movie/${tmdbId}`);
      setMovie(response.data.movie);
    } catch (error) {
      console.error('Error fetching movie:', error);
      Alert.alert('Error', 'Failed to load movie details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllReviews = async () => {
    try {
      const response = await api.get(`/api/reviews/movie/${tmdbId}/reviews`, {
        params: { page: 1, limit: 20 }
      });
      setAllReviews(response.data.reviews);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchFollowingReviews = async () => {
    try {
      setReviewsLoading(true);
      const response = await api.get(`/api/reviews/movie/${tmdbId}/following-reviews`, {
        params: { page: 1, limit: 10 }
      });
      setFollowingReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Error fetching following reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const fetchFollowingWatched = async () => {
    try {
      const response = await api.get(`/api/reviews/movie/${tmdbId}/following-watched`);
      setFollowingWatched(response.data.users || []);
    } catch (error) {
      console.error('Error fetching following watched:', error);
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out ${movie.title} (${movie.year}) on Social!`,
        url: movie.externalUrl || `https://www.themoviedb.org/movie/${tmdbId}`,
        title: movie.title
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleReview = () => {
    navigation.navigate('CreatePostScreen', {
      movie: {
        tmdbId: movie.id,
        title: movie.title,
        year: movie.year,
        poster: movie.poster
      }
    });
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const reviewDate = new Date(date);
    const diffInSeconds = Math.floor((now - reviewDate) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={16}
          color={i <= rating ? "#4CAF50" : "#E1E1E1"}
        />
      );
    }
    return stars;
  };

  const getRatingBadgeColor = (rating) => {
    if (!rating) return '#8E8E93';
    if (rating >= 4) return '#4CAF50';
    if (rating >= 3) return '#FF9800';
    return '#8E8E93';
  };

  const renderRatingsDistribution = () => {
    if (!stats?.ratingsDistribution) return null;

    const distribution = stats.ratingsDistribution;
    const maxCount = Math.max(...Object.values(distribution));
    const totalRatings = Object.values(distribution).reduce((a, b) => a + b, 0);

    return (
      <View style={styles.ratingsSection}>
        <View style={styles.ratingsHeader}>
          <Text style={styles.ratingsTitle}>RATINGS</Text>
          <Text style={styles.ratingsSubtitle}>{formatNumber(totalRatings)} ratings</Text>
        </View>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star] || 0;
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <View key={star} style={styles.ratingBarRow}>
              <Text style={styles.ratingBarLabel}>{star}</Text>
              <View style={styles.ratingBarContainer}>
                <View 
                  style={[
                    styles.ratingBar, 
                    { 
                      width: `${percentage}%`,
                      backgroundColor: star >= 4 ? '#3797EF' : '#8E8E93'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.ratingBarCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!movie) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Movie not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Convert TMDB 10-point rating to 5-star display
  const tmdbRating = movie.rating || 0;
  const displayRating = (tmdbRating / 2).toFixed(1);
  const starRating = Math.round(tmdbRating / 2);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with back button and menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <View style={styles.headerButtonCircle}>
            <Ionicons name="arrow-back" size={20} color="#000000" />
          </View>
        </TouchableOpacity>
        <View style={styles.headerButton}>
          <View style={styles.headerButtonCircle}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#000000" />
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section with Background and Poster */}
        <View style={styles.heroSection}>
          {movie.backdrop && (
            <Image
              source={{ uri: movie.backdrop }}
              style={styles.backdrop}
            />
          )}
          <View style={styles.heroOverlay} />
          
          <View style={styles.heroContent}>
            {movie.poster && (
              <Image source={{ uri: movie.poster }} style={styles.poster} />
            )}
            <View style={styles.heroInfo}>
              <Text style={styles.movieTitle}>{movie.title}</Text>
              <Text style={styles.movieMeta}>
                {movie.year} | Directed by {movie.director || 'Unknown'} | {movie.runtime}m
              </Text>
              
              <View style={styles.ratingDisplay}>
                <View style={styles.starsContainer}>
                  {renderStars(starRating)}
                </View>
                <Text style={styles.ratingText}>
                  {displayRating} ({formatNumber(movie.voteCount || stats?.ratingCount || 0)})
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.reviewButton} onPress={handleReview}>
                  <Ionicons name="create-outline" size={18} color="#000000" />
                  <Text style={styles.reviewButtonText}>Review</Text>
                </TouchableOpacity>
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity style={styles.watchPartyButton}>
                    <Ionicons name="gift-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.watchPartyButtonText}>Plan Watch Party</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <Ionicons name="share-outline" size={18} color="#000000" />
                    <Text style={styles.shareButtonText}>Share Movie</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Trailer Button */}
              {movie.trailerUrl && (
                <TouchableOpacity
                  style={styles.trailerButtonHero}
                  onPress={() => setShowTrailer(true)}
                >
                  <Ionicons name="play-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.trailerButtonTextHero}>Watch Trailer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Following Watched Section */}
        {followingWatched.length > 0 && (
          <View style={styles.followingWatchedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTitle}>
                FOLLOWING WATCHED {followingWatched.length}
              </Text>
              <TouchableOpacity>
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.followingAvatars}>
              {followingWatched.slice(0, 5).map((user, idx) => (
                <View key={user._id || idx} style={styles.avatarContainer}>
                  {user.profilePicture ? (
                    <Image
                      source={{ uri: user.profilePicture }}
                      style={styles.followingAvatar}
                    />
                  ) : (
                    <View style={[styles.followingAvatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={20} color="#8E8E93" />
                    </View>
                  )}
                  {user.rating && (
                    <View style={[styles.ratingBadge, { backgroundColor: getRatingBadgeColor(user.rating) }]}>
                      <Text style={styles.ratingBadgeText}>{user.rating.toFixed(1)}</Text>
                    </View>
                  )}
                  {!user.rating && (
                    <View style={styles.watchedBadge}>
                      <Ionicons name="eye" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Synopsis Section */}
        {movie.overview && (
          <View style={styles.synopsisSection}>
            <Text style={styles.sectionTitle}>SYNOPSIS</Text>
            <Text style={styles.synopsisText}>{movie.overview}</Text>
          </View>
        )}

        {/* Top Cast Section */}
        {movie.cast && movie.cast.length > 0 && (
          <View style={styles.castSection}>
            <Text style={styles.sectionTitle}>TOP CAST</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.castList}>
              {movie.cast.map((actor, idx) => (
                <View key={idx} style={styles.castMember}>
                  {actor.profileImage ? (
                    <Image
                      source={{ uri: actor.profileImage }}
                      style={styles.castAvatar}
                    />
                  ) : (
                    <View style={[styles.castAvatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={24} color="#8E8E93" />
                    </View>
                  )}
                  <Text style={styles.castName} numberOfLines={1}>{actor.name}</Text>
                  <Text style={styles.castCharacter} numberOfLines={1}>{actor.character}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Ratings Distribution */}
        {renderRatingsDistribution()}

        {/* Following Reviews Section */}
        <View style={styles.followingReviewsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Following Reviews</Text>
            {followingReviews.length > 2 && (
              <TouchableOpacity>
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {reviewsLoading && followingReviews.length === 0 ? (
            <ActivityIndicator size="small" color="#3797EF" style={styles.loader} />
          ) : followingReviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No reviews from people you follow yet</Text>
            </View>
          ) : (
            followingReviews.slice(0, 2).map((review) => (
              <View key={review._id} style={styles.followingReviewCard}>
                <View style={styles.reviewCardHeader}>
                  <View style={styles.reviewUserInfo}>
                    {review.user?.profilePicture ? (
                      <Image
                        source={{ uri: review.user.profilePicture }}
                        style={styles.reviewAvatar}
                      />
                    ) : (
                      <View style={[styles.reviewAvatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={16} color="#8E8E93" />
                      </View>
                    )}
                    <View>
                      <Text style={styles.reviewUsername}>
                        {review.user?.username || 'Unknown'}
                      </Text>
                      {review.review?.rating && (
                        <View style={styles.reviewStars}>
                          {renderStars(review.review.rating)}
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.reviewTime}>{formatTimeAgo(review.createdAt)}</Text>
                </View>
                
                {(review.textContent || review.caption) && (
                  <Text style={styles.reviewText}>
                    {review.textContent || review.caption}
                  </Text>
                )}

                <View style={styles.reviewEngagement}>
                  <View style={styles.engagementItem}>
                    <Ionicons name="heart-outline" size={16} color="#8E8E93" />
                    <Text style={styles.engagementText}>{review.likeCount || 0}</Text>
                  </View>
                  <View style={styles.engagementItem}>
                    <Ionicons name="chatbubble-outline" size={16} color="#8E8E93" />
                    <Text style={styles.engagementText}>{review.commentCount || 0}</Text>
                  </View>
                  <TouchableOpacity>
                    <Text style={styles.replyLink}>Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Trailer Modal */}
      {showTrailer && movie.trailerUrl && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            onPress={() => setShowTrailer(false)}
          />
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.trailerButton}
              onPress={() => Linking.openURL(movie.trailerUrl)}
            >
              <Ionicons name="play-circle" size={64} color="#3797EF" />
              <Text style={styles.trailerLinkText}>Open in YouTube</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  heroSection: {
    position: 'relative',
    minHeight: 400,
  },
  backdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  heroContent: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 100,
    gap: 16,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#E1E1E1',
  },
  heroInfo: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  movieTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  movieMeta: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
    opacity: 0.9,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtons: {
    marginTop: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  watchPartyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  watchPartyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  trailerButtonHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 151, 239, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    alignSelf: 'flex-start',
  },
  trailerButtonTextHero: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingWatchedSection: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  viewAllLink: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '600',
  },
  followingAvatars: {
    flexDirection: 'row',
  },
  avatarContainer: {
    marginRight: 12,
    alignItems: 'center',
  },
  followingAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1E1E1',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  watchedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  synopsisSection: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  synopsisText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
  },
  castSection: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  castList: {
    flexDirection: 'row',
  },
  castMember: {
    width: 80,
    marginRight: 16,
    alignItems: 'center',
  },
  castAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E1E1E1',
    marginBottom: 8,
  },
  castName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 2,
  },
  castCharacter: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
  ratingsSection: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  ratingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
  ratingsSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ratingBarLabel: {
    width: 20,
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBar: {
    height: '100%',
    borderRadius: 4,
  },
  ratingBarCount: {
    width: 40,
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
  },
  followingReviewsSection: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  followingReviewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
  },
  reviewUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  reviewText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
    marginBottom: 12,
  },
  reviewEngagement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  replyLink: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '600',
    marginLeft: 'auto',
  },
  loader: {
    marginVertical: 32,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCloseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    zIndex: 1001,
  },
  trailerLinkText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 16,
    fontWeight: '600',
  },
});
