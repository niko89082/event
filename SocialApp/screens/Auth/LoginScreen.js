// screens/Auth/LoginScreen.js
import React, { useContext, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import api from '../../services/api';
import { AuthContext } from '../../services/AuthContext';

export default function LoginScreen({ navigation }) {
  const { setTokenAndUser } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLoginPress = async () => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      setTokenAndUser(token, user);
    } catch (error) {
      console.log("WHERTERER");
      alert('Login failed => ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SOCIAL APP</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Log In" onPress={handleLoginPress} />
      <Button
        title="Go to Register"
        onPress={() => navigation.navigate('Register')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
});