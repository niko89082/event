// NotificationList.js
import React, { useEffect, useState } from 'react';

function NotificationList() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      setNotifications(data);
    };

    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    setNotifications(notifications.map((notification) =>
      notification._id === id ? { ...notification, isRead: true } : notification
    ));
  };

  return (
    <div>
      {notifications.map((notification) => (
        <div
          key={notification._id}
          style={{ backgroundColor: notification.isRead ? 'white' : 'lightgray' }}
          onClick={() => markAsRead(notification._id)}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
}

export default NotificationList;