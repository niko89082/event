import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:3000');

const Conversation = ({ recipientId }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await axios.get(`/api/messages/conversation/${recipientId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setMessages(response.data);
    };

    fetchMessages();

    socket.emit('joinRoom', { conversationId: recipientId });

    socket.on('message', (newMessage) => {
      setMessages((messages) => [...messages, newMessage]);
    });

    return () => {
      socket.emit('leaveRoom', { conversationId: recipientId });
    };
  }, [recipientId]);

  const sendMessage = async () => {
    const messageData = { sender: userId, content: message };
    try {
      const response = await axios.post('http://localhost:3000/api/messages/send', {
        recipientId,
        content: message,
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      socket.emit('sendMessage', { conversationId: recipientId, message: response.data });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div>
      <div className="message-list">
        {messages.map((msg, index) => (
          <div key={index} className={msg.sender === userId ? 'my-message' : 'their-message'}>
            {msg.content}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

export default Conversation;