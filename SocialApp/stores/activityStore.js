// stores/activityStore.js - Activity Feed State Management
import { create } from 'zustand';
import api from '../services/api';

const useActivityStore = create((set, get) => ({
  // Activity storage
  activities: new Map(),
  loading: false,
  error: null,
  
  // Action processing states
  processingActions: new Set(),

  /* ═══════════════════════════════════════════════════════════════════
     CORE ACTIVITY MANAGEMENT
  ══════════════════════════════════════════════════════════════════ */

  // Add activity to store
  addActivity: (activity) => {
    const { activities } = get();
    const newActivities = new Map(activities);
    newActivities.set(activity._id, activity);
    set({ activities: newActivities });
    
    console.log('📝 Activity added to store:', {
      activityId: activity._id,
      activityType: activity.activityType,
      totalActivities: newActivities.size
    });
  },

  // Update existing activity
  updateActivity: (activityId, updates) => {
    const { activities } = get();
    const activity = activities.get(activityId);
    
    if (activity) {
      const newActivities = new Map(activities);
      newActivities.set(activityId, { ...activity, ...updates });
      set({ activities: newActivities });
      
      console.log('🔄 Activity updated in store:', {
        activityId,
        updates: Object.keys(updates)
      });
    }
  },

  // Get activity by ID
  getActivity: (activityId) => {
    const { activities } = get();
    return activities.get(activityId);
  },

  // Remove activity from store
  removeActivity: (activityId) => {
    const { activities } = get();
    const newActivities = new Map(activities);
    newActivities.delete(activityId);
    set({ activities: newActivities });
    
    console.log('🗑️ Activity removed from store:', { activityId });
  },

  // Sync activities from feed API response
  syncActivitiesFromFeed: (newActivities) => {
    const { activities } = get();
    const updatedActivities = new Map(activities);
    
    let addedCount = 0;
    let updatedCount = 0;
    
    newActivities.forEach(activity => {
      if (updatedActivities.has(activity._id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      updatedActivities.set(activity._id, activity);
    });
    
    set({ activities: updatedActivities });
    
    console.log('🔄 Activities synced from feed:', {
      added: addedCount,
      updated: updatedCount,
      total: updatedActivities.size
    });
  },

  // Clear all activities
  clearActivities: () => {
    console.log('🧹 Clearing all activities from store');
    set({ activities: new Map(), loading: false, error: null });
  },

  /* ═══════════════════════════════════════════════════════════════════
     ACTIVITY ACTIONS (Friend Requests, Event Invitations, etc.)
  ══════════════════════════════════════════════════════════════════ */

  // Handle activity actions with optimistic updates
  handleActivityAction: async (activityId, action, actionData = {}) => {
    const { activities, processingActions } = get();
    const activity = activities.get(activityId);

    if (!activity) {
      console.warn('⚠️ Activity not found for action:', { activityId, action });
      return false;
    }

    if (processingActions.has(activityId)) {
      console.warn('⚠️ Action already processing for activity:', { activityId, action });
      return false;
    }

    console.log('🎯 === ACTIVITY ACTION START ===');
    console.log('📝 Action details:', {
      activityId,
      action,
      activityType: activity.activityType,
      actionData
    });

    // Mark as processing
    const newProcessingActions = new Set(processingActions);
    newProcessingActions.add(activityId);
    set({ processingActions: newProcessingActions });

    try {
      // Optimistic update
      const optimisticUpdates = getOptimisticUpdates(activity, action);
      if (optimisticUpdates) {
        get().updateActivity(activityId, optimisticUpdates);
      }

      // Make API call based on action type
      const result = await performActivityAction(action, activity, actionData);
      
      console.log('📥 Action API response:', {
        action,
        success: result.success,
        data: result.data
      });

      // Update with server response
      if (result.success && result.data) {
        get().updateActivity(activityId, result.data);
      }

      return result;

    } catch (error) {
      console.error('❌ Activity action error:', {
        action,
        activityId,
        error: error.message
      });

      // Revert optimistic update on error
      const revertUpdates = getRevertUpdates(activity, action);
      if (revertUpdates) {
        get().updateActivity(activityId, revertUpdates);
      }

      throw error;

    } finally {
      // Remove from processing
      const newProcessingActions = new Set(processingActions);
      newProcessingActions.delete(activityId);
      set({ processingActions: newProcessingActions });
    }
  },

  // Check if action is processing
  isActionProcessing: (activityId) => {
    const { processingActions } = get();
    return processingActions.has(activityId);
  },

  /* ═══════════════════════════════════════════════════════════════════
     UTILITY FUNCTIONS
  ══════════════════════════════════════════════════════════════════ */

  // Get activities as array (useful for FlatList)
  getActivitiesArray: () => {
    const { activities } = get();
    const activitiesArray = Array.from(activities.values());
    
    console.log('📋 Retrieved activities array:', {
      totalActivities: activitiesArray.length,
      activityTypes: activitiesArray.reduce((acc, activity) => {
        acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
        return acc;
      }, {})
    });
    
    return activitiesArray;
  },

  // Get activities by type
  getActivitiesByType: (activityType = 'all') => {
    const { activities } = get();
    const allActivities = Array.from(activities.values());
    
    if (activityType === 'all') {
      return allActivities;
    }
    
    const filteredActivities = allActivities.filter(activity => activity.activityType === activityType);
    
    console.log('🔍 Retrieved activities by type:', {
      requestedType: activityType,
      filteredCount: filteredActivities.length,
      totalCount: allActivities.length
    });
    
    return filteredActivities;
  },

  // Get store statistics
  getStoreStats: () => {
    const { activities, processingActions } = get();
    const activitiesArray = Array.from(activities.values());
    
    const stats = {
      totalActivities: activitiesArray.length,
      processingActions: processingActions.size,
      activityTypes: activitiesArray.reduce((acc, activity) => {
        acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
        return acc;
      }, {}),
      actionableActivities: activitiesArray.filter(a => a.metadata?.actionable).length,
      groupedActivities: activitiesArray.filter(a => a.metadata?.grouped).length
    };
    
    console.log('📊 Store statistics:', stats);
    return stats;
  }
}));

/* ═══════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════ */

// Get optimistic updates for immediate UI feedback
const getOptimisticUpdates = (activity, action) => {
  switch (action) {
    case 'accept_friend_request':
      return {
        metadata: {
          ...activity.metadata,
          actionProcessing: true,
          actionLabel: 'Accepting...'
        }
      };
      
    case 'decline_friend_request':
      return {
        metadata: {
          ...activity.metadata,
          actionProcessing: true,
          actionLabel: 'Declining...'
        }
      };
      
    case 'send_friend_request':
      return {
        data: {
          ...activity.data,
          canAddFriend: false,
          friendRequestSent: true
        },
        metadata: {
          ...activity.metadata,
          actionProcessing: true,
          actionLabel: 'Sending...'
        }
      };
      
    case 'accept_event_invitation':
      return {
        metadata: {
          ...activity.metadata,
          actionProcessing: true,
          actionLabel: 'Accepting...'
        }
      };
      
    case 'decline_event_invitation':
      return {
        metadata: {
          ...activity.metadata,
          actionProcessing: true,
          actionLabel: 'Declining...'
        }
      };
      
    default:
      return {
        metadata: {
          ...activity.metadata,
          actionProcessing: true
        }
      };
  }
};

// Get revert updates for failed actions
const getRevertUpdates = (activity, action) => {
  switch (action) {
    case 'send_friend_request':
      return {
        data: {
          ...activity.data,
          canAddFriend: true,
          friendRequestSent: false
        },
        metadata: {
          ...activity.metadata,
          actionProcessing: false,
          actionLabel: undefined
        }
      };
      
    default:
      return {
        metadata: {
          ...activity.metadata,
          actionProcessing: false,
          actionLabel: undefined
        }
      };
  }
};

// Perform the actual API call for activity actions
const performActivityAction = async (action, activity, actionData) => {
  let endpoint;
  let method = 'POST';
  let data = {};

  switch (action) {
    case 'accept_friend_request':
      endpoint = `/api/friends/accept`;
      data = { requesterId: activity.data.requester._id };
      break;
      
    case 'decline_friend_request':
      endpoint = `/api/friends/decline`;
      data = { requesterId: activity.data.requester._id };
      break;
      
    case 'send_friend_request':
      endpoint = `/api/friends/request`;
      data = { targetUserId: activity.data.uploader._id };
      break;
      
    case 'accept_event_invitation':
      endpoint = `/api/events/attend/${activity.data.event._id}`;
      break;
      
    case 'decline_event_invitation':
      endpoint = `/api/events/invite/${activity.data.event._id}`;
      method = 'DELETE';
      break;
      
    case 'view_event':
      // No API call needed, just return success
      return { success: true, action: 'navigation' };
      
    case 'view_profile':
      // No API call needed, just return success
      return { success: true, action: 'navigation' };
      
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  console.log('📡 Making API call:', {
    method,
    endpoint,
    data
  });

  const response = await api({
    method,
    url: endpoint,
    data: Object.keys(data).length > 0 ? data : undefined
  });

  return {
    success: true,
    data: response.data,
    action
  };
};

export default useActivityStore;