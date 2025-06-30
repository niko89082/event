// services/memoryService.js - API service for memory interactions
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

class MemoryService {
  constructor() {
    this.baseURL = `http://${API_BASE_URL}:3000/api`;
  }

  // ✅ Get authentication headers
  async getAuthHeaders() {
    const token = await AsyncStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // ✅ Memory API Methods
  async getMemory(memoryId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memories/${memoryId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch memory: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching memory:', error);
      throw error;
    }
  }

  async getMemoryPhotos(memoryId, page = 1, limit = 20) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/memories/${memoryId}/photos?page=${page}&limit=${limit}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching memory photos:', error);
      throw error;
    }
  }

  async uploadPhotoToMemory(memoryId, photoData) {
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('photo', {
        uri: photoData.uri,
        type: photoData.type || 'image/jpeg',
        name: photoData.name || 'photo.jpg',
      });

      if (photoData.caption) {
        formData.append('caption', photoData.caption);
      }

      if (photoData.taggedUsers && photoData.taggedUsers.length > 0) {
        formData.append('taggedUsers', JSON.stringify(photoData.taggedUsers));
      }

      const response = await fetch(`${this.baseURL}/memories/${memoryId}/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload photo: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error uploading photo:', error);
      throw error;
    }
  }

  // ✅ Photo Interaction API Methods
  async getPhotoDetails(photoId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memory-photos/${photoId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photo: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching photo details:', error);
      throw error;
    }
  }

  async togglePhotoLike(photoId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memory-photos/${photoId}/like`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle like: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error toggling like:', error);
      throw error;
    }
  }

  async getPhotoLikes(photoId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memory-photos/${photoId}/likes`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch likes: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching likes:', error);
      throw error;
    }
  }

  async addPhotoComment(photoId, text, tags = []) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memory-photos/${photoId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, tags }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      throw error;
    }
  }

  async getPhotoComments(photoId, page = 1, limit = 20) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/memory-photos/${photoId}/comments?page=${page}&limit=${limit}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching comments:', error);
      throw error;
    }
  }

  async editPhotoComment(photoId, commentId, text) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/memory-photos/${photoId}/comments/${commentId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to edit comment: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error editing comment:', error);
      throw error;
    }
  }

  async deletePhotoComment(photoId, commentId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/memory-photos/${photoId}/comments/${commentId}`,
        {
          method: 'DELETE',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete comment: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error deleting comment:', error);
      throw error;
    }
  }

  async reportPhoto(photoId, reason) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memory-photos/${photoId}/report`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error(`Failed to report photo: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error reporting photo:', error);
      throw error;
    }
  }

  // ✅ Bulk Operations
  async getMemoryStatistics(memoryId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memories/${memoryId}/stats`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching memory stats:', error);
      throw error;
    }
  }

  async bulkLikePhotos(photoIds) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/memory-photos/bulk-like`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ photoIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk like photos: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error bulk liking photos:', error);
      throw error;
    }
  }

  // ✅ Cache Management
  async clearMemoryCache(memoryId) {
    try {
      await AsyncStorage.removeItem(`memory_${memoryId}`);
      await AsyncStorage.removeItem(`memory_photos_${memoryId}`);
    } catch (error) {
      console.error('❌ Error clearing memory cache:', error);
    }
  }

  async cacheMemoryData(memoryId, data) {
    try {
      await AsyncStorage.setItem(
        `memory_${memoryId}`,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('❌ Error caching memory data:', error);
    }
  }

  async getCachedMemoryData(memoryId, maxAge = 5 * 60 * 1000) { // 5 minutes
    try {
      const cached = await AsyncStorage.getItem(`memory_${memoryId}`);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > maxAge) {
        await AsyncStorage.removeItem(`memory_${memoryId}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error getting cached memory data:', error);
      return null;
    }
  }
}

export default new MemoryService();