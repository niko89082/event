// UserSearchPage.js
import React, { useState } from 'react';
import SearchUsersForm from './SearchUsersForm';

function UserSearchPage() {
  const [users, setUsers] = useState([]);

  const handleSearch = async (filters) => {
    const query = new URLSearchParams(filters).toString();
    const response = await fetch(`/api/search/users?${query}`);
    const data = await response.json();
    setUsers(data);
  };

  return (
    <div>
      <SearchUsersForm onSearch={handleSearch} />
      <div>
        {users.map((user) => (
          <div key={user._id}>
            <h2>{user.username}</h2>
            <p>{user.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserSearchPage;