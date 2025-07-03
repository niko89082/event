// screens/PaymentSettingsScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';

export default function PaymentSettingsScreen() {
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);

  // State
  const [paymentMethods, setPaymentMethods] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [updating, setUpdating] = useState(false);

  // Fetch payment data - FIXED to use correct endpoints
  const fetchPaymentData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // FIXED: Use the correct endpoint from your routes/profile.js
      const response = await api.get('/profile/payment-methods');
      console.log('Payment methods response:', response.data);
      
      setPaymentMethods(response.data.paymentMethods || {});

      // Set current PayPal email if exists
      if (response.data.paymentMethods?.paypal?.email) {
        setPaypalEmail(response.data.paymentMethods.paypal.email);
      }

    } catch (error) {
      console.error('Error fetching payment data:', error);
      Alert.alert('Error', 'Failed to load payment information');
      // Initialize empty state on error
      setPaymentMethods({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, []);

  // Validate email
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle PayPal setup/update - FIXED to use correct endpoints
  const handlePayPalUpdate = async () => {
    if (!validateEmail(paypalEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setUpdating(true);
      setEmailError('');

      const isNewSetup = !paymentMethods.paypal?.connected;
      
      // FIXED: Use the correct endpoints from your routes/profile.js
      const endpoint = isNewSetup ? '/profile/setup-paypal' : '/profile/paypal-email';
      const method = isNewSetup ? 'POST' : 'PUT';

      const response = await api.request({
        method,
        url: endpoint,
        data: { paypalEmail: paypalEmail.trim() }
      });

      if (response.data.success) {
        Alert.alert(
          'Success!', 
          isNewSetup ? 'PayPal account connected successfully!' : 'PayPal email updated successfully!',
          [{ text: 'OK', onPress: () => setShowPayPalModal(false) }]
        );
        fetchPaymentData(); // Refresh data
      }

    } catch (error) {
      console.error('PayPal update error:', error);
      const message = error.response?.data?.message || 'Failed to update PayPal account';
      Alert.alert('Error', message);
    } finally {
      setUpdating(false);
    }
  };

  // Handle PayPal removal - FIXED to use correct endpoint
  const handleRemovePayPal = () => {
    Alert.alert(
      'Remove PayPal Account',
      'Are you sure you want to remove your PayPal account? You won\'t be able to receive payments until you add a new payment method.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              // FIXED: Use the correct endpoint from your routes/profile.js
              await api.delete('/profile/paypal');
              Alert.alert('Success', 'PayPal account removed successfully');
              fetchPaymentData();
            } catch (error) {
              console.error('Remove PayPal error:', error);
              Alert.alert('Error', 'Failed to remove PayPal account');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  // Handle primary payment method change - FIXED to use correct endpoint
  const handleSetPrimary = async (provider) => {
    try {
      setUpdating(true);
      // FIXED: Use the correct endpoint from your routes/profile.js
      await api.put('/profile/primary-payment', { provider });
      Alert.alert('Success', `${provider === 'paypal' ? 'PayPal' : 'Stripe'} is now your primary payment method`);
      fetchPaymentData();
    } catch (error) {
      console.error('Set primary error:', error);
      Alert.alert('Error', 'Failed to update primary payment method');
    } finally {
      setUpdating(false);
    }
  };

  // Handle Stripe setup
  const handleStripeSetup = () => {
    Alert.alert(
      'Stripe Setup',
      'Stripe Connect integration is coming soon. This will allow you to accept credit cards directly.',
      [{ text: 'OK' }]
    );
  };

  // Render PayPal section
  const renderPayPalSection = () => {
    const { paypal } = paymentMethods;
    const isPrimary = paymentMethods.primary?.type === 'paypal';

    return (
      <View style={styles.paymentMethodCard}>
        <View style={styles.methodHeader}>
          <View style={styles.methodInfo}>
            <Ionicons name="logo-paypal" size={32} color="#0070BA" />
            <View style={styles.methodDetails}>
              <Text style={styles.methodName}>PayPal</Text>
              <Text style={styles.methodDescription}>
                {paypal?.connected ? paypal.email : 'Not connected'}
              </Text>
            </View>
          </View>
          
          <View style={styles.methodStatus}>
            {isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            )}
            <View style={[styles.statusDot, paypal?.connected ? styles.connectedDot : styles.disconnectedDot]} />
          </View>
        </View>

        <View style={styles.methodActions}>
          {paypal?.connected ? (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setPaypalEmail(paypal.email);
                  setShowPayPalModal(true);
                }}
              >
                <Ionicons name="create" size={16} color="#3797EF" />
                <Text style={styles.actionButtonText}>Edit Email</Text>
              </TouchableOpacity>

              {!isPrimary && paypal.connected && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleSetPrimary('paypal')}
                >
                  <Ionicons name="star" size={16} color="#FF9500" />
                  <Text style={styles.actionButtonText}>Set Primary</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={handleRemovePayPal}
              >
                <Ionicons name="trash" size={16} color="#FF3B30" />
                <Text style={[styles.actionButtonText, styles.removeButtonText]}>Remove</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => setShowPayPalModal(true)}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.connectButtonText}>Connect PayPal</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render Stripe section
  const renderStripeSection = () => {
    const { stripe } = paymentMethods;
    const isPrimary = paymentMethods.primary?.type === 'stripe';

    return (
      <View style={styles.paymentMethodCard}>
        <View style={styles.methodHeader}>
          <View style={styles.methodInfo}>
            <Ionicons name="card" size={32} color="#635BFF" />
            <View style={styles.methodDetails}>
              <Text style={styles.methodName}>Stripe Connect</Text>
              <Text style={styles.methodDescription}>
                {stripe?.connected ? 'Professional payment processing' : 'Coming soon'}
              </Text>
            </View>
          </View>
          
          <View style={styles.methodStatus}>
            {isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            )}
            <View style={[styles.statusDot, stripe?.connected ? styles.connectedDot : styles.disconnectedDot]} />
          </View>
        </View>

        <View style={styles.methodActions}>
          {stripe?.connected ? (
            <>
              {!isPrimary && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleSetPrimary('stripe')}
                >
                  <Ionicons name="star" size={16} color="#FF9500" />
                  <Text style={styles.actionButtonText}>Set Primary</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert(
                    'Stripe Dashboard',
                    'To manage your Stripe account, you\'ll be redirected to the Stripe dashboard.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Dashboard', onPress: () => Linking.openURL('https://dashboard.stripe.com') }
                    ]
                  );
                }}
              >
                <Ionicons name="open" size={16} color="#3797EF" />
                <Text style={styles.actionButtonText}>Dashboard</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.connectButton, styles.disabledButton]}
              onPress={handleStripeSetup}
            >
              <Ionicons name="time" size={16} color="#8E8E93" />
              <Text style={[styles.connectButtonText, styles.disabledButtonText]}>Coming Soon</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render earnings summary
  const renderEarningsSummary = () => {
    const earnings = paymentMethods.earnings;
    if (!earnings || earnings.total === 0) return null;

    return (
      <View style={styles.earningsCard}>
        <Text style={styles.sectionTitle}>Earnings Summary</Text>
        
        <View style={styles.earningsGrid}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>Total Earned</Text>
            <Text style={styles.earningsValue}>
              ${(earnings.total / 100).toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>Available</Text>
            <Text style={styles.earningsValue}>
              ${(earnings.available / 100).toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>Pending</Text>
            <Text style={styles.earningsValue}>
              ${(earnings.pending / 100).toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>Currency</Text>
            <Text style={styles.earningsValue}>{earnings.currency || 'USD'}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading payment settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPaymentData(true)}
            tintColor="#3797EF"
          />
        }
      >
        {/* Status Overview */}
        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Payment Status</Text>
          <View style={styles.statusRow}>
            <Ionicons 
              name={paymentMethods.primary?.canReceivePayments ? "checkmark-circle" : "alert-circle"} 
              size={24} 
              color={paymentMethods.primary?.canReceivePayments ? "#34C759" : "#FF9500"} 
            />
            <Text style={styles.statusText}>
              {paymentMethods.primary?.canReceivePayments 
                ? "Ready to receive payments" 
                : "Payment setup required"
              }
            </Text>
          </View>
          {paymentMethods.primary?.type && (
            <Text style={styles.primaryMethodText}>
              Primary method: {paymentMethods.primary.type === 'paypal' ? 'PayPal' : 'Stripe Connect'}
            </Text>
          )}
        </View>

        {/* Earnings Summary */}
        {renderEarningsSummary()}

        {/* Payment Methods */}
        <Text style={styles.sectionTitle}>Payment Methods</Text>
        
        {renderPayPalSection()}
        {renderStripeSection()}

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            Payment methods allow you to receive money from event attendees. You need at least one connected payment method to create paid events.
          </Text>
          
          <TouchableOpacity style={styles.helpButton}>
            <Ionicons name="help-circle" size={16} color="#3797EF" />
            <Text style={styles.helpButtonText}>View Payment FAQ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* PayPal Setup/Edit Modal */}
      <Modal
        visible={showPayPalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPayPalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {paymentMethods.paypal?.connected ? 'Update PayPal Email' : 'Connect PayPal Account'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowPayPalModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter your PayPal email address. Payments will be sent directly to this account.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>PayPal Email</Text>
              <TextInput
                style={[styles.emailInput, emailError && styles.inputError]}
                placeholder="your-email@example.com"
                value={paypalEmail}
                onChangeText={(text) => {
                  setPaypalEmail(text);
                  setEmailError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
              {emailError && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{emailError}</Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPayPalModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, (!paypalEmail.trim() || updating) && styles.buttonDisabled]}
                onPress={handlePayPalUpdate}
                disabled={!paypalEmail.trim() || updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {paymentMethods.paypal?.connected ? 'Update' : 'Connect'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    marginTop: 8,
  },

  // Status Card
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  primaryMethodText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 36,
  },

  // Earnings Card
  earningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  earningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  earningsItem: {
    width: '48%',
    marginBottom: 16,
  },
  earningsLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },

  // Payment Method Cards
  paymentMethodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodDetails: {
    marginLeft: 12,
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  methodStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBadge: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  primaryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectedDot: {
    backgroundColor: '#34C759',
  },
  disconnectedDot: {
    backgroundColor: '#8E8E93',
  },

  // Method Actions
  methodActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  removeButton: {
    backgroundColor: '#FFF5F5',
  },
  removeButtonText: {
    color: '#FF3B30',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  connectButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#F8F8F8',
  },
  disabledButtonText: {
    color: '#8E8E93',
  },

  // Help Card
  helpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 12,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 24,
  },

  // Input Styles
  inputContainer: {
    marginBottom: 24,
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

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});