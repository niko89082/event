// services/notificationScheduler.js - NEW FILE: Auto-send event reminders
const cron = require('node-cron');
const Event = require('../models/Event');
const notificationService = require('./notificationService');

class NotificationScheduler {
  
  start() {
    // Check for events starting in 1 hour - runs every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      console.log('🔔 Checking for 1-hour event reminders...');
      await this.checkOneHourReminders();
    });
    
    // Check for events starting tomorrow - runs once daily at 10 AM
    cron.schedule('0 10 * * *', async () => {
      console.log('🔔 Checking for 1-day event reminders...');
      await this.checkOneDayReminders();
    });
    
    console.log('📅 Notification scheduler started');
  }
  
  async checkOneHourReminders() {
    try {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const fifteenMinutesLater = new Date(now.getTime() + 75 * 60 * 1000); // 15min buffer
      
      // Find events starting in the next hour (with 15min buffer)
      const upcomingEvents = await Event.find({
        time: {
          $gte: oneHourLater,
          $lt: fifteenMinutesLater
        },
        attendees: { $exists: true, $not: { $size: 0 } }
      }).select('_id title time');
      
      console.log(`📅 Found ${upcomingEvents.length} events starting in 1 hour`);
      
      for (const event of upcomingEvents) {
        await notificationService.sendEventReminder(event._id, '1_hour');
        console.log(`🔔 Sent 1-hour reminders for event: ${event.title}`);
      }
      
    } catch (error) {
      console.error('Error checking 1-hour reminders:', error);
    }
  }
  
  async checkOneDayReminders() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
      // Find events happening tomorrow
      const tomorrowEvents = await Event.find({
        time: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        attendees: { $exists: true, $not: { $size: 0 } }
      }).select('_id title time');
      
      console.log(`📅 Found ${tomorrowEvents.length} events tomorrow`);
      
      for (const event of tomorrowEvents) {
        await notificationService.sendEventReminder(event._id, '1_day');
        console.log(`🔔 Sent 1-day reminders for event: ${event.title}`);
      }
      
    } catch (error) {
      console.error('Error checking 1-day reminders:', error);
    }
  }
}

module.exports = new NotificationScheduler();