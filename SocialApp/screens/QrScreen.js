// screens/QrScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Button } from 'react-native';
import api from '../services/api';
import { useNavigation } from '@react-navigation/native';

export default function QrScreen() {
  const navigation = useNavigation();
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQrCode();
  }, []);

  const fetchQrCode = async () => {
    try {
      const response = await api.get('/profile'); // e.g. returns { qrCode: "...", ... }
      setQrCode(response.data.qrCode); 
    } catch (error) {
      console.log(error.response?.data || error);
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleScan = () => {
    navigation.navigate('QrScan');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading QR code...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My QR Code</Text>
      {qrCode ? (
        <Image
          source={{ uri: qrCode }}
          style={styles.qrImage}
          resizeMode="contain"
        />
      ) : (
        <Text>No QR code found.</Text>
      )}
      <Button title="Scan a Code" onPress={handleScan} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { marginBottom: 20, fontSize: 18 },
  qrImage: { width: 200, height: 200, marginBottom: 20 },
});