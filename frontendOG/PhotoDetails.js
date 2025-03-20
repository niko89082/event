// PhotoDetails.js
import React, { useEffect, useState } from 'react';

function PhotoDetails({ photoId }) {
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    const fetchPhoto = async () => {
      const response = await fetch(`/api/photos/${photoId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      setPhoto(data);
    };

    fetchPhoto();
  }, [photoId]);

  return (
    <div>
      {photo && (
        <>
          <img src={`/${photo.path}`} alt="User upload" />
          <div>
            <LikeButton photoId={photo._id} />
            <span>{photo.likes.length} likes</span>
          </div>
          <div>
            <CommentForm photoId={photo._id} />
            {photo.comments.map((comment) => (
              <div key={comment._id}>
                <p>{comment.text}</p>
                <p>— {comment.user.username}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PhotoDetails;