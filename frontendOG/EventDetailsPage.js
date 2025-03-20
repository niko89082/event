// EventDetailsPage.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function EventDetailsPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const response = await fetch(`/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setEvent(data);
    };

    fetchEvent();
  }, [eventId]);

  if (!event) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p>{event.location}</p>
      <p>{new Date(event.time).toLocaleString()}</p>
      <p>{event.price ? `$${event.price.toFixed(2)}` : 'Free'}</p>
      <p>{event.isPublic ? 'Public Event' : 'Private Event'}</p>
      <div>
        <h3>Co-hosts</h3>
        {event.coHosts.map((coHost) => (
          <p key={coHost._id}>{coHost.username}</p>
        ))}
      </div>
      <div>
        <h3>Attendees</h3>
        {event.attendees.map((attendee) => (
          <p key={attendee._id}>{attendee.username}</p>
        ))}
      </div>
    </div>
  );
}

export default EventDetailsPage;