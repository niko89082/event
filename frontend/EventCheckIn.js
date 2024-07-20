// EventCheckIn.js
import React, { useState } from 'react';

function EventCheckIn({ eventId }) {
  const [qrCodeData, setQrCodeData] = useState('');
  const [message, setMessage] = useState('');

  const handleCheckIn = async () => {
    const response = await fetch(`/api/checkin/${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ qrCodeData }),
    });

    const data = await response.json();
    setMessage(data.message);
  };

  return (
    <div>
      <input
        type="text"
        value={qrCodeData}
        onChange={(e) => setQrCodeData(e.target.value)}
        placeholder="Scan QR Code"
      />
      <button onClick={handleCheckIn}>Check In</button>
      {message && <div>{message}</div>}
    </div>
  );
}

export default EventCheckIn;