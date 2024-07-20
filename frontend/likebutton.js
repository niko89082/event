// LikeButton.js
import React, { useState } from 'react';

function LikeButton({ photoId }) {
  const [liked, setLiked] = useState(false);

  const handleLike = async () => {
    const response = await fetch(`/api/photos/like/${photoId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    const data = await response.json();
    setLiked(!liked);
  };

  return (
    <button onClick={handleLike}>
      {liked ? 'Unlike' : 'Like'}
    </button>
  );
}

export default LikeButton;