// services/searchHistoryService.js - Search history management
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = '@search_history';
const MAX_HISTORY_ITEMS = 20;

class SearchHistoryService {
  /**
   * Get recent searches
   * @returns {Promise<Array<string>>} Array of recent search queries
   */
  static async getRecentSearches() {
    try {
      const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (!historyJson) return [];
      
      const history = JSON.parse(historyJson);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
  }

  /**
   * Add a search to history
   * @param {string} query - Search query to add
   * @returns {Promise<void>}
   */
  static async addSearch(query) {
    try {
      if (!query || query.trim().length === 0) return;
      
      const trimmedQuery = query.trim();
      const history = await this.getRecentSearches();
      
      // Remove if already exists (to move to top)
      const filtered = history.filter(q => q.toLowerCase() !== trimmedQuery.toLowerCase());
      
      // Add to beginning
      const updated = [trimmedQuery, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error adding search to history:', error);
    }
  }

  /**
   * Clear all search history
   * @returns {Promise<void>}
   */
  static async clearHistory() {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }

  /**
   * Remove a specific search from history
   * @param {string} query - Search query to remove
   * @returns {Promise<void>}
   */
  static async removeSearch(query) {
    try {
      const history = await this.getRecentSearches();
      const filtered = history.filter(q => q.toLowerCase() !== query.toLowerCase());
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing search from history:', error);
    }
  }
}

export default SearchHistoryService;


