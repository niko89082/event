// scripts/migratePhotoSchema.js - Phase 1 Migration Script
require('dotenv').config(); // ✅ Load environment variables
const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const User = require('../models/User');

/**
 * Migration script to:
 * 1. Add missing taggedEvent field where needed
 * 2. Sync event and taggedEvent fields 
 * 3. Update privacy context for existing photos
 * 4. Clean up any orphaned references
 */

async function migratePhotoSchema() {
  console.log('🔄 Starting Photo Schema Migration...');
  
  try {
    // ✅ Enhanced connection handling with better error messages
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    
    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in environment variables.');
      console.error('   Please set one of: MONGO_URI, MONGODB_URI, or DATABASE_URL');
      console.error('   Example: export MONGO_URI="mongodb://localhost:27017/your-database"');
      process.exit(1);
    }
    
    console.log('🔗 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in log
    
    // Connect to database if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Connected to MongoDB');
    } else {
      console.log('✅ Already connected to MongoDB');
    }

    // ============================================
    // STEP 1: Analyze current data
    // ============================================
    
    console.log('\n📊 Analyzing current photo data...');
    
    const totalPhotos = await Photo.countDocuments();
    const photosWithEvent = await Photo.countDocuments({ event: { $exists: true, $ne: null } });
    const photosWithTaggedEvent = await Photo.countDocuments({ taggedEvent: { $exists: true, $ne: null } });
    const photosWithBothFields = await Photo.countDocuments({ 
      event: { $exists: true, $ne: null },
      taggedEvent: { $exists: true, $ne: null }
    });
    
    console.log(`📸 Total photos: ${totalPhotos}`);
    console.log(`📍 Photos with 'event' field: ${photosWithEvent}`);
    console.log(`📍 Photos with 'taggedEvent' field: ${photosWithTaggedEvent}`);
    console.log(`📍 Photos with both fields: ${photosWithBothFields}`);

    // ============================================
    // STEP 2: Sync missing taggedEvent fields
    // ============================================
    
    console.log('\n🔄 Syncing missing taggedEvent fields...');
    
    const photosNeedingTaggedEvent = await Photo.find({
      event: { $exists: true, $ne: null },
      $or: [
        { taggedEvent: { $exists: false } },
        { taggedEvent: null },
        { taggedEvent: '' }
      ]
    });
    
    console.log(`📸 Found ${photosNeedingTaggedEvent.length} photos needing taggedEvent sync`);
    
    let syncedCount = 0;
    for (const photo of photosNeedingTaggedEvent) {
      try {
        await Photo.updateOne(
          { _id: photo._id },
          { $set: { taggedEvent: photo.event } }
        );
        syncedCount++;
        
        if (syncedCount % 100 === 0) {
          console.log(`  📍 Synced ${syncedCount}/${photosNeedingTaggedEvent.length} photos...`);
        }
      } catch (error) {
        console.error(`❌ Error syncing photo ${photo._id}:`, error.message);
      }
    }
    
    console.log(`✅ Synced ${syncedCount} photos with taggedEvent field`);

    // ============================================
    // STEP 3: Sync missing event fields (reverse sync)
    // ============================================
    
    console.log('\n🔄 Syncing missing event fields...');
    
    const photosNeedingEvent = await Photo.find({
      taggedEvent: { $exists: true, $ne: null },
      $or: [
        { event: { $exists: false } },
        { event: null },
        { event: '' }
      ]
    });
    
    console.log(`📸 Found ${photosNeedingEvent.length} photos needing event sync`);
    
    let reverseSyncedCount = 0;
    for (const photo of photosNeedingEvent) {
      try {
        await Photo.updateOne(
          { _id: photo._id },
          { $set: { event: photo.taggedEvent } }
        );
        reverseSyncedCount++;
        
        if (reverseSyncedCount % 100 === 0) {
          console.log(`  📍 Reverse synced ${reverseSyncedCount}/${photosNeedingEvent.length} photos...`);
        }
      } catch (error) {
        console.error(`❌ Error reverse syncing photo ${photo._id}:`, error.message);
      }
    }
    
    console.log(`✅ Reverse synced ${reverseSyncedCount} photos with event field`);

    // ============================================
    // STEP 4: Fix inconsistent field values
    // ============================================
    
    console.log('\n🔄 Fixing inconsistent field values...');
    
    const inconsistentPhotos = await Photo.find({
      event: { $exists: true, $ne: null },
      taggedEvent: { $exists: true, $ne: null },
      $expr: { $ne: ['$event', '$taggedEvent'] }
    });
    
    console.log(`📸 Found ${inconsistentPhotos.length} photos with inconsistent event fields`);
    
    let fixedCount = 0;
    for (const photo of inconsistentPhotos) {
      try {
        // Use 'event' field as source of truth
        await Photo.updateOne(
          { _id: photo._id },
          { $set: { taggedEvent: photo.event } }
        );
        fixedCount++;
        
        console.log(`  📍 Fixed inconsistency in photo ${photo._id}: event=${photo.event}, taggedEvent=${photo.taggedEvent} -> ${photo.event}`);
      } catch (error) {
        console.error(`❌ Error fixing photo ${photo._id}:`, error.message);
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} photos with inconsistent fields`);

    // ============================================
    // STEP 5: Update privacy context for existing photos
    // ============================================
    
    console.log('\n🔄 Updating privacy context for existing photos...');
    
    const photosNeedingPrivacyUpdate = await Photo.find({
      $or: [
        { 'privacyContext.isFromPrivateAccount': { $exists: false } },
        { 'privacyContext.requiresFollowToView': { $exists: false } },
        { 'privacyContext.isInPrivateEvent': { $exists: false } }
      ]
    }).populate('user event');
    
    console.log(`📸 Found ${photosNeedingPrivacyUpdate.length} photos needing privacy context update`);
    
    let privacyUpdatedCount = 0;
    for (const photo of photosNeedingPrivacyUpdate) {
      try {
        const updates = {};
        
        // Set user privacy context
        if (photo.user) {
          updates['privacyContext.isFromPrivateAccount'] = !photo.user.isPublic;
          updates['privacyContext.requiresFollowToView'] = !photo.user.isPublic;
        }
        
        // Set event privacy context
        if (photo.event) {
          updates['privacyContext.isInPrivateEvent'] = ['private', 'secret'].includes(photo.event.privacyLevel);
        }
        
        // Set default visibility if not set
        if (!photo.visibility) {
          updates['visibility.level'] = 'public';
          updates['visibility.inheritFromUser'] = true;
        }
        
        await Photo.updateOne(
          { _id: photo._id },
          { $set: updates }
        );
        
        privacyUpdatedCount++;
        
        if (privacyUpdatedCount % 100 === 0) {
          console.log(`  📍 Updated privacy context for ${privacyUpdatedCount}/${photosNeedingPrivacyUpdate.length} photos...`);
        }
      } catch (error) {
        console.error(`❌ Error updating privacy context for photo ${photo._id}:`, error.message);
      }
    }
    
    console.log(`✅ Updated privacy context for ${privacyUpdatedCount} photos`);

    // ============================================
    // STEP 6: Clean up orphaned references
    // ============================================
    
    console.log('\n🧹 Cleaning up orphaned event references...');
    
    const photosWithEventRefs = await Photo.find({
      $or: [
        { event: { $exists: true, $ne: null } },
        { taggedEvent: { $exists: true, $ne: null } }
      ]
    });
    
    console.log(`📸 Checking ${photosWithEventRefs.length} photos for orphaned references...`);
    
    let orphanedCount = 0;
    let cleanedCount = 0;
    
    for (const photo of photosWithEventRefs) {
      try {
        const eventId = photo.event || photo.taggedEvent;
        
        if (eventId) {
          const eventExists = await Event.findById(eventId);
          
          if (!eventExists) {
            // Clean up orphaned reference
            await Photo.updateOne(
              { _id: photo._id },
              { 
                $unset: { event: 1, taggedEvent: 1 },
                $set: { visibleInEvent: false }
              }
            );
            
            orphanedCount++;
            cleanedCount++;
            
            if (cleanedCount % 50 === 0) {
              console.log(`  🧹 Cleaned ${cleanedCount} orphaned references...`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error checking photo ${photo._id}:`, error.message);
      }
    }
    
    console.log(`🧹 Found and cleaned ${orphanedCount} orphaned event references`);

    // ============================================
    // STEP 7: Verify migration results
    // ============================================
    
    console.log('\n✅ Verifying migration results...');
    
    const finalStats = {
      totalPhotos: await Photo.countDocuments(),
      photosWithEvent: await Photo.countDocuments({ event: { $exists: true, $ne: null } }),
      photosWithTaggedEvent: await Photo.countDocuments({ taggedEvent: { $exists: true, $ne: null } }),
      photosWithBothFields: await Photo.countDocuments({ 
        event: { $exists: true, $ne: null },
        taggedEvent: { $exists: true, $ne: null }
      }),
      photosWithPrivacyContext: await Photo.countDocuments({
        'privacyContext.isFromPrivateAccount': { $exists: true }
      }),
      inconsistentPhotos: await Photo.countDocuments({
        event: { $exists: true, $ne: null },
        taggedEvent: { $exists: true, $ne: null },
        $expr: { $ne: ['$event', '$taggedEvent'] }
      })
    };
    
    console.log('\n📊 Final Statistics:');
    console.log(`📸 Total photos: ${finalStats.totalPhotos}`);
    console.log(`📍 Photos with 'event' field: ${finalStats.photosWithEvent}`);
    console.log(`📍 Photos with 'taggedEvent' field: ${finalStats.photosWithTaggedEvent}`);
    console.log(`📍 Photos with both fields: ${finalStats.photosWithBothFields}`);
    console.log(`🔒 Photos with privacy context: ${finalStats.photosWithPrivacyContext}`);
    console.log(`⚠️ Remaining inconsistent photos: ${finalStats.inconsistentPhotos}`);
    
    // ============================================
    // STEP 8: Create summary report
    // ============================================
    
    const migrationReport = {
      timestamp: new Date().toISOString(),
      actions: {
        taggedEventSynced: syncedCount,
        eventSynced: reverseSyncedCount,
        inconsistenciesFixed: fixedCount,
        privacyContextUpdated: privacyUpdatedCount,
        orphanedReferencesRemoved: orphanedCount
      },
      finalStats,
      success: finalStats.inconsistentPhotos === 0
    };
    
    console.log('\n📄 Migration Report:');
    console.log(JSON.stringify(migrationReport, null, 2));
    
    if (migrationReport.success) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️ Migration completed with warnings. Please review inconsistent photos.');
    }
    
    return migrationReport;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePhotoSchema()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePhotoSchema };