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
const multer = require('multer'); // ✅ ADD: Required for memory photo uploads

// Import routes
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
const memoryRoutes = require('./routes/memories');
const qrRoutes = require('./routes/qr');

// Import middleware and models
const protect = require('./middleware/auth');
const Notification = require('./models/Notification');

// Import the new EventPrivacyService
const EventPrivacyService = require('./services/eventPrivacyService');

// Load environment
dotenv.config();

// ✅ UPDATED: Ensure ALL uploads directories exist (including memory photos)
const uploadsDir = path.join(__dirname, 'uploads');
const photosDir = path.join(__dirname, 'uploads', 'photos');
const eventCoversDir = path.join(__dirname, 'uploads', 'event-covers');
const memoryPhotosDir = path.join(__dirname, 'uploads', 'memory-photos'); // ✅ ADD: Memory photos directory

[uploadsDir, photosDir, eventCoversDir, memoryPhotosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created upload directory: ${dir}`);
  }
});

// Example CRON job: delete old notifications every night at midnight
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

// ********************************
// 1) Maintain user -> socket mapping in memory
const connectedUsers = {}; 

// ********************************
// 2) Body parsing, static paths
// ✅ UPDATED: Increase limits for photo uploads
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

// ✅ UPDATED: Static file serving with proper headers for images
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    if (path.match(/\.(jpg|jpeg|png|gif)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache images for 1 day
      res.setHeader('Content-Type', 'image/*');
    }
  }
}));

// ✅ ADD: Global multer error handling (must be early in middleware stack)
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        message: 'Too many files. Maximum is 10 files per upload.',
        code: 'TOO_MANY_FILES'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        message: 'Unexpected file field.',
        code: 'UNEXPECTED_FILE'
      });
    }
    
    return res.status(400).json({ 
      message: `Upload error: ${error.message}`,
      code: error.code
    });
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({ 
      message: 'Only image files (JPEG, PNG, GIF) are allowed!',
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
});

// ********************************
// 3) Connect to Mongo with enhanced error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Enhanced index creation for privacy system
async function ensureIndexes() {
  try {
    const User = mongoose.model('User');
    const Event = mongoose.model('Event');

    await Promise.all([
      // Full-text search for users
      User.collection.createIndex(
        { username: 'text', displayName: 'text', bio: 'text' },
        { name: 'UserFullText', weights: { username: 10, displayName: 5, bio: 2 } }
      ),

      // Full-text search for events with privacy tags
      Event.collection.createIndex(
        { title: 'text', category: 'text', description: 'text', tags: 'text' },
        { name: 'EventFullText', weights: { title: 8, category: 5, description: 1, tags: 3 } }
      ),

      // Privacy and discovery indexes
      Event.collection.createIndex({ privacyLevel: 1, time: 1 }),
      Event.collection.createIndex({ 'permissions.appearInSearch': 1, time: 1 }),
      Event.collection.createIndex({ 'permissions.appearInFeed': 1, time: 1 }),
      Event.collection.createIndex({ host: 1, privacyLevel: 1 }),
      Event.collection.createIndex({ attendees: 1, time: 1 }),
      Event.collection.createIndex({ invitedUsers: 1 }),
      
      // Category and tag discovery
      Event.collection.createIndex({ category: 1, time: 1 }),
      Event.collection.createIndex({ tags: 1, time: 1 }),
      Event.collection.createIndex({ interests: 1, time: 1 }),
      
      // Weather and location indexes
      Event.collection.createIndex({ weatherDependent: 1, time: 1 }),
      Event.collection.createIndex(
        { geo: '2dsphere' },
        {
          name: 'GeoIndex',
          partialFilterExpression: { 'geo.coordinates.0': { $exists: true } }
        }
      ),

      // Time-based queries
      Event.collection.createIndex({ time: 1 }),
      Event.collection.createIndex({ createdAt: -1 }),
    ]);

    console.log('✅ Database indexes ensured for privacy system');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}

mongoose.connection.once('open', ensureIndexes);

// ********************************
// 4) Socket.io setup with enhanced event handling
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

  // Handle messages
  socket.on('sendMessage', async ({ conversationId, message }) => {
    io.to(conversationId).emit('message', message);
  });

  // Handle event updates (for live event changes)
  socket.on('eventUpdate', ({ eventId, update }) => {
    socket.to(`event_${eventId}`).emit('eventUpdated', update);
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

// ********************************
// 5) ROUTES WITH /api PREFIX FOR CONSISTENCY
// ********************************

// ✅ UPDATED: Health check endpoint with memory support indication
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    features: {
      eventPrivacy: true,
      recommendations: true,
      realTimeUpdates: true,
      memoryPhotos: true, // ✅ ADD: Indicate memory photo support
      fileUploads: true
    },
    uploadDirs: {
      photos: fs.existsSync(photosDir),
      eventCovers: fs.existsSync(eventCoversDir),
      memoryPhotos: fs.existsSync(memoryPhotosDir)
    }
  });
});

// API Routes
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
app.use('/api/memories', memoryRoutes); // ✅ ENSURE: Memory routes are properly registered
app.use('/api/users', usersRoutes);
app.use('/api/qr', qrRoutes);

// Legacy routes for backward compatibility (WITHOUT /api prefix)
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/photos', photoRoutes);
app.use('/notifications', notificationRoutes);
app.use('/profile', profileRoutes);
app.use('/follow', followRoutes);
app.use('/users', usersRoutes);
// ✅ REMOVE: Duplicate memory route registrations
// app.use('/api/memories', memoryRoutes); // This was duplicated
// app.use('/api/notifications', notificationRoutes); // This was duplicated

// ********************************
// 6) EVENT PRIVACY SYSTEM API ENDPOINTS
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
// 7) ERROR HANDLING MIDDLEWARE
// ********************************

// ✅ UPDATED: Handle 404 with better logging
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
      '/api/memories'
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
// 8) START SERVER
// ********************************

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket: Enabled`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
  console.log(`📸 Memory photos directory: ${memoryPhotosDir}`);
  
  // ✅ ADD: Verify upload directories on startup
  console.log('📂 Upload directories:');
  console.log(`   Photos: ${fs.existsSync(photosDir) ? '✅' : '❌'} ${photosDir}`);
  console.log(`   Event covers: ${fs.existsSync(eventCoversDir) ? '✅' : '❌'} ${eventCoversDir}`);
  console.log(`   Memory photos: ${fs.existsSync(memoryPhotosDir) ? '✅' : '❌'} ${memoryPhotosDir}`);
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