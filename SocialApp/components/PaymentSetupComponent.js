// components/PaymentSetupComponent.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const PaymentSetupComponent = ({ onPaymentSetupComplete, onClose }) => {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [setupInProgress, setSetupInProgress] = useState(false);

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/events/payment-status');
      setPaymentStatus(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startPaymentSetup = async () => {
    try {
      setSetupInProgress(true);
      setError(null);

      const response = await api.post('/api/events/setup-payments', {
        firstName: '', // You might want to collect this from user profile
        lastName: '',
        country: 'US'
      });

      if (response.data.success) {
        // Open Stripe onboarding in browser
        const supported = await Linking.canOpenURL(response.data.onboardingUrl);
        if (supported) {
          await Linking.openURL(response.data.onboardingUrl);
          
          // Show instructions to user
          Alert.alert(
            'Complete Setup',
            'Please complete the payment setup in your browser, then return to the app.',
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
      
    } catch (err) {
      setError(err.message);
    } finally {
      setSetupInProgress(false);
    }
  };

  const openStripeDashboard = async () => {
    try {
      const response = await api.get('/api/events/payment-dashboard');
      const supported = await Linking.canOpenURL(response.data.dashboardUrl);
      if (supported) {
        await Linking.openURL(response.data.dashboardUrl);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
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

  // Payment setup is complete
  if (paymentStatus?.canReceivePayments) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>Payment Setup Complete</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#34C759" />
              <Text style={styles.successTitle}>You're ready to receive payments!</Text>
              <Text style={styles.successDescription}>
                You can now create paid events and receive money directly from attendees.
              </Text>
            </View>

            <View style={styles.statusList}>
              <View style={styles.statusItem}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.statusText}>Account verified</Text>
              </View>
              <View style={styles.statusItem}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.statusText}>Charges enabled</Text>
              </View>
              {paymentStatus.payoutsEnabled && (
                <View style={styles.statusItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                  <Text style={styles.statusText}>Daily payouts enabled</Text>
                </View>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.dashboardButton}
                onPress={openStripeDashboard}
              >
                <Ionicons name="open-outline" size={20} color="#FFF" />
                <Text style={styles.dashboardButtonText}>View Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => {
                  if (onPaymentSetupComplete) onPaymentSetupComplete();
                  if (onClose) onClose();
                }}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // Payment setup needed
  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Payment Setup Required</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="card" size={64} color="#3797EF" />
          </View>

          <Text style={styles.description}>
            To create paid events and receive payments from attendees, you need to set up your payment account. 
            This secure process is handled by Stripe and takes just a few minutes.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={24} color="#3797EF" />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Secure Payment Processing</Text>
                <Text style={styles.featureDescription}>Powered by Stripe Connect for safe, reliable transactions</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="cash" size={24} color="#34C759" />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Keep 100% of Revenue</Text>
                <Text style={styles.featureDescription}>You receive all event revenue minus standard processing fees</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="time" size={24} color="#FF9500" />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Daily Payouts</Text>
                <Text style={styles.featureDescription}>Automatic transfers to your bank account every business day</Text>
              </View>
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.setupButton, setupInProgress && styles.setupButtonDisabled]}
              onPress={startPaymentSetup}
              disabled={setupInProgress}
            >
              {setupInProgress ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="card" size={20} color="#FFF" />
              )}
              <Text style={styles.setupButtonText}>
                {setupInProgress ? 'Setting up...' : 'Set Up Payments'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            By setting up payments, you agree to Stripe's terms of service. 
            Standard payment processing fees apply (2.9% + 30¢ per transaction).
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
    width: 32, // Same width as close button to center title
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
    textAlign: 'center',
    marginBottom: 32,
  },
  featureList: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureText: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  statusList: {
    marginBottom: 32,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#000',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  setupButtonDisabled: {
    opacity: 0.5,
  },
  setupButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  dashboardButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  continueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default PaymentSetupComponent;