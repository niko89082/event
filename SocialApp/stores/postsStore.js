// stores/postsStore.js - Centralized state management for posts and likes
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
          userLiked: post.userLiked || false,
          likeCount: post.likeCount || 0,
          commentCount: post.commentCount || 0,
        });
      });
      set({ posts: postsMap });
    },

    addPost: (post) => {
      const { posts } = get();
      const newPosts = new Map(posts);
      newPosts.set(post._id, {
        ...post,
        userLiked: post.userLiked || false,
        likeCount: post.likeCount || 0,
        commentCount: post.commentCount || 0,
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
      }
    },

    getPost: (postId) => {
      const { posts } = get();
      return posts.get(postId);
    },

    // Optimistic like toggle with API sync
    toggleLike: async (postId, isMemoryPost = false, currentUserId) => {
      const { posts, updatePost } = get();
      const post = posts.get(postId);
      
      if (!post || !currentUserId) {
        console.warn('Cannot toggle like: post not found or no user ID');
        return false;
      }

      const wasLiked = post.userLiked;
      const newLiked = !wasLiked;
      const newCount = wasLiked ? post.likeCount - 1 : post.likeCount + 1;

      // Optimistic update
      updatePost(postId, {
        userLiked: newLiked,
        likeCount: newCount
      });

      console.log('🔄 Optimistic like toggle:', {
        postId,
        isMemoryPost,
        wasLiked,
        newLiked,
        newCount
      });

      try {
        // Make API call
        const endpoint = isMemoryPost 
          ? `/api/memories/photos/${postId}/like`
          : `/api/photos/like/${postId}`;
        
        const response = await api.post(endpoint);
        console.log('✅ Like API response:', response.data);

        // Sync with server response
        let serverLiked = newLiked; // Default to optimistic value
        let serverCount = newCount; // Default to optimistic value

        // Handle different response formats
        if (response.data.liked !== undefined) {
          serverLiked = response.data.liked;
        } else if (response.data.userLiked !== undefined) {
          serverLiked = response.data.userLiked;
        } else if (Array.isArray(response.data.likes)) {
          serverLiked = response.data.likes.some(id => 
            id.toString() === currentUserId.toString()
          );
        }

        if (response.data.likeCount !== undefined) {
          serverCount = response.data.likeCount;
        } else if (Array.isArray(response.data.likes)) {
          serverCount = response.data.likes.length;
        }

        // Update with server values
        updatePost(postId, {
          userLiked: serverLiked,
          likeCount: serverCount
        });

        console.log('✅ Like synced with server:', {
          postId,
          serverLiked,
          serverCount
        });

        return serverLiked;

      } catch (error) {
        console.error('❌ Like toggle failed:', error);
        
        // Revert optimistic update on error
        updatePost(postId, {
          userLiked: wasLiked,
          likeCount: post.likeCount
        });

        throw error;
      }
    },

    // Comment management
    addComment: async (postId, commentText, isMemoryPost = false) => {
      if (!commentText.trim()) return false;

      try {
        const endpoint = isMemoryPost
          ? `/api/memories/photos/${postId}/comment`
          : `/api/photos/${postId}/comment`;

        const response = await api.post(endpoint, { text: commentText });
        
        // Update comment count
        const { posts, updatePost } = get();
        const post = posts.get(postId);
        if (post) {
          updatePost(postId, {
            commentCount: post.commentCount + 1
          });
        }

        console.log('✅ Comment added:', response.data);
        return response.data;

      } catch (error) {
        console.error('❌ Add comment failed:', error);
        throw error;
      }
    },

    // Bulk operations for feed updates
    syncPostsFromFeed: (feedPosts) => {
      const { posts } = get();
      const newPosts = new Map(posts);
      
      feedPosts.forEach(feedPost => {
        const existingPost = newPosts.get(feedPost._id);
        if (existingPost) {
          // Update existing post with any new data
          newPosts.set(feedPost._id, {
            ...existingPost,
            ...feedPost,
            // Preserve local optimistic updates if they're newer
            userLiked: existingPost.userLiked,
            likeCount: existingPost.likeCount,
            commentCount: Math.max(existingPost.commentCount, feedPost.commentCount || 0)
          });
        } else {
          // Add new post
          newPosts.set(feedPost._id, {
            ...feedPost,
            userLiked: feedPost.userLiked || false,
            likeCount: feedPost.likeCount || 0,
            commentCount: feedPost.commentCount || 0,
          });
        }
      });

      set({ posts: newPosts });
    },

    // Clear all posts (useful for logout)
    clearPosts: () => {
      set({ posts: new Map(), loading: false, error: null });
    },

    // Get posts as array (useful for FlatList)
    getPostsArray: () => {
      const { posts } = get();
      return Array.from(posts.values());
    },

    // Get posts for a specific type
    getPostsByType: (isMemoryPost = false) => {
      const { posts } = get();
      return Array.from(posts.values()).filter(post => {
        // You can add logic here to differentiate post types
        // For now, we'll use all posts
        return true;
      });
    },
  }))
);

export default usePostsStore;