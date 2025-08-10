// CREATE THIS FILE: hooks/useFriendRequestManager.js
import { useEffect, useCallback, useRef, useState, useContext } from 'react';
import { Alert } from 'react-native';
import FriendRequestManager from '../services/FriendRequestManager';
import { AuthContext } from '../services/AuthContext';

export const useFriendRequestManager = (componentId, options = {}) => {
  const { currentUser } = useContext(AuthContext);
  const [processingActions, setProcessingActions] = useState(new Set());
  const [lastActionResult, setLastActionResult] = useState(null);
  const componentRef = useRef(componentId);

  const config = {
    showSuccessAlerts: options.showSuccessAlerts !== false,
    showErrorAlerts: options.showErrorAlerts !== false,
    autoRefresh: options.autoRefresh !== false,
    logEvents: options.logEvents !== false,
    ...options
  };

  const handleStateChange = useCallback((eventType, data) => {
    if (config.logEvents) {
      console.log(`🔔 ${componentId}: Received event ${eventType}`, data);
    }

    const operationId = data.operationId;

    switch (eventType) {
      case 'friend_request_accepting':
      case 'friend_request_rejecting':
      case 'friend_request_cancelling':
      case 'friend_request_sending':
        if (operationId) {
          setProcessingActions(prev => new Set(prev).add(operationId));
        }
        break;

      case 'friend_request_accepted':
        if (operationId) {
          setProcessingActions(prev => {
            const newSet = new Set(prev);
            newSet.delete(operationId);
            return newSet;
          });
        }
        
        setLastActionResult({
          type: 'success',
          action: 'accepted',
          data,
          timestamp: Date.now()
        });

        if (options.onAcceptSuccess) {
          options.onAcceptSuccess(data);
        }
        break;

      case 'friend_request_rejected':
        if (operationId) {
          setProcessingActions(prev => {
            const newSet = new Set(prev);
            newSet.delete(operationId);
            return newSet;
          });
        }
        
        setLastActionResult({
          type: 'success',
          action: 'rejected',
          data,
          timestamp: Date.now()
        });

        if (options.onRejectSuccess) {
          options.onRejectSuccess(data);
        }
        break;

      case 'friend_request_cancelled':
        if (operationId) {
          setProcessingActions(prev => {
            const newSet = new Set(prev);
            newSet.delete(operationId);
            return newSet;
          });
        }
        
        setLastActionResult({
          type: 'success',
          action: 'cancelled',
          data,
          timestamp: Date.now()
        });

        if (options.onCancelSuccess) {
          options.onCancelSuccess(data);
        }
        break;

      case 'friend_request_sent':
        if (operationId) {
          setProcessingActions(prev => {
            const newSet = new Set(prev);
            newSet.delete(operationId);
            return newSet;
          });
        }
        
        setLastActionResult({
          type: 'success',
          action: 'sent',
          data,
          timestamp: Date.now()
        });

        if (options.onSendSuccess) {
          options.onSendSuccess(data);
        }
        break;

      case 'friend_request_error':
        if (operationId) {
          setProcessingActions(prev => {
            const newSet = new Set(prev);
            newSet.delete(operationId);
            return newSet;
          });
        }
        
        setLastActionResult({
          type: 'error',
          action: data.action,
          error: data.error,
          data,
          timestamp: Date.now()
        });

        if (config.showErrorAlerts) {
          Alert.alert(
            'Error',
            data.error || 'An error occurred. Please try again.',
            [{ text: 'OK', style: 'default' }]
          );
        }

        if (options.onError) {
          options.onError(data);
        }
        break;

      case 'refresh_required':
        if (options.onRefreshRequired) {
          options.onRefreshRequired(data);
        }
        break;
    }
  }, [componentId, config, options]);

  useEffect(() => {
    console.log(`🔌 ${componentId}: Registering with FriendRequestManager`);
    FriendRequestManager.addListener(componentRef.current, handleStateChange);

    return () => {
      console.log(`🔌 ${componentId}: Unregistering from FriendRequestManager`);
      FriendRequestManager.removeListener(componentRef.current);
    };
  }, [handleStateChange]);

  const acceptRequest = useCallback(async (requesterId, notificationId = null, activityId = null, options = {}) => {
    if (!currentUser?._id) {
      throw new Error('User not authenticated');
    }

    try {
      return await FriendRequestManager.acceptRequest(
        requesterId,
        currentUser._id,
        notificationId,
        activityId,
        options
      );
    } catch (error) {
      console.error(`❌ ${componentId}: Accept request failed:`, error);
      throw error;
    }
  }, [currentUser, componentId]);

  const rejectRequest = useCallback(async (requesterId, notificationId = null, activityId = null, options = {}) => {
    if (!currentUser?._id) {
      throw new Error('User not authenticated');
    }

    try {
      return await FriendRequestManager.rejectRequest(
        requesterId,
        currentUser._id,
        notificationId,
        activityId,
        options
      );
    } catch (error) {
      console.error(`❌ ${componentId}: Reject request failed:`, error);
      throw error;
    }
  }, [currentUser, componentId]);

  const cancelSentRequest = useCallback(async (targetUserId, options = {}) => {
    if (!currentUser?._id) {
      throw new Error('User not authenticated');
    }

    try {
      return await FriendRequestManager.cancelSentRequest(
        targetUserId,
        currentUser._id,
        options
      );
    } catch (error) {
      console.error(`❌ ${componentId}: Cancel request failed:`, error);
      throw error;
    }
  }, [currentUser, componentId]);

  const sendRequest = useCallback(async (targetUserId, message = '', options = {}) => {
    if (!currentUser?._id) {
      throw new Error('User not authenticated');
    }

    try {
      return await FriendRequestManager.sendRequest(
        targetUserId,
        currentUser._id,
        message,
        options
      );
    } catch (error) {
      console.error(`❌ ${componentId}: Send request failed:`, error);
      throw error;
    }
  }, [currentUser, componentId]);

  const getFriendshipStatus = useCallback(async (userId) => {
    if (!currentUser?._id) {
      throw new Error('User not authenticated');
    }

    try {
      return await FriendRequestManager.getFriendshipStatus(userId, currentUser._id);
    } catch (error) {
      console.error(`❌ ${componentId}: Get friendship status failed:`, error);
      throw error;
    }
  }, [currentUser, componentId]);

  const refreshComponents = useCallback(() => {
    FriendRequestManager.refreshAllComponents();
  }, []);

  const isProcessing = useCallback((operationId = null) => {
    if (operationId) {
      return processingActions.has(operationId);
    }
    return processingActions.size > 0;
  }, [processingActions]);

  const clearLastResult = useCallback(() => {
    setLastActionResult(null);
  }, []);

  return {
    acceptRequest,
    rejectRequest,
    cancelSentRequest,
    sendRequest,
    getFriendshipStatus,
    refreshComponents,
    
    isProcessing,
    processingActions,
    lastActionResult,
    clearLastResult,
    
    currentUserId: currentUser?._id,
    isAuthenticated: !!currentUser?._id
  };
};

export default useFriendRequestManager;