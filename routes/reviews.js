// routes/reviews.js - Review API routes for movies and songs
const express = require('express');
const protect = require('../middleware/auth');
const TMDBService = require('../services/tmdbService');
const SpotifyService = require('../services/spotifyService');
const Photo = require('../models/Photo');

const router = express.Router();

/**
 * Search movies via TMDB
 * GET /api/reviews/search-movies?query=...&page=...
 */
router.get('/search-movies', protect, async (req, res) => {
  try {
    const { query, page = 1 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await TMDBService.searchMovies(query.trim(), parseInt(page));

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Movie search error:', error);
    res.status(500).json({ 
      message: 'Failed to search movies',
      error: error.message 
    });
  }
});

/**
 * Get movie details by TMDB ID
 * GET /api/reviews/movie/:tmdbId
 */
router.get('/movie/:tmdbId', protect, async (req, res) => {
  try {
    const { tmdbId } = req.params;

    if (!tmdbId) {
      return res.status(400).json({ message: 'Movie ID is required' });
    }

    const movie = await TMDBService.getMovieDetails(parseInt(tmdbId));

    res.json({
      success: true,
      movie
    });
  } catch (error) {
    console.error('Movie details error:', error);
    res.status(500).json({ 
      message: 'Failed to get movie details',
      error: error.message 
    });
  }
});

/**
 * Search songs via Spotify
 * GET /api/reviews/search-songs?query=...&limit=...&offset=...
 */
router.get('/search-songs', protect, async (req, res) => {
  try {
    const { query, limit = 20, offset = 0 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await SpotifyService.searchTracks(
      query.trim(), 
      parseInt(limit), 
      parseInt(offset)
    );

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Song search error:', error);
    res.status(500).json({ 
      message: 'Failed to search songs',
      error: error.message 
    });
  }
});

/**
 * Get song details by Spotify ID
 * GET /api/reviews/song/:spotifyId
 */
router.get('/song/:spotifyId', protect, async (req, res) => {
  try {
    const { spotifyId } = req.params;

    if (!spotifyId) {
      return res.status(400).json({ message: 'Song ID is required' });
    }

    const track = await SpotifyService.getTrackDetails(spotifyId);

    res.json({
      success: true,
      track
    });
  } catch (error) {
    console.error('Song details error:', error);
    res.status(500).json({ 
      message: 'Failed to get song details',
      error: error.message 
    });
  }
});

/**
 * Get reviews for a movie by TMDB ID
 * GET /api/reviews/movie/:tmdbId/reviews?page=...&limit=...
 */
router.get('/movie/:tmdbId/reviews', protect, async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!tmdbId) {
      return res.status(400).json({ message: 'Movie ID is required' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find photos with reviews for this movie
    const reviews = await Photo.find({
      'review.type': 'movie',
      'review.mediaId': tmdbId.toString(),
      isDeleted: false
    })
      .populate('user', '_id username profilePicture')
      .populate('comments.user', '_id username profilePicture')
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Photo.countDocuments({
      'review.type': 'movie',
      'review.mediaId': tmdbId.toString(),
      isDeleted: false
    });

    // Calculate average rating
    const allReviews = await Photo.find({
      'review.type': 'movie',
      'review.mediaId': tmdbId.toString(),
      'review.rating': { $exists: true, $ne: null },
      isDeleted: false
    })
      .select('review.rating')
      .lean();

    const ratings = allReviews
      .map(r => r.review?.rating)
      .filter(r => r !== null && r !== undefined);
    
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    res.json({
      success: true,
      reviews: reviews.map(r => ({
        _id: r._id,
        user: r.user,
        textContent: r.textContent,
        caption: r.caption,
        review: r.review,
        likes: r.likes || [],
        likeCount: r.likes?.length || 0,
        commentCount: r.comments?.length || 0,
        comments: r.comments || [],
        uploadDate: r.uploadDate,
        createdAt: r.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        totalReviews: total,
        averageRating: averageRating ? parseFloat(averageRating.toFixed(2)) : null,
        ratingCount: ratings.length
      }
    });
  } catch (error) {
    console.error('Movie reviews error:', error);
    res.status(500).json({ 
      message: 'Failed to get movie reviews',
      error: error.message 
    });
  }
});

/**
 * Get reviews for a song by Spotify ID
 * GET /api/reviews/song/:spotifyId/reviews?page=...&limit=...
 */
router.get('/song/:spotifyId/reviews', protect, async (req, res) => {
  try {
    const { spotifyId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!spotifyId) {
      return res.status(400).json({ message: 'Song ID is required' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find photos with reviews for this song
    const reviews = await Photo.find({
      'review.type': 'song',
      'review.mediaId': spotifyId,
      isDeleted: false
    })
      .populate('user', '_id username profilePicture')
      .populate('comments.user', '_id username profilePicture')
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Photo.countDocuments({
      'review.type': 'song',
      'review.mediaId': spotifyId,
      isDeleted: false
    });

    // Calculate average rating
    const allReviews = await Photo.find({
      'review.type': 'song',
      'review.mediaId': spotifyId,
      'review.rating': { $exists: true, $ne: null },
      isDeleted: false
    })
      .select('review.rating')
      .lean();

    const ratings = allReviews
      .map(r => r.review?.rating)
      .filter(r => r !== null && r !== undefined);
    
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    res.json({
      success: true,
      reviews: reviews.map(r => ({
        _id: r._id,
        user: r.user,
        textContent: r.textContent,
        caption: r.caption,
        review: r.review,
        likes: r.likes || [],
        likeCount: r.likes?.length || 0,
        commentCount: r.comments?.length || 0,
        comments: r.comments || [],
        uploadDate: r.uploadDate,
        createdAt: r.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        totalReviews: total,
        averageRating: averageRating ? parseFloat(averageRating.toFixed(2)) : null,
        ratingCount: ratings.length
      }
    });
  } catch (error) {
    console.error('Song reviews error:', error);
    res.status(500).json({ 
      message: 'Failed to get song reviews',
      error: error.message 
    });
  }
});

module.exports = router;

