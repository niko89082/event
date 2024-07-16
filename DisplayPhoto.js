// DisplayPhotos.js
import React, { useEffect, useState } from 'react';

function DisplayPhotos({ eventId }) {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    const fetchPhotos = async () => {
      let url = '/api/photos/main';
      if (eventId) {
        url = `/api/photos/event/${eventId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      setPhotos(data);
    };

    fetchPhotos();
  }, [eventId]);

  return (
    <div>
      {photos.map((photo) => (
        <img key={photo._id} src={`/${photo.path}`} alt="User upload" />
      ))}
    </div>
  );
}

export default DisplayPhotos;