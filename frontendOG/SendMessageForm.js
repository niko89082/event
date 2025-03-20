// SendMessageForm.js
import React, { useState } from 'react';

function SendMessageForm({ recipientId }) {
  const [content, setContent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ recipientId, content }),
    });

    const data = await response.json();
    console.log(data);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your message"
        required
      />
      <button type="submit">Send</button>
    </form>
  );
}

export default SendMessageForm;