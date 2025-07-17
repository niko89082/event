// scripts/migrations/002_standardize_likes_arrays.js
// Migration script to standardize likes arrays across all models

const mongoose = require('mongoose');
const Photo = require('../../models/Photo');
const Event = require('../../models/Event'); // If events have likes
const User = require('../../models/User');

async function standardizeLikesArrays() {
  console.log('🔄 Starting likes array standardization migration...');
  
  try {
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    let totalFixed = 0;

    // ============================================
    // FIX PHOTO LIKES ARRAYS
    // ============================================
    console.log('📸 Fixing Photo likes arrays...');
    
    // Find photos with null, undefined, or non-array likes
    const photosToFix = await Photo.find({
      $or: [
        { likes: { $exists: false } },
        { likes: null },
        { likes: { $not: { $type: "array" } } }
      ]
    });

    console.log(`   Found ${photosToFix.length} photos with invalid likes arrays`);

    for (const photo of photosToFix) {
      try {
        photo.likes = [];
        await photo.save();
        totalFixed++;
        
        if (totalFixed % 100 === 0) {
          console.log(`   ✅ Fixed ${totalFixed} photos...`);
        }
      } catch (error) {
        console.error(`   ❌ Error fixing photo ${photo._id}:`, error);
      }
    }

    // ============================================
    // REMOVE DUPLICATE LIKES
    // ============================================
    console.log('🔄 Removing duplicate likes from photos...');
    
    const photosWithDuplicates = await Photo.aggregate([
      {
        $match: {
          likes: { $exists: true, $type: "array" },
          $expr: {
            $ne: [
              { $size: "$likes" },
              { $size: { $setUnion: ["$likes", []] } }
            ]
          }
        }
      }
    ]);

    console.log(`   Found ${photosWithDuplicates.length} photos with duplicate likes`);

    for (const photoData of photosWithDuplicates) {
      try {
        const photo = await Photo.findById(photoData._id);
        if (photo) {
          // Remove duplicates using Set
          const uniqueLikes = [...new Set(photo.likes.map(like => String(like)))];
          photo.likes = uniqueLikes.map(like => new mongoose.Types.ObjectId(like));
          await photo.save();
          totalFixed++;
        }
      } catch (error) {
        console.error(`   ❌ Error removing duplicates from photo ${photoData._id}:`, error);
      }
    }

    // ============================================
    // VALIDATE LIKE REFERENCES
    // ============================================
    console.log('🔍 Validating like references...');
    
    // Find photos with likes pointing to non-existent users
    const photosWithInvalidLikes = await Photo.aggregate([
      { $unwind: { path: "$likes", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "likes",
          foreignField: "_id",
          as: "userDoc"
        }
      },
      {
        $match: {
          likes: { $exists: true },
          userDoc: { $size: 0 }
        }
      },
      {
        $group: {
          _id: "$_id",
          invalidLikes: { $push: "$likes" },
          validLikes: { $push: { $cond: [{ $gt: [{ $size: "$userDoc" }, 0] }, "$likes", null] } }
        }
      }
    ]);

    console.log(`   Found ${photosWithInvalidLikes.length} photos with invalid like references`);

    for (const photoData of photosWithInvalidLikes) {
      try {
        const photo = await Photo.findById(photoData._id);
        if (photo) {
          // Remove invalid user references
          const validUserIds = await User.find({
            _id: { $in: photo.likes }
          }).select('_id');
          
          photo.likes = validUserIds.map(user => user._id);
          await photo.save();
          totalFixed++;
        }
      } catch (error) {
        console.error(`   ❌ Error cleaning invalid likes from photo ${photoData._id}:`, error);
      }
    }

    // ============================================
    // CREATE HELPER INDEXES
    // ============================================
    console.log('🔍 Creating performance indexes...');
    
    try {
      await Photo.collection.createIndex({ "likes": 1 });
      await Photo.collection.createIndex({ "user": 1, "likes": 1 });
      console.log('   ✅ Created likes performance indexes');
    } catch (error) {
      console.error('   ❌ Error creating indexes:', error);
    }

    // ============================================
    // PERFORMANCE TEST
    // ============================================
    console.log('⚡ Running performance test...');
    
    const testUserId = new mongoose.Types.ObjectId();
    const start = Date.now();
    
    // Test like status checking performance
    await Photo.find({ likes: testUserId }).limit(10);
    
    const duration = Date.now() - start;
    console.log(`   Query performance: ${duration}ms`);

    // ============================================
    // GENERATE SUMMARY REPORT
    // ============================================
    const finalStats = await generateLikesReport();
    
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Total documents fixed: ${totalFixed}`);
    console.log(`   📸 Photos with likes: ${finalStats.photosWithLikes}`);
    console.log(`   👥 Total likes count: ${finalStats.totalLikes}`);
    console.log(`   📈 Average likes per photo: ${finalStats.avgLikesPerPhoto}`);

    console.log('✅ Likes array standardization migration completed successfully!');
    
    return {
      success: true,
      totalFixed,
      finalStats
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Generate comprehensive likes statistics report
 */
async function generateLikesReport() {
  const stats = await Photo.aggregate([
    {
      $match: {
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: null,
        totalPhotos: { $sum: 1 },
        photosWithLikes: {
          $sum: {
            $cond: [{ $gt: [{ $size: { $ifNull: ["$likes", []] } }, 0] }, 1, 0]
          }
        },
        totalLikes: {
          $sum: { $size: { $ifNull: ["$likes", []] } }
        },
        maxLikes: {
          $max: { $size: { $ifNull: ["$likes", []] } }
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalPhotos: 0,
    photosWithLikes: 0,
    totalLikes: 0,
    maxLikes: 0
  };

  result.avgLikesPerPhoto = result.totalPhotos > 0 
    ? (result.totalLikes / result.totalPhotos).toFixed(2)
    : 0;

  return result;
}

/**
 * Utility function to check and fix a single photo's likes array
 */
async function fixPhotoLikes(photoId) {
  try {
    const photo = await Photo.findById(photoId);
    if (!photo) return false;

    // Ensure likes is an array
    if (!Array.isArray(photo.likes)) {
      photo.likes = [];
    }

    // Remove duplicates
    const uniqueLikes = [...new Set(photo.likes.map(like => String(like)))];
    photo.likes = uniqueLikes.map(like => new mongoose.Types.ObjectId(like));

    // Validate user references
    const validUserIds = await User.find({
      _id: { $in: photo.likes }
    }).select('_id');
    
    photo.likes = validUserIds.map(user => user._id);
    
    await photo.save();
    return true;
  } catch (error) {
    console.error(`Error fixing photo ${photoId}:`, error);
    return false;
  }
}

// Run migration if called directly
if (require.main === module) {
  standardizeLikesArrays()
    .then(result => {
      console.log('Migration completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  standardizeLikesArrays,
  generateLikesReport,
  fixPhotoLikes 
};