// screens/Auth/PhoneVerificationScreen.js
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { AuthContext } from '../../services/AuthContext';

export default function PhoneVerificationScreen({ route, navigation }) {
  const { userId, phoneNumber, fromSignup = false, fromLogin = false } = route.params;
  const { setTokenAndUser } = useContext(AuthContext);

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef([]);

  useEffect(() => {
    // Auto-focus first input
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (text, index) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits entered
    if (index === 5 && text && newCode.every(digit => digit !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (verificationCode = null) => {
    const codeToVerify = verificationCode || code.join('');

    if (codeToVerify.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter all 6 digits');
      return;
    }

    try {
      setLoading(true);
      console.log('📱 Verifying phone with code:', codeToVerify);

      let response;
      if (fromLogin) {
        // Login 2FA verification
        response = await api.post('/api/auth/verify-2fa', {
          userId,
          code: codeToVerify,
        });
      } else {
        // Signup phone verification
        response = await api.post('/api/auth/verify-phone', {
          userId,
          code: codeToVerify,
        });
      }

      console.log('✅ Verification successful');
      const { token, user } = response.data;

      if (token && user) {
        await setTokenAndUser(token, user);
        console.log('✅ User authenticated and logged in');
      }
    } catch (error) {
      console.error('❌ Verification failed:', error.response?.data || error.message);

      let errorMessage = 'Verification failed. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Verification Failed', errorMessage);
      
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setResending(true);
      console.log('📱 Resending verification code');

      await api.post('/api/auth/resend-phone-code', { userId });

      setCountdown(60); // Start 60 second countdown
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone.');
    } catch (error) {
      console.error('❌ Failed to resend code:', error.response?.data || error.message);

      let errorMessage = 'Failed to resend code. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setResending(false);
    }
  };

  const maskPhoneNumber = (phone) => {
    // Mask middle digits: +1 (234) ***-5678
    if (phone && phone.length >= 10) {
      const visibleDigits = phone.slice(-4);
      return `***-***-${visibleDigits}`;
    }
    return phone;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="phone-portrait-outline" size={64} color="#3797EF" />
            </View>
            <Text style={styles.title}>Verify Your Phone</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={styles.phoneNumber}>{maskPhoneNumber(phoneNumber)}</Text>
            </Text>
          </View>

          {/* Code Input */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  digit && styles.codeInputFilled,
                  loading && styles.codeInputDisabled,
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
            onPress={() => handleVerify()}
            disabled={loading || code.some(digit => !digit)}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.verifyButtonText}>Verify</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Resend Code */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            {countdown > 0 ? (
              <Text style={styles.countdownText}>Resend in {countdown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResendCode} disabled={resending}>
                {resending ? (
                  <ActivityIndicator size="small" color="#3797EF" />
                ) : (
                  <Text style={styles.resendButton}>Resend Code</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Help Text */}
          <View style={styles.helpContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#8E8E93" />
            <Text style={styles.helpText}>
              The verification code will expire in 10 minutes
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#3797EF',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000',
    backgroundColor: '#F8F9FA',
  },
  codeInputFilled: {
    borderColor: '#3797EF',
    backgroundColor: '#F0F8FF',
  },
  codeInputDisabled: {
    opacity: 0.6,
  },
  verifyButton: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  resendButton: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },
  countdownText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
});

