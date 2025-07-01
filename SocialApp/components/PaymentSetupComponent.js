// SocialApp/components/PaymentSetupComponent.js - Enhanced with PayPal
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const PaymentSetupComponent = ({ onPaymentSetupComplete, onClose }) => {
  const [selectedProvider, setSelectedProvider] = useState('paypal');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [providers, setProviders] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeComponent();
  }, []);

  const initializeComponent = async () => {
    try {
      setCheckingStatus(true);
      await Promise.all([
        loadProviders(),
        checkPaymentStatus()
      ]);
    } catch (error) {
      console.error('Initialization error:', error);
      setError('Failed to load payment setup');
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await api.get('/api/events/payment-providers');
      if (response.data.success) {
        setProviders(response.data.providers);
        // Set PayPal as default if available
        const paypalProvider = response.data.providers.find(p => p.type === 'paypal');
        if (paypalProvider) {
          setSelectedProvider('paypal');
        }
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const checkPaymentStatus = async () => {
    try {
      const response = await api.get('/api/events/payment-status');
      if (response.data.success) {
        setPaymentStatus(response.data);
        
        // If user already has payment setup, show success screen
        if (response.data.canReceivePayments) {
          return;
        }
        
        // Pre-fill PayPal email if already connected but not verified
        if (response.data.providers?.paypal?.email) {
          setPaypalEmail(response.data.providers.paypal.email);
        }
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
    }
  };

  const setupPayPal = async () => {
    if (!paypalEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your PayPal email address');
      return;
    }

    if (!isValidEmail(paypalEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/events/setup-payments/paypal', {
        paypalEmail: paypalEmail.trim()
      });

      if (response.data.success) {
        Alert.alert(
          '🎉 Success!', 
          'PayPal account connected successfully! You can now accept payments from your event attendees.',
          [
            { 
              text: 'Great!', 
              onPress: () => {
                if (onPaymentSetupComplete) {
                  onPaymentSetupComplete();
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Setup failed. Please try again.';
      setError(errorMessage);
      Alert.alert('Setup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const setupStripe = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/events/setup-payments', {
        firstName: '', // You might want to get this from user profile
        lastName: '',
        country: 'US'
      });

      if (response.data.success) {
        const supported = await Linking.canOpenURL(response.data.onboardingUrl);
        if (supported) {
          await Linking.openURL(response.data.onboardingUrl);
          
          Alert.alert(
            'Complete Setup',
            'Please complete the Stripe setup in your browser, then return to the app.',
            [
              {
                text: 'I completed setup',
                onPress: async () => {
                  await checkPaymentStatus();
                  if (onPaymentSetupComplete) onPaymentSetupComplete();
                }
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          throw new Error('Cannot open browser for payment setup');
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Stripe setup failed. Please try again.';
      setError(errorMessage);
      Alert.alert('Setup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const PaymentProviderCard = ({ provider, isSelected, onSelect }) => (
    <TouchableOpacity
      style={[styles.providerCard, isSelected && styles.selectedCard]}
      onPress={() => onSelect(provider.type)}
    >
      <View style={styles.providerHeader}>
        <View style={styles.providerInfo}>
          <View style={styles.providerTitleRow}>
            <Text style={styles.providerName}>{provider.name}</Text>
            {provider.recommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            )}
          </View>
          <Text style={styles.setupTime}>⚡ {provider.setupTime} setup</Text>
        </View>
        <View style={[styles.radioButton, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </View>
      
      <Text style={styles.providerDescription}>{provider.description}</Text>
      
      <View style={styles.featuresList}>
        {provider.features?.slice(0, 2).map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={14} color="#34C759" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      
      <Text style={styles.fees}>Fees: {provider.fees}</Text>
    </TouchableOpacity>
  );

  // Loading state
  if (checkingStatus) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3797EF" />
            <Text style={styles.loadingText}>Checking payment status...</Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Success state - payment already set up
  if (paymentStatus?.canReceivePayments) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>Payment Setup</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#34C759" />
              <Text style={styles.successTitle}>You're ready to accept payments!</Text>
              <Text style={styles.successDescription}>
                Your {paymentStatus.primaryProvider === 'paypal' ? 'PayPal' : 'Stripe'} account is connected and ready to receive payments from event attendees.
              </Text>

              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <Ionicons name="business" size={20} color="#3797EF" />
                  <Text style={styles.statusLabel}>Primary Payment Method</Text>
                </View>
                <Text style={styles.statusValue}>
                  {paymentStatus.primaryProvider === 'paypal' ? 'PayPal' : 'Stripe Connect'}
                </Text>
                {paymentStatus.providers?.paypal?.email && (
                  <Text style={styles.statusSubtext}>
                    {paymentStatus.providers.paypal.email}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={onClose}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // Main setup flow
  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Setup Payments</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.introSection}>
            <Ionicons name="card" size={48} color="#3797EF" />
            <Text style={styles.introTitle}>Start accepting payments</Text>
            <Text style={styles.introDescription}>
              Connect a payment method to accept cover charges and ticket sales for your events
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Choose your payment method</Text>

          {providers.map((provider) => (
            <PaymentProviderCard
              key={provider.type}
              provider={provider}
              isSelected={selectedProvider === provider.type}
              onSelect={setSelectedProvider}
            />
          ))}

          {/* PayPal Setup Section */}
          {selectedProvider === 'paypal' && (
            <View style={styles.setupSection}>
              <View style={styles.setupHeader}>
                <Ionicons name="logo-paypal" size={32} color="#0070BA" />
                <Text style={styles.setupTitle}>Connect PayPal Account</Text>
              </View>
              
              <Text style={styles.setupDescription}>
                Enter your PayPal email address. Payments will be sent directly to your PayPal account.
              </Text>
              
              <TextInput
                style={styles.emailInput}
                placeholder="your-email@example.com"
                value={paypalEmail}
                onChangeText={(text) => {
                  setPaypalEmail(text);
                  setError(null); // Clear error when user types
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.setupButton, 
                  styles.paypalButton,
                  (!paypalEmail.trim() || loading) && styles.buttonDisabled
                ]}
                onPress={setupPayPal}
                disabled={!paypalEmail.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="logo-paypal" size={20} color="#FFF" />
                    <Text style={styles.buttonText}>Connect PayPal</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Ionicons name="flash" size={16} color="#FF9500" />
                  <Text style={styles.benefitText}>Instant setup - no verification needed</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="shield-checkmark" size={16} color="#34C759" />
                  <Text style={styles.benefitText}>Guests can pay with any card or PayPal</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="cash" size={16} color="#3797EF" />
                  <Text style={styles.benefitText}>Money goes directly to your PayPal</Text>
                </View>
              </View>
            </View>
          )}

          {/* Stripe Setup Section */}
          {selectedProvider === 'stripe' && (
            <View style={styles.setupSection}>
              <View style={styles.setupHeader}>
                <Ionicons name="card" size={32} color="#635BFF" />
                <Text style={styles.setupTitle}>Connect Stripe Account</Text>
              </View>
              
              <Text style={styles.setupDescription}>
                Professional payment processing with advanced features. Requires business verification.
              </Text>

              <TouchableOpacity
                style={[styles.setupButton, styles.stripeButton, loading && styles.buttonDisabled]}
                onPress={setupStripe}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="card" size={20} color="#FFF" />
                    <Text style={styles.buttonText}>Setup Stripe Connect</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Ionicons name="analytics" size={16} color="#635BFF" />
                  <Text style={styles.benefitText}>Advanced payment analytics</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="globe" size={16} color="#635BFF" />
                  <Text style={styles.benefitText}>International payment support</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="repeat" size={16} color="#635BFF" />
                  <Text style={styles.benefitText}>Subscription and recurring billing</Text>
                </View>
              </View>
            </View>
          )}

          <Text style={styles.disclaimer}>
            Standard payment processing fees apply. You'll receive 100% of ticket revenue minus payment processor fees.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  introSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  providerCard: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    backgroundColor: '#FFF',
  },
  selectedCard: {
    borderColor: '#3797EF',
    backgroundColor: '#F0F8FF',
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  providerInfo: {
    flex: 1,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginRight: 8,
  },
  recommendedBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  recommendedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  setupTime: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#3797EF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3797EF',
  },
  providerDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  featuresList: {
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  fees: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  setupSection: {
    marginTop: 24,
    padding: 24,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginLeft: 12,
  },
  setupDescription: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
  },
  paypalButton: {
    backgroundColor: '#0070BA',
  },
  stripeButton: {
    backgroundColor: '#635BFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  benefitsList: {
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  disclaimer: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 20,
    fontStyle: 'italic',
  },
  // Success state styles
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  statusCard: {
    backgroundColor: '#F8F9FA',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 32,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 14,
    color: '#666',
  },
  continueButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default PaymentSetupComponent;