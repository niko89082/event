// routes/share.js - API routes for sharing functionality
const express = require('express');
const protect = require('../middleware/auth');
const User = require('../models/User');
const Event = require('../models/Event');
const Photo = require('../models/Photo');
const Memory = require('../models/Memory');
const Notification = require('../models/Notification');

const router = express.Router();

/* ───────────────────────────────────────────────────────────────────
   POST /api/share/send - Send share to user
──────────────────────────────────────────────────────────────────── */
router.post('/send', protect, async (req, res) => {
  try {
    const { recipientId, shareType, shareId, message } = req.body;
    
    // Validate input
    if (!recipientId || !shareType || !shareId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Verify recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    // Verify shared content exists and user has access
    let shareData = {};
    let notificationMessage = '';
    
    switch (shareType) {
      case 'event':
        const event = await Event.findById(shareId).populate('host', 'username');
        if (!event) {
          return res.status(404).json({ message: 'Event not found' });
        }
        
        // Check if user can see this event
        if (event.visibility === 'private' && 
            event.host._id.toString() !== req.user._id.toString() &&
            !event.attendees.includes(req.user._id)) {
          return res.status(403).json({ message: 'Access denied' });
        }
        
        shareData = { eventId: shareId, eventTitle: event.title };
        notificationMessage = `${req.user.username} shared an event: "${event.title}"`;
        break;
        
      case 'post':
        const post = await Photo.findById(shareId).populate('user', 'username');
        if (!post) {
          return res.status(404).json({ message: 'Post not found' });
        }
        
        shareData = { postId: shareId };
        notificationMessage = `${req.user.username} shared a post`;
        break;
        
      case 'memory':
        const memory = await Memory.findById(shareId);
        if (!memory) {
          return res.status(404).json({ message: 'Memory not found' });
        }
        
        // Check if user is participant in memory
        if (!memory.isParticipant(req.user._id)) {
          return res.status(403).json({ message: 'Access denied' });
        }
        
        shareData = { memoryId: shareId, memoryTitle: memory.title };
        notificationMessage = `${req.user.username} shared a memory: "${memory.title}"`;
        break;
        
      case 'profile':
        const profileUser = await User.findById(shareId).select('username');
        if (!profileUser) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        shareData = { userId: shareId, username: profileUser.username };
        notificationMessage = `${req.user.username} shared ${profileUser.username}'s profile`;
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid share type' });
    }
    
    // Create notification for recipient
    await Notification.create({
      user: recipientId,
      sender: req.user._id,
      type: 'share',
      message: message || notificationMessage,
      meta: {
        shareType,
        shareId,
        ...shareData
      }
    });
    
    // Update recent shares for sender
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { recentShares: recipientId },
      $push: {
        recentShares: {
          $each: [recipientId],
          $position: 0,
          $slice: 10 // Keep only last 10 recent shares
        }
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Share sent successfully' 
    });
    
  } catch (error) {
    console.error('Error sending share:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/users/recent-shares - Get users recently shared with
──────────────────────────────────────────────────────────────────── */
router.get('/users/recent-shares', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'recentShares',
        select: 'username fullName profilePicture',
        options: { limit: 10 }
      });
    
    res.json({
      users: user.recentShares || []
    });
    
  } catch (error) {
    console.error('Error fetching recent shares:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/share/preview/:type/:id - Get share preview data
──────────────────────────────────────────────────────────────────── */
router.get('/preview/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    let previewData = {};
    
    switch (type) {
      case 'event':
        const event = await Event.findById(id)
          .populate('host', 'username profilePicture')
          .select('title description time location visibility');
        
        if (!event) {
          return res.status(404).json({ message: 'Event not found' });
        }
        
        previewData = {
          type: 'event',
          title: event.title,
          description: event.description,
          time: event.time,
          location: event.location?.address,
          host: event.host,
          visibility: event.visibility
        };
        break;
        
      case 'post':
        const post = await Photo.findById(id)
          .populate('user', 'username profilePicture')
          .select('paths uploadDate likes comments');
        
        if (!post) {
          return res.status(404).json({ message: 'Post not found' });
        }
        
        previewData = {
          type: 'post',
          images: post.paths,
          author: post.user,
          likesCount: post.likes?.length || 0,
          commentsCount: post.comments?.length || 0,
          uploadDate: post.uploadDate
        };
        break;
        
      case 'memory':
        const memory = await Memory.findById(id)
          .populate('createdBy', 'username profilePicture')
          .populate('participants', 'username')
          .select('title description createdBy participants createdAt photos');
        
        if (!memory) {
          return res.status(404).json({ message: 'Memory not found' });
        }
        
        previewData = {
          type: 'memory',
          title: memory.title,
          description: memory.description,
          creator: memory.createdBy,
          participantsCount: memory.participants?.length || 0,
          photosCount: memory.photos?.length || 0,
          createdAt: memory.createdAt
        };
        break;
        
      case 'profile':
        const user = await User.findById(id)
          .select('username fullName profilePicture bio followers following');
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        previewData = {
          type: 'profile',
          username: user.username,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          followersCount: user.followers?.length || 0,
          followingCount: user.following?.length || 0
        };
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid share type' });
    }
    
    res.json(previewData);
    
  } catch (error) {
    console.error('Error fetching share preview:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;