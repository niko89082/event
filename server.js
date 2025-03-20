/*************************************************
 * server.js (main server file)
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

// ********************************
// 4) Socket.io setup
//    Optionally parse JWT from handshake, attach user to socket, etc.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  // If you want to decode the token to identify the user:
  //  const userId = decodeJwt(token);
  //  if (userId) { socket.userId = userId; }
  // For now, we'll just proceed:
  next();
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);


  // Listen for "joinRoom" to join conversation-based rooms
  socket.on('joinRoom', ({ conversationId }) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined room: ${conversationId}`);
  });

  // Listen for "sendMessage" from client for real-time broadcast
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
app.use('/api/memories', memoryRoutes);
app.use('/users', usersRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

