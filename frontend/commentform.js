// CommentForm.js
import React, { useState } from 'react';

function CommentForm({ photoId }) {
  const [text, setText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch(`/api/photos/comment/${photoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    setText('');
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment"
      />
      <button type="submit">Submit</button>
    </form>
  );
}

export default CommentForm;