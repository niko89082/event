// UserProfile.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProfilePictureUpload from './ProfilePictureUpload';

function UserProfile() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [isProfileOwner, setIsProfileOwner] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      setUser(data);
      const loggedInUser = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const loggedInUserData = await loggedInUser.json();
      setIsProfileOwner(loggedInUserData._id === userId);
    };

    fetchUser();
  }, [userId]);

  if (!user) {
    return <div>Loading...</div>;
  }

  if (!user.isPublic && !isProfileOwner) {
    return <div>This profile is private.</div>;
  }

  return (
    <div>
      <h1>{user.username}</h1>
      <p>{user.email}</p>
      {user.profilePicture && <img src={user.profilePicture} alt="Profile" />}
      {isProfileOwner && <ProfilePictureUpload />}
    </div>
  );
}

export default UserProfile;