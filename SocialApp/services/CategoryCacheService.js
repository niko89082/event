// services/CategoryCacheService.js - Phase 1: Simple caching for category data
class CategoryCacheService {
  constructor() {
    this.cache = {
      categoryCounts: null,
      categoryEvents: new Map(),
      timestamps: new Map(),
    };
    
    // Cache duration: 5 minutes
    this.CACHE_DURATION = 5 * 60 * 1000;
  }

  // Check if cache entry is still valid
  isCacheValid(key) {
    const timestamp = this.cache.timestamps.get(key);
    if (!timestamp) return false;
    
    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  // Category counts caching
  setCategoryCounts(counts) {
    this.cache.categoryCounts = counts;
    this.cache.timestamps.set('categoryCounts', Date.now());
  }

  getCategoryCounts() {
    if (!this.isCacheValid('categoryCounts')) {
      this.cache.categoryCounts = null;
      return null;
    }
    return this.cache.categoryCounts;
  }

  // Category events caching
  setCategoryEvents(category, events) {
    const key = `events_${category}`;
    this.cache.categoryEvents.set(key, events);
    this.cache.timestamps.set(key, Date.now());
  }

  getCachedEvents(category) {
    const key = `events_${category}`;
    if (!this.isCacheValid(key)) {
      this.cache.categoryEvents.delete(key);
      return null;
    }
    return this.cache.categoryEvents.get(key);
  }

  // Clear specific category cache
  clearCategoryCache(category) {
    const key = `events_${category}`;
    this.cache.categoryEvents.delete(key);
    this.cache.timestamps.delete(key);
  }

  // Clear all cache
  clearAllCache() {
    this.cache.categoryCounts = null;
    this.cache.categoryEvents.clear();
    this.cache.timestamps.clear();
  }

  // Debug: Get cache status
  getCacheStatus() {
    const now = Date.now();
    const status = {
      categoryCounts: {
        exists: !!this.cache.categoryCounts,
        valid: this.isCacheValid('categoryCounts'),
        age: this.cache.timestamps.get('categoryCounts') 
          ? now - this.cache.timestamps.get('categoryCounts') 
          : null
      },
      categoryEvents: {
        count: this.cache.categoryEvents.size,
        entries: Array.from(this.cache.categoryEvents.keys()).map(key => ({
          key,
          valid: this.isCacheValid(key),
          age: this.cache.timestamps.get(key) 
            ? now - this.cache.timestamps.get(key) 
            : null
        }))
      }
    };
    
    return status;
  }
}

// Export singleton instance
export default new CategoryCacheService();