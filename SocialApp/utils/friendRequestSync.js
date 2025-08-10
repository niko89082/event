
// utils/friendRequestSync.js - New utility for cross-component sync
class FriendRequestSyncManager {
  constructor() {
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Friend request sync listener error:', error);
      }
    });
  }

  // Called after successful friend request actions
  onFriendRequestAction(action, userId, data) {
    this.notify({
      type: 'FRIEND_REQUEST_ACTION',
      action,
      userId,
      data,
      timestamp: Date.now()
    });
  }
}

// Export singleton instance
export const friendRequestSync = new FriendRequestSyncManager();