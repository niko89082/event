// scripts/addIndexes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function addSearchIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // User search indexes
    console.log('Creating user search indexes...');
    await db.collection('users').createIndex(
      { 
        username: 'text', 
        fullName: 'text', 
        email: 'text' 
      },
      {
        name: 'user_search_index',
        weights: { username: 3, fullName: 2, email: 1 }
      }
    );

    // Additional user indexes for performance
    await db.collection('users').createIndex({ username: 1 });
    await db.collection('users').createIndex({ email: 1 });
    await db.collection('users').createIndex({ followers: 1 });
    await db.collection('users').createIndex({ following: 1 });

    // Event search indexes
    console.log('Creating event search indexes...');
    await db.collection('events').createIndex(
      {
        title: 'text',
        description: 'text',
        'location.address': 'text'
      },
      {
        name: 'event_search_index',
        weights: { title: 3, description: 1, 'location.address': 2 }
      }
    );

    // Event performance indexes
    await db.collection('events').createIndex({ host: 1, time: 1 });
    await db.collection('events').createIndex({ time: 1, visibility: 1 });
    await db.collection('events').createIndex({ attendees: 1 });
    await db.collection('events').createIndex({ 'location.coordinates': '2dsphere' });

    // Memory indexes
    console.log('Creating memory indexes...');
    await db.collection('memories').createIndex({ createdBy: 1, createdAt: -1 });
    await db.collection('memories').createIndex({ participants: 1, createdAt: -1 });
    await db.collection('memories').createIndex({ createdAt: -1 });

    // Notification indexes
    await db.collection('notifications').createIndex({ user: 1, createdAt: -1 });
    await db.collection('notifications').createIndex({ user: 1, isRead: 1 });

    console.log('✅ All indexes created successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

addSearchIndexes();