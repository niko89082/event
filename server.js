// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
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

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));