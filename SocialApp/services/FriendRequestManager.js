// CREATE THIS FILE: services/FriendRequestManager.js
import api from './api';

class FriendRequestManager {
  
  static listeners = new Map();
  
  static addListener(componentId, callback) {
    this.listeners.set(componentId, callback);
    console.log(`🔔 FriendRequestManager: Registered listener ${componentId}`);
  }
  
  static removeListener(componentId) {
    this.listeners.delete(componentId);
    console.log(`🔕 FriendRequestManager: Removed listener ${componentId}`);
  }
  
  static broadcastStateChange(eventType, data) {
    console.log(`📢 FriendRequestManager: Broadcasting ${eventType}`, data);
    
    this.listeners.forEach((callback, componentId) => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error(`❌ FriendRequestManager: Error in listener ${componentId}:`, error);
      }
    });
  }

  static async acceptRequest(requesterId, currentUserId, notificationId = null, activityId = null, options = {}) {
    const operationId = `accept_${requesterId}_${Date.now()}`;
    
    console.log(`🤝 FriendRequestManager: Starting accept operation ${operationId}`, {
      requesterId,
      currentUserId,
      notificationId,
      activityId,
      options
    });

    try {
      this.broadcastStateChange('friend_request_accepting', {
        requesterId,
        currentUserId,
        notificationId,
        activityId,
        operationId,
        status: 'processing'
      });

      console.log(`📡 FriendRequestManager: Making API call to accept friend request`);
      const response = await api.post(`/api/friends/quick-accept/${requesterId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to accept friend request');
      }

      const successData = {
        requesterId,
        currentUserId,
        notificationId,
        activityId,
        operationId,
        status: 'accepted',
        friendData: response.data.data || {},
        message: response.data.message || `You are now friends!`,
        timestamp: new Date().toISOString()
      };

      this.broadcastStateChange('friend_request_accepted', successData);

      console.log(`✅ FriendRequestManager: Accept operation ${operationId} completed successfully`);
      return successData;

    } catch (error) {
      console.error(`❌ FriendRequestManager: Accept operation ${operationId} failed:`, error);

      this.broadcastStateChange('friend_request_error', {
        requesterId,
        currentUserId,
        notificationId,
        activityId,
        operationId,
        action: 'accept',
        error: error.message || 'Failed to accept friend request'
      });

      throw error;
    }
  }

  static async rejectRequest(requesterId, currentUserId, notificationId = null, activityId = null, options = {}) {
    const operationId = `reject_${requesterId}_${Date.now()}`;
    
    console.log(`❌ FriendRequestManager: Starting reject operation ${operationId}`, {
      requesterId,
      currentUserId,
      notificationId,
      activityId,
      options
    });

    try {
      this.broadcastStateChange('friend_request_rejecting', {
        requesterId,
        currentUserId,
        notificationId,
        activityId,
        operationId,
        status: 'processing'
      });

      console.log(`📡 FriendRequestManager: Making API call to reject friend request`);
      const response = await api.post(`/api/friends/quick-reject/${requesterId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to reject friend request');
      }

      const rejectionData = {
        requesterId,
        currentUserId,
        notificationId,
        activityId,
        operationId,
        status: 'rejected',
        message: response.data.message || `Friend request rejected`,
        timestamp: new Date().toISOString(),
        shouldRemove: options.autoRemove !== false
      };

      this.broadcastStateChange('friend_request_rejected', rejectionData);

      console.log(`✅ FriendRequestManager: Reject operation ${operationId} completed successfully`);
      return rejectionData;

    } catch (error) {
      console.error(`❌ FriendRequestManager: Reject operation ${operationId} failed:`, error);

      this.broadcastStateChange('friend_request_error', {
        requesterId,
        currentUserId,
        notificationId,
        activityId,
        operationId,
        action: 'reject',
        error: error.message || 'Failed to reject friend request'
      });

      throw error;
    }
  }

  static async cancelSentRequest(targetUserId, currentUserId, options = {}) {
    const operationId = `cancel_${targetUserId}_${Date.now()}`;
    
    console.log(`🚫 FriendRequestManager: Starting cancel operation ${operationId}`, {
      targetUserId,
      currentUserId,
      options
    });

    try {
      this.broadcastStateChange('friend_request_cancelling', {
        targetUserId,
        currentUserId,
        operationId,
        status: 'processing'
      });

      console.log(`📡 FriendRequestManager: Making API call to cancel friend request`);
      const response = await api.delete(`/api/friends/cancel/${targetUserId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to cancel friend request');
      }

      const cancelData = {
        targetUserId,
        currentUserId,
        operationId,
        status: 'cancelled',
        message: response.data.message || `Friend request cancelled`,
        timestamp: new Date().toISOString(),
        data: response.data.data || {}
      };

      this.broadcastStateChange('friend_request_cancelled', cancelData);

      console.log(`✅ FriendRequestManager: Cancel operation ${operationId} completed successfully`);
      return cancelData;

    } catch (error) {
      console.error(`❌ FriendRequestManager: Cancel operation ${operationId} failed:`, error);

      this.broadcastStateChange('friend_request_error', {
        targetUserId,
        currentUserId,
        operationId,
        action: 'cancel',
        error: error.message || 'Failed to cancel friend request'
      });

      throw error;
    }
  }

  static async sendRequest(targetUserId, currentUserId, message = '', options = {}) {
    const operationId = `send_${targetUserId}_${Date.now()}`;
    
    console.log(`📤 FriendRequestManager: Starting send operation ${operationId}`, {
      targetUserId,
      currentUserId,
      message,
      options
    });

    try {
      this.broadcastStateChange('friend_request_sending', {
        targetUserId,
        currentUserId,
        operationId,
        status: 'processing'
      });

      console.log(`📡 FriendRequestManager: Making API call to send friend request`);
      const response = await api.post(`/api/friends/request/${targetUserId}`, {
        message: message || 'I would like to add you as a friend.'
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to send friend request');
      }

      const sendData = {
        targetUserId,
        currentUserId,
        operationId,
        status: 'sent',
        message: response.data.message || `Friend request sent`,
        timestamp: new Date().toISOString(),
        data: response.data.data || {}
      };

      this.broadcastStateChange('friend_request_sent', sendData);

      console.log(`✅ FriendRequestManager: Send operation ${operationId} completed successfully`);
      return sendData;

    } catch (error) {
      console.error(`❌ FriendRequestManager: Send operation ${operationId} failed:`, error);

      this.broadcastStateChange('friend_request_error', {
        targetUserId,
        currentUserId,
        operationId,
        action: 'send',
        error: error.message || 'Failed to send friend request'
      });

      throw error;
    }
  }

  static async removeFriend(targetUserId, currentUserId, options = {}) {
    const operationId = `remove_${targetUserId}_${Date.now()}`;
    
    console.log(`💔 FriendRequestManager: Starting remove friend operation ${operationId}`, {
      targetUserId,
      currentUserId,
      options
    });

    try {
      this.broadcastStateChange('friend_removing', {
        targetUserId,
        currentUserId,
        operationId,
        status: 'processing'
      });

      console.log(`📡 FriendRequestManager: Making API call to remove friend`);
      const response = await api.delete(`/api/friends/${targetUserId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to remove friend');
      }

      const removeData = {
        targetUserId,
        currentUserId,
        operationId,
        status: 'removed',
        message: response.data.message || 'Friend removed',
        timestamp: new Date().toISOString()
      };

      this.broadcastStateChange('friend_removed', removeData);

      console.log(`✅ FriendRequestManager: Remove operation ${operationId} completed successfully`);
      return removeData;

    } catch (error) {
      console.error(`❌ FriendRequestManager: Remove operation ${operationId} failed:`, error);

      this.broadcastStateChange('friend_request_error', {
        targetUserId,
        currentUserId,
        operationId,
        action: 'remove',
        error: error.message || 'Failed to remove friend'
      });

      throw error;
    }
  }

  static async getFriendshipStatus(userId, currentUserId) {
    try {
      const response = await api.get(`/api/friends/status/${userId}`);
      return response.data;
    } catch (error) {
      console.error('❌ FriendRequestManager: Error getting friendship status:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  static refreshAllComponents() {
    this.broadcastStateChange('refresh_required', {
      timestamp: new Date().toISOString(),
      reason: 'manual_refresh'
    });
  }

  static cleanup() {
    console.log('🧹 FriendRequestManager: Cleaning up listeners');
    this.listeners.clear();
  }
}

export default FriendRequestManager;