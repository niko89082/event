// EventSearchPage.js
import React, { useState } from 'react';
import SearchEventsForm from './SearchEventsForm';

function EventSearchPage() {
  const [events, setEvents] = useState([]);

  const handleSearch = async (filters) => {
    const query = new URLSearchParams(filters).toString();
    const response = await fetch(`/api/search/events?${query}`);
    const data = await response.json();
    setEvents(data);
  };

  return (
    <div>
      <SearchEventsForm onSearch={handleSearch} />
      <div>
        {events.map((event) => (
          <div key={event._id}>
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            <p>{event.location}</p>
            <p>{new Date(event.time).toLocaleString()}</p>
            <p>{event.price ? `$${event.price.toFixed(2)}` : 'Free'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventSearchPage;