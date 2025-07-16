// scripts/fixIndexConflict.js - Run this script to fix the index conflict

const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexConflict() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Drop the conflicting index
    try {
      await db.collection('events').dropIndex('EventFullText');
      console.log('✅ Dropped existing EventFullText index');
    } catch (error) {
      console.log('ℹ️ Index EventFullText does not exist or already dropped');
    }

    // Recreate the index with the correct options including 'tags'
    await db.collection('events').createIndex(
      {
        title: 'text',
        description: 'text',
        category: 'text',
        tags: 'text' // ✅ ADD: Include tags in the text index
      },
      {
        name: 'EventFullText',
        weights: { 
          title: 8, 
          category: 5, 
          tags: 3, 
          description: 1 
        },
        default_language: 'english'
      }
    );

    console.log('✅ Recreated EventFullText index with tags support');
    console.log('🎉 Index conflict resolved successfully');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing index conflict:', error);
    process.exit(1);
  }
}

// Run the fix
fixIndexConflict();