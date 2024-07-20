// Conversation.js
import React, { useEffect, useState } from 'react';

function Conversation({ recipientId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await fetch(`/api/messages/conversation/${recipientId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      setMessages(data);
    };

    fetchMessages();
  }, [recipientId]);

  return (
    <div>
      {messages.map((message) => (
        <div key={message._id}>
          <strong>{message.sender.username}:</strong> {message.content}
        </div>
      ))}
    </div>
  );
}

export default Conversation;