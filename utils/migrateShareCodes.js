
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('../models/User');
const crypto = require('crypto');

async function migrateExistingUsers() {
  try {
    console.log('🔄 Starting shareCode migration...');
    
    // Find users without shareCode
    const usersWithoutShareCode = await User.find({ 
      $or: [
        { shareCode: { $exists: false } },
        { shareCode: null },
        { shareCode: '' }
      ]
    });

    console.log(`📊 Found ${usersWithoutShareCode.length} users without shareCode`);

    for (const user of usersWithoutShareCode) {
      // Generate unique share code
      let shareCode;
      let isUnique = false;
      
      while (!isUnique) {
        shareCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const existingUser = await User.findOne({ shareCode });
        if (!existingUser) {
          isUnique = true;
        }
      }

      // Update user with shareCode
      await User.findByIdAndUpdate(user._id, { shareCode });
      console.log(`✅ Updated user ${user.username} with shareCode: ${shareCode}`);
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Export for manual execution
module.exports = { migrateExistingUsers };

// If running this file directly
if (require.main === module) {
  // Connect to MongoDB
  mongoose.connect("process.env.MONGO_URI", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('📦 Connected to MongoDB');
    return migrateExistingUsers();
  })
  .then(() => {
    console.log('🔚 Migration script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Migration error:', error);
    process.exit(1);
  });
}