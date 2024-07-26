import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProfileCustomization = () => {
  const [user, setUser] = useState({});
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [theme, setTheme] = useState('');
  const [colorScheme, setColorScheme] = useState('');
  const [bio, setBio] = useState('');
  const [socialMediaLinks, setSocialMediaLinks] = useState({
    facebook: '',
    twitter: '',
    instagram: '',
  });

  useEffect(() => {
    // Fetch user profile
    const fetchUserProfile = async () => {
      const res = await axios.get('/api/profile');
      setUser(res.data);
      setTheme(res.data.theme || '');
      setColorScheme(res.data.colorScheme || '');
      setBio(res.data.bio || '');
      setSocialMediaLinks(res.data.socialMediaLinks || {});
    };

    fetchUserProfile();
  }, []);

  const handleImageChange = (e) => {
    setBackgroundImage(e.target.files[0]);
  };

  const handleSocialMediaChange = (e) => {
    setSocialMediaLinks({ ...socialMediaLinks, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    if (backgroundImage) formData.append('backgroundImage', backgroundImage);
    formData.append('theme', theme);
    formData.append('colorScheme', colorScheme);
    formData.append('bio', bio);
    formData.append('socialMediaLinks', JSON.stringify(socialMediaLinks));

    try {
      const res = await axios.put('/api/profile/customize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(res.data);
    } catch (error) {
      console.error('Error updating profile', error);
    }
  };

  return (
    <div>
      <h1>Customize Your Profile</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Background Image</label>
          <input type="file" onChange={handleImageChange} />
        </div>
        <div>
          <label>Theme</label>
          <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>
        <div>
          <label>Color Scheme</label>
          <input type="text" value={colorScheme} onChange={(e) => setColorScheme(e.target.value)} />
        </div>
        <div>
          <label>Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div>
          <label>Facebook</label>
          <input type="text" name="facebook" value={socialMediaLinks.facebook} onChange={handleSocialMediaChange} />
        </div>
        <div>
          <label>Twitter</label>
          <input type="text" name="twitter" value={socialMediaLinks.twitter} onChange={handleSocialMediaChange} />
        </div>
        <div>
          <label>Instagram</label>
          <input type="text" name="instagram" value={socialMediaLinks.instagram} onChange={handleSocialMediaChange} />
        </div>
        <button type="submit">Save Changes</button>
      </form>
    </div>
  );
};

export default ProfileCustomization;