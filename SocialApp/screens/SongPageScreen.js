// screens/SongPageScreen.js - Letterboxd-style song page
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, FlatList, Dimensions, SafeAreaView,
  StatusBar, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SongPageScreen({ navigation }) {
  const route = useRoute();
  const { spotifyId } = route.params || {};
  const { currentUser } = useContext(AuthContext);
  
  const [song, setSong] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (spotifyId) {
      fetchSongDetails();
      fetchReviews();
    }
  }, [spotifyId]);

  const fetchSongDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/reviews/song/${spotifyId}`);
      setSong(response.data.track);
    } catch (error) {
      console.error('Error fetching song:', error);
      Alert.alert('Error', 'Failed to load song details');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (pageNum = 1, append = false) => {
    try {
      setReviewsLoading(true);
      const response = await api.get(`/api/reviews/song/${spotifyId}/reviews`, {
        params: { page: pageNum, limit: 20 }
      });
      
      if (append) {
        setReviews([...reviews, ...response.data.reviews]);
      } else {
        setReviews(response.data.reviews);
      }
      
      setStats(response.data.stats);
      setHasMore(pageNum < response.data.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadMoreReviews = () => {
    if (!reviewsLoading && hasMore) {
      fetchReviews(page + 1, true);
    }
  };

  const handlePostComment = async (reviewId) => {
    if (!newComment.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      await api.post(`/api/photos/comment/${reviewId}`, {
        text: newComment.trim()
      });
      setNewComment('');
      // Refresh reviews
      fetchReviews(page, false);
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

  const renderReview = ({ item }) => {
    const isLiked = item.likes?.some(like => 
      typeof like === 'object' ? like._id === currentUser?._id : like === currentUser?._id
    ) || false;

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewUserInfo}>
            {item.user?.profilePicture ? (
              <Image
                source={{ uri: item.user.profilePicture }}
                style={styles.reviewAvatar}
              />
            ) : (
              <View style={styles.reviewAvatarPlaceholder}>
                <Ionicons name="person" size={16} color="#8E8E93" />
              </View>
            )}
            <Text style={styles.reviewUsername}>
              {item.user?.username || 'Unknown'}
            </Text>
          </View>
          {item.review?.rating && (
            <View style={styles.reviewRating}>
              {renderStars(item.review.rating)}
            </View>
          )}
        </View>
        
        {(item.textContent || item.caption) && (
          <Text style={styles.reviewText}>
            {item.textContent || item.caption}
          </Text>
        )}

        <View style={styles.reviewActions}>
          <TouchableOpacity style={styles.reviewActionButton}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={18}
              color={isLiked ? "#FF3B30" : "#8E8E93"}
            />
            <Text style={styles.reviewActionText}>
              {item.likeCount || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reviewActionButton}>
            <Ionicons name="chatbubble-outline" size={18} color="#8E8E93" />
            <Text style={styles.reviewActionText}>
              {item.commentCount || 0}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        {item.comments && item.comments.length > 0 && (
          <View style={styles.commentsSection}>
            {item.comments.slice(0, 3).map((comment, idx) => (
              <View key={idx} style={styles.commentItem}>
                <Text style={styles.commentUsername}>
                  {comment.user?.username || 'Unknown'}
                </Text>
                <Text style={styles.commentText}>{comment.text}</Text>
              </View>
            ))}
            {item.comments.length > 3 && (
              <Text style={styles.viewMoreComments}>
                View {item.comments.length - 3} more comments
              </Text>
            )}
          </View>
        )}

        {/* Add Comment */}
        <View style={styles.addCommentContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#8E8E93"
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            style={styles.postCommentButton}
            onPress={() => handlePostComment(item._id)}
            disabled={!newComment.trim() || submittingComment}
          >
            <Ionicons name="send" size={18} color="#3797EF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!song) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Song not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const averageRating = stats?.averageRating;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Song</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Song Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            {song.albumArt && (
              <Image source={{ uri: song.albumArt }} style={styles.albumArt} />
            )}
            <View style={styles.heroInfo}>
              <Text style={styles.songTitle}>{song.name}</Text>
              {song.artist && (
                <Text style={styles.songArtist}>{song.artist}</Text>
              )}
              
              {song.album && (
                <Text style={styles.songAlbum}>{song.album}</Text>
              )}

              {averageRating && (
                <View style={styles.ratingSection}>
                  <View style={styles.starsContainer}>
                    {renderStars(Math.round(averageRating))}
                  </View>
                  <Text style={styles.ratingText}>
                    {averageRating.toFixed(1)}/5
                  </Text>
                  {stats && (
                    <Text style={styles.ratingCount}>
                      ({stats.ratingCount} ratings)
                    </Text>
                  )}
                </View>
              )}

              {song.duration && (
                <Text style={styles.songMeta}>
                  {formatDuration(song.duration)}
                </Text>
              )}

              {song.year && (
                <Text style={styles.songMeta}>
                  Released {song.year}
                </Text>
              )}

              {song.genres && song.genres.length > 0 && (
                <View style={styles.genresContainer}>
                  {song.genres.map((genre, idx) => (
                    <View key={idx} style={styles.genreTag}>
                      <Text style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              )}

              {song.externalUrl && (
                <TouchableOpacity
                  style={styles.spotifyButton}
                  onPress={() => Linking.openURL(song.externalUrl)}
                >
                  <Ionicons name="musical-notes" size={20} color="#1DB954" />
                  <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
                </TouchableOpacity>
              )}

              {song.previewUrl && (
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={() => Linking.openURL(song.previewUrl)}
                >
                  <Ionicons name="play-circle" size={20} color="#3797EF" />
                  <Text style={styles.previewButtonText}>Preview</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Reviews Section */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>
              Reviews {stats && `(${stats.totalReviews})`}
            </Text>
          </View>

          {reviewsLoading && reviews.length === 0 ? (
            <ActivityIndicator size="large" color="#3797EF" style={styles.loader} />
          ) : reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyStateText}>No reviews yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Be the first to review this song!
              </Text>
            </View>
          ) : (
            <FlatList
              data={reviews}
              renderItem={renderReview}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              onEndReached={loadMoreReviews}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                reviewsLoading && reviews.length > 0 ? (
                  <ActivityIndicator size="small" color="#3797EF" />
                ) : null
              }
            />
          )}
        </View>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  content: {
    flex: 1,
  },
  heroSection: {
    padding: 16,
  },
  heroContent: {
    flexDirection: 'row',
    gap: 16,
  },
  albumArt: {
    width: 160,
    height: 160,
    borderRadius: 8,
    backgroundColor: '#E1E1E1',
  },
  heroInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 18,
    color: '#8E8E93',
    marginBottom: 4,
  },
  songAlbum: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 12,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  songMeta: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  genreTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  genreText: {
    fontSize: 12,
    color: '#000000',
  },
  spotifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DB954',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  spotifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#3797EF',
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  reviewsSection: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  reviewsHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  loader: {
    marginVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  reviewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
    marginBottom: 12,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  reviewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewActionText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  commentItem: {
    marginBottom: 8,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  viewMoreComments: {
    fontSize: 14,
    color: '#3797EF',
    marginTop: 4,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  postCommentButton: {
    padding: 8,
  },
});



