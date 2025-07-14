// stores/postsStore.js - Enhanced centralized state management for posts and memory photos
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import api from '../services/api';

const usePostsStore = create(
  subscribeWithSelector((set, get) => ({
    // State
    posts: new Map(), // Store posts by ID for efficient lookups
    loading: false,
    error: null,

    // Actions
    setPosts: (postsArray) => {
      const postsMap = new Map();
      postsArray.forEach(post => {
        postsMap.set(post._id, {
          ...post,
          userLiked: Boolean(post.userLiked),
          likeCount: post.likeCount || 0,
          commentCount: post.commentCount || 0,
          postType: post.postType || 'regular', // 'regular' or 'memory'
        });
      });
      set({ posts: postsMap });
    },

    addPost: (post) => {
      const { posts } = get();
      const newPosts = new Map(posts);
      newPosts.set(post._id, {
        ...post,
        userLiked: Boolean(post.userLiked),
        likeCount: post.likeCount || 0,
        commentCount: post.commentCount || 0,
        postType: post.postType || 'regular',
      });
      set({ posts: newPosts });
    },

    updatePost: (postId, updates) => {
      const { posts } = get();
      const existingPost = posts.get(postId);
      if (existingPost) {
        const newPosts = new Map(posts);
        newPosts.set(postId, { ...existingPost, ...updates });
        set({ posts: newPosts });
        
        console.log('📊 Post updated in store:', {
          postId,
          updates,
          newState: newPosts.get(postId)
        });
      } else {
        console.warn('⚠️ Attempted to update non-existent post:', postId);
      }
    },

    getPost: (postId) => {
      const { posts } = get();
      return posts.get(postId);
    },

    // ✅ ENHANCED: Optimistic like toggle with proper memory photo support
    toggleLike: async (postId, isMemoryPost = false, currentUserId) => {
      const { posts, updatePost } = get();
      const post = posts.get(postId);
      
      if (!post || !currentUserId) {
        console.warn('⚠️ Cannot toggle like: post not found or no user ID', {
          hasPost: !!post,
          postId,
          currentUserId
        });
        return false;
      }

      const wasLiked = Boolean(post.userLiked);
      const newLiked = !wasLiked;
      const newCount = Math.max(0, wasLiked ? post.likeCount - 1 : post.likeCount + 1);

      console.log('🔄 === OPTIMISTIC LIKE TOGGLE START ===');
      console.log('📊 Like toggle details:', {
        postId,
        isMemoryPost,
        postType: post.postType,
        wasLiked,
        newLiked,
        oldCount: post.likeCount,
        newCount,
        currentUserId
      });

      // ✅ CRITICAL: Optimistic update first
      updatePost(postId, {
        userLiked: newLiked,
        likeCount: newCount
      });

      try {
        // ✅ ENHANCED: Determine correct API endpoint
        let endpoint;
        if (isMemoryPost || post.postType === 'memory') {
          endpoint = `/api/memories/photos/${postId}/like`;
          console.log('📡 Using memory photo like endpoint:', endpoint);
        } else {
          endpoint = `/api/photos/like/${postId}`;
          console.log('📡 Using regular post like endpoint:', endpoint);
        }
        
        const response = await api.post(endpoint);
        
        console.log('📥 Like API response received:', {
          endpoint,
          status: response.status,
          data: response.data,
          success: response.data?.success
        });

        // ✅ ENHANCED: Handle different response formats for memory vs regular posts
        let serverLiked = newLiked; // Default to optimistic value
        let serverCount = newCount; // Default to optimistic value

        if (response.data) {
          // Handle memory photo responses
          if (response.data.userLiked !== undefined) {
            serverLiked = Boolean(response.data.userLiked);
            console.log('📊 Using userLiked from response:', serverLiked);
          }
          // Handle regular post responses
          else if (response.data.liked !== undefined) {
            serverLiked = Boolean(response.data.liked);
            console.log('📊 Using liked from response:', serverLiked);
          }
          // Handle array-based likes (some endpoints return user ID arrays)
          else if (Array.isArray(response.data.likes)) {
            serverLiked = response.data.likes.some(likeUserId => 
              likeUserId.toString() === currentUserId.toString()
            );
            console.log('📊 Calculated userLiked from likes array:', serverLiked);
          }

          // Handle like count
          if (response.data.likeCount !== undefined) {
            serverCount = Number(response.data.likeCount);
            console.log('📊 Using likeCount from response:', serverCount);
          } else if (response.data.likesCount !== undefined) {
            serverCount = Number(response.data.likesCount);
            console.log('📊 Using likesCount from response:', serverCount);
          } else if (Array.isArray(response.data.likes)) {
            serverCount = response.data.likes.length;
            console.log('📊 Calculated count from likes array:', serverCount);
          }
        }

        // ✅ CRITICAL: Sync with server values (might differ from optimistic update)
        updatePost(postId, {
          userLiked: serverLiked,
          likeCount: Math.max(0, serverCount) // Ensure non-negative
        });

        console.log('✅ === LIKE TOGGLE COMPLETED ===');
        console.log('📊 Final state:', {
          postId,
          serverLiked,
          serverCount,
          wasOptimisticCorrect: serverLiked === newLiked && serverCount === newCount
        });

        return serverLiked;

      } catch (error) {
        console.error('🚨 === LIKE TOGGLE ERROR ===');
        console.error('❌ Error details:', {
          postId,
          isMemoryPost,
          endpoint: isMemoryPost ? 'memory' : 'regular',
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        // ✅ CRITICAL: Revert optimistic update on error
        updatePost(postId, {
          userLiked: wasLiked,
          likeCount: post.likeCount // Use original count
        });

        console.log('🔄 Reverted to original state:', {
          userLiked: wasLiked,
          likeCount: post.likeCount
        });

        // Re-throw error for component handling
        throw error;
      }
    },

    // ✅ ENHANCED: Comment management with memory photo support
    addComment: async (postId, commentText, isMemoryPost = false) => {
      if (!commentText.trim()) {
        console.warn('⚠️ Cannot add empty comment');
        return false;
      }

      const { posts, updatePost } = get();
      const post = posts.get(postId);

      console.log('💬 === ADDING COMMENT START ===');
      console.log('📝 Comment details:', {
        postId,
        isMemoryPost,
        postType: post?.postType,
        commentLength: commentText.length
      });

      try {
        // ✅ ENHANCED: Determine correct API endpoint
        let endpoint;
        if (isMemoryPost || post?.postType === 'memory') {
          endpoint = `/api/memories/photos/${postId}/comments`;
          console.log('📡 Using memory photo comment endpoint:', endpoint);
        } else {
          endpoint = `/api/photos/${postId}/comments`;
          console.log('📡 Using regular post comment endpoint:', endpoint);
        }

        const response = await api.post(endpoint, { 
          text: commentText.trim(),
          tags: [] // Include tags if your API supports them
        });
        
        console.log('📥 Comment API response:', {
          endpoint,
          status: response.status,
          hasComment: !!response.data?.comment,
          commentId: response.data?.comment?._id
        });
        
        // ✅ CRITICAL: Update comment count in store
        if (post) {
          updatePost(postId, {
            commentCount: post.commentCount + 1
          });
          
          console.log('📊 Updated comment count:', {
            postId,
            oldCount: post.commentCount,
            newCount: post.commentCount + 1
          });
        }

        console.log('✅ Comment added successfully');
        return response.data;

      } catch (error) {
        console.error('🚨 === ADD COMMENT ERROR ===');
        console.error('❌ Error details:', {
          postId,
          isMemoryPost,
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        throw error;
      }
    },

    // ✅ NEW: Batch sync posts from feed (useful for feed refreshes)
    syncPostsFromFeed: (feedPosts) => {
      const { posts } = get();
      const newPosts = new Map(posts);
      let syncedCount = 0;
      let addedCount = 0;
      
      console.log('🔄 === SYNCING POSTS FROM FEED START ===');
      console.log('📊 Sync details:', {
        feedPostsCount: feedPosts.length,
        currentStoreCount: newPosts.size
      });
      
      feedPosts.forEach(feedPost => {
        const existingPost = newPosts.get(feedPost._id);
        
        if (existingPost) {
          // ✅ ENHANCED: Smart merge - preserve optimistic updates if they're more recent
          const shouldPreserveOptimistic = 
            existingPost.userLiked !== feedPost.userLiked || 
            existingPost.likeCount !== feedPost.likeCount;
            
          newPosts.set(feedPost._id, {
            ...existingPost,
            ...feedPost,
            // Preserve optimistic updates for likes (they're usually more current)
            userLiked: shouldPreserveOptimistic ? existingPost.userLiked : Boolean(feedPost.userLiked),
            likeCount: shouldPreserveOptimistic ? existingPost.likeCount : (feedPost.likeCount || 0),
            // Always use the higher comment count
            commentCount: Math.max(existingPost.commentCount, feedPost.commentCount || 0),
            postType: feedPost.postType || existingPost.postType || 'regular'
          });
          
          syncedCount++;
        } else {
          // Add new post
          newPosts.set(feedPost._id, {
            ...feedPost,
            userLiked: Boolean(feedPost.userLiked),
            likeCount: feedPost.likeCount || 0,
            commentCount: feedPost.commentCount || 0,
            postType: feedPost.postType || 'regular'
          });
          
          addedCount++;
        }
      });

      set({ posts: newPosts });
      
      console.log('✅ === FEED SYNC COMPLETED ===');
      console.log('📊 Sync results:', {
        totalInStore: newPosts.size,
        syncedExisting: syncedCount,
        addedNew: addedCount
      });
    },

    // ✅ NEW: Remove post (useful for deletions)
    removePost: (postId) => {
      const { posts } = get();
      const newPosts = new Map(posts);
      const deleted = newPosts.delete(postId);
      
      if (deleted) {
        set({ posts: newPosts });
        console.log('🗑️ Post removed from store:', postId);
      } else {
        console.warn('⚠️ Attempted to remove non-existent post:', postId);
      }
      
      return deleted;
    },

    // Clear all posts (useful for logout)
    clearPosts: () => {
      console.log('🧹 Clearing all posts from store');
      set({ posts: new Map(), loading: false, error: null });
    },

    // Get posts as array (useful for FlatList)
    getPostsArray: () => {
      const { posts } = get();
      const postsArray = Array.from(posts.values());
      
      console.log('📋 Retrieved posts array:', {
        totalPosts: postsArray.length,
        memoryPosts: postsArray.filter(p => p.postType === 'memory').length,
        regularPosts: postsArray.filter(p => p.postType === 'regular').length
      });
      
      return postsArray;
    },

    // ✅ NEW: Get posts by type
    getPostsByType: (postType = 'all') => {
      const { posts } = get();
      const allPosts = Array.from(posts.values());
      
      if (postType === 'all') {
        return allPosts;
      }
      
      const filteredPosts = allPosts.filter(post => post.postType === postType);
      
      console.log('🔍 Retrieved posts by type:', {
        requestedType: postType,
        filteredCount: filteredPosts.length,
        totalCount: allPosts.length
      });
      
      return filteredPosts;
    },

    // ✅ NEW: Get memory posts only
    getMemoryPosts: () => {
      const { getPostsByType } = get();
      return getPostsByType('memory');
    },

    // ✅ NEW: Get regular posts only
    getRegularPosts: () => {
      const { getPostsByType } = get();
      return getPostsByType('regular');
    },

    // ✅ NEW: Debugging utilities
    getStoreStats: () => {
      const { posts } = get();
      const postsArray = Array.from(posts.values());
      
      const stats = {
        totalPosts: postsArray.length,
        memoryPosts: postsArray.filter(p => p.postType === 'memory').length,
        regularPosts: postsArray.filter(p => p.postType === 'regular').length,
        likedPosts: postsArray.filter(p => p.userLiked).length,
        totalLikes: postsArray.reduce((sum, p) => sum + (p.likeCount || 0), 0),
        totalComments: postsArray.reduce((sum, p) => sum + (p.commentCount || 0), 0)
      };
      
      console.log('📊 Store statistics:', stats);
      return stats;
    },

    // ✅ NEW: Force refresh post data from API
    refreshPost: async (postId, isMemoryPost = false) => {
      console.log('🔄 Refreshing post from API:', { postId, isMemoryPost });
      
      try {
        let endpoint;
        if (isMemoryPost) {
          endpoint = `/api/memories/photos/${postId}`;
        } else {
          endpoint = `/api/posts/${postId}`; // Adjust based on your API
        }
        
        const response = await api.get(endpoint);
        const postData = response.data?.photo || response.data?.post || response.data;
        
        if (postData) {
          const { updatePost } = get();
          updatePost(postId, {
            ...postData,
            userLiked: Boolean(postData.userLiked),
            likeCount: postData.likeCount || 0,
            commentCount: postData.commentCount || 0,
            postType: isMemoryPost ? 'memory' : 'regular'
          });
          
          console.log('✅ Post refreshed successfully:', postId);
          return postData;
        } else {
          throw new Error('Invalid response format');
        }
        
      } catch (error) {
        console.error('❌ Failed to refresh post:', error);
        throw error;
      }
    },
  }))
);

// ✅ NEW: Subscribe to store changes for debugging (optional)
if (__DEV__) {
  usePostsStore.subscribe(
    (state) => state.posts,
    (posts, previousPosts) => {
      const currentSize = posts.size;
      const previousSize = previousPosts.size;
      
      if (currentSize !== previousSize) {
        console.log('📊 Posts store size changed:', {
          previous: previousSize,
          current: currentSize,
          difference: currentSize - previousSize
        });
      }
    }
  );
}

export default usePostsStore;