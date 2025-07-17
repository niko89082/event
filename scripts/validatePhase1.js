// scripts/validatePhase1.js - Validation script for Phase 1 implementation
const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const User = require('../models/User');

class Phase1Validator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {};
  }

  /**
   * Connect to database
   */
  async connect() {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-app';
      await mongoose.connect(uri);
      console.log('✅ Connected to MongoDB for validation');
    }
  }

  /**
   * Validate Photo schema consolidation
   */
  async validatePhotoSchemaConsolidation() {
    console.log('\n🔍 Validating Photo schema consolidation...');

    try {
      // Check if all photos have event field properly set
      const photosWithoutEvent = await Photo.countDocuments({
        taggedEvent: { $exists: true, $ne: null },
        event: { $exists: false }
      });

      if (photosWithoutEvent > 0) {
        this.errors.push(`${photosWithoutEvent} photos still have taggedEvent but no event field`);
      }

      // Check for duplicate event references
      const photosWithBothFields = await Photo.find({
        event: { $exists: true, $ne: null },
        taggedEvent: { $exists: true, $ne: null }
      }).select('_id event taggedEvent');

      let mismatchedFields = 0;
      for (const photo of photosWithBothFields) {
        if (String(photo.event) !== String(photo.taggedEvent)) {
          mismatchedFields++;
        }
      }

      if (mismatchedFields > 0) {
        this.warnings.push(`${mismatchedFields} photos have mismatched event/taggedEvent fields`);
      }

      // Validate photo indexes exist
      const photoIndexes = await Photo.collection.indexes();
      const requiredIndexes = ['event_1', 'event_1_user_1', 'event_1_visibleInEvent_1'];
      const missingIndexes = requiredIndexes.filter(index => 
        !photoIndexes.some(idx => Object.keys(idx.key).join('_') === index.replace('_1', ''))
      );

      if (missingIndexes.length > 0) {
        this.warnings.push(`Missing photo indexes: ${missingIndexes.join(', ')}`);
      }

      // Check for orphaned photos (photos referencing deleted events)
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
          $count: "orphanedCount"
        }
      ]);

      const orphanedCount = orphanedPhotos[0]?.orphanedCount || 0;
      if (orphanedCount > 0) {
        this.warnings.push(`${orphanedCount} photos reference deleted events`);
      }

      this.stats.photoConsolidation = {
        totalPhotos: await Photo.countDocuments(),
        photosWithEvent: await Photo.countDocuments({ event: { $exists: true, $ne: null } }),
        photosWithTaggedEvent: await Photo.countDocuments({ taggedEvent: { $exists: true, $ne: null } }),
        orphanedPhotos: orphanedCount
      };

      console.log('   ✅ Photo schema consolidation validation completed');

    } catch (error) {
      this.errors.push(`Photo schema validation failed: ${error.message}`);
    }
  }

  /**
   * Validate likes array standardization
   */
  async validateLikesStandardization() {
    console.log('\n🔍 Validating likes array standardization...');

    try {
      // Check for photos with invalid likes arrays
      const photosWithInvalidLikes = await Photo.countDocuments({
        $or: [
          { likes: { $exists: false } },
          { likes: null },
          { likes: { $not: { $type: "array" } } }
        ]
      });

      if (photosWithInvalidLikes > 0) {
        this.errors.push(`${photosWithInvalidLikes} photos have invalid likes arrays`);
      }

      // Check for duplicate likes
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
        },
        {
          $count: "duplicateCount"
        }
      ]);

      const duplicateCount = photosWithDuplicates[0]?.duplicateCount || 0;
      if (duplicateCount > 0) {
        this.errors.push(`${duplicateCount} photos have duplicate likes`);
      }

      // Validate like references point to existing users
      const invalidLikeRefs = await Photo.aggregate([
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
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]);

      const invalidRefCount = invalidLikeRefs[0]?.count || 0;
      if (invalidRefCount > 0) {
        this.warnings.push(`${invalidRefCount} invalid user references in likes arrays`);
      }

      // Performance test - check if like queries are fast
      const testUserId = new mongoose.Types.ObjectId();
      const start = Date.now();
      await Photo.find({ likes: testUserId }).limit(10);
      const queryTime = Date.now() - start;

      if (queryTime > 100) {
        this.warnings.push(`Like queries are slow (${queryTime}ms) - consider adding indexes`);
      }

      this.stats.likesStandardization = {
        totalPhotos: await Photo.countDocuments(),
        photosWithLikes: await Photo.countDocuments({ "likes.0": { $exists: true } }),
        totalLikes: await Photo.aggregate([
          { $group: { _id: null, total: { $sum: { $size: "$likes" } } } }
        ]).then(result => result[0]?.total || 0),
        averageLikesPerPhoto: 0, // Will be calculated below
        queryPerformance: queryTime
      };

      // Calculate average likes per photo
      if (this.stats.likesStandardization.totalPhotos > 0) {
        this.stats.likesStandardization.averageLikesPerPhoto = 
          (this.stats.likesStandardization.totalLikes / this.stats.likesStandardization.totalPhotos).toFixed(2);
      }

      console.log('   ✅ Likes array standardization validation completed');

    } catch (error) {
      this.errors.push(`Likes standardization validation failed: ${error.message}`);
    }
  }

  /**
   * Validate privacy middleware functionality
   */
  async validatePrivacyMiddleware() {
    console.log('\n🔍 Validating privacy middleware functionality...');

    try {
      // Test that we can import the privacy middleware
      const { PrivacyMiddleware } = require('../middleware/privacy');
      
      if (!PrivacyMiddleware) {
        this.errors.push('Privacy middleware not found or not exported correctly');
        return;
      }

      // Check if required methods exist
      const requiredMethods = [
        'checkPhotoAccess',
        'checkEventAccess',
        'checkUserProfileAccess',
        'filterContentList',
        'batchCheckAccess'
      ];

      for (const method of requiredMethods) {
        if (typeof PrivacyMiddleware[method] !== 'function') {
          this.errors.push(`PrivacyMiddleware.${method} method not found`);
        }
      }

      // Test privacy checking with sample data
      const sampleUser = await User.findOne().select('_id');
      const samplePhoto = await Photo.findOne().select('_id user');

      if (sampleUser && samplePhoto) {
        try {
          const { hasAccess } = await PrivacyMiddleware.checkPhotoAccess(
            sampleUser._id, 
            samplePhoto._id
          );
          
          if (typeof hasAccess !== 'boolean') {
            this.warnings.push('Privacy middleware not returning expected boolean result');
          }
        } catch (error) {
          this.warnings.push(`Privacy middleware test failed: ${error.message}`);
        }
      }

      // Check if Photo model has new privacy methods
      const samplePhotoDoc = await Photo.findOne();
      if (samplePhotoDoc) {
        const requiredPhotoMethods = ['canUserView', 'canUserEdit', 'isLikedBy', 'toggleLike'];
        for (const method of requiredPhotoMethods) {
          if (typeof samplePhotoDoc[method] !== 'function') {
            this.errors.push(`Photo model missing ${method} method`);
          }
        }
      }

      this.stats.privacyMiddleware = {
        middlewareExists: !!PrivacyMiddleware,
        methodsImplemented: requiredMethods.filter(method => 
          typeof PrivacyMiddleware[method] === 'function'
        ).length,
        totalMethods: requiredMethods.length
      };

      console.log('   ✅ Privacy middleware validation completed');

    } catch (error) {
      this.errors.push(`Privacy middleware validation failed: ${error.message}`);
    }
  }

  /**
   * Validate database performance and indexes
   */
  async validateDatabasePerformance() {
    console.log('\n🔍 Validating database performance...');

    try {
      // Test key queries and their performance
      const performanceTests = [
        {
          name: 'Photo by event query',
          query: () => Photo.find({ event: new mongoose.Types.ObjectId() }).limit(10)
        },
        {
          name: 'Photos with likes query',
          query: () => Photo.find({ "likes.0": { $exists: true } }).limit(10)
        },
        {
          name: 'User photos query',
          query: () => Photo.find({ user: new mongoose.Types.ObjectId() }).limit(10)
        }
      ];

      const performanceResults = {};

      for (const test of performanceTests) {
        const start = Date.now();
        await test.query();
        const duration = Date.now() - start;
        
        performanceResults[test.name] = duration;
        
        if (duration > 200) {
          this.warnings.push(`${test.name} is slow (${duration}ms)`);
        }
      }

      // Check database indexes
      const photoIndexes = await Photo.collection.indexes();
      const eventIndexes = await Event.collection.indexes();
      const userIndexes = await User.collection.indexes();

      this.stats.performance = {
        queryTimes: performanceResults,
        indexes: {
          photos: photoIndexes.length,
          events: eventIndexes.length,
          users: userIndexes.length
        }
      };

      console.log('   ✅ Database performance validation completed');

    } catch (error) {
      this.errors.push(`Database performance validation failed: ${error.message}`);
    }
  }

  /**
   * Validate data consistency
   */
  async validateDataConsistency() {
    console.log('\n🔍 Validating data consistency...');

    try {
      // Check for photos in events that don't reference them back
      const inconsistentPhotoEvents = await Photo.aggregate([
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
            eventDoc: { $size: 1 }
          }
        },
        {
          $project: {
            _id: 1,
            event: 1,
            eventPhotos: { $arrayElemAt: ['$eventDoc.photos', 0] }
          }
        },
        {
          $match: {
            $expr: {
              $not: {
                $in: ['$_id', { $ifNull: ['$eventPhotos', []] }]
              }
            }
          }
        },
        {
          $count: 'inconsistentCount'
        }
      ]);

      const inconsistentCount = inconsistentPhotoEvents[0]?.inconsistentCount || 0;
      if (inconsistentCount > 0) {
        this.warnings.push(`${inconsistentCount} photos not properly referenced in their events`);
      }

      // Check for users with photos that don't reference them back
      const userPhotoInconsistencies = await User.aggregate([
        {
          $lookup: {
            from: 'photos',
            localField: 'photos',
            foreignField: '_id',
            as: 'photoDoc'
          }
        },
        {
          $project: {
            _id: 1,
            photoCount: { $size: '$photos' },
            actualPhotoCount: { $size: '$photoDoc' }
          }
        },
        {
          $match: {
            $expr: { $ne: ['$photoCount', '$actualPhotoCount'] }
          }
        },
        {
          $count: 'inconsistentUsers'
        }
      ]);

      const userInconsistencies = userPhotoInconsistencies[0]?.inconsistentUsers || 0;
      if (userInconsistencies > 0) {
        this.warnings.push(`${userInconsistencies} users have inconsistent photo references`);
      }

      this.stats.dataConsistency = {
        inconsistentPhotoEvents: inconsistentCount,
        inconsistentUserPhotos: userInconsistencies,
        totalChecks: 2
      };

      console.log('   ✅ Data consistency validation completed');

    } catch (error) {
      this.errors.push(`Data consistency validation failed: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive validation report
   */
  async generateReport() {
    console.log('\n📊 Generating Phase 1 validation report...');

    const report = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 1 - Schema Consolidation & Privacy Framework',
      status: this.errors.length === 0 ? 'PASS' : 'FAIL',
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        checksCompleted: Object.keys(this.stats).length
      },
      errors: this.errors,
      warnings: this.warnings,
      statistics: this.stats,
      recommendations: []
    };

    // Generate recommendations based on findings
    if (this.warnings.some(w => w.includes('slow'))) {
      report.recommendations.push('Consider adding database indexes to improve query performance');
    }

    if (this.warnings.some(w => w.includes('orphaned'))) {
      report.recommendations.push('Run cleanup script to remove orphaned photo references');
    }

    if (this.warnings.some(w => w.includes('inconsistent'))) {
      report.recommendations.push('Run data consistency repair script to fix reference inconsistencies');
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      report.recommendations.push('Phase 1 implementation is successful - proceed to Phase 2');
    }

    return report;
  }

  /**
   * Run all validations
   */
  async runAllValidations() {
    try {
      await this.connect();

      console.log('🚀 Starting Phase 1 Validation');
      console.log('📋 This will check schema consolidation, likes standardization, and privacy framework');

      await this.validatePhotoSchemaConsolidation();
      await this.validateLikesStandardization();
      await this.validatePrivacyMiddleware();
      await this.validateDatabasePerformance();
      await this.validateDataConsistency();

      const report = await this.generateReport();

      // Display results
      console.log('\n' + '='.repeat(60));
      console.log('📊 PHASE 1 VALIDATION REPORT');
      console.log('='.repeat(60));
      
      console.log(`\n🎯 Overall Status: ${report.status}`);
      console.log(`📅 Timestamp: ${report.timestamp}`);
      
      console.log(`\n📈 Summary:`);
      console.log(`   ✅ Checks completed: ${report.summary.checksCompleted}`);
      console.log(`   ❌ Errors found: ${report.summary.errors}`);
      console.log(`   ⚠️  Warnings: ${report.summary.warnings}`);

      if (report.errors.length > 0) {
        console.log(`\n❌ ERRORS (${report.errors.length}):`);
        report.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }

      if (report.warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${report.warnings.length}):`);
        report.warnings.forEach((warning, index) => {
          console.log(`   ${index + 1}. ${warning}`);
        });
      }

      if (report.recommendations.length > 0) {
        console.log(`\n💡 RECOMMENDATIONS:`);
        report.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }

      // Display key statistics
      console.log(`\n📊 KEY STATISTICS:`);
      
      if (report.statistics.photoConsolidation) {
        const pc = report.statistics.photoConsolidation;
        console.log(`   📸 Photos: ${pc.totalPhotos} total, ${pc.photosWithEvent} with event field`);
      }
      
      if (report.statistics.likesStandardization) {
        const ls = report.statistics.likesStandardization;
        console.log(`   ❤️  Likes: ${ls.totalLikes} total across ${ls.photosWithLikes} photos`);
        console.log(`   📊 Average: ${ls.averageLikesPerPhoto} likes per photo`);
        console.log(`   ⚡ Query time: ${ls.queryPerformance}ms`);
      }

      console.log('\n' + '='.repeat(60));

      if (report.status === 'PASS') {
        console.log('🎉 Phase 1 validation PASSED! Ready for Phase 2.');
      } else {
        console.log('⚠️  Phase 1 validation found issues. Please fix errors before proceeding.');
      }

      return report;

    } catch (error) {
      console.error('💥 Validation failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const validator = new Phase1Validator();
  
  try {
    const report = await validator.runAllValidations();
    
    // Exit with error code if validation failed
    if (report.status === 'FAIL') {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Validation command failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = { Phase1Validator };

// Run CLI if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Validation completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Validation failed:', error);
      process.exit(1);
    });
}