// services/tmdbService.js - TMDB API integration for movie reviews
const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class TMDBService {
  /**
   * Search movies by query
   * @param {string} query - Search query
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} Search results
   */
  static async searchMovies(query, page = 1) {
    try {
      if (!TMDB_API_KEY) {
        console.warn('⚠️ TMDB_API_KEY not set, returning mock data');
        return this.getMockSearchResults(query);
      }

      const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
        params: {
          api_key: TMDB_API_KEY,
          query: query,
          page: page,
          language: 'en-US'
        }
      });

      return {
        results: response.data.results.map(movie => ({
          id: movie.id,
          title: movie.title,
          releaseDate: movie.release_date,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          poster: movie.poster_path 
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
            : null,
          backdrop: movie.backdrop_path 
            ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` 
            : null,
          overview: movie.overview,
          rating: movie.vote_average
        })),
        totalPages: response.data.total_pages,
        totalResults: response.data.total_results,
        page: response.data.page
      };
    } catch (error) {
      console.error('TMDB search error:', error);
      throw new Error('Failed to search movies');
    }
  }

  /**
   * Get movie details by ID
   * @param {number} movieId - TMDB movie ID
   * @returns {Promise<Object>} Movie details
   */
  static async getMovieDetails(movieId) {
    try {
      if (!TMDB_API_KEY) {
        console.warn('⚠️ TMDB_API_KEY not set, returning mock data');
        return this.getMockMovieDetails(movieId);
      }

      const [movieResponse, creditsResponse, videosResponse] = await Promise.all([
        axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
          params: {
            api_key: TMDB_API_KEY,
            language: 'en-US'
          }
        }),
        axios.get(`${TMDB_BASE_URL}/movie/${movieId}/credits`, {
          params: {
            api_key: TMDB_API_KEY
          }
        }),
        axios.get(`${TMDB_BASE_URL}/movie/${movieId}/videos`, {
          params: {
            api_key: TMDB_API_KEY,
            language: 'en-US'
          }
        })
      ]);

      const movie = movieResponse.data;
      const credits = creditsResponse.data;
      const videos = videosResponse.data;

      // Get director
      const director = credits.crew.find(person => person.job === 'Director');

      // Find trailer (prefer official trailer, then any trailer, then teaser)
      let trailer = null;
      const officialTrailer = videos.results.find(v => 
        v.type === 'Trailer' && v.official === true && v.site === 'YouTube'
      );
      const anyTrailer = videos.results.find(v => 
        v.type === 'Trailer' && v.site === 'YouTube'
      );
      const teaser = videos.results.find(v => 
        v.type === 'Teaser' && v.site === 'YouTube'
      );
      
      trailer = officialTrailer || anyTrailer || teaser;
      const trailerUrl = trailer 
        ? `https://www.youtube.com/watch?v=${trailer.key}`
        : null;

      return {
        id: movie.id,
        title: movie.title,
        releaseDate: movie.release_date,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        poster: movie.poster_path 
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
          : null,
        backdrop: movie.backdrop_path 
          ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` 
          : null,
        overview: movie.overview,
        rating: movie.vote_average,
        runtime: movie.runtime, // in minutes
        genres: movie.genres.map(g => g.name),
        director: director ? director.name : null,
        cast: credits.cast.slice(0, 5).map(actor => actor.name),
        externalUrl: `https://www.themoviedb.org/movie/${movie.id}`,
        trailerUrl: trailerUrl
      };
    } catch (error) {
      console.error('TMDB movie details error:', error);
      throw new Error('Failed to get movie details');
    }
  }

  /**
   * Mock search results for development
   */
  static getMockSearchResults(query) {
    return {
      results: [
        {
          id: 27205,
          title: 'Inception',
          releaseDate: '2010-07-16',
          year: 2010,
          poster: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
          overview: 'A skilled thief is given a chance at redemption...',
          rating: 8.8
        }
      ],
      totalPages: 1,
      totalResults: 1,
      page: 1
    };
  }

  /**
   * Mock movie details for development
   */
  static getMockMovieDetails(movieId) {
    return {
      id: movieId,
      title: 'Inception',
      releaseDate: '2010-07-16',
      year: 2010,
      poster: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
      overview: 'A skilled thief is given a chance at redemption...',
      rating: 8.8,
      runtime: 148,
      genres: ['Sci-Fi', 'Action', 'Thriller'],
      director: 'Christopher Nolan',
      cast: ['Leonardo DiCaprio', 'Marion Cotillard', 'Tom Hardy'],
      externalUrl: `https://www.themoviedb.org/movie/${movieId}`,
      trailerUrl: 'https://www.youtube.com/watch?v=YoHD9XEInc0'
    };
  }
}

module.exports = TMDBService;

