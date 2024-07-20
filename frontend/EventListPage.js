// EventListPage.js
import React, { useState, useEffect } from 'react';

function EventListPage() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const response = await fetch('/api/events', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setEvents(data);
    };

    fetchEvents();
  }, []);

  return (
    <div>
      <h1>Events</h1>
      <div>
        {events.map((event) => (
          <div key={event._id}>
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            <p>{event.location}</p>
            <p>{new Date(event.time).toLocaleString()}</p>
            <p>{event.price ? `$${event.price.toFixed(2)}` : 'Free'}</p>
            <a href={`/events/${event._id}`}>View Event</a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventListPage;