// scripts/simpleMigration.js - Standalone migration without model dependencies
require('dotenv').config();
const mongoose = require('mongoose');

async function simpleMigration() {
  try {
    // ✅ Get MongoDB URI from environment
    const mongoUri = process.env.MONGO_URI || 
                     process.env.MONGODB_URI || 
                     process.env.DATABASE_URL ||
                     'mongodb://localhost:27017/your-database'; // fallback
    
    console.log('🔄 Starting Simple Photo Migration...');
    console.log(`🔗 Connecting to: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Get direct access to collections
    const db = mongoose.connection.db;
    const photosCollection = db.collection('photos');
    
    // ============================================
    // STEP 1: Analyze current data
    // ============================================
    
    console.log('\n📊 Analyzing current photo data...');
    
    const totalPhotos = await photosCollection.countDocuments();
    const photosWithEvent = await photosCollection.countDocuments({ 
      event: { $exists: true, $ne: null } 
    });
    const photosWithTaggedEvent = await photosCollection.countDocuments({ 
      taggedEvent: { $exists: true, $ne: null } 
    });
    
    console.log(`📸 Total photos: ${totalPhotos}`);
    console.log(`📍 Photos with 'event' field: ${photosWithEvent}`);
    console.log(`📍 Photos with 'taggedEvent' field: ${photosWithTaggedEvent}`);
    
    if (totalPhotos === 0) {
      console.log('ℹ️ No photos found. Migration not needed.');
      return { success: true, message: 'No photos to migrate' };
    }
    
    // ============================================
    // STEP 2: Add missing taggedEvent fields
    // ============================================
    
    console.log('\n🔄 Adding missing taggedEvent fields...');
    
    const result1 = await photosCollection.updateMany(
      {
        event: { $exists: true, $ne: null },
        $or: [
          { taggedEvent: { $exists: false } },
          { taggedEvent: null }
        ]
      },
      {
        $set: {
          taggedEvent: '$event'
        }
      }
    );
    
    console.log(`✅ Added taggedEvent to ${result1.modifiedCount} photos`);
    
    // ============================================
    // STEP 3: Add missing event fields (reverse)
    // ============================================
    
    console.log('\n🔄 Adding missing event fields...');
    
    const result2 = await photosCollection.updateMany(
      {
        taggedEvent: { $exists: true, $ne: null },
        $or: [
          { event: { $exists: false } },
          { event: null }
        ]
      },
      [
        {
          $set: {
            event: '$taggedEvent'
          }
        }
      ]
    );
    
    console.log(`✅ Added event to ${result2.modifiedCount} photos`);
    
    // ============================================
    // STEP 4: Add default privacy context
    // ============================================
    
    console.log('\n🔄 Adding privacy context...');
    
    const result3 = await photosCollection.updateMany(
      {
        $or: [
          { 'privacyContext.isFromPrivateAccount': { $exists: false } },
          { visibility: { $exists: false } },
          { isDeleted: { $exists: false } }
        ]
      },
      {
        $set: {
          'privacyContext.isFromPrivateAccount': false,
          'privacyContext.requiresFollowToView': false,
          'privacyContext.isInPrivateEvent': false,
          'visibility.level': 'public',
          'visibility.inheritFromUser': true,
          isDeleted: false
        }
      }
    );
    
    console.log(`✅ Updated privacy context for ${result3.modifiedCount} photos`);
    
    // ============================================
    // STEP 5: Verify results
    // ============================================
    
    console.log('\n✅ Verifying migration results...');
    
    const finalStats = {
      totalPhotos: await photosCollection.countDocuments(),
      photosWithEvent: await photosCollection.countDocuments({ 
        event: { $exists: true, $ne: null } 
      }),
      photosWithTaggedEvent: await photosCollection.countDocuments({ 
        taggedEvent: { $exists: true, $ne: null } 
      }),
      photosWithPrivacyContext: await photosCollection.countDocuments({
        'privacyContext.isFromPrivateAccount': { $exists: true }
      })
    };
    
    console.log('\n📊 Final Statistics:');
    console.log(`📸 Total photos: ${finalStats.totalPhotos}`);
    console.log(`📍 Photos with 'event' field: ${finalStats.photosWithEvent}`);
    console.log(`📍 Photos with 'taggedEvent' field: ${finalStats.photosWithTaggedEvent}`);
    console.log(`🔒 Photos with privacy context: ${finalStats.photosWithPrivacyContext}`);
    
    const migrationReport = {
      timestamp: new Date().toISOString(),
      actions: {
        taggedEventAdded: result1.modifiedCount,
        eventAdded: result2.modifiedCount,
        privacyContextUpdated: result3.modifiedCount
      },
      finalStats,
      success: true
    };
    
    console.log('\n📄 Migration Report:');
    console.log(JSON.stringify(migrationReport, null, 2));
    console.log('\n🎉 Simple migration completed successfully!');
    
    return migrationReport;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  simpleMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { simpleMigration };