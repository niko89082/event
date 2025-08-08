// hooks/useCommentManager.js - Global comment count management
import { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import usePostsStore from '../stores/postsStore';

// Global comment store using Zustand
const useCommentStore = create(
  subscribeWithSelector((set, get) => ({
    // Store comment counts by postId
    commentCounts: new Map(),
    
    // Update comment count for a specific post
    updateCommentCount: (postId, count) => {
      set((state) => {
        const newCounts = new Map(state.commentCounts);
        newCounts.set(postId, count);
        return { commentCounts: newCounts };
      });
      
      // Also update the posts store to keep everything in sync
      const updatePost = usePostsStore.getState().updatePost;
      updatePost(postId, { commentCount: count });
    },
    
    // Increment comment count
    incrementCommentCount: (postId) => {
      set((state) => {
        const newCounts = new Map(state.commentCounts);
        const currentCount = newCounts.get(postId) || 0;
        const newCount = currentCount + 1;
        newCounts.set(postId, newCount);
        return { commentCounts: newCounts };
      });
      
      // Update posts store
      const { commentCounts } = get();
      const newCount = commentCounts.get(postId);
      const updatePost = usePostsStore.getState().updatePost;
      updatePost(postId, { commentCount: newCount });
    },
    
    // Decrement comment count
    decrementCommentCount: (postId) => {
      set((state) => {
        const newCounts = new Map(state.commentCounts);
        const currentCount = newCounts.get(postId) || 0;
        const newCount = Math.max(0, currentCount - 1);
        newCounts.set(postId, newCount);
        return { commentCounts: newCounts };
      });
      
      // Update posts store
      const { commentCounts } = get();
      const newCount = commentCounts.get(postId);
      const updatePost = usePostsStore.getState().updatePost;
      updatePost(postId, { commentCount: newCount });
    },
    
    // Get comment count for a post
    getCommentCount: (postId) => {
      const { commentCounts } = get();
      return commentCounts.get(postId) || 0;
    },
    
    // Clear all comment counts (for logout, etc.)
    clearCommentCounts: () => {
      set({ commentCounts: new Map() });
    }
  }))
);

// Hook for managing comments with global sync
export const useCommentManager = (postId, initialCount = 0, isMemoryPost = false) => {
  const [localCommentCount, setLocalCommentCount] = useState(initialCount);
  
  // Get store functions
  const updateCommentCount = useCommentStore(state => state.updateCommentCount);
  const incrementCommentCount = useCommentStore(state => state.incrementCommentCount);
  const decrementCommentCount = useCommentStore(state => state.decrementCommentCount);
  const getCommentCount = useCommentStore(state => state.getCommentCount);
  
  // Initialize comment count in store
  useEffect(() => {
    if (postId && initialCount !== undefined) {
      updateCommentCount(postId, initialCount);
      setLocalCommentCount(initialCount);
    }
  }, [postId, initialCount, updateCommentCount]);
  
  // Subscribe to comment count changes for this post
  useEffect(() => {
    if (!postId) return;
    
    const unsubscribe = useCommentStore.subscribe(
      (state) => state.commentCounts.get(postId),
      (commentCount) => {
        if (commentCount !== undefined) {
          setLocalCommentCount(commentCount);
        }
      }
    );
    
    return unsubscribe;
  }, [postId]);
  
  // Add comment function
  const addComment = useCallback(() => {
    if (postId) {
      incrementCommentCount(postId);
    }
  }, [postId, incrementCommentCount]);
  
  // Remove comment function
  const removeComment = useCallback(() => {
    if (postId) {
      decrementCommentCount(postId);
    }
  }, [postId, decrementCommentCount]);
  
  // Update comment count function
  const updateCount = useCallback((newCount) => {
    if (postId) {
      updateCommentCount(postId, newCount);
    }
  }, [postId, updateCommentCount]);
  
  // Get current comment count
  const getCurrentCount = useCallback(() => {
    return postId ? getCommentCount(postId) : localCommentCount;
  }, [postId, getCommentCount, localCommentCount]);
  
  return {
    commentCount: localCommentCount,
    addComment,
    removeComment,
    updateCount,
    getCurrentCount
  };
};

// Hook for bulk comment operations (for memory screens with multiple photos)
export const useBulkCommentManager = () => {
  const updateCommentCount = useCommentStore(state => state.updateCommentCount);
  const getCommentCount = useCommentStore(state => state.getCommentCount);
  
  // Initialize multiple comment counts
  const initializeCommentCounts = useCallback((posts) => {
    posts.forEach(post => {
      if (post._id && post.commentCount !== undefined) {
        updateCommentCount(post._id, post.commentCount);
      }
    });
  }, [updateCommentCount]);
  
  // Get comment counts for multiple posts
  const getCommentCounts = useCallback((postIds) => {
    const counts = {};
    postIds.forEach(postId => {
      counts[postId] = getCommentCount(postId);
    });
    return counts;
  }, [getCommentCount]);
  
  // Subscribe to comment count changes for multiple posts
  const useCommentCounts = (postIds) => {
    const [commentCounts, setCommentCounts] = useState({});
    
    useEffect(() => {
      if (!postIds || postIds.length === 0) return;
      
      const updateCounts = () => {
        const newCounts = {};
        postIds.forEach(postId => {
          newCounts[postId] = getCommentCount(postId);
        });
        setCommentCounts(newCounts);
      };
      
      // Initial update
      updateCounts();
      
      // Subscribe to changes
      const unsubscribe = useCommentStore.subscribe(
        (state) => state.commentCounts,
        updateCounts
      );
      
      return unsubscribe;
    }, [postIds]);
    
    return commentCounts;
  };
  
  return {
    initializeCommentCounts,
    getCommentCounts,
    updateCommentCount,
    getCommentCount,
    useCommentCounts
  };
};

// Hook specifically for memory detail screens
export const useMemoryCommentSync = (memoryPhotos = []) => {
  const { initializeCommentCounts, useCommentCounts } = useBulkCommentManager();
  
  // Initialize comment counts when memory photos are loaded
  useEffect(() => {
    if (memoryPhotos.length > 0) {
      initializeCommentCounts(memoryPhotos);
    }
  }, [memoryPhotos, initializeCommentCounts]);
  
  // Get photo IDs
  const photoIds = memoryPhotos.map(photo => photo._id).filter(Boolean);
  
  // Subscribe to comment count changes
  const commentCounts = useCommentCounts(photoIds);
  
  // Get updated comment count for a specific photo
  const getPhotoCommentCount = useCallback((photoId) => {
    return commentCounts[photoId] || 0;
  }, [commentCounts]);
  
  // Get total comment count for the memory
  const getTotalCommentCount = useCallback(() => {
    return Object.values(commentCounts).reduce((total, count) => total + count, 0);
  }, [commentCounts]);
  
  return {
    commentCounts,
    getPhotoCommentCount,
    getTotalCommentCount
  };
};

export default useCommentManager;