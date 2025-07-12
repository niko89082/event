// routes/memories.js - Complete with all functionality
const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/memory-photos/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'memory-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// ✅ POST: Create memory
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, participantIds = [] } = req.body;
    const creatorId = req.user.id;
    
    console.log('🚀 Creating memory with data:', {
      title,
      description,
      creatorId,
      participantIds
    });
    
    if (!title || !title.trim()) {
      return res.status(400).json({
        message: 'Memory title is required'
      });
    }
    
    const totalParticipants = participantIds.length + 1;
    if (totalParticipants > 15) {
      return res.status(400).json({
        message: `Cannot create memory with ${totalParticipants} participants. Maximum is 15 (including creator).`
      });
    }
    
    if (participantIds.length > 0) {
      try {
        const users = await User.find({ 
          _id: { $in: participantIds } 
        }).select('_id username');
        
        if (users.length !== participantIds.length) {
          const foundIds = users.map(u => u._id.toString());
          const invalidIds = participantIds.filter(id => !foundIds.includes(id));
          
          return res.status(400).json({
            message: 'Some participant IDs are invalid',
            details: { invalidIds }
          });
        }
      } catch (userError) {
        console.error('❌ Error validating participant IDs:', userError);
        return res.status(400).json({
          message: 'Invalid participant IDs format'
        });
      }
    }
    
    const cleanParticipantIds = participantIds.filter(id => id !== creatorId);
    
    const memoryData = {
      title: title.trim(),
      description: description ? description.trim() : '',
      creator: creatorId,
      participants: cleanParticipantIds,
      isPrivate: true
    };
    
    const memory = new Memory(memoryData);
    await memory.save();
    
    await memory.populate([
      { 
        path: 'creator', 
        select: 'username fullName profilePicture' 
      },
      { 
        path: 'participants', 
        select: 'username fullName profilePicture' 
      }
    ]);
    
    console.log('✅ Memory created successfully:', memory._id);
    
    res.status(201).json({
      message: 'Memory created successfully',
      memory: memory
    });
    
  } catch (error) {
    console.error('❌ Error creating memory:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        details: errors.join(', ')
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid ID format',
        details: error.message
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Memory with this title already exists'
      });
    }
    
    res.status(500).json({
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// ✅ GET: User's memories
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const memories = await Memory.find({
      $or: [
        { creator: userId },
        { participants: userId }
      ]
    })
    .populate('creator', 'username fullName profilePicture')
    .populate('participants', 'username fullName profilePicture')
    .populate({
      path: 'photos',
      match: { isDeleted: false },
      populate: {
        path: 'uploadedBy',
        select: 'username'
      }
    })
    .sort({ createdAt: -1 });
    
    res.json({ memories });
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ message: 'Failed to fetch memories' });
  }
});

// ✅ GET: Single memory by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'photos',
        match: { isDeleted: false },
        populate: {
          path: 'uploadedBy',
          select: 'username profilePicture'
        },
        options: { sort: { uploadedAt: -1 } }
      });
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const userId = req.user.id;
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ memory });
  } catch (error) {
    console.error('Error fetching memory:', error);
    res.status(500).json({ message: 'Failed to fetch memory' });
  }
});

// ✅ GET: User's memories (for profile screen)
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    
    console.log(`📚 Fetching memories for user ${userId} (requested by ${currentUserId})`);
    
    let query;
    
    if (userId === currentUserId) {
      // Show all memories where user is creator or participant
      query = {
        $or: [
          { creator: userId },
          { participants: userId }
        ]
      };
    } else {
      // Show only memories where both users are participants
      query = {
        $and: [
          {
            $or: [
              { creator: userId },
              { participants: userId }
            ]
          },
          {
            $or: [
              { creator: currentUserId },
              { participants: currentUserId }
            ]
          }
        ]
      };
    }
    
    const memories = await Memory.find(query)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'photos',
        match: { isDeleted: false },
        select: 'url uploadedBy uploadedAt caption',
        populate: {
          path: 'uploadedBy',
          select: 'username profilePicture'
        },
        options: { limit: 5, sort: { uploadedAt: -1 } }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalMemories = await Memory.countDocuments(query);

    // ✅ ENHANCED: Transform memories to include proper virtual fields
    const transformedMemories = memories.map(memory => {
      const memoryObj = memory.toObject();
      
      // Ensure virtual fields are computed
      memoryObj.photoCount = memory.photoCount;
      memoryObj.participantCount = memory.participantCount;
      memoryObj.coverPhoto = memory.coverPhoto; // This will get the first photo's URL
      
      return memoryObj;
    });
    
    res.json({
      memories: transformedMemories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMemories / parseInt(limit)),
        totalMemories,
        hasMore: parseInt(page) * parseInt(limit) < totalMemories
      }
    });
    
  } catch (error) {
    console.error('Error fetching user memories:', error);
    res.status(500).json({ message: 'Failed to fetch memories' });
  }
});

// ✅ ALSO UPDATE: Single memory route for better photo population
router.get('/:id', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'photos',
        match: { isDeleted: false },
        populate: {
          path: 'uploadedBy',
          select: 'username profilePicture'
        },
        options: { sort: { uploadedAt: -1 } }
      });
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const userId = req.user.id;
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // ✅ TRANSFORM: Ensure virtual fields are included
    const memoryObj = memory.toObject();
    memoryObj.photoCount = memory.photoCount;
    memoryObj.participantCount = memory.participantCount;
    memoryObj.coverPhoto = memory.coverPhoto;
    
    res.json({ memory: memoryObj });
  } catch (error) {
    console.error('Error fetching memory:', error);
    res.status(500).json({ message: 'Failed to fetch memory' });
  }
});

// ✅ PUT: Add participant to memory
router.put('/:id/participants', protect, async (req, res) => {
  try {
    const { participantId } = req.body;
    const memoryId = req.params.id;
    
    // Verify memory exists and user has permission
    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // Check if user is creator or already a participant
    const isCreator = memory.creator.toString() === req.user._id.toString();
    const isParticipant = memory.participants.includes(req.user._id);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({ message: 'Not authorized to add participants' });
    }
    
    // Check if user is already a participant
    if (memory.participants.includes(participantId)) {
      return res.status(400).json({ message: 'User is already a participant' });
    }
    
    // Add participant to memory
    memory.participants.push(participantId);
    await memory.save();
    
    // 🆕 SEND NOTIFICATION
    await notificationService.sendMemoryInvitation(
      req.user._id,
      memoryId,
      [participantId]
    );
    
    console.log(`🔔 Sent memory invitation notification to ${participantId}`);
    
    res.json({ 
      success: true, 
      message: 'Participant added successfully',
      memory 
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




// ✅ PUT: Update memory details (creator only) - NEW ROUTE
router.put('/:memoryId', auth, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;
    
    // 🔍 DEBUG: Log everything received from frontend
    console.log('🐛 BACKEND DEBUG - Update memory request:');
    console.log('  - memoryId:', memoryId);
    console.log('  - userId:', userId);
    console.log('  - req.body:', JSON.stringify(req.body));
    console.log('  - title received:', JSON.stringify(title));
    console.log('  - description received:', JSON.stringify(description));
    console.log('  - title type:', typeof title);
    console.log('  - description type:', typeof description);
    
    // Validate input
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Memory title is required' });
    }
    
    if (title.trim().length > 50) {
      return res.status(400).json({ message: 'Title cannot exceed 50 characters' });
    }
    
    if (description && description.length > 200) {
      return res.status(400).json({ message: 'Description cannot exceed 200 characters' });
    }
    
    // Find memory and check ownership
    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // 🔍 DEBUG: Log current memory state
    console.log('🐛 BACKEND DEBUG - Current memory in DB:');
    console.log('  - current title:', JSON.stringify(memory.title));
    console.log('  - current description:', JSON.stringify(memory.description));
    
    // Only memory creator can update
    if (!memory.creator.equals(userId)) {
      return res.status(403).json({ message: 'Only memory creator can edit this memory' });
    }
    
    // 🔍 DEBUG: Log the values we're about to assign
    const newTitle = title.trim();
    const newDescription = description ? description.trim() : '';
    
    console.log('🐛 BACKEND DEBUG - Values being assigned:');
    console.log('  - newTitle:', JSON.stringify(newTitle));
    console.log('  - newDescription:', JSON.stringify(newDescription));
    
    // Update memory
    memory.title = newTitle;
    memory.description = newDescription;
    memory.updatedAt = new Date();
    
    // 🔍 DEBUG: Log memory state before saving
    console.log('🐛 BACKEND DEBUG - Memory object before save:');
    console.log('  - memory.title:', JSON.stringify(memory.title));
    console.log('  - memory.description:', JSON.stringify(memory.description));
    
    await memory.save();
    
    // 🔍 DEBUG: Log memory state after saving
    console.log('🐛 BACKEND DEBUG - Memory object after save:');
    console.log('  - memory.title:', JSON.stringify(memory.title));
    console.log('  - memory.description:', JSON.stringify(memory.description));
    
    // Populate creator and participants for response
    await memory.populate('creator', 'username fullName profilePicture');
    await memory.populate('participants', 'username fullName profilePicture');
    
    // 🔍 DEBUG: Log final response data
    const responseData = {
      message: 'Memory updated successfully',
      memory
    };
    console.log('🐛 BACKEND DEBUG - Response being sent:');
    console.log('  - response message:', responseData.message);
    console.log('  - response memory title:', JSON.stringify(responseData.memory.title));
    console.log('  - response memory description:', JSON.stringify(responseData.memory.description));
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error updating memory:', error);
    res.status(500).json({ message: 'Failed to update memory' });
  }
});
// ✅ DELETE: Remove participant from memory
router.delete('/:id/participants/:participantId', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const isCreator = memory.creator.equals(req.user.id);
    const isSelf = req.params.participantId === req.user.id;
    
    if (!isCreator && !isSelf) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // ✅ FIXED: Manual participant removal instead of using the buggy method
    const participantIdToRemove = req.params.participantId;
    
    // Cannot remove creator
    if (memory.creator.equals(participantIdToRemove)) {
      return res.status(400).json({ message: 'Cannot remove creator from memory' });
    }
    
    // Remove participant from array
    memory.participants = memory.participants.filter(p => 
      p && !p.equals(participantIdToRemove)  // ✅ FIXED: Added null check
    );
    
    await memory.save();
    await memory.populate('participants', 'username fullName profilePicture');
    
    res.json({ 
      message: 'Participant removed successfully',
      memory 
    });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ POST: Upload photos to memory
router.post('/:id/photos', protect, upload.single('photo'), async (req, res) => {
  try {
    const memoryId = req.params.id;
    
    // Verify memory exists and user has permission
    const memory = await Memory.findById(memoryId).select('participants creator title');
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // Check if user is creator or participant
    const isCreator = memory.creator.toString() === req.user._id.toString();
    const isParticipant = memory.participants.includes(req.user._id);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({ message: 'Not authorized to upload to this memory' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No photo provided' });
    }
    
    // Your existing photo upload logic here...
    // (save photo to database, process image, etc.)
    const photoData = {
      url: `/uploads/memory-photos/${req.file.filename}`,
      filename: req.file.filename,
      uploader: req.user._id,
      memory: memoryId,
      createdAt: new Date()
    };
    
    // Save photo (adjust based on your photo model)
    // const savedPhoto = await Photo.create(photoData);
    
    // 🆕 SEND NOTIFICATION TO OTHER PARTICIPANTS
    const allParticipants = [memory.creator, ...memory.participants];
    
    if (allParticipants.length > 1) {
      await notificationService.sendMemoryPhotoAdded(
        req.user._id,
        memoryId,
        allParticipants
      );
      
      console.log(`🔔 Sent memory photo notification to ${allParticipants.length - 1} participants`);
    }
    
    res.json({ 
      success: true, 
      message: 'Photo uploaded successfully',
      photo: photoData
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ DELETE: Remove photo from memory
router.delete('/:id/photos/:photoId', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const photo = await MemoryPhoto.findById(req.params.photoId);
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Verify photo belongs to this memory
    if (!photo.memory.equals(memory._id)) {
      return res.status(400).json({ message: 'Photo does not belong to this memory' });
    }
    
    // Only photo uploader or memory creator can delete
    const userId = req.user.id;
    const canDelete = photo.uploadedBy.equals(userId) || memory.creator.equals(userId);
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Soft delete the photo
    await photo.softDelete();
    
    // Remove photo reference from memory
    memory.photos = memory.photos.filter(p => !p.equals(photo._id));
    await memory.save();
    
    res.json({ message: 'Photo deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ message: 'Failed to delete photo' });
  }
});

// ✅ POST: Toggle like on memory photo
router.post('/photos/:photoId/like', protect, async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const userId = req.user._id;

    console.log('📷 Memory photo like request:', {
      photoId,
      userId: userId.toString()
    });

    // Find the memory photo
    const memoryPhoto = await MemoryPhoto.findById(photoId);
    if (!memoryPhoto) {
      return res.status(404).json({ message: 'Memory photo not found' });
    }

    console.log('📷 Current memory photo likes before toggle:', {
      likes: memoryPhoto.likes,
      likesCount: memoryPhoto.likes ? memoryPhoto.likes.length : 0
    });

    // ✅ CRITICAL FIX: Initialize likes array properly
    if (!memoryPhoto.likes) {
      memoryPhoto.likes = [];
    }

    // ✅ CRITICAL FIX: Handle both ObjectId array and object array formats
    let userLikedIndex = -1;
    let wasLiked = false;

    // Check if likes contains objects with user field or just ObjectIds
    if (memoryPhoto.likes.length > 0) {
      const firstLike = memoryPhoto.likes[0];
      
      if (firstLike && typeof firstLike === 'object' && firstLike.user) {
        // Likes array contains objects with user field
        userLikedIndex = memoryPhoto.likes.findIndex(like => 
          like.user && like.user.toString() === userId.toString()
        );
        wasLiked = userLikedIndex !== -1;
        console.log('📷 Using object format likes with user field');
      } else {
        // Likes array contains just ObjectIds
        userLikedIndex = memoryPhoto.likes.findIndex(likeId => 
          likeId.toString() === userId.toString()
        );
        wasLiked = userLikedIndex !== -1;
        console.log('📷 Using ObjectId format likes');
      }
    }

    console.log('📷 Current like status:', {
      wasLiked,
      userLikedIndex,
      likesArray: memoryPhoto.likes.map(like => 
        typeof like === 'object' && like.user ? like.user.toString() : like.toString()
      )
    });

    let newLikedStatus;
    let newLikesArray;

    if (wasLiked) {
      // Unlike: Remove user from likes array
      if (userLikedIndex !== -1) {
        newLikesArray = [...memoryPhoto.likes];
        newLikesArray.splice(userLikedIndex, 1);
      } else {
        newLikesArray = memoryPhoto.likes;
      }
      newLikedStatus = false;
      console.log('📷 Unliking memory photo');
    } else {
      // Like: Add user to likes array
      // ✅ CRITICAL FIX: Add just the ObjectId, not an object
      newLikesArray = [...memoryPhoto.likes, userId];
      newLikedStatus = true;
      console.log('📷 Liking memory photo');
    }

    console.log('📷 New likes array:', {
      newLikesArray: newLikesArray.map(like => 
        typeof like === 'object' && like.user ? like.user.toString() : like.toString()
      ),
      newLikedStatus,
      newCount: newLikesArray.length
    });

    // ✅ CRITICAL FIX: Update the memory photo with new likes array
    memoryPhoto.likes = newLikesArray;
    
    // Save the memory photo
    await memoryPhoto.save();

    const finalResponse = {
      success: true,
      liked: newLikedStatus,        
      userLiked: newLikedStatus,    
      likeCount: newLikesArray.length,
      likes: newLikesArray,         
      message: newLikedStatus ? 'Memory photo liked' : 'Memory photo unliked'
    };

    console.log('📷 Sending memory like response:', finalResponse);

    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('❌ Memory like endpoint error:', error);
    
    // ✅ ENHANCED: Better error handling for validation errors
    if (error.name === 'ValidationError') {
      console.error('❌ Validation error details:', error.errors);
      
      // If it's a likes validation error, try to fix the data
      if (error.message.includes('likes') && error.message.includes('user')) {
        console.log('🔧 Attempting to fix corrupted likes data...');
        
        try {
          const memoryPhoto = await MemoryPhoto.findById(req.params.photoId);
          if (memoryPhoto) {
            // Clean up likes array - ensure all entries are just ObjectIds
            const cleanedLikes = memoryPhoto.likes
              .map(like => {
                if (typeof like === 'object' && like.user) {
                  return like.user;
                } else if (typeof like === 'string' || like._id) {
                  return like;
                } else {
                  return null;
                }
              })
              .filter(like => like !== null);
            
            console.log('🔧 Cleaned likes array:', cleanedLikes);
            
            // Update with cleaned array
            await MemoryPhoto.findByIdAndUpdate(
              req.params.photoId,
              { likes: cleanedLikes },
              { runValidators: false } // Skip validation for cleanup
            );
            
            return res.status(200).json({
              success: false,
              message: 'Data cleaned up. Please try again.',
              likes: cleanedLikes,
              likeCount: cleanedLikes.length,
              userLiked: cleanedLikes.some(likeId => likeId.toString() === req.user._id.toString())
            });
          }
        } catch (cleanupError) {
          console.error('❌ Cleanup failed:', cleanupError);
        }
      }
      
      return res.status(400).json({ 
        message: 'Data validation error. Please refresh and try again.',
        error: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// ✅ GET: Get photo likes
router.get('/photos/:photoId/likes', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;
    
    console.log('📷 Getting memory photo likes:', { photoId, userId });
    
    const photo = await MemoryPhoto.findById(photoId);
    
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // ✅ CRITICAL FIX: Handle both like formats
    let userLiked = false;
    let likeCount = 0;
    
    if (photo.likes && Array.isArray(photo.likes)) {
      likeCount = photo.likes.length;
      
      // Check if likes contains objects with user field or just ObjectIds
      if (photo.likes.length > 0) {
        const firstLike = photo.likes[0];
        
        if (firstLike && typeof firstLike === 'object' && firstLike.user) {
          // Likes array contains objects with user field
          userLiked = photo.likes.some(like => 
            like.user && like.user.toString() === userId.toString()
          );
        } else {
          // Likes array contains just ObjectIds
          userLiked = photo.likes.some(likeId => 
            likeId.toString() === userId.toString()
          );
        }
      }
    }
    
    console.log('📷 Memory photo like status:', {
      userLiked,
      likeCount,
      userId
    });
    
    res.json({
      likes: photo.likes || [],
      likeCount: likeCount,
      userLiked: userLiked
    });
    
  } catch (error) {
    console.error('Error fetching memory photo likes:', error);
    res.status(500).json({ message: 'Failed to fetch likes' });
  }
});

// ✅ POST: Add comment to memory photo
router.post('/photos/:photoId/comments', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { text, tags = [] } = req.body;
    const userId = req.user.id;
    
    // Validate comment text
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    
    if (text.trim().length > 500) {
      return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
    }
    
    // Find the photo
    const photo = await MemoryPhoto.findById(photoId);
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Validate tags (if provided) - ensure tagged users are memory participants
    if (tags.length > 0) {
      const allParticipants = [memory.creator, ...memory.participants];
      const invalidTags = tags.filter(tagId => 
        !allParticipants.some(p => p.equals(tagId))
      );
      
      if (invalidTags.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot tag users who are not memory participants' 
        });
      }
    }
    
    // Add comment
    const comment = photo.addComment(userId, text, tags);
    await photo.save();
    
    // Populate the new comment
    await photo.populate({
      path: 'comments.user',
      select: 'username fullName profilePicture'
    });
    
    // Find the newly added comment
    const newComment = photo.comments[photo.comments.length - 1];
    
    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
      commentCount: photo.commentCount
    });
    
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// ✅ GET: Get photo comments
router.get('/photos/:photoId/comments', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    
    const photo = await MemoryPhoto.findById(photoId)
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      })
      .populate({
        path: 'comments.tags',
        select: 'username fullName'
      });
    
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Sort comments by newest first and paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    const sortedComments = photo.comments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(startIndex, endIndex);
    
    res.json({
      comments: sortedComments,
      commentCount: photo.commentCount,
      hasMore: endIndex < photo.comments.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// ✅ DELETE: Remove comment from memory photo
router.delete('/photos/comments/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    
    // Find photo containing this comment
    const photo = await MemoryPhoto.findOne({
      'comments._id': commentId,
      isDeleted: false
    });
    
    if (!photo) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find the specific comment
    const comment = photo.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Only comment author or memory creator can delete
    const canDelete = comment.user.equals(userId) || memory.creator.equals(userId);
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // Remove comment
    photo.comments.pull(commentId);
    await photo.save();
    
    res.json({
      message: 'Comment deleted successfully',
      commentCount: photo.commentCount
    });
    
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});


module.exports = router;