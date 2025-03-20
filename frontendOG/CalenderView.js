import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import { useHistory } from 'react-router-dom';

const CalendarView = () => {
  const [events, setEvents] = useState([]);
  const history = useHistory();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get('/api/events/calendar');
        setEvents(response.data);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchEvents();
  }, []);

  const handleDateClick = (value) => {
    const selectedEvent = events.find(event => new Date(event.start).toDateString() === value.toDateString());
    if (selectedEvent) {
      history.push(selectedEvent.url);
    }
  };

  return (
    <div>
      <Calendar
        tileContent={({ date, view }) => {
          const event = events.find(event => new Date(event.start).toDateString() === date.toDateString());
          return event ? <p>{event.title}</p> : null;
        }}
        onClickDay={handleDateClick}
      />
    </div>
  );
};

export default CalendarView;