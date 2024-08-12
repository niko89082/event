const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const photoRoutes = require('./routes/photos');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const searchRoutes = require('./routes/search');
const checkinRoutes = require('./routes/checkin');
const profileRoutes = require('./routes/profile');
const followRoutes = require('./routes/follow');
const protect = require('./middleware/auth');
const cron = require('node-cron');
const Notification = require('./models/Notification');

// Run daily at midnight
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
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

// Socket.IO configuration
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('joinRoom', ({ conversationId }) => {
    socket.join(conversationId);
    console.log(`Joined room: ${conversationId}`);
  });

  socket.on('sendMessage', async ({ conversationId, message }) => {
    io.to(conversationId).emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiter to all requests
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/follow', followRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));