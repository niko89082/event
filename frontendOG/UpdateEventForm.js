// UpdateEventForm.js
import React, { useState, useEffect } from 'react';

function UpdateEventForm({ eventId }) {
  const [event, setEvent] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [price, setPrice] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [coHostId, setCoHostId] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      const response = await fetch(`/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setEvent(data);
      setTitle(data.title);
      setDescription(data.description);
      setTime(data.time);
      setLocation(data.location);
      setMaxAttendees(data.maxAttendees);
      setPrice(data.price);
      setIsPublic(data.isPublic);
    };

    fetchEvent();
  }, [eventId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        title,
        description,
        time,
        location,
        maxAttendees,
        price,
        isPublic,
      }),
    });

    const data = await response.json();
    console.log(data);
  };

  const handleAddCoHost = async () => {
    const response = await fetch(`/api/events/${eventId}/cohost`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ coHostId }),
    });
  
    const data = await response.json();
    console.log(data);
  };
  
  if (!event) {
    return <div>Loading...</div>;
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" required />
      <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
      <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" required />
      <input type="number" value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} placeholder="Max Attendees" required />
      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" />
      <label>
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Public Event
      </label>
      <button type="submit">Update Event</button>
  
      <div>
        <input type="text" value={coHostId} onChange={(e) => setCoHostId(e.target.value)} placeholder="Co-host User ID" />
        <button type="button" onClick={handleAddCoHost}>Add Co-host</button>
      </div>
    </form>
  );
  }
  
  export default UpdateEventForm;