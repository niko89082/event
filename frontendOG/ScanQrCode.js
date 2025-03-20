import React, { useState } from 'react';
import QrReader from 'react-qr-reader';
import axios from 'axios';

const ScanQrCode = () => {
  const [scanResult, setScanResult] = useState('');

  const handleScan = async (data) => {
    if (data) {
      setScanResult(data);
      try {
        const token = localStorage.getItem('token'); // Get JWT token
        const response = await axios.post(`http://localhost:3000/api/follow/follow/${data}`, {}, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log(response.data.message);
      } catch (error) {
        console.error('Error following user:', error.response.data.message);
      }
    }
  };

  const handleError = (err) => {
    console.error(err);
  };

  return (
    <div>
      <QrReader
        delay={300}
        onError={handleError}
        onScan={handleScan}
        style={{ width: '100%' }}
      />
      <p>{scanResult}</p>
    </div>
  );
};

export default ScanQrCode;