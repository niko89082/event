/*************************************************
 * server.js (main server file) - FIXED ROUTES
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
const memoryRoutes = require('./routes/memories');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const photoRoutes = require('./routes/photos');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const searchRoutes = require('./routes/search');
const checkinRoutes = require('./routes/checkin');
const feedRoutes = require('./routes/feed');
const profileRoutes = require('./routes/profile');
const followRoutes = require('./routes/follow');
const usersRoutes = require('./routes/users');

const protect = require('./middleware/auth');
const Notification = require('./models/Notification');

// Load environment
dotenv.config();

// Ensure uploads/photos directory exists
const photosDir = path.join(__dirname, 'uploads', 'photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

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
const io = socketIo(server);

// ********************************
// 1) Maintain user -> socket mapping in memory
//    For a large, production-scale site, you'd typically store this
//    in Redis or another shared store, especially if you run multiple servers.
const connectedUsers = {}; 
// Format: connectedUsers[userId] = [socketId1, socketId2, ...]

// ********************************
// 2) Body parsing, static paths
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ********************************
// 3) Connect to Mongo
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

async function ensureIndexes () {
  const User   = mongoose.model('User');
  const Event  = mongoose.model('Event');

  await Promise.all([
    /* full-text for users */
    User.collection.createIndex(
      { username: 'text', displayName: 'text', bio: 'text' },
      { name: 'UserFullText', weights: { username: 10, displayName: 5, bio: 2 } }
    ),

    /* full-text for events */
    Event.collection.createIndex(
      { title: 'text', category: 'text', description: 'text' },
      { name: 'EventFullText', weights: { title: 8, category: 5, description: 1 } }
    ),

    /* upcoming-date index */
    Event.collection.createIndex({ time: 1 }),

    /* geo index on the GEO field, **NOT** on location string.
       The partialFilter avoids errors if some legacy docs
       still miss the geo.coordinates array. */
    Event.collection.createIndex(
      { geo: '2dsphere' },
      {
        name: 'GeoIndex',
        partialFilterExpression: { 'geo.coordinates.0': { $exists: true } }
      }
    )
  ]);

  console.log('✅  indexes ensured');
}
mongoose.connection.once('open', ensureIndexes);

// ********************************
// 4) Socket.io setup
//    Optionally parse JWT from handshake, attach user to socket, etc.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  next();
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', ({ conversationId }) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined room: ${conversationId}`);
  });

  socket.on('sendMessage', async ({ conversationId, message }) => {
    io.to(conversationId).emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, 
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// ********************************
// 5) FIXED ROUTES - Added /api prefix consistently
// ********************************
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);  // Changed from /events to /api/events
app.use('/api/photos', photoRoutes);
app.use('/api/messages', messageRoutes(io, connectedUsers)); 
app.use('/api/notifications', notificationRoutes);  // Now matches client expectation
app.use('/api/search', searchRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/profile', profileRoutes);  // Now matches client expectation
app.use('/api/follow', followRoutes);
app.use('/api', feedRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/users', usersRoutes);  // Changed from /users to /api/users

// Legacy routes for backward compatibility (if needed)
app.use('/events', eventRoutes);
app.use('/notifications', notificationRoutes);
app.use('/profile', profileRoutes);
app.use('/follow', followRoutes);
app.use('/users', usersRoutes);

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));