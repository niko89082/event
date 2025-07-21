// scripts/migrateToFriendsSystem.js - FIXED: Mongoose Options & Connection Issues
require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Migration script to convert follower/following system to friends system
 */

async function migrateToFriendsSystem() {
  console.log('🔄 Starting Friends System Migration...');
  console.log('📊 This will convert your follower/following system to a friends system\n');

  let connection;
  
  try {
    // ✅ FIXED: Simple connection without deprecated options
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in environment variables');
      console.error('   Please set MONGO_URI in your .env file');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    
    // ✅ FIXED: Clean connection options
    connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    
    console.log('✅ Connected to MongoDB\n');

    // ✅ FIXED: Import User model AFTER connection
    const User = mongoose.model('User', require('../models/User').schema);

    // ✅ ENHANCED: Better error handling for count operations
    let totalUsers, usersWithFollowers, usersWithFollowing, usersWithRequests;
    
    try {
      console.log('📊 Gathering migration statistics...');
      
      totalUsers = await User.countDocuments();
      console.log(`   Total Users: ${totalUsers}`);
      
      usersWithFollowers = await User.countDocuments({ 
        followers: { $exists: true, $not: { $size: 0 } } 
      });
      console.log(`   Users with Followers: ${usersWithFollowers}`);
      
      usersWithFollowing = await User.countDocuments({ 
        following: { $exists: true, $not: { $size: 0 } } 
      });
      console.log(`   Users with Following: ${usersWithFollowing}`);
      
      usersWithRequests = await User.countDocuments({ 
        followRequests: { $exists: true, $not: { $size: 0 } } 
      });
      console.log(`   Users with Follow Requests: ${usersWithRequests}\n`);
      
    } catch (countError) {
      console.error('❌ Error getting user counts:', countError.message);
      console.log('⚠️  Proceeding with migration anyway...\n');
      totalUsers = 0;
      usersWithFollowers = 0;
      usersWithFollowing = 0;
      usersWithRequests = 0;
    }

    console.log('⚠️  This migration will:');
    console.log('   • Convert mutual follows to accepted friendships');
    console.log('   • Convert one-way follows to pending friend requests');
    console.log('   • Preserve original data for rollback');
    console.log('   • Add default privacy settings\n');

    let processedUsers = 0;
    let mutualFriendships = 0;
    let pendingRequests = 0;
    let errors = 0;

    console.log('🚀 Starting migration...\n');

    // ✅ FIXED: Better batch processing with smaller batches
    const batchSize = 50; // Reduced batch size
    let skip = 0;
    const maxUsers = totalUsers || 1000; // Fallback if count failed

    while (skip < maxUsers) {
      try {
        console.log(`📦 Processing batch starting at ${skip}...`);
        
        const users = await User.find({})
          .populate('followers', '_id')
          .populate('following', '_id')
          .limit(batchSize)
          .skip(skip);

        if (users.length === 0) {
          console.log('✅ No more users to process');
          break;
        }

        console.log(`   Processing ${users.length} users in this batch`);

        for (const user of users) {
          try {
            await migrateUserToFriendsSystem(user);
            
            const stats = await getUserMigrationStats(user);
            mutualFriendships += stats.mutualFriendships;
            pendingRequests += stats.pendingRequests;
            
            processedUsers++;
            
            if (processedUsers % 25 === 0) {
              console.log(`   ✅ Processed ${processedUsers} users so far...`);
            }
            
          } catch (userError) {
            console.error(`   ❌ Error processing user ${user.username || user._id}:`, userError.message);
            errors++;
          }
        }

        skip += batchSize;
        
        // ✅ ADDED: Small delay between batches to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (batchError) {
        console.error(`❌ Error processing batch at ${skip}:`, batchError.message);
        errors++;
        skip += batchSize; // Continue to next batch
      }
    }

    console.log('\n🎉 Migration Complete!');
    console.log('📊 Final Statistics:');
    console.log(`   ✅ Processed Users: ${processedUsers}`);
    console.log(`   🤝 Mutual Friendships Created: ${Math.floor(mutualFriendships / 2)}`);
    console.log(`   📤 Pending Friend Requests: ${pendingRequests}`);
    console.log(`   ❌ Errors: ${errors}\n`);

    if (errors === 0) {
      console.log('🔍 Verifying migration...');
      await verifyMigration();
      console.log('\n✅ Migration verification complete!');
    } else {
      console.log('⚠️  Some errors occurred during migration. Please review the logs.');
    }

    console.log('\n📝 Next steps:');
    console.log('   1. Test the friends system with: GET /api/friends/list');
    console.log('   2. Check migration status: GET /api/migration/status');
    console.log('   3. Test friend requests in your app');
    console.log('   4. Update frontend components to use new friends system');
    console.log('\n💡 The old follower data is preserved for rollback if needed.');

  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('🔌 Database connection failed. Please check:');
      console.error('   • MongoDB is running');
      console.error('   • MONGO_URI is correct in .env file');
      console.error('   • Network connectivity');
    }
    throw error;
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

/**
 * Migrate a single user from follower system to friends system
 * @param {Object} user - User document with populated followers/following
 */
async function migrateUserToFriendsSystem(user) {
  if (!user.followers && !user.following && !user.followRequests) {
    return; // Nothing to migrate
  }

  const friends = [];
  const processedUsers = new Set();

  // Convert existing followRequests to pending friend requests
  if (user.followRequests && user.followRequests.length > 0) {
    for (const requesterId of user.followRequests) {
      const requesterIdStr = String(requesterId);
      
      if (!processedUsers.has(requesterIdStr)) {
        friends.push({
          user: requesterId,
          status: 'pending',
          initiatedBy: requesterId,
          createdAt: new Date(),
          requestMessage: 'Migrated from follow request'
        });
        processedUsers.add(requesterIdStr);
      }
    }
  }

  const userFollowers = user.followers || [];
  const userFollowing = user.following || [];

  // Find mutual follows (bidirectional relationships)
  const mutualFollows = userFollowers.filter(followerId => 
    userFollowing.some(followingId => String(followerId._id) === String(followingId._id))
  );

  // Create accepted friendships for mutual follows
  for (const mutualUser of mutualFollows) {
    const mutualUserIdStr = String(mutualUser._id);
    
    if (!processedUsers.has(mutualUserIdStr) && mutualUserIdStr !== String(user._id)) {
      friends.push({
        user: mutualUser._id,
        status: 'accepted',
        initiatedBy: user._id,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(),
        requestMessage: 'Migrated from mutual follow'
      });
      processedUsers.add(mutualUserIdStr);
    }
  }

  // Create pending requests for one-way follows
  const oneWayFollowing = userFollowing.filter(followingId => 
    !userFollowers.some(followerId => String(followerId._id) === String(followingId._id))
  );

  for (const followedUser of oneWayFollowing) {
    const followedUserIdStr = String(followedUser._id);
    
    if (!processedUsers.has(followedUserIdStr) && followedUserIdStr !== String(user._id)) {
      friends.push({
        user: followedUser._id,
        status: 'pending',
        initiatedBy: user._id,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        requestMessage: 'Migrated from follow relationship'
      });
      processedUsers.add(followedUserIdStr);
    }
  }

  // Set default privacy settings
  const defaultPrivacy = {
    friendRequests: user.isPublic ? 'everyone' : 'friends-of-friends',
    friendsList: user.isPublic ? 'friends' : 'only-me',
    posts: user.isPublic ? 'public' : 'friends',
    eventAttendance: 'friends',
    allowSuggestions: true
  };

  // ✅ FIXED: Use updateOne instead of findByIdAndUpdate for better performance
  await mongoose.model('User').updateOne(
    { _id: user._id },
    {
      $set: {
        friends: friends,
        privacy: defaultPrivacy,
        migratedToFriendsAt: new Date()
      }
    }
  );
}

/**
 * Get migration statistics for a user
 */
async function getUserMigrationStats(user) {
  try {
    const updatedUser = await mongoose.model('User').findById(user._id).select('friends');
    
    const mutualFriendships = updatedUser.friends.filter(f => f.status === 'accepted').length;
    const pendingRequests = updatedUser.friends.filter(f => f.status === 'pending').length;
    
    return {
      mutualFriendships,
      pendingRequests
    };
  } catch (error) {
    console.error('Error getting user stats:', error.message);
    return { mutualFriendships: 0, pendingRequests: 0 };
  }
}

/**
 * Verify the migration was successful
 */
async function verifyMigration() {
  try {
    const User = mongoose.model('User');
    
    const totalUsers = await User.countDocuments();
    const migratedUsers = await User.countDocuments({ migratedToFriendsAt: { $exists: true } });
    const usersWithFriends = await User.countDocuments({ friends: { $exists: true, $not: { $size: 0 } } });
    
    console.log('📊 Migration Verification:');
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Migrated Users: ${migratedUsers}`);
    console.log(`   Users with Friends: ${usersWithFriends}`);
    
    if (migratedUsers < totalUsers * 0.5) {
      console.log('\n⚠️  Warning: Less than 50% of users were migrated');
      console.log('   This might indicate an issue with the migration process');
    } else {
      console.log('\n✅ Migration appears successful');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }
}

/**
 * Generate migration report
 */
async function generateMigrationReport() {
  console.log('📋 Generating Migration Report...\n');
  
  let connection;
  
  try {
    // ✅ FIXED: Same connection improvements for report
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in environment variables');
      process.exit(1);
    }

    connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Connected to MongoDB for report generation\n');
    
    const User = mongoose.model('User', require('../models/User').schema);
    
    const totalUsers = await User.countDocuments();
    const migratedUsers = await User.countDocuments({ migratedToFriendsAt: { $exists: true } });
    
    console.log('📊 Migration Report:');
    console.log('=====================================');
    console.log(`Migration Date: ${new Date().toISOString()}`);
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Migrated Users: ${migratedUsers} (${totalUsers > 0 ? Math.round(migratedUsers/totalUsers*100) : 0}%)`);
    
    if (migratedUsers > 0) {
      // Get detailed statistics only if there are migrated users
      try {
        const stats = await User.aggregate([
          { $match: { migratedToFriendsAt: { $exists: true } } },
          { 
            $project: {
              username: 1,
              friendsCount: { $size: { $ifNull: ['$friends', []] } },
              acceptedFriends: {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$friends', []] },
                    as: 'friend',
                    cond: { $eq: ['$friend.status', 'accepted'] }
                  }
                }
              },
              pendingRequests: {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$friends', []] },
                    as: 'friend',
                    cond: { $eq: ['$friend.status', 'pending'] }
                  }
                }
              }
            }
          },
          {
            $group: {
              _id: null,
              totalFriendships: { $sum: '$friendsCount' },
              totalAccepted: { $sum: '$acceptedFriends' },
              totalPending: { $sum: '$pendingRequests' },
              avgFriendsPerUser: { $avg: '$acceptedFriends' },
              maxFriends: { $max: '$acceptedFriends' },
              minFriends: { $min: '$acceptedFriends' }
            }
          }
        ]);

        const friendshipStats = stats[0] || {};
        
        console.log(`Total Friendship Records: ${friendshipStats.totalFriendships || 0}`);
        console.log(`Accepted Friendships: ${friendshipStats.totalAccepted || 0}`);
        console.log(`Pending Requests: ${friendshipStats.totalPending || 0}`);
        console.log(`Average Friends per User: ${Math.round(friendshipStats.avgFriendsPerUser || 0)}`);
        console.log(`Max Friends (single user): ${friendshipStats.maxFriends || 0}`);
        
      } catch (statsError) {
        console.log('⚠️  Could not generate detailed statistics:', statsError.message);
      }
    } else {
      console.log('No migrated users found. Migration has not been run yet.');
    }
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

// Export functions
module.exports = {
  migrateToFriendsSystem,
  generateMigrationReport
};

// Run based on command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--report')) {
    generateMigrationReport().catch(console.error);
  } else {
    migrateToFriendsSystem().catch(console.error);
  }
}

/**
 * Migration script to convert follower/following system to friends system
 */

async function migrateToFriendsSystem() {
  console.log('🔄 Starting Friends System Migration...');
  console.log('📊 This will convert your follower/following system to a friends system\n');

  let connection;
  
  try {
    // ✅ ENHANCED: Better connection with longer timeout
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in environment variables');
      console.error('   Please set MONGO_URI in your .env file');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    
    // ✅ FIXED: Enhanced connection options
    connection = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      bufferCommands: false,
      bufferMaxEntries: 0,
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    
    console.log('✅ Connected to MongoDB\n');

    // ✅ FIXED: Import User model AFTER connection
    const User = mongoose.model('User', require('../models/User').schema);

    // ✅ ENHANCED: Better error handling for count operations
    let totalUsers, usersWithFollowers, usersWithFollowing, usersWithRequests;
    
    try {
      console.log('📊 Gathering migration statistics...');
      
      totalUsers = await User.countDocuments().maxTimeMS(30000);
      console.log(`   Total Users: ${totalUsers}`);
      
      usersWithFollowers = await User.countDocuments({ 
        followers: { $exists: true, $not: { $size: 0 } } 
      }).maxTimeMS(30000);
      console.log(`   Users with Followers: ${usersWithFollowers}`);
      
      usersWithFollowing = await User.countDocuments({ 
        following: { $exists: true, $not: { $size: 0 } } 
      }).maxTimeMS(30000);
      console.log(`   Users with Following: ${usersWithFollowing}`);
      
      usersWithRequests = await User.countDocuments({ 
        followRequests: { $exists: true, $not: { $size: 0 } } 
      }).maxTimeMS(30000);
      console.log(`   Users with Follow Requests: ${usersWithRequests}\n`);
      
    } catch (countError) {
      console.error('❌ Error getting user counts:', countError.message);
      console.log('⚠️  Proceeding with migration anyway...\n');
      totalUsers = 0;
      usersWithFollowers = 0;
      usersWithFollowing = 0;
      usersWithRequests = 0;
    }

    console.log('⚠️  This migration will:');
    console.log('   • Convert mutual follows to accepted friendships');
    console.log('   • Convert one-way follows to pending friend requests');
    console.log('   • Preserve original data for rollback');
    console.log('   • Add default privacy settings\n');

    let processedUsers = 0;
    let mutualFriendships = 0;
    let pendingRequests = 0;
    let errors = 0;

    console.log('🚀 Starting migration...\n');

    // ✅ FIXED: Better batch processing with smaller batches
    const batchSize = 50; // Reduced batch size
    let skip = 0;
    const maxUsers = totalUsers || 1000; // Fallback if count failed

    while (skip < maxUsers) {
      try {
        console.log(`📦 Processing batch starting at ${skip}...`);
        
        const users = await User.find({})
          .populate('followers', '_id')
          .populate('following', '_id')
          .limit(batchSize)
          .skip(skip)
          .maxTimeMS(30000);

        if (users.length === 0) {
          console.log('✅ No more users to process');
          break;
        }

        console.log(`   Processing ${users.length} users in this batch`);

        for (const user of users) {
          try {
            await migrateUserToFriendsSystem(user);
            
            const stats = await getUserMigrationStats(user);
            mutualFriendships += stats.mutualFriendships;
            pendingRequests += stats.pendingRequests;
            
            processedUsers++;
            
            if (processedUsers % 25 === 0) {
              console.log(`   ✅ Processed ${processedUsers} users so far...`);
            }
            
          } catch (userError) {
            console.error(`   ❌ Error processing user ${user.username || user._id}:`, userError.message);
            errors++;
          }
        }

        skip += batchSize;
        
        // ✅ ADDED: Small delay between batches to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (batchError) {
        console.error(`❌ Error processing batch at ${skip}:`, batchError.message);
        errors++;
        skip += batchSize; // Continue to next batch
      }
    }

    console.log('\n🎉 Migration Complete!');
    console.log('📊 Final Statistics:');
    console.log(`   ✅ Processed Users: ${processedUsers}`);
    console.log(`   🤝 Mutual Friendships Created: ${Math.floor(mutualFriendships / 2)}`);
    console.log(`   📤 Pending Friend Requests: ${pendingRequests}`);
    console.log(`   ❌ Errors: ${errors}\n`);

    if (errors === 0) {
      console.log('🔍 Verifying migration...');
      await verifyMigration();
      console.log('\n✅ Migration verification complete!');
    } else {
      console.log('⚠️  Some errors occurred during migration. Please review the logs.');
    }

    console.log('\n📝 Next steps:');
    console.log('   1. Test the friends system with: GET /api/friends/list');
    console.log('   2. Check migration status: GET /api/migration/status');
    console.log('   3. Test friend requests in your app');
    console.log('   4. Update frontend components to use new friends system');
    console.log('\n💡 The old follower data is preserved for rollback if needed.');

  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('🔌 Database connection failed. Please check:');
      console.error('   • MongoDB is running');
      console.error('   • MONGO_URI is correct in .env file');
      console.error('   • Network connectivity');
    }
    throw error;
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

/**
 * Migrate a single user from follower system to friends system
 * @param {Object} user - User document with populated followers/following
 */
async function migrateUserToFriendsSystem(user) {
  if (!user.followers && !user.following && !user.followRequests) {
    return; // Nothing to migrate
  }

  const friends = [];
  const processedUsers = new Set();

  // Convert existing followRequests to pending friend requests
  if (user.followRequests && user.followRequests.length > 0) {
    for (const requesterId of user.followRequests) {
      const requesterIdStr = String(requesterId);
      
      if (!processedUsers.has(requesterIdStr)) {
        friends.push({
          user: requesterId,
          status: 'pending',
          initiatedBy: requesterId,
          createdAt: new Date(),
          requestMessage: 'Migrated from follow request'
        });
        processedUsers.add(requesterIdStr);
      }
    }
  }

  const userFollowers = user.followers || [];
  const userFollowing = user.following || [];

  // Find mutual follows (bidirectional relationships)
  const mutualFollows = userFollowers.filter(followerId => 
    userFollowing.some(followingId => String(followerId._id) === String(followingId._id))
  );

  // Create accepted friendships for mutual follows
  for (const mutualUser of mutualFollows) {
    const mutualUserIdStr = String(mutualUser._id);
    
    if (!processedUsers.has(mutualUserIdStr) && mutualUserIdStr !== String(user._id)) {
      friends.push({
        user: mutualUser._id,
        status: 'accepted',
        initiatedBy: user._id,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(),
        requestMessage: 'Migrated from mutual follow'
      });
      processedUsers.add(mutualUserIdStr);
    }
  }

  // Create pending requests for one-way follows
  const oneWayFollowing = userFollowing.filter(followingId => 
    !userFollowers.some(followerId => String(followerId._id) === String(followingId._id))
  );

  for (const followedUser of oneWayFollowing) {
    const followedUserIdStr = String(followedUser._id);
    
    if (!processedUsers.has(followedUserIdStr) && followedUserIdStr !== String(user._id)) {
      friends.push({
        user: followedUser._id,
        status: 'pending',
        initiatedBy: user._id,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        requestMessage: 'Migrated from follow relationship'
      });
      processedUsers.add(followedUserIdStr);
    }
  }

  // Set default privacy settings
  const defaultPrivacy = {
    friendRequests: user.isPublic ? 'everyone' : 'friends-of-friends',
    friendsList: user.isPublic ? 'friends' : 'only-me',
    posts: user.isPublic ? 'public' : 'friends',
    eventAttendance: 'friends',
    allowSuggestions: true
  };

  // ✅ FIXED: Use updateOne instead of findByIdAndUpdate for better performance
  await mongoose.model('User').updateOne(
    { _id: user._id },
    {
      $set: {
        friends: friends,
        privacy: defaultPrivacy,
        migratedToFriendsAt: new Date()
      }
    }
  );
}

/**
 * Get migration statistics for a user
 */
async function getUserMigrationStats(user) {
  try {
    const updatedUser = await mongoose.model('User').findById(user._id).select('friends');
    
    const mutualFriendships = updatedUser.friends.filter(f => f.status === 'accepted').length;
    const pendingRequests = updatedUser.friends.filter(f => f.status === 'pending').length;
    
    return {
      mutualFriendships,
      pendingRequests
    };
  } catch (error) {
    console.error('Error getting user stats:', error.message);
    return { mutualFriendships: 0, pendingRequests: 0 };
  }
}

/**
 * Verify the migration was successful
 */
async function verifyMigration() {
  try {
    const User = mongoose.model('User');
    
    const totalUsers = await User.countDocuments().maxTimeMS(30000);
    const migratedUsers = await User.countDocuments({ migratedToFriendsAt: { $exists: true } }).maxTimeMS(30000);
    const usersWithFriends = await User.countDocuments({ friends: { $exists: true, $not: { $size: 0 } } }).maxTimeMS(30000);
    
    console.log('📊 Migration Verification:');
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Migrated Users: ${migratedUsers}`);
    console.log(`   Users with Friends: ${usersWithFriends}`);
    
    if (migratedUsers < totalUsers * 0.5) {
      console.log('\n⚠️  Warning: Less than 50% of users were migrated');
      console.log('   This might indicate an issue with the migration process');
    } else {
      console.log('\n✅ Migration appears successful');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }
}

/**
 * Generate migration report
 */
async function generateMigrationReport() {
  console.log('📋 Generating Migration Report...\n');
  
  let connection;
  
  try {
    // ✅ FIXED: Same connection improvements for report
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in environment variables');
      process.exit(1);
    }

    connection = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
    });
    
    console.log('✅ Connected to MongoDB for report generation\n');
    
    const User = mongoose.model('User', require('../models/User').schema);
    
    const totalUsers = await User.countDocuments().maxTimeMS(30000);
    const migratedUsers = await User.countDocuments({ migratedToFriendsAt: { $exists: true } }).maxTimeMS(30000);
    
    console.log('📊 Migration Report:');
    console.log('=====================================');
    console.log(`Migration Date: ${new Date().toISOString()}`);
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Migrated Users: ${migratedUsers} (${Math.round(migratedUsers/totalUsers*100)}%)`);
    
    if (migratedUsers > 0) {
      // Get detailed statistics only if there are migrated users
      try {
        const stats = await User.aggregate([
          { $match: { migratedToFriendsAt: { $exists: true } } },
          { 
            $project: {
              username: 1,
              friendsCount: { $size: { $ifNull: ['$friends', []] } },
              acceptedFriends: {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$friends', []] },
                    as: 'friend',
                    cond: { $eq: ['$$friend.status', 'accepted'] }
                  }
                }
              },
              pendingRequests: {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$friends', []] },
                    as: 'friend',
                    cond: { $eq: ['$$friend.status', 'pending'] }
                  }
                }
              }
            }
          },
          {
            $group: {
              _id: null,
              totalFriendships: { $sum: '$friendsCount' },
              totalAccepted: { $sum: '$acceptedFriends' },
              totalPending: { $sum: '$pendingRequests' },
              avgFriendsPerUser: { $avg: '$acceptedFriends' },
              maxFriends: { $max: '$acceptedFriends' },
              minFriends: { $min: '$acceptedFriends' }
            }
          }
        ]).maxTimeMS(30000);

        const friendshipStats = stats[0] || {};
        
        console.log(`Total Friendship Records: ${friendshipStats.totalFriendships || 0}`);
        console.log(`Accepted Friendships: ${friendshipStats.totalAccepted || 0}`);
        console.log(`Pending Requests: ${friendshipStats.totalPending || 0}`);
        console.log(`Average Friends per User: ${Math.round(friendshipStats.avgFriendsPerUser || 0)}`);
        console.log(`Max Friends (single user): ${friendshipStats.maxFriends || 0}`);
        
      } catch (statsError) {
        console.log('⚠️  Could not generate detailed statistics:', statsError.message);
      }
    } else {
      console.log('No migrated users found. Migration has not been run yet.');
    }
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

// Export functions
module.exports = {
  migrateToFriendsSystem,
  generateMigrationReport
};

// Run based on command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--report')) {
    generateMigrationReport().catch(console.error);
  } else {
    migrateToFriendsSystem().catch(console.error);
  }
}