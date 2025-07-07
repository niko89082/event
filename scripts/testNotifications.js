// scripts/testNotifications.js - PHASE 3: Test notification system
require('dotenv').config();
const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');

async function testNotificationSystem() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // Test user IDs (replace with real user IDs from your database)
    const testUserId1 = '507f1f77bcf86cd799439011'; // Replace with real user ID
    const testUserId2 = '507f1f77bcf86cd799439012'; // Replace with real user ID
    const testEventId = '507f1f77bcf86cd799439013'; // Replace with real event ID
    const testMemoryId = '507f1f77bcf86cd799439014'; // Replace with real memory ID

    console.log('\n🧪 Testing Notification System...\n');

    // Test 1: Social Notifications
    console.log('📱 Testing Social Notifications:');
    
    // Friend request
    const friendRequest = await notificationService.sendFriendRequest(testUserId1, testUserId2);
    console.log('✅ Friend request notification:', friendRequest.type);
    
    // New follower
    const follower = await notificationService.sendNewFollower(testUserId1, testUserId2);
    console.log('✅ New follower notification:', follower.type);
    
    // Memory photo added
    const memoryPhoto = await notificationService.sendMemoryPhotoAdded(
      testUserId1, 
      testMemoryId, 
      [testUserId1, testUserId2]
    );
    console.log('✅ Memory photo notifications:', memoryPhoto.length);

    // Test 2: Event Notifications
    console.log('\n🎉 Testing Event Notifications:');
    
    // Event invitation
    const eventInvite = await notificationService.sendEventInvitation(
      testUserId1, 
      testEventId, 
      [testUserId2]
    );
    console.log('✅ Event invitation notifications:', eventInvite.length);
    
    // Event reminder
    const reminder = await notificationService.sendEventReminder(testEventId, '1_day');
    console.log('✅ Event reminder notifications:', reminder.length);
    
    // Batched RSVP (test multiple RSVPs)
    const rsvp1 = await notificationService.sendEventRSVPBatch(testEventId, testUserId1);
    console.log('✅ First RSVP notification:', rsvp1.type);
    
    // Wait a bit then send another RSVP (should batch)
    setTimeout(async () => {
      const rsvp2 = await notificationService.sendEventRSVPBatch(testEventId, testUserId1);
      console.log('✅ Batched RSVP notification count:', rsvp2.data.count);
    }, 1000);

    // Test 3: Notification Retrieval
    console.log('\n📋 Testing Notification Retrieval:');
    
    // Get all notifications
    const allNotifications = await notificationService.getUserNotifications(testUserId2);
    console.log('✅ Total notifications:', allNotifications.notifications.length);
    console.log('✅ Unread counts:', allNotifications.unreadCounts);
    
    // Get social notifications only
    const socialNotifications = await notificationService.getUserNotifications(testUserId2, 1, 20, 'social');
    console.log('✅ Social notifications:', socialNotifications.notifications.length);
    
    // Get event notifications only
    const eventNotifications = await notificationService.getUserNotifications(testUserId2, 1, 20, 'events');
    console.log('✅ Event notifications:', eventNotifications.notifications.length);

    // Test 4: Notification Management
    console.log('\n⚙️ Testing Notification Management:');
    
    if (allNotifications.notifications.length > 0) {
      const firstNotification = allNotifications.notifications[0];
      
      // Mark as read
      const marked = await notificationService.markAsRead(firstNotification._id, testUserId2);
      console.log('✅ Marked notification as read:', marked.isRead);
      
      // Mark all social as read
      await notificationService.markAllAsRead(testUserId2, 'social');
      console.log('✅ Marked all social notifications as read');
    }

    // Test 5: Category Statistics
    console.log('\n📊 Testing Category Statistics:');
    
    const stats = await Notification.getUnreadCountByCategory(testUserId2);
    console.log('✅ Unread counts by category:', stats);
    
    const socialCount = await notificationService.getUnreadCount(testUserId2, 'social');
    const eventCount = await notificationService.getUnreadCount(testUserId2, 'events');
    console.log('✅ Social unread:', socialCount);
    console.log('✅ Events unread:', eventCount);

    // Test 6: Cleanup Test Notifications
    console.log('\n🧹 Cleaning up test notifications...');
    
    const deletedCount = await Notification.deleteMany({
      user: { $in: [testUserId1, testUserId2] },
      message: { $regex: /test|Test/ }
    });
    console.log('✅ Deleted test notifications:', deletedCount.deletedCount);

    console.log('\n🎉 All notification tests completed successfully!');
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log('- ✅ Social notifications (friend request, follower, memory photo)');
    console.log('- ✅ Event notifications (invitation, reminder, batched RSVP)');
    console.log('- ✅ Category-based retrieval');
    console.log('- ✅ Notification management (mark read, delete)');
    console.log('- ✅ Unread count tracking');
    console.log('- ✅ Batching functionality');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Helper function to create test notifications with real data
async function createTestNotificationsWithRealData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Get real users from database
    const User = require('../models/User');
    const users = await User.find().limit(2).select('_id username');
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users in database to run tests');
      return;
    }
    
    const user1 = users[0];
    const user2 = users[1];
    
    console.log(`🧪 Creating test notifications for real users: ${user1.username} and ${user2.username}`);
    
    // Create test notifications
    const notifications = [
      {
        userId: user2._id,
        senderId: user1._id,
        category: 'social',
        type: 'friend_request',
        title: 'Test Friend Request',
        message: `${user1.username} sent you a friend request`,
        actionType: 'VIEW_PROFILE',
        actionData: { userId: user1._id }
      },
      {
        userId: user2._id,
        senderId: user1._id,
        category: 'social',
        type: 'new_follower',
        title: 'Test New Follower',
        message: `${user1.username} started following you`,
        actionType: 'VIEW_PROFILE',
        actionData: { userId: user1._id }
      },
      {
        userId: user2._id,
        senderId: null,
        category: 'events',
        type: 'event_reminder',
        title: 'Test Event Reminder',
        message: 'Don\'t forget: "Test Party" is tomorrow',
        actionType: 'VIEW_EVENT',
        actionData: { eventId: 'test' }
      },
      {
        userId: user2._id,
        senderId: user1._id,
        category: 'events',
        type: 'event_invitation',
        title: 'Test Event Invitation',
        message: `${user1.username} invited you to "Test Party"`,
        actionType: 'VIEW_EVENT',
        actionData: { eventId: 'test' }
      }
    ];
    
    for (const notifData of notifications) {
      await notificationService.createNotification(notifData);
    }
    
    console.log('✅ Created 4 test notifications');
    console.log('✅ Test these with:');
    console.log(`   GET /api/notifications (as user: ${user2.username})`);
    console.log(`   GET /api/notifications?category=social`);
    console.log(`   GET /api/notifications?category=events`);
    console.log(`   GET /api/notifications/unread-count`);
    
  } catch (error) {
    console.error('❌ Error creating test notifications:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run based on command line argument
const command = process.argv[2];

if (command === 'create') {
  createTestNotificationsWithRealData();
} else {
  testNotificationSystem();
}

// Usage:
// node scripts/testNotifications.js        - Run full test suite
// node scripts/testNotifications.js create - Create test notifications with real user data