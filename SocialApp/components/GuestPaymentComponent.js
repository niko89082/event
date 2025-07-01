// SocialApp/components/GuestPaymentComponent.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const GuestPaymentComponent = ({ 
  guestPassToken, 
  amount, 
  currency, 
  eventTitle,
  hostName,
  onPaymentComplete,
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paymentError, setPaymentError] = useState(null);
  const [paymentInProgress, setPaymentInProgress] = useState(false);

  const formatAmount = (cents) => {
    return (cents / 100).toFixed(2);
  };

  const processPayPalPayment = async () => {
    try {
      setLoading(true);
      setPaymentError(null);
      setPaymentInProgress(true);
      
      console.log('🚀 Starting PayPal payment process...');

      // Step 1: Create PayPal payment order
      const createResponse = await api.post('/api/events/guest-payment/paypal/create', {
        guestPassToken
      });

      if (!createResponse.data.success) {
        throw new Error(createResponse.data.message || 'Failed to create payment');
      }

      const { orderId, approvalUrl } = createResponse.data;
      console.log('✅ PayPal order created:', orderId);

      // Step 2: Open PayPal approval URL
      const supported = await Linking.canOpenURL(approvalUrl);
      if (!supported) {
        throw new Error('Cannot open PayPal payment page');
      }

      await Linking.openURL(approvalUrl);

      // Step 3: Show payment completion dialog
      Alert.alert(
        '💳 Complete Your Payment',
        'Please complete your payment in the browser that just opened, then return here to confirm.',
        [
          {
            text: '✅ Payment Completed',
            onPress: () => capturePayment(orderId),
            style: 'default'
          },
          {
            text: '❌ Payment Failed/Cancelled',
            onPress: () => {
              setPaymentInProgress(false);
              setLoading(false);
            },
            style: 'cancel'
          }
        ],
        { cancelable: false }
      );

    } catch (error) {
      console.error('❌ PayPal payment error:', error);
      setPaymentError(error.message || 'Payment failed');
      setPaymentInProgress(false);
      
      Alert.alert(
        'Payment Failed',
        error.message || 'Unable to process payment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const capturePayment = async (orderId) => {
    try {
      setLoading(true);
      console.log('💰 Capturing payment for order:', orderId);

      const captureResponse = await api.post('/api/events/guest-payment/paypal/capture', {
        orderId,
        guestPassToken
      });

      if (captureResponse.data.success) {
        console.log('✅ Payment captured successfully');
        
        Alert.alert(
          '🎉 Payment Successful!',
          `Your payment of $${formatAmount(amount)} has been processed successfully. You're all set for the event!`,
          [
            {
              text: 'Great!',
              onPress: () => {
                if (onPaymentComplete) {
                  onPaymentComplete(captureResponse.data.guestPassId);
                }
              }
            }
          ]
        );
      } else {
        throw new Error(captureResponse.data.message || 'Payment capture failed');
      }

    } catch (error) {
      console.error('❌ Payment capture error:', error);
      setPaymentError(error.message || 'Payment verification failed');
      
      Alert.alert(
        'Payment Verification Failed',
        'We couldn\'t verify your payment. If you completed the payment, please contact the event host or try again.',
        [
          { text: 'Try Again', onPress: () => processPayPalPayment() },
          { text: 'Contact Host', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
      setPaymentInProgress(false);
    }
  };

  const PaymentMethodCard = ({ method, title, icon, description, recommended }) => (
    <TouchableOpacity
      style={[
        styles.paymentMethodCard,
        paymentMethod === method && styles.selectedMethodCard,
        recommended && styles.recommendedCard
      ]}
      onPress={() => {
        setPaymentMethod(method);
        setPaymentError(null);
      }}
    >
      <View style={styles.methodHeader}>
        <View style={styles.methodInfo}>
          <View style={styles.methodTitleRow}>
            <Ionicons name={icon} size={24} color={method === 'paypal' ? '#0070BA' : '#635BFF'} />
            <Text style={styles.methodTitle}>{title}</Text>
            {recommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            )}
          </View>
          <Text style={styles.methodDescription}>{description}</Text>
        </View>
        <View style={[styles.radioButton, paymentMethod === method && styles.radioSelected]}>
          {paymentMethod === method && <View style={styles.radioInner} />}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Complete Payment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Event Info Section */}
          <View style={styles.eventInfoCard}>
            <View style={styles.eventHeader}>
              <Ionicons name="calendar" size={24} color="#3797EF" />
              <View style={styles.eventDetails}>
                <Text style={styles.eventTitle} numberOfLines={2}>{eventTitle}</Text>
                <Text style={styles.hostName}>Hosted by {hostName}</Text>
              </View>
            </View>
            
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount Due</Text>
              <Text style={styles.amountValue}>${formatAmount(amount)} {currency}</Text>
            </View>
          </View>

          {/* Payment Methods */}
          <Text style={styles.sectionTitle}>Choose Payment Method</Text>

          <PaymentMethodCard
            method="paypal"
            title="PayPal"
            icon="logo-paypal"
            description="Pay with PayPal account or any credit/debit card"
            recommended={true}
          />

          {/* Payment Error Display */}
          {paymentError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#FF3B30" />
              <View style={styles.errorTextContainer}>
                <Text style={styles.errorTitle}>Payment Error</Text>
                <Text style={styles.errorText}>{paymentError}</Text>
              </View>
            </View>
          )}

          {/* Payment in Progress */}
          {paymentInProgress && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color="#0070BA" />
              <Text style={styles.progressText}>
                Complete your payment in the browser, then return here to confirm
              </Text>
            </View>
          )}

          {/* Payment Button */}
          <TouchableOpacity
            style={[
              styles.payButton,
              paymentMethod === 'paypal' && styles.paypalButton,
              (loading || paymentInProgress) && styles.buttonDisabled
            ]}
            onPress={processPayPalPayment}
            disabled={loading || paymentInProgress}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons 
                  name={paymentMethod === 'paypal' ? 'logo-paypal' : 'card'} 
                  size={24} 
                  color="#FFF" 
                />
                <Text style={styles.payButtonText}>
                  Pay ${formatAmount(amount)} with {paymentMethod === 'paypal' ? 'PayPal' : 'Stripe'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <View style={styles.securityItem}>
              <Ionicons name="shield-checkmark" size={16} color="#34C759" />
              <Text style={styles.securityText}>Your payment is secured by PayPal</Text>
            </View>
            <View style={styles.securityItem}>
              <Ionicons name="lock-closed" size={16} color="#34C759" />
              <Text style={styles.securityText}>256-bit SSL encryption</Text>
            </View>
            <View style={styles.securityItem}>
              <Ionicons name="card" size={16} color="#34C759" />
              <Text style={styles.securityText}>No card details stored</Text>
            </View>
          </View>

          {/* Help Text */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpText}>
              If you're having trouble with payment, contact the event host or reach out to our support team.
            </Text>
          </View>
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
  eventInfoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eventDetails: {
    flex: 1,
    marginLeft: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  hostName: {
    fontSize: 14,
    color: '#666',
  },
  amountSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  paymentMethodCard: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectedMethodCard: {
    borderColor: '#3797EF',
    backgroundColor: '#F0F8FF',
  },
  recommendedCard: {
    borderWidth: 2,
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  recommendedBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  recommendedText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  methodDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 32,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#3797EF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3797EF',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D32F2F',
    marginBottom: 2,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    lineHeight: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  payButton: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  paypalButton: {
    backgroundColor: '#0070BA',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  securityInfo: {
    backgroundColor: '#F0F8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 8,
  },
  helpSection: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default GuestPaymentComponent;