// services/spotifyService.js - Spotify API integration for song reviews
const axios = require('axios');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';

class SpotifyService {
  // Cache for access token
  static accessToken = null;
  static tokenExpiry = null;

  /**
   * Get access token using client credentials flow
   * @returns {Promise<string>} Access token
   */
  static async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.warn('⚠️ Spotify credentials not set, using mock data');
        this.accessToken = 'mock_token';
        this.tokenExpiry = Date.now() + 3600000; // 1 hour
        return this.accessToken;
      }

      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer

      return this.accessToken;
    } catch (error) {
      console.error('Spotify token error:', error);
      throw new Error('Failed to get Spotify access token');
    }
  }

  /**
   * Search tracks by query
   * @param {string} query - Search query
   * @param {number} limit - Number of results (default: 20)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} Search results
   */
  static async searchTracks(query, limit = 20, offset = 0) {
    try {
      const token = await this.getAccessToken();

      if (token === 'mock_token') {
        return this.getMockSearchResults(query);
      }

      const response = await axios.get(`${SPOTIFY_BASE_URL}/search`, {
        params: {
          q: query,
          type: 'track',
          limit: limit,
          offset: offset
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return {
        tracks: response.data.tracks.items.map(track => ({
          id: track.id,
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          albumArt: track.album.images[0]?.url || null,
          duration: track.duration_ms, // in milliseconds
          releaseDate: track.album.release_date,
          year: track.album.release_date 
            ? new Date(track.album.release_date).getFullYear() 
            : null,
          externalUrl: track.external_urls.spotify,
          previewUrl: track.preview_url
        })),
        total: response.data.tracks.total,
        limit: response.data.tracks.limit,
        offset: response.data.tracks.offset
      };
    } catch (error) {
      console.error('Spotify search error:', error);
      throw new Error('Failed to search tracks');
    }
  }

  /**
   * Get track details by ID
   * @param {string} trackId - Spotify track ID
   * @returns {Promise<Object>} Track details
   */
  static async getTrackDetails(trackId) {
    try {
      const token = await this.getAccessToken();

      if (token === 'mock_token') {
        return this.getMockTrackDetails(trackId);
      }

      const response = await axios.get(`${SPOTIFY_BASE_URL}/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const track = response.data;

      return {
        id: track.id,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url || null,
        duration: track.duration_ms, // in milliseconds
        releaseDate: track.album.release_date,
        year: track.album.release_date 
          ? new Date(track.album.release_date).getFullYear() 
          : null,
        genres: track.album.genres || [],
        externalUrl: track.external_urls.spotify,
        previewUrl: track.preview_url
      };
    } catch (error) {
      console.error('Spotify track details error:', error);
      throw new Error('Failed to get track details');
    }
  }

  /**
   * Mock search results for development
   */
  static getMockSearchResults(query) {
    return {
      tracks: [
        {
          id: '4uLU6hMCjMI75M1A2tKUQC',
          name: 'Bohemian Rhapsody',
          artist: 'Queen',
          album: 'A Night at the Opera',
          albumArt: 'https://i.scdn.co/image/ab67616d0000b2734ce8b4e4256c4c4e3c8e8b4e',
          duration: 355000,
          releaseDate: '1975-10-31',
          year: 1975,
          externalUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'
        }
      ],
      total: 1,
      limit: 20,
      offset: 0
    };
  }

  /**
   * Mock track details for development
   */
  static getMockTrackDetails(trackId) {
    return {
      id: trackId,
      name: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      albumArt: 'https://i.scdn.co/image/ab67616d0000b2734ce8b4e4256c4c4e3c8e8b4e',
      duration: 355000,
      releaseDate: '1975-10-31',
      year: 1975,
      genres: ['Rock', 'Progressive Rock'],
      externalUrl: `https://open.spotify.com/track/${trackId}`
    };
  }
}

module.exports = SpotifyService;

