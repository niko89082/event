// routes/memory-photos.js - API routes for memory photo interactions
const express = require('express');
const router = express.Router();
const MemoryPhoto = require('../models/MemoryPhoto');
const Memory = require('../models/Memory');
const auth = require('../middleware/auth');

// ✅ GET: Get memory photo details with likes/comments
router.get('/:photoId', auth, async (req, res) => {
  try {
    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('uploadedBy', 'username profilePicture fullName')
      .populate('likes', 'username profilePicture fullName')
      .populate('comments.user', 'username profilePicture fullName')
      .populate('taggedUsers', 'username profilePicture fullName')
      .populate({
        path: 'memory',
        select: 'title creator participants',
        populate: {
          path: 'creator participants',
          select: 'username profilePicture'
        }
      });

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Increment view count if not the uploader
    if (!photo.uploadedBy.equals(userId)) {
      await photo.incrementView();
    }

    res.json({
      success: true,
      photo: {
        ...photo.toJSON(),
        isLikedByUser: photo.isLikedBy(userId)
      }
    });

  } catch (error) {
    console.error('Error fetching memory photo:', error);
    res.status(500).json({ 
      message: 'Failed to fetch photo',
      details: error.message 
    });
  }
});

// ✅ POST: Toggle like on memory photo
router.post('/:photoId/like', auth, async (req, res) => {
  try {
    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('memory', 'creator participants');

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { liked, likeCount } = photo.toggleLike(userId);
    await photo.save();

    res.json({
      success: true,
      liked,
      likeCount,
      message: liked ? 'Photo liked' : 'Photo unliked'
    });

  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ 
      message: 'Failed to toggle like',
      details: error.message 
    });
  }
});

// ✅ POST: Add comment to memory photo
router.post('/:photoId/comments', auth, async (req, res) => {
  try {
    const { text, tags = [] } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
    }

    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('memory', 'creator participants');

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comment = photo.addComment(userId, text, tags);
    await photo.save();

    // Populate the new comment with user details
    await photo.populate('comments.user', 'username profilePicture fullName');
    
    const newComment = photo.comments[photo.comments.length - 1];

    res.status(201).json({
      success: true,
      comment: newComment,
      commentCount: photo.comments.length,
      message: 'Comment added successfully'
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ 
      message: 'Failed to add comment',
      details: error.message 
    });
  }
});

// ✅ PUT: Edit comment on memory photo
router.put('/:photoId/comments/:commentId', auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
    }

    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('memory', 'creator participants');

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedComment = photo.editComment(req.params.commentId, text, userId);
    await photo.save();

    res.json({
      success: true,
      comment: updatedComment,
      message: 'Comment updated successfully'
    });

  } catch (error) {
    console.error('Error editing comment:', error);
    
    if (error.message === 'Comment not found' || error.message === 'Unauthorized to edit this comment') {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({ 
      message: 'Failed to edit comment',
      details: error.message 
    });
  }
});

// ✅ DELETE: Delete comment from memory photo
router.delete('/:photoId/comments/:commentId', auth, async (req, res) => {
  try {
    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('memory', 'creator participants');

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await photo.deleteComment(req.params.commentId, userId);

    res.json({
      success: true,
      commentCount: photo.comments.length,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    
    if (error.message === 'Comment not found' || error.message === 'Unauthorized to delete this comment') {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({ 
      message: 'Failed to delete comment',
      details: error.message 
    });
  }
});

// ✅ GET: Get all comments for a memory photo
router.get('/:photoId/comments', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('memory', 'creator participants')
      .populate({
        path: 'comments.user',
        select: 'username profilePicture fullName'
      });

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Sort comments by creation date (newest first) and paginate
    const comments = photo.comments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: photo.comments.length,
        hasMore: skip + parseInt(limit) < photo.comments.length
      }
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ 
      message: 'Failed to fetch comments',
      details: error.message 
    });
  }
});

// ✅ GET: Get users who liked a memory photo
router.get('/:photoId/likes', auth, async (req, res) => {
  try {
    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('memory', 'creator participants')
      .populate('likes', 'username profilePicture fullName');

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      success: true,
      likes: photo.likes,
      likeCount: photo.likes.length
    });

  } catch (error) {
    console.error('Error fetching likes:', error);
    res.status(500).json({ 
      message: 'Failed to fetch likes',
      details: error.message 
    });
  }
});

// ✅ POST: Report memory photo
router.post('/:photoId/report', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const photo = await MemoryPhoto.findById(req.params.photoId)
      .populate('memory', 'creator participants');

    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = photo.memory.creator.equals(userId) || 
                     photo.memory.participants.some(p => p.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    photo.reportCount += 1;
    photo.isReported = true;
    await photo.save();

    // TODO: Add to moderation queue, send notification to moderators

    res.json({
      success: true,
      message: 'Photo reported successfully'
    });

  } catch (error) {
    console.error('Error reporting photo:', error);
    res.status(500).json({ 
      message: 'Failed to report photo',
      details: error.message 
    });
  }
});

module.exports = router;