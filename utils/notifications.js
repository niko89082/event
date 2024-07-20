// utils/notifications.js
const Notification = require('../models/Notification');

const createNotification = async (userId, type, message) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      message,
    });

    await notification.save();
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

module.exports = {
  createNotification,
};