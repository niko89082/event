/*************************************************
 * server.js (main server file) - UPDATED WITH MEMORY PHOTO SUPPORT
 *************************************************/
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const fs = require('fs');
const multer = require('multer'); // Required for memory photo uploads

// Load environment first
dotenv.config();

// ✅ ENSURE ALL uploads directories exist BEFORE importing routes
const uploadsDir = path.join(__dirname, 'uploads');
const photosDir = path.join(__dirname, 'uploads', 'photos');
const eventCoversDir = path.join(__dirname, 'uploads', 'event-covers');
const memoryPhotosDir = path.join(__dirname, 'uploads', 'memory-photos');

[uploadsDir, photosDir, eventCoversDir, memoryPhotosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created upload directory: ${dir}`);
  }
});

// Import routes AFTER ensuring directories exist
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');
const eventRoutes = require('./routes/events');
const photoRoutes = require('./routes/photos');
const messageRoutes = require('./routes/messages');
const searchRoutes = require('./routes/search');
const checkinRoutes = require('./routes/checkin');
const feedRoutes = require('./routes/feed');
const profileRoutes = require('./routes/profile');
const followRoutes = require('./routes/follow');
const usersRoutes = require('./routes/users');
const memoryRoutes = require('./routes/memories'); // ✅ This should work now
const qrRoutes = require('./routes/qr');

// Import middleware and models
const protect = require('./middleware/auth');
const Notification = require('./models/Notification');

// Import the EventPrivacyService
const EventPrivacyService = require('./services/eventPrivacyService');

// CRON job: delete old notifications every night at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 28); // 4 weeks
    await Notification.deleteMany({ createdAt: { $lt: cutoffDate } });
    console.log('Old notifications deleted successfully.');
  } catch (error) {
    console.error('Error deleting old notifications:', error);
  }
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Maintain user -> socket mapping in memory
const connectedUsers = {}; 

// Body parsing, static paths
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Static file serving with proper headers for images
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache images for 1 day
      res.setHeader('Content-Type', 'image/*');
    }
  }
}));

// Global multer error handling (must be early in middleware stack)
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error:', error);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          message: 'File too large. Maximum size is 10MB.',
          code: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          message: 'Too many files. Maximum is 10 files per upload.',
          code: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          message: 'Unexpected file field.',
          code: 'UNEXPECTED_FILE'
        });
      default:
        return res.status(400).json({ 
          message: `Upload error: ${error.message}`,
          code: error.code
        });
    }
  }
  
  if (error.message && error.message.includes('Only image files')) {
    return res.status(400).json({ 
      message: 'Only image files (JPEG, PNG, GIF, WebP) are allowed!',
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
});

// Connect to MongoDB with proper configuration
mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Enhanced index creation for privacy system (with conflict handling)
async function ensureIndexes() {
  try {
    console.log('🔍 Checking existing indexes...');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Helper function to safely create indexes
    async function safeCreateIndex(collection, indexSpec, options = {}) {
      try {
        await collection.createIndex(indexSpec, options);
        console.log(`✅ Created index: ${options.name || JSON.stringify(indexSpec)}`);
      } catch (error) {
        if (error.code === 85) { // IndexOptionsConflict
          console.log(`⚠️  Index already exists: ${options.name || JSON.stringify(indexSpec)}`);
          
          // Optionally drop and recreate if needed
          if (options.forceRecreate) {
            try {
              await collection.dropIndex(options.name);
              await collection.createIndex(indexSpec, options);
              console.log(`✅ Recreated index: ${options.name}`);
            } catch (recreateError) {
              console.log(`❌ Failed to recreate index: ${options.name}`, recreateError.message);
            }
          }
        } else {
          console.log(`❌ Error creating index: ${options.name || JSON.stringify(indexSpec)}`, error.message);
        }
      }
    }
    
    // Only create indexes if collections exist
    if (collectionNames.includes('users')) {
      const User = mongoose.model('User');
      await safeCreateIndex(
        User.collection,
        { username: 'text', displayName: 'text', bio: 'text' },
        { 
          name: 'UserFullText', 
          weights: { username: 10, displayName: 5, bio: 2 }
        }
      );
    }

    if (collectionNames.includes('events')) {
      const Event = mongoose.model('Event');
      
      // Create text index with proper conflict handling
      await safeCreateIndex(
        Event.collection,
        { title: 'text', category: 'text', description: 'text', tags: 'text' },
        { 
          name: 'EventFullText', 
          weights: { title: 8, category: 5, description: 1, tags: 3 }
        }
      );
      
      // Create other indexes
      const eventIndexes = [
        { spec: { privacyLevel: 1, time: 1 }, options: { name: 'privacy_time' } },
        { spec: { host: 1, privacyLevel: 1 }, options: { name: 'host_privacy' } },
        { spec: { attendees: 1, time: 1 }, options: { name: 'attendees_time' } },
        { spec: { time: 1 }, options: { name: 'time_index' } },
        { spec: { createdAt: -1 }, options: { name: 'created_desc' } },
      ];
      
      for (const { spec, options } of eventIndexes) {
        await safeCreateIndex(Event.collection, spec, options);
      }
    }

    // ✅ Memory indexes
    if (collectionNames.includes('memories')) {
      const Memory = mongoose.model('Memory');
      
      const memoryIndexes = [
        { spec: { creator: 1, createdAt: -1 }, options: { name: 'creator_created' } },
        { spec: { participants: 1, createdAt: -1 }, options: { name: 'participants_created' } },
        { spec: { isDeleted: 1 }, options: { name: 'deleted_flag' } },
        { spec: { isPrivate: 1 }, options: { name: 'private_flag' } },
        { spec: { creator: 1, isDeleted: 1 }, options: { name: 'creator_deleted' } },
        { spec: { participants: 1, isDeleted: 1 }, options: { name: 'participants_deleted' } },
      ];
      
      for (const { spec, options } of memoryIndexes) {
        await safeCreateIndex(Memory.collection, spec, options);
      }
    }

    if (collectionNames.includes('memoryphotos')) {
      const MemoryPhoto = mongoose.model('MemoryPhoto');
      
      const photoIndexes = [
        { spec: { memory: 1, uploadedAt: -1 }, options: { name: 'memory_uploaded' } },
        { spec: { uploadedBy: 1, uploadedAt: -1 }, options: { name: 'uploader_uploaded' } },
        { spec: { isDeleted: 1 }, options: { name: 'photo_deleted' } },
        { spec: { likes: 1 }, options: { name: 'photo_likes' } },
        { spec: { memory: 1, isDeleted: 1, uploadedAt: -1 }, options: { name: 'memory_deleted_uploaded' } },
      ];
      
      for (const { spec, options } of photoIndexes) {
        await safeCreateIndex(MemoryPhoto.collection, spec, options);
      }
    }

    console.log('✅ Database indexes ensured for privacy and memory systems');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}

mongoose.connection.once('open', ensureIndexes);

// Socket.io setup with enhanced event handling
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  // Add authentication if needed
  next();
});

io.on('connection', (socket) => {
  console.log('🔗 New client connected:', socket.id);

  // Handle room joining for conversations
  socket.on('joinRoom', ({ conversationId, userId }) => {
    socket.join(conversationId);
    if (userId) {
      connectedUsers[userId] = socket.id;
    }
    console.log(`Socket ${socket.id} joined room: ${conversationId}`);
  });

  // Handle event-related real-time updates
  socket.on('joinEventRoom', ({ eventId }) => {
    socket.join(`event_${eventId}`);
    console.log(`Socket ${socket.id} joined event room: ${eventId}`);
  });

  // ✅ ADD: Memory room handling
  socket.on('joinMemoryRoom', ({ memoryId }) => {
    socket.join(`memory_${memoryId}`);
    console.log(`Socket ${socket.id} joined memory room: ${memoryId}`);
  });

  // Handle messages
  socket.on('sendMessage', async ({ conversationId, message }) => {
    io.to(conversationId).emit('message', message);
  });

  // Handle event updates
  socket.on('eventUpdate', ({ eventId, update }) => {
    socket.to(`event_${eventId}`).emit('eventUpdated', update);
  });

  // ✅ ADD: Memory updates
  socket.on('memoryUpdate', ({ memoryId, update }) => {
    socket.to(`memory_${memoryId}`).emit('memoryUpdated', update);
  });

  // ✅ ADD: Memory photo likes/comments
  socket.on('memoryPhotoLike', ({ memoryId, photoId, like }) => {
    socket.to(`memory_${memoryId}`).emit('photoLiked', { photoId, like });
  });

  socket.on('memoryPhotoComment', ({ memoryId, photoId, comment }) => {
    socket.to(`memory_${memoryId}`).emit('photoCommented', { photoId, comment });
  });

  // Handle typing indicators
  socket.on('typing', ({ conversationId, username }) => {
    socket.to(conversationId).emit('typing', { username });
  });

  socket.on('stopTyping', ({ conversationId, username }) => {
    socket.to(conversationId).emit('stopTyping', { username });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    // Remove from connected users
    Object.keys(connectedUsers).forEach(userId => {
      if (connectedUsers[userId] === socket.id) {
        delete connectedUsers[userId];
      }
    });
  });
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for privacy system
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check endpoint with memory support indication
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    features: {
      eventPrivacy: true,
      recommendations: true,
      realTimeUpdates: true,
      memoryPhotos: true,
      fileUploads: true
    },
    uploadDirs: {
      photos: fs.existsSync(photosDir),
      eventCovers: fs.existsSync(eventCoversDir),
      memoryPhotos: fs.existsSync(memoryPhotosDir)
    }
  });
});

// ********************************
// API ROUTES WITH /api PREFIX
// ********************************

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/messages', messageRoutes(io, connectedUsers)); 
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/follow', followRoutes);
app.use('/api', feedRoutes);
app.use('/api/memories', memoryRoutes); // ✅ Memory routes
app.use('/api/users', usersRoutes);
app.use('/api/qr', qrRoutes);

// ✅ Legacy routes for backward compatibility (WITHOUT /api prefix)
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/photos', photoRoutes);
app.use('/notifications', notificationRoutes);
app.use('/profile', profileRoutes);
app.use('/follow', followRoutes);
app.use('/users', usersRoutes);
app.use('/memories', memoryRoutes); // ✅ Legacy memory routes

// ********************************
// EVENT PRIVACY SYSTEM API ENDPOINTS
// ********************************

// Get event recommendations
app.get('/api/events/recommendations', protect, async (req, res) => {
  try {
    const { location, weather, limit = 10 } = req.query;
    
    const options = { limit: parseInt(limit) };
    
    if (location) {
      try {
        options.location = JSON.parse(location);
      } catch (e) {
        console.log('Invalid location format');
      }
    }

    if (weather) {
      try {
        options.weatherData = JSON.parse(weather);
      } catch (e) {
        console.log('Invalid weather format');
      }
    }

    const recommendations = await EventPrivacyService.getRecommendations(req.user._id, options);
    res.json(recommendations);
  } catch (e) {
    console.error('Get recommendations error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends activity
app.get('/api/events/friends-activity', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const events = await EventPrivacyService.getFriendsActivity(req.user._id, { 
      limit: parseInt(limit) 
    });
    res.json(events);
  } catch (e) {
    console.error('Get friends activity error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check event permissions
app.get('/api/events/:eventId/permissions/:action', protect, async (req, res) => {
  try {
    const { eventId, action } = req.params;
    const permission = await EventPrivacyService.checkPermission(
      req.user._id, 
      eventId, 
      action
    );
    res.json(permission);
  } catch (e) {
    console.error('Check permission error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ********************************
// ✅ MEMORY SYSTEM API ENDPOINTS
// ********************************

// Share memory via socket (real-time sharing)
app.post('/api/memories/:memoryId/share', protect, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { recipientIds, message } = req.body;

    // Emit to connected recipients
    recipientIds.forEach(recipientId => {
      const socketId = connectedUsers[recipientId];
      if (socketId) {
        io.to(socketId).emit('memoryShared', {
          memoryId,
          sharedBy: req.user._id,
          message
        });
      }
    });

    res.json({ success: true, message: 'Memory shared successfully' });
  } catch (error) {
    console.error('Error sharing memory:', error);
    res.status(500).json({ message: 'Failed to share memory' });
  }
});

// Get memory analytics
app.get('/api/memories/:memoryId/analytics', protect, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const Memory = require('./models/Memory');
    const MemoryPhoto = require('./models/MemoryPhoto');

    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Check access
    if (!memory.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get analytics
    const photos = await MemoryPhoto.find({ memory: memoryId, isDeleted: false });
    const totalLikes = photos.reduce((sum, photo) => sum + photo.likes.length, 0);
    const totalComments = photos.reduce((sum, photo) => sum + photo.comments.length, 0);
    const totalViews = photos.reduce((sum, photo) => sum + photo.viewCount, 0);

    res.json({
      success: true,
      analytics: {
        photoCount: photos.length,
        totalLikes,
        totalComments,
        totalViews,
        participantCount: memory.participants.length + 1, // +1 for creator
        createdAt: memory.createdAt,
        lastActivity: photos.length > 0 ? 
          Math.max(...photos.map(p => new Date(p.uploadedAt))) : 
          memory.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting memory analytics:', error);
    res.status(500).json({ message: 'Failed to get analytics' });
  }
});

// ********************************
// ERROR HANDLING MIDDLEWARE
// ********************************

// Handle 404 with better logging
app.use('*', (req, res) => {
  console.log('🟡 Route not found:', req.method, req.originalUrl);
  res.status(404).json({ 
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: [
      '/api/auth',
      '/api/events',
      '/api/photos',
      '/api/messages',
      '/api/notifications',
      '/api/search',
      '/api/profile',
      '/api/follow',
      '/api/users',
      '/api/memories', // ✅ Include memories in available routes
      '/api/qr'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ 
      message: 'Validation Error', 
      errors 
    });
  }
  
  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(404).json({ 
      message: 'Resource not found' 
    });
  }
  
  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      message: 'Invalid token' 
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ********************************
// START SERVER
// ********************************

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket: Enabled`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
  console.log(`📸 Memory photos directory: ${memoryPhotosDir}`);
  
  // Verify upload directories on startup
  console.log('📂 Upload directories:');
  console.log(`   Photos: ${fs.existsSync(photosDir) ? '✅' : '❌'} ${photosDir}`);
  console.log(`   Event covers: ${fs.existsSync(eventCoversDir) ? '✅' : '❌'} ${eventCoversDir}`);
  console.log(`   Memory photos: ${fs.existsSync(memoryPhotosDir) ? '✅' : '❌'} ${memoryPhotosDir}`);
  
  // ✅ Test memory routes
  console.log('🧠 Memory system: ✅ Enabled');
  console.log('   Available memory endpoints:');
  console.log('   - GET    /api/memories (list memories)');
  console.log('   - POST   /api/memories (create memory)');
  console.log('   - GET    /api/memories/:id (get memory details)');
  console.log('   - PUT    /api/memories/:id (update memory)');
  console.log('   - DELETE /api/memories/:id (delete memory)');
  console.log('   - POST   /api/memories/:id/photos (upload photos)');
  console.log('   - POST   /api/memories/photos/:photoId/like (like photo)');
  console.log('   - POST   /api/memories/photos/:photoId/comments (add comment)');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('🔌 Process terminated');
    mongoose.connection.close(false, () => {
      console.log('📊 MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('🔌 Process terminated');
    mongoose.connection.close(false, () => {
      console.log('📊 MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;