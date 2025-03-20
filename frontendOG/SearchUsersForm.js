// SearchUsersForm.js
import React, { useState } from 'react';

function SearchUsersForm({ onSearch }) {
  const [username, setUsername] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    onSearch({ username });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Search by username"
      />
      <button type="submit">Search</button>
    </form>
  );
}

export default SearchUsersForm;