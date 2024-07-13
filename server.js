// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const protect = require('./middleware/auth');

dotenv.config();

const app = express();
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err))
  .finally(console.log(process.env.MONGO_URI));

// Routes
app.use('/api/auth', authRoutes);

// A protected route example
app.get('/api/protected', protect, (req, res) => {
  res.status(200).json({ message: 'This is a protected route', user: req.user });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
