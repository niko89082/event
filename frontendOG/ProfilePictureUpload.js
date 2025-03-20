// ProfilePictureUpload.js
import React, { useState } from 'react';

function ProfilePictureUpload() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [profilePicture, setProfilePicture] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await fetch('/api/profile/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (response.ok) {
      setProfilePicture(data.profilePicture);
      setMessage('Profile picture uploaded successfully');
    } else {
      setMessage(data.message);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="file" onChange={handleFileChange} />
        <button type="submit">Upload</button>
      </form>
      {message && <p>{message}</p>}
      {profilePicture && <img src={profilePicture} alt="Profile" />}
    </div>
  );
}

export default ProfilePictureUpload;