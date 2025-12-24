/*************************************************
 * server.js (main server file) - PHASE 1: UPDATED WITH FRIENDS SYSTEM + MEMORY PHOTOS
 *************************************************/
require('dotenv').config();

// Auto-update IP address in .env files
try {
  require('./scripts/updateIpAddress.js');
} catch (error) {
  console.log('⚠️  Could not auto-update IP address:', error.message);
} 
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const fs = require('fs');
const multer = require('multer');

// Import routes
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');
const eventRoutes = require('./routes/events');
const photoRoutes = require('./routes/photos');
const messageRoutes = require('./trash/messages');
const searchRoutes = require('./routes/search');
const checkinRoutes = require('./routes/checkin');
const feedRoutes = require('./routes/feed');
const profileRoutes = require('./routes/profile');
const usersRoutes = require('./routes/users');
const memoryRoutes = require('./routes/memories');
const qrRoutes = require('./routes/qr');
const formsRoutes = require('./routes/forms');

// ✅ NEW: Friends System Routes (Phase 1)
const friendsRoutes = require('./routes/friends');

// 🔄 DEPRECATED: Keep follower routes during migration (will be removed in Phase 5)
const followRoutes = require('./routes/follow');

// Import middleware and models
const protect = require('./middleware/auth');
const Notification = require('./models/Notification');

// Import services
const EventPrivacyService = require('./services/eventPrivacyService');

// ✅ UPDATED: Ensure ALL uploads directories exist (including memory photos)
const uploadsDir = path.join(__dirname, 'uploads');
const photosDir = path.join(__dirname, 'uploads', 'photos');
const eventCoversDir = path.join(__dirname, 'uploads', 'event-covers');
const memoryPhotosDir = path.join(__dirname, 'uploads', 'memory-photos');
const profilePicturesDir = path.join(__dirname, 'uploads', 'profile-pictures');

[uploadsDir, photosDir, eventCoversDir, memoryPhotosDir, profilePicturesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created upload directory: ${dir}`);
  }
});

// Cleanup CRON job: delete old notifications every night at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 28); // 4 weeks

    // ✅ SAFE TO DELETE: Informational notifications that don't require action
    const safeToDeleteTypes = [
      'friend_request_accepted',     // ✅ Informational - user was notified, no action needed
      'new_follower',               // ✅ Informational - user was notified, no action needed  
      'memory_photo_added',         // ✅ Informational - photo was added to memory
      'memory_photo_batch',         // ✅ Informational - batch photos added
      'memory_photo_liked',         // ✅ Informational - someone liked their photo
      'event_reminder',             // ✅ Past events - reminder is no longer relevant
      'event_reminder_1_hour',      // ✅ Past events - reminder is no longer relevant
      'event_update',               // ✅ Old event updates are not actionable
      'event_cancelled',            // ✅ Cancellation notifications are informational
      'event_announcement',         // ✅ Old announcements are not actionable
      'event_rsvp_batch',          // ✅ Informational - RSVP summary
      'post_liked',                // ✅ Informational - like notification
      'post_commented',            // ✅ Informational - comment notification
      'cohost_added',              // ✅ Informational - user was notified of cohost status
      'cohost_left',               // ✅ Informational - user was notified of cohost removal
    ];

    // ✅ DELETE: Safe notifications older than 28 days
    const safeDeleteResult = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      type: { $in: safeToDeleteTypes }
    });

    console.log(`🧹 Deleted ${safeDeleteResult.deletedCount} old informational notifications`);

    // ✅ ADDITIONAL CLEANUP: Delete very old friend requests (6 months+) that are likely stale
    const veryOldCutoff = new Date();
    veryOldCutoff.setMonth(veryOldCutoff.getMonth() - 6); // 6 months

    const staleRequestsResult = await Notification.deleteMany({
      createdAt: { $lt: veryOldCutoff },
      type: 'friend_request',
      isRead: false // Only delete unread ones (read ones might have been seen but not acted on)
    });

    console.log(`🧹 Deleted ${staleRequestsResult.deletedCount} stale friend requests (6+ months old)`);

    // ✅ PRESERVE: Important actionable notifications (these should NOT be auto-deleted)
    const preservedTypes = [
      'friend_request',            // 🔒 PRESERVE - User needs to accept/reject
      'event_invitation',          // 🔒 PRESERVE - User needs to RSVP (events might be in future)
      'memory_invitation',         // 🔒 PRESERVE - User needs to join memory
      'cohost_permission_denied',  // 🔒 PRESERVE - Important permission info
    ];

    // ✅ LOG: Count of preserved actionable notifications
    const preservedCount = await Notification.countDocuments({
      createdAt: { $lt: cutoffDate },
      type: { $in: preservedTypes }
    });

    if (preservedCount > 0) {
      console.log(`🔒 Preserved ${preservedCount} actionable notifications (friend requests, invitations, etc.)`);
    }

    // ✅ SUMMARY: Log cleanup results
    const totalDeleted = safeDeleteResult.deletedCount + staleRequestsResult.deletedCount;
    console.log(`✅ Notification cleanup complete: ${totalDeleted} total deleted, ${preservedCount} preserved`);

  } catch (error) {
    console.error('❌ Error in enhanced notification cleanup:', error);
  }
});

// ✅ OPTIONAL: Additional cleanup for resolved friend requests
// This runs separately to clean up friend requests that have been acted upon
cron.schedule('0 2 * * 0', async () => { // Runs weekly on Sunday at 2 AM
  try {
    // Clean up friend requests that have been resolved (accepted/rejected)
    // These have actionTaken data indicating they were processed
    const resolvedRequestsResult = await Notification.deleteMany({
      type: 'friend_request',
      'data.actionTaken': { $in: ['accepted', 'rejected'] },
      createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 1 week old
    });

    if (resolvedRequestsResult.deletedCount > 0) {
      console.log(`🧹 Weekly cleanup: Deleted ${resolvedRequestsResult.deletedCount} resolved friend requests`);
    }

  } catch (error) {
    console.error('❌ Error in weekly friend request cleanup:', error);
  }
});

// ✅ NEW: Daily friend suggestions refresh (if implemented)
cron.schedule('0 6 * * *', async () => {
  try {
    // TODO: Implement friend suggestions refresh logic
    console.log('🔄 Friend suggestions refresh scheduled for future implementation');
  } catch (error) {
    console.error('❌ Error refreshing friend suggestions:', error);
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

// ✅ ENHANCED: Global multer error handling (must be early in middleware stack)
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

// ✅ ENHANCED: Index creation for friends system + privacy system
async function ensureIndexes() {
  try {
    const User = mongoose.model('User');
    const Event = mongoose.model('Event');
    const Photo = mongoose.model('Photo');

    await Promise.all([
      // ✅ NEW: Friends system indexes
      User.collection.createIndex({ 'friends.user': 1, 'friends.status': 1 }),
      User.collection.createIndex({ 'friends.initiatedBy': 1 }),
      User.collection.createIndex({ 'friends.createdAt': -1 }),
      User.collection.createIndex({ 'privacy.friendRequests': 1 }),
      User.collection.createIndex({ migratedToFriendsAt: 1 }),

      // Full-text search for users
      User.collection.createIndex(
        { username: 'text', bio: 'text' },
        { name: 'UserFullText', weights: { username: 10, bio: 2 } }
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

      // ✅ NEW: Photo privacy indexes for friends system
      Photo.collection.createIndex({ user: 1, 'visibility.level': 1 }),
      Photo.collection.createIndex({ event: 1, user: 1 }),
      Photo.collection.createIndex({ taggedEvent: 1, user: 1 }),
      Photo.collection.createIndex({ uploadDate: -1 }),

      // Notification indexes
      Notification.collection.createIndex({ user: 1, read: 1, createdAt: -1 }),
      Notification.collection.createIndex({ user: 1, category: 1, read: 1 }),
    ]);

    console.log('✅ Database indexes ensured for friends + privacy system');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}

mongoose.connection.once('open', ensureIndexes);

// ********************************
// 4) Socket.io setup with enhanced event handling for friends system
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

  // ✅ NEW: Handle friend request real-time updates
  socket.on('joinUserRoom', ({ userId }) => {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined user room: ${userId}`);
  });

  // Handle messages
  socket.on('sendMessage', async ({ conversationId, message }) => {
    io.to(conversationId).emit('message', message);
  });

  // Handle event updates (for live event changes)
  socket.on('eventUpdate', ({ eventId, update }) => {
    socket.to(`event_${eventId}`).emit('eventUpdated', update);
  });

  // ✅ NEW: Handle friend request updates
  socket.on('friendRequestSent', ({ targetUserId, requesterData }) => {
    socket.to(`user_${targetUserId}`).emit('friendRequestReceived', requesterData);
  });

  socket.on('friendRequestAccepted', ({ requesterUserId, accepterData }) => {
    socket.to(`user_${requesterUserId}`).emit('friendRequestAccepted', accepterData);
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

// Rate limiting with increased limits for friends system
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for friends system operations
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ********************************
// 5) ROUTES WITH /api PREFIX FOR CONSISTENCY
// ********************************

// ✅ ENHANCED: Health check endpoint with friends system support indication
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    features: {
      friendsSystem: true,         // ✅ NEW: Friends system enabled
      eventPrivacy: true,
      recommendations: true,
      realTimeUpdates: true,
      memoryPhotos: true,
      fileUploads: true,
      migration: {
        phase: 1,
        description: 'Friends system active, follower system deprecated'
      }
    },
    uploadDirs: {
      photos: fs.existsSync(photosDir),
      eventCovers: fs.existsSync(eventCoversDir),
      memoryPhotos: fs.existsSync(memoryPhotosDir),
      profilePictures: fs.existsSync(profilePicturesDir)
    }
  });
});

// ✅ NEW: Migration status endpoint
app.get('/api/migration/status', protect, async (req, res) => {
  try {
    const User = require('./models/User');
    
    const totalUsers = await User.countDocuments();
    const migratedUsers = await User.countDocuments({ migratedToFriendsAt: { $exists: true } });
    const usersWithFriends = await User.countDocuments({ friends: { $exists: true, $not: { $size: 0 } } });
    const usersWithFollowers = await User.countDocuments({ followers: { $exists: true, $not: { $size: 0 } } });
    
    res.status(200).json({
      migration: {
        phase: 1,
        status: migratedUsers > 0 ? 'in-progress' : 'pending',
        totalUsers,
        migratedUsers,
        migrationProgress: totalUsers > 0 ? Math.round((migratedUsers / totalUsers) * 100) : 0,
        usersWithFriends,
        usersWithFollowers,
        isComplete: migratedUsers === totalUsers,
        canCleanup: migratedUsers === totalUsers && usersWithFollowers === 0
      },
      features: {
        friendsSystemEnabled: true,
        followerSystemDeprecated: true,
        bothSystemsRunning: migratedUsers > 0 && usersWithFollowers > 0
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get migration status',
      message: error.message 
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/messages', messageRoutes(io, connectedUsers)); 
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/forms', formsRoutes); 
app.use('/api/profile', profileRoutes);

// ✅ NEW: Friends system routes (Phase 1)
app.use('/api/friends', friendsRoutes);

// 🔄 DEPRECATED: Follower routes (keep during migration)
app.use('/api/follow', followRoutes);

app.use('/api', feedRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/qr', qrRoutes);

// Legacy routes for backward compatibility (WITHOUT /api prefix)
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/photos', photoRoutes);
app.use('/notifications', notificationRoutes);
app.use('/profile', profileRoutes);
app.use('/follow', followRoutes); // Keep legacy follow routes during migration
app.use('/users', usersRoutes);

// ********************************
// 6) FRIENDS SYSTEM API ENDPOINTS
// ********************************

// ✅ NEW: Get mutual friends between two users
app.get('/api/friends/mutual/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    const User = require('./models/User');
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);
    
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const currentFriends = currentUser.getAcceptedFriends().map(id => String(id));
    const targetFriends = targetUser.getAcceptedFriends().map(id => String(id));
    
    const mutualFriendIds = currentFriends.filter(id => targetFriends.includes(id));
    
    const mutualFriends = await User.find({ _id: { $in: mutualFriendIds } })
      .select('username profilePicture displayName')
      .limit(10);
    
    res.json({
      mutualFriends,
      count: mutualFriendIds.length,
      totalMutual: mutualFriendIds.length
    });
    
  } catch (error) {
    console.error('Get mutual friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ NEW: Get friend activity feed
app.get('/api/friends/activity', protect, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const User = require('./models/User');
    const Photo = require('./models/Photo');
    const Event = require('./models/Event');
    
    const currentUser = await User.findById(req.user._id);
    const friendIds = currentUser.getAcceptedFriends();
    
    // Get recent activity from friends
    const [friendPosts, friendEvents] = await Promise.all([
      Photo.find({ user: { $in: friendIds } })
        .populate('user', 'username profilePicture')
        .populate('event', 'title time')
        .sort({ uploadDate: -1 })
        .limit(parseInt(limit) / 2),
        
      Event.find({ 
        host: { $in: friendIds },
        time: { $gte: new Date() }
      })
        .populate('host', 'username profilePicture')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit) / 2)
    ]);
    
    // Combine and sort by recency
    const activity = [
      ...friendPosts.map(post => ({
        type: 'photo',
        data: post,
        timestamp: post.uploadDate,
        user: post.user
      })),
      ...friendEvents.map(event => ({
        type: 'event',
        data: event,
        timestamp: event.createdAt,
        user: event.host
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, parseInt(limit));
    
    res.json({ activity });
    
  } catch (error) {
    console.error('Get friend activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ********************************
// 7) EVENT PRIVACY SYSTEM API ENDPOINTS
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

// Get friends activity (enhanced for friends system)
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
// 8) ERROR HANDLING MIDDLEWARE
// ********************************

// ✅ UPDATED: Handle 404 with better logging and friends system routes
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
      '/api/friends',      // ✅ NEW
      '/api/follow',       // 🔄 DEPRECATED
      '/api/messages',
      '/api/notifications',
      '/api/search',
      '/api/profile',
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
// 9) START SERVER
// ********************************

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('\n🚀 Social App Server Started - Phase 1: Friends System');
  console.log('=====================================');
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Server: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: Enabled`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
  console.log('=====================================');
  console.log('✅ Friends System: ENABLED (Phase 1)');
  console.log('🔄 Follower System: DEPRECATED (Migration Period)');
  console.log('📸 Memory Photos: ENABLED');
  console.log('🔒 Event Privacy: ENABLED');
  console.log('\n📂 Upload directories:');
  console.log(`   Photos: ${fs.existsSync(photosDir) ? '✅' : '❌'} ${photosDir}`);
  console.log(`   Event covers: ${fs.existsSync(eventCoversDir) ? '✅' : '❌'} ${eventCoversDir}`);
  console.log(`   Memory photos: ${fs.existsSync(memoryPhotosDir) ? '✅' : '❌'} ${memoryPhotosDir}`);
  console.log(`   Profile pictures: ${fs.existsSync(profilePicturesDir) ? '✅' : '❌'} ${profilePicturesDir}`);
  console.log('\n🎯 Available API Routes:');
  console.log('   • /api/friends/* (NEW - Friends System)');
  console.log('   • /api/follow/* (DEPRECATED - Will be removed)');
  console.log('   • /api/auth/*');
  console.log('   • /api/profile/*');
  console.log('   • /api/events/*');
  console.log('   • /api/photos/*');
  console.log('   • /api/memories/*');
  console.log('   • /api/notifications/*');
  console.log('   • /api/messages/*');
  console.log('   • /api/search/*');
  console.log('   • /api/users/*');
  console.log('\n💡 Migration Commands:');
  console.log('   Run migration: node scripts/migrateToFriendsSystem.js');
  console.log('   Check status: GET /api/migration/status');
  console.log('   Generate report: node scripts/migrateToFriendsSystem.js --report');
  console.log('\n🎉 Ready for Phase 1 Testing!');
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