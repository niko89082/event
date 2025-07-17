// scripts/migrations/001_consolidate_photo_event_fields.js
// Migration script to consolidate event/taggedEvent fields in Photo model

const mongoose = require('mongoose');
const Photo = require('../../models/Photo');

async function migratePhotoEventFields() {
  console.log('🔄 Starting Photo event field consolidation migration...');
  
  try {
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Step 1: Find all photos with taggedEvent but no event field
    const photosToMigrate = await Photo.find({
      taggedEvent: { $exists: true, $ne: null },
      $or: [
        { event: { $exists: false } },
        { event: null }
      ]
    });

    console.log(`📊 Found ${photosToMigrate.length} photos to migrate`);

    // Step 2: Update photos to use event field instead of taggedEvent
    let migratedCount = 0;
    let errorCount = 0;

    for (const photo of photosToMigrate) {
      try {
        // Copy taggedEvent to event field
        photo.event = photo.taggedEvent;
        
        // Keep taggedEvent for backward compatibility during transition
        // We'll remove it in a future migration after confirming everything works
        
        await photo.save();
        migratedCount++;
        
        if (migratedCount % 100 === 0) {
          console.log(`✅ Migrated ${migratedCount} photos...`);
        }
      } catch (error) {
        console.error(`❌ Error migrating photo ${photo._id}:`, error);
        errorCount++;
      }
    }

    // Step 3: Create indexes for better performance
    console.log('🔍 Creating optimized indexes...');
    
    await Photo.collection.createIndex({ event: 1, user: 1 });
    await Photo.collection.createIndex({ event: 1, visibleInEvent: 1 });
    await Photo.collection.createIndex({ user: 1, event: 1, uploadDate: -1 });

    // Step 4: Validate migration
    const validationCount = await Photo.countDocuments({
      event: { $exists: true, $ne: null }
    });

    console.log('📈 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount} photos`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total photos with event field: ${validationCount}`);

    // Step 5: Check for orphaned photos (photos with invalid event references)
    const orphanedPhotos = await Photo.aggregate([
      {
        $match: {
          event: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDoc'
        }
      },
      {
        $match: {
          eventDoc: { $size: 0 }
        }
      },
      {
        $project: {
          _id: 1,
          event: 1,
          user: 1
        }
      }
    ]);

    if (orphanedPhotos.length > 0) {
      console.log(`⚠️  Found ${orphanedPhotos.length} orphaned photos (references to deleted events)`);
      console.log('   These will need manual cleanup or automatic cleanup in next migration');
    }

    console.log('✅ Photo event field consolidation migration completed successfully!');
    
    return {
      success: true,
      migratedCount,
      errorCount,
      orphanedCount: orphanedPhotos.length
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePhotoEventFields()
    .then(result => {
      console.log('Migration completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePhotoEventFields };