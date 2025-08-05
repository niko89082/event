// components/QuickPaymentSetupModal.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FEATURES } from '../config/features';
import api from '../services/api';

export default function QuickPaymentSetupModal({ 
  visible, 
  onClose, 
  onSuccess, 
  eventTitle = 'your event' 
}) {
  // Add this early return
  if (!FEATURES.PAYMENTS) {
    return null;
  }
  const [paypalEmail, setPaypalEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validate email
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle PayPal setup
  const handlePayPalSetup = async () => {
    if (!validateEmail(paypalEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.post('/api/events/setup-paypal', {
        paypalEmail: paypalEmail.trim()
      });

      if (response.data.success) {
        Alert.alert(
          'Payment Setup Complete!',
          'Your PayPal account has been connected successfully. You can now create paid events.',
          [
            {
              text: 'Continue',
              onPress: () => {
                onSuccess && onSuccess();
                onClose();
              }
            }
          ]
        );
      }

    } catch (error) {
      console.error('PayPal setup error:', error);
      const message = error.response?.data?.message || 'Failed to setup PayPal account';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPaypalEmail('');
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <LinearGradient
                  colors={['#FF6B35', '#FF8E53']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="card" size={24} color="#FFFFFF" />
                </LinearGradient>
              </View>
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>Payment Setup Required</Text>
              <Text style={styles.description}>
                To create paid events and collect payments for {eventTitle}, you need to connect a payment method first.
              </Text>

              {/* Quick PayPal Setup */}
              <View style={styles.setupSection}>
                <View style={styles.providerHeader}>
                  <Ionicons name="logo-paypal" size={32} color="#0070BA" />
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>Quick PayPal Setup</Text>
                    <Text style={styles.providerDescription}>
                      Connect in 30 seconds with just your email
                    </Text>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>PayPal Email Address</Text>
                  <TextInput
                    style={[styles.emailInput, error && styles.inputError]}
                    placeholder="your-email@example.com"
                    value={paypalEmail}
                    onChangeText={(text) => {
                      setPaypalEmail(text);
                      setError('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!loading}
                  />
                  
                  {error && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.setupButton,
                    (!paypalEmail.trim() || loading) && styles.buttonDisabled
                  ]}
                  onPress={handlePayPalSetup}
                  disabled={!paypalEmail.trim() || loading}
                >
                  <LinearGradient
                    colors={['#0070BA', '#005ea6']}
                    style={styles.buttonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="logo-paypal" size={20} color="#FFFFFF" />
                        <Text style={styles.buttonText}>Connect PayPal</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Benefits */}
                <View style={styles.benefits}>
                  <View style={styles.benefitItem}>
                    <Ionicons name="flash" size={16} color="#FF9500" />
                    <Text style={styles.benefitText}>Instant activation</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="shield-checkmark" size={16} color="#34C759" />
                    <Text style={styles.benefitText}>Secure payments</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="cash" size={16} color="#3797EF" />
                    <Text style={styles.benefitText}>Direct deposits</Text>
                  </View>
                </View>
              </View>

              {/* Alternative */}
              <View style={styles.alternative}>
                <Text style={styles.alternativeText}>
                  Need more advanced features?
                </Text>
                <TouchableOpacity style={styles.alternativeButton}>
                  <Text style={styles.alternativeButtonText}>Set up Stripe Connect instead</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 0,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: 4,
  },

  // Content
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Setup Section
  setupSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  providerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  providerDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Input
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#FF3B30',
  },

  // Button
  setupButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Benefits
  benefits: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#8E8E93',
  },

  // Alternative
  alternative: {
    alignItems: 'center',
  },
  alternativeText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  alternativeButton: {
    padding: 8,
  },
  alternativeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
});