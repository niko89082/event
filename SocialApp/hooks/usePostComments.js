// hooks/usePostComments.js - Comments Management Hook
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const usePostComments = (postId, isMemoryPost = false, initialComments = []) => {
  const [comments, setComments] = useState([]);
  const [latestComment, setLatestComment] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize from initial data
  useEffect(() => {
    if (initialComments && initialComments.length > 0) {
      const sortedComments = [...initialComments].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      setComments(sortedComments);
      setLatestComment(sortedComments[0]);
      setCommentCount(sortedComments.length);
    }
  }, [initialComments]);

  // Add comment optimistically
  const addComment = useCallback(async (commentText, currentUserId) => {
    if (!commentText.trim() || !currentUserId) {
      throw new Error('Comment text and user ID are required');
    }

    const trimmedComment = commentText.trim();
    
    // Create optimistic comment
    const optimisticComment = {
      _id: `temp-${Date.now()}`,
      text: trimmedComment,
      user: {
        _id: currentUserId,
        username: 'You',
        profilePicture: null
      },
      createdAt: new Date().toISOString(),
      isTemp: true
    };

    // Update state optimistically
    setComments(prev => [optimisticComment, ...prev]);
    setLatestComment(optimisticComment);
    setCommentCount(prev => prev + 1);

    try {
      // Determine API endpoint
      const endpoint = isMemoryPost 
        ? `/api/memories/photos/${postId}/comments`
        : `/api/photos/comment/${postId}`;

      console.log('📡 usePostComments: Submitting to:', endpoint);

      const response = await api.post(endpoint, {
        text: trimmedComment,
        tags: []
      });

      let realComment = null;
      
      if (response.data.comment) {
        realComment = response.data.comment;
      } else if (response.data.comments && response.data.comments.length > 0) {
        realComment = response.data.comments[response.data.comments.length - 1];
      }

      if (realComment) {
        // Replace optimistic comment with real one
        setComments(prev => prev.map(comment => 
          comment._id === optimisticComment._id ? realComment : comment
        ));
        setLatestComment(realComment);
        
        console.log('✅ usePostComments: Comment successfully added');
        return realComment;
      }

    } catch (error) {
      console.error('❌ usePostComments: Failed to add comment:', error);
      
      // Revert optimistic update
      setComments(prev => prev.filter(comment => comment._id !== optimisticComment._id));
      setLatestComment(prev => {
        if (prev?._id === optimisticComment._id) {
          // Find the previous latest comment
          const remaining = comments.filter(c => c._id !== optimisticComment._id);
          return remaining.length > 0 ? remaining[0] : null;
        }
        return prev;
      });
      setCommentCount(prev => Math.max(0, prev - 1));
      
      throw error;
    }
  }, [postId, isMemoryPost, comments]);

  // Fetch full comments list (for when user wants to see all)
  const fetchAllComments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = isMemoryPost 
        ? `/api/memories/photos/${postId}/comments`
        : `/api/photos/comment/${postId}`;

      const response = await api.get(endpoint);
      
      let fetchedComments = [];
      if (response.data.comments) {
        fetchedComments = Array.isArray(response.data.comments) 
          ? response.data.comments 
          : [response.data.comments];
      }

      const sortedComments = fetchedComments.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      setComments(sortedComments);
      setLatestComment(sortedComments[0] || null);
      setCommentCount(sortedComments.length);

      return sortedComments;

    } catch (error) {
      console.error('❌ usePostComments: Failed to fetch comments:', error);
      setError(error.message || 'Failed to load comments');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [postId, isMemoryPost]);

  return {
    comments,
    latestComment,
    commentCount,
    loading,
    error,
    addComment,
    fetchAllComments
  };
};