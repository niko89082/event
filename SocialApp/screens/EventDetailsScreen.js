// screens/EventDetailsScreen.js - Phase 4: Clean Integration with QR Scanner
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Share,
  Linking,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { eventId } = route.params;

  // State
  const [event, setEvent] = useState(null);
  const [eventPhotos, setEventPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPayPalWebView, setShowPayPalWebView] = useState(false);
  const [payPalOrderId, setPayPalOrderId] = useState(null);
  const [payPalApprovalUrl, setPayPalApprovalUrl] = useState(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [permissions, setPermissions] = useState({});
  const [showShareModal, setShowShareModal] = useState(false);

  // PHASE 4: Check-in related state
  const [checkedInCount, setCheckedInCount] = useState(0);

  // Deep link handling for payment returns with AsyncStorage persistence
  useEffect(() => {
    const handlePaymentReturn = async (url) => {
      console.log('🔗 EventDetailsScreen received deep link:', url);
      
      if (url.includes('/payment/success') && payPalOrderId) {
        console.log('✅ Payment success via deep link, capturing payment...');
        
        try {
          setPaymentLoading(true);
          
          // Capture the PayPal payment
          const response = await api.post(`/api/events/capture-paypal-payment/${eventId}`, {
            orderId: payPalOrderId
          });
          
          if (response.data.success) {
            // Add user to event attendees
            await confirmAttendanceAfterPayment('paypal', payPalOrderId, response.data.captureId);
            Alert.alert('Success!', 'Payment completed and you\'re now attending the event!');
            
            // Clear the stored order ID
            setPayPalOrderId(null);
            await AsyncStorage.removeItem(`paypal_order_${eventId}`);
          }
        } catch (error) {
          console.error('Payment capture error:', error);
          Alert.alert('Error', 'Payment completed but there was an issue confirming your attendance. Please contact support.');
        } finally {
          setPaymentLoading(false);
        }
      } else if (url.includes('/payment/cancel')) {
        console.log('❌ Payment cancelled via deep link');
        Alert.alert('Payment Cancelled', 'Your payment was cancelled.');
        setPayPalOrderId(null);
        await AsyncStorage.removeItem(`paypal_order_${eventId}`);
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handlePaymentReturn(url);
    });

    // Check for stored PayPal order ID on component mount
    const checkStoredOrderId = async () => {
      try {
        const storedOrderId = await AsyncStorage.getItem(`paypal_order_${eventId}`);
        if (storedOrderId) {
          setPayPalOrderId(storedOrderId);
          console.log('🔍 Restored PayPal order ID:', storedOrderId);
        }
      } catch (error) {
        console.error('Error checking stored order ID:', error);
      }
    };

    checkStoredOrderId();

    return () => subscription?.remove();
  }, [payPalOrderId, eventId]);

  // Payment helper functions
  const isPaidEvent = () => {
    return event?.pricing && !event.pricing.isFree && event.pricing.amount > 0;
  };

  const getCurrentPrice = () => {
    if (!isPaidEvent()) return 0;
    
    // Check if early bird pricing is active
    if (event.pricing.earlyBirdPricing?.enabled && 
        event.pricing.earlyBirdPricing?.deadline && 
        new Date() < new Date(event.pricing.earlyBirdPricing.deadline)) {
      return event.pricing.earlyBirdPricing.amount;
    }
    
    return event.pricing.amount;
  };

  const getFormattedPrice = () => {
    if (!isPaidEvent()) return 'Free';
    
    const currentPrice = getCurrentPrice();
    const dollarAmount = (currentPrice / 100).toFixed(2);
    return `$${dollarAmount}`;
  };

  const hasUserPaid = () => {
    if (!event?.paymentHistory || !currentUser?._id) return false;
    
    return event.paymentHistory.some(payment => 
      payment.user && 
      String(payment.user) === String(currentUser._id) && 
      payment.status === 'succeeded'
    );
  };

  // Error handling helper
  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    
    let errorMessage = 'Payment failed. Please try again.';
    
    if (error.response?.data?.needsPaymentSetup) {
      errorMessage = 'The host needs to complete their payment setup. Please contact them.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    Alert.alert('Payment Error', errorMessage);
    setPaymentLoading(false);
  };

  // Fetch event details
  const fetchEvent = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(`/api/events/${eventId}`);
      const eventData = response.data;
      
      setEvent(eventData);
      setAttendeeCount(eventData.attendees?.length || 0);
      setPermissions(eventData.permissions || {});
      
      // PHASE 4: Set checked-in count
      setCheckedInCount(eventData.checkedIn?.length || 0);

      // Debug payment data in development
      if (__DEV__) {
        console.log('🔍 Event Payment Debug:', {
          eventId: eventData._id,
          isPaidEvent: eventData.pricing && !eventData.pricing.isFree,
          hostPaymentCapabilities: eventData.hostPaymentCapabilities,
          userPaymentStatus: eventData.userPaymentStatus
        });
      }

    } catch (error) {
      console.error('Error fetching event:', error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch event photos
  const fetchEventPhotos = async () => {
    try {
      setPhotosLoading(true);
      const response = await api.get(`/api/users/event-photos/${eventId}`);
      setEventPhotos(response.data.photos || []);
    } catch (error) {
      console.error('Error fetching event photos:', error);
      // Don't show error for photos, just fail silently
    } finally {
      setPhotosLoading(false);
    }
  };

  // PHASE 4: Refresh on focus (instead of polling)
  useFocusEffect(
    React.useCallback(() => {
      fetchEvent();
      fetchEventPhotos();
    }, [eventId])
  );

  // PHASE 4: QR Scanner navigation
  const handleOpenScanner = () => {
    navigation.navigate('QrScanScreen', { 
      eventId: eventId,
      eventTitle: event.title,
      isEventCheckin: true
    });
  };

  // Handle Stripe payment flow
  const handleStripePayment = async () => {
    try {
      setPaymentLoading(true);
      
      // Create payment intent
      const response = await api.post(`/api/events/create-stripe-payment-intent/${eventId}`, {
        amount: getCurrentPrice(),
        currency: event.pricing.currency || 'usd'
      });

      const { paymentIntent, ephemeralKey, customer, publishableKey } = response.data;

      // Initialize Stripe with payment intent
      const { error } = await initPaymentSheet({
        merchantDisplayName: 'Event Payment',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        defaultBillingDetails: {
          name: currentUser.username
        }
      });

      if (error) {
        Alert.alert('Payment Error', error.message);
        return;
      }

      // Present payment sheet
      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment Cancelled', paymentError.message);
        }
        return;
      }

      // Payment successful - confirm attendance
      await confirmAttendanceAfterPayment('stripe');

    } catch (error) {
      console.error('Stripe payment error:', error);
      handlePaymentError(error);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Enhanced PayPal payment flow with deep links and AsyncStorage
  const handlePayPalPayment = async () => {
    try {
      setPaymentLoading(true);
      
      console.log('🔍 Creating PayPal order...');
      
      // Create PayPal order
      const response = await api.post(`/api/events/create-paypal-order/${eventId}`, {
        amount: getCurrentPrice(),
        currency: event.pricing.currency || 'USD'
      });

      console.log('🔍 PayPal order response:', response.data);

      const { approvalUrl, orderId } = response.data;

      if (!approvalUrl || !orderId) {
        throw new Error('Invalid PayPal response - missing approval URL or order ID');
      }

      // Store order ID for later verification and in AsyncStorage for persistence
      setPayPalOrderId(orderId);
      await AsyncStorage.setItem(`paypal_order_${eventId}`, orderId);

      console.log('💾 Stored PayPal order ID:', orderId);

      // Open PayPal in external browser
      const supported = await Linking.canOpenURL(approvalUrl);
      if (supported) {
        console.log('🔍 Opening PayPal URL:', approvalUrl);
        await Linking.openURL(approvalUrl);
        
        // Show informational modal
        Alert.alert(
          'Payment in Progress',
          'Complete your payment in PayPal, then return to the app. Your payment will be processed automatically.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Cannot open PayPal payment page');
      }

    } catch (error) {
      console.error('PayPal payment error:', error);
      console.error('PayPal error details:', error.response?.data);
      handlePaymentError(error);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle PayPal WebView navigation (keeping for backward compatibility)
  const handlePayPalWebViewNavigation = async (navigationState) => {
    const { url } = navigationState;
    
    // Check if user completed payment
    if (url.includes('success') || url.includes('approved')) {
      setShowPayPalWebView(false);
      
      try {
        setPaymentLoading(true);
        // Capture the payment
        const response = await api.post(`/api/events/capture-paypal-payment/${eventId}`, {
          orderId: payPalOrderId
        });
        
        if (response.data.success) {
          await confirmAttendanceAfterPayment('paypal', payPalOrderId, response.data.captureId);
        } else {
          throw new Error('Payment capture failed');
        }
      } catch (error) {
        handlePaymentError(error);
      } finally {
        setPaymentLoading(false);
      }
    } else if (url.includes('cancel')) {
      setShowPayPalWebView(false);
      Alert.alert('Payment Cancelled', 'Payment was cancelled by user.');
    }
  };

  // Show payment options modal with proper validation
  const showPaymentOptions = () => {
    if (!event?.hostPaymentCapabilities) {
      Alert.alert('Error', 'Host payment information not available');
      return;
    }

    const { paymentMethods } = event.hostPaymentCapabilities;
    const hasStripe = paymentMethods?.stripe?.available;
    const hasPayPal = paymentMethods?.paypal?.available;

    console.log('🔍 Payment methods check:', {
      hasStripe,
      hasPayPal,
      hostPaymentCapabilities: event.hostPaymentCapabilities
    });

    if (!hasStripe && !hasPayPal) {
      Alert.alert('Error', 'Host has not set up payment methods yet. Please contact the host.');
      return;
    }

    const options = [];
    
    // Add Stripe option if available
    if (hasStripe) {
      options.push({
        text: '💳 Pay with Card (Stripe)',
        onPress: handleStripePayment
      });
    }
    
    // Add PayPal option if available
    if (hasPayPal) {
      options.push({
        text: '🅿️ Pay with PayPal',
        onPress: handlePayPalPayment
      });
    }

    options.push({
      text: 'Cancel',
      style: 'cancel'
    });

    Alert.alert(
      'Choose Payment Method',
      `Pay ${getFormattedPrice()} to join this event`,
      options
    );
  };

  // Confirm attendance after successful payment
  const confirmAttendanceAfterPayment = async (provider, orderId = null, captureId = null) => {
    try {
      const paymentData = {
        paymentConfirmed: true,
        provider
      };

      if (provider === 'paypal') {
        paymentData.paypalOrderId = orderId;
        paymentData.paypalCaptureId = captureId;
      }

      await api.post(`/api/events/attend/${eventId}`, paymentData);
      
      Alert.alert('Success', 'Payment successful! You are now attending this event!');
      fetchEvent(); // Refresh to show updated state
    } catch (error) {
      console.error('Attendance confirmation error:', error);
      Alert.alert('Error', 'Payment succeeded but failed to confirm attendance. Please contact support.');
    }
  };

  // Enhanced attend event function
  const attendEvent = async () => {
    try {
      if (isPaidEvent() && !hasUserPaid()) {
        // Show payment options for paid events
        showPaymentOptions();
        return;
      }

      // For free events or if user already paid
      setRequestLoading(true);
      const response = await api.post(`/api/events/attend/${eventId}`);
      
      if (response.data.alreadyPaid) {
        Alert.alert('Success', 'Welcome back! You are now attending this event.');
      } else {
        Alert.alert('Success', response.data.message);
      }
      
      fetchEvent(); // Refresh event data
    } catch (error) {
      console.error('Attend event error:', error);
      
      if (error.response?.status === 402) {
        // Payment required - should have been handled above
        showPaymentOptions();
      } else {
        Alert.alert('Error', error.response?.data?.message || 'Failed to join event');
      }
    } finally {
      setRequestLoading(false);
    }
  };

  // Handle join request (approval required events)
  const handleJoinRequest = async () => {
    if (!event) return;

    try {
      setRequestLoading(true);

      // Check if this is a paid event and user hasn't paid
      if (isPaidEvent() && !hasUserPaid()) {
        showPaymentOptions();
        return;
      }

      // Free event or user already paid
      if (event.permissions?.canJoin === 'approval-required') {
        setShowRequestModal(true);
      } else {
        await attendEvent();
      }
    } catch (error) {
      console.error('Join request error:', error);
      const message = error.response?.data?.message || 'Failed to join event';
      Alert.alert('Error', message);
    } finally {
      setRequestLoading(false);
    }
  };

  // Enhanced leave event function with refund protection
  const handleLeaveEvent = async () => {
    try {
      // Check if user paid for this event
      const userPayment = event.paymentHistory?.find(p => 
        p.user === currentUser._id && p.status === 'succeeded'
      );

      let confirmMessage = 'Are you sure you want to leave this event?';
      
      if (userPayment) {
        confirmMessage += '\n\nNote: Your payment will remain valid if you want to rejoin later.';
      }

      Alert.alert(
        'Leave Event',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Leave', 
            style: 'destructive',
            onPress: async () => {
              try {
                setRequestLoading(true);
                const response = await api.delete(`/api/events/attend/${eventId}`);
                
                Alert.alert('Left Event', response.data.message);
                fetchEvent(); // Refresh event data
                
              } catch (error) {
                console.error('Leave event error:', error);
                Alert.alert('Error', 'Failed to leave event');
              } finally {
                setRequestLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Leave event preparation error:', error);
      Alert.alert('Error', 'Unable to process request');
    }
  };

  // Share functionality
  const handleShare = () => {
    setShowShareModal(true);
  };

  const shareViaMessages = async () => {
    try {
      if (!event) return;
      
      const eventLink = `https://yourapp.com/events/${eventId}`;
      const priceText = isPaidEvent() ? `\n💰 ${getFormattedPrice()}` : '\n🆓 Free Event';
      const message = `Check out this event: ${event.title}\n\n${event.description}${priceText}\n\n📅 ${new Date(event.time).toLocaleDateString()}\n📍 ${event.location}\n\nJoin here: ${eventLink}`;
      
      // iOS-specific iMessage sharing
      const url = `sms:&body=${encodeURIComponent(message)}`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to generic share
        await Share.share({
          message: message,
          url: eventLink,
          title: event.title
        });
      }
      setShowShareModal(false);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share event');
    }
  };

  const shareViaGeneric = async () => {
    try {
      if (!event) return;
      
      const eventLink = `https://yourapp.com/events/${eventId}`;
      const priceText = isPaidEvent() ? ` (${getFormattedPrice()})` : ' (Free)';
      const message = `Check out this event: ${event.title}${priceText}\n\n${event.description}\n\n📅 ${new Date(event.time).toLocaleDateString()}\n📍 ${event.location}`;
      
      await Share.share({
        message: message,
        url: eventLink,
        title: event.title
      });
      setShowShareModal(false);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share event');
    }
  };

  const copyEventLink = async () => {
    try {
      const eventLink = `https://yourapp.com/events/${eventId}`;
      // Note: Clipboard API would need to be imported and used here
      Alert.alert(
        'Event Link',
        eventLink,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Copy Link', 
            onPress: () => {
              Alert.alert('Copied!', 'Event link copied to clipboard');
            }
          }
        ]
      );
      setShowShareModal(false);
    } catch (error) {
      console.error('Copy link error:', error);
    }
  };

  // Navigate to invite users screen
  const handleInviteUsers = () => {
    navigation.navigate('InviteUsersScreen', { 
      eventId,
      eventTitle: event?.title 
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Event not found</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchEvent()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isHost = String(event.host?._id || event.host) === String(currentUser?._id);
  const isCoHost = event.coHosts?.some(c => String(c._id || c) === String(currentUser?._id));
  const isAttending = event.attendees?.some(a => String(a._id || a) === String(currentUser?._id));
  const canInvite = event.canUserInvite?.(currentUser?._id) || isHost || isCoHost;
  const canShare = permissions.canShare !== 'host-only' || isHost || isCoHost;
  const isPast = new Date(event.time) <= new Date();

  // Format date and time
  const eventDate = new Date(event.time);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const renderPrivacyBadge = () => {
    const privacyConfig = {
      public: { icon: 'globe', color: '#34C759', label: 'Public' },
      friends: { icon: 'people', color: '#3797EF', label: 'Friends' },
      private: { icon: 'lock-closed', color: '#FF9500', label: 'Private' },
      secret: { icon: 'eye-off', color: '#FF3B30', label: 'Secret' }
    };

    const config = privacyConfig[event.privacyLevel] || privacyConfig.public;

    return (
      <View style={[styles.privacyBadge, { backgroundColor: config.color }]}>
        <Ionicons name={config.icon} size={12} color="#FFFFFF" />
        <Text style={styles.privacyBadgeText}>{config.label}</Text>
      </View>
    );
  };

  // Get join button text and styling
  const getJoinButtonInfo = () => {
    if (isPast) {
      return { text: 'Event Ended', disabled: true };
    }

    if (isAttending) {
      return { text: 'Leave Event', isLeave: true, disabled: false };
    }

    if (event.permissions?.canJoin === 'approval-required') {
      return { text: 'Request to Join', disabled: false };
    }

    if (isPaidEvent() && !hasUserPaid()) {
      return { 
        text: `${getFormattedPrice()} to Join`, 
        disabled: false, 
        isPaid: true 
      };
    }

    return { text: 'Join Event', disabled: false };
  };

  const renderActionButtons = () => {
    if (isHost || isCoHost) {
      return (
        <View style={styles.actionContainer}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryAction]}
              onPress={() => navigation.navigate('EditEventScreen', { eventId })}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3797EF', '#3797EF']}
                style={styles.gradientButton}
              >
                <Ionicons name="create" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Edit Event</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* PHASE 4: QR Scanner Button for Check-in */}
            {!isPast && (
              <TouchableOpacity
                style={[styles.actionButton, styles.scannerAction]}
                onPress={handleOpenScanner}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.gradientButton}
                >
                  <Ionicons name="scan" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Scan Check-ins</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {canInvite && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={handleInviteUsers}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={18} color="#3797EF" />
                <Text style={styles.secondaryActionText}>Invite</Text>
              </TouchableOpacity>
            )}

            {canShare && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share" size={18} color="#3797EF" />
                <Text style={styles.secondaryActionText}>Share</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    const joinButtonInfo = getJoinButtonInfo();

    return (
      <View style={styles.actionContainer}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton, 
              joinButtonInfo.isLeave ? styles.leaveAction : styles.primaryAction,
              joinButtonInfo.disabled && styles.disabledAction
            ]}
            onPress={joinButtonInfo.isLeave ? handleLeaveEvent : handleJoinRequest}
            disabled={joinButtonInfo.disabled || requestLoading || paymentLoading}
            activeOpacity={0.8}
          >
            {joinButtonInfo.isLeave ? (
              <Text style={styles.leaveActionText}>{joinButtonInfo.text}</Text>
            ) : (
              <LinearGradient
                colors={joinButtonInfo.isPaid ? ['#FF6B35', '#FF8E53'] : ['#3797EF', '#3797EF']}
                style={styles.gradientButton}
              >
                {(requestLoading || paymentLoading) ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    {joinButtonInfo.isPaid && (
                      <Ionicons name="card" size={18} color="#FFFFFF" />
                    )}
                    {!joinButtonInfo.isPaid && !joinButtonInfo.disabled && (
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    )}
                    <Text style={styles.primaryActionText}>{joinButtonInfo.text}</Text>
                  </>
                )}
              </LinearGradient>
            )}
          </TouchableOpacity>

          {canShare && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share" size={18} color="#3797EF" />
              <Text style={styles.secondaryActionText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderPhotoItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => navigation.navigate('PostDetailsScreen', { postId: item._id })}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: `http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={styles.photoImage}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              fetchEvent(true);
              fetchEventPhotos();
            }}
            tintColor="#3797EF"
          />
        }
      >
        {/* Cover Image Header */}
        <View style={styles.coverContainer}>
          {event.coverImage ? (
            <Image
              source={{ uri: `http://${API_BASE_URL}:3000${event.coverImage}` }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.coverImage}
            />
          )}
          
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Share Button */}
          {canShare && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Edit Button for Host (Top Right) */}
          {(isHost || isCoHost) && !isPast && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditEventScreen', { eventId })}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Privacy Badge */}
          {renderPrivacyBadge()}

          {/* Price Badge for Paid Events */}
          {isPaidEvent() && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{getFormattedPrice()}</Text>
              {event.pricing.earlyBirdPricing?.enabled && 
               new Date() < new Date(event.pricing.earlyBirdPricing.deadline) && (
                <Text style={styles.earlyBirdText}>Early Bird!</Text>
              )}
            </View>
          )}
        </View>

        {/* Event Information */}
        <View style={styles.contentContainer}>
          {/* Title and Category */}
          <View style={styles.headerSection}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          )}

          {/* Host Information */}
          <View style={styles.hostSection}>
            <TouchableOpacity
              style={styles.hostInfo}
              onPress={() => navigation.navigate('ProfileScreen', { userId: event.host?._id })}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri: event.host?.profilePicture
                    ? `http://${API_BASE_URL}:3000${event.host.profilePicture}`
                    : 'https://placehold.co/32x32.png?text=👤'
                }}
                style={styles.hostAvatar}
              />
              <View style={styles.hostDetails}>
                <Text style={styles.hostName}>Hosted by {event.host?.username}</Text>
                {event.coHosts && event.coHosts.length > 0 && (
                  <Text style={styles.coHostText}>
                    Co-hosts: {event.coHosts.map(c => c.username || c).join(', ')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Event Details Cards */}
          <View style={styles.detailsContainer}>
            {/* Date & Time Card */}
            <View style={styles.detailCard}>
              <View style={styles.detailCardHeader}>
                <Ionicons name="calendar" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>When</Text>
              </View>
              <Text style={styles.detailCardContent}>{formattedDate}</Text>
              <Text style={styles.detailCardSubContent}>{formattedTime}</Text>
            </View>

            {/* Location Card */}
            <View style={styles.detailCard}>
              <View style={styles.detailCardHeader}>
                <Ionicons name="location" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Where</Text>
              </View>
              <Text style={styles.detailCardContent}>{event.location}</Text>
            </View>

            {/* Pricing Card for Paid Events */}
            {isPaidEvent() && (
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="card" size={24} color="#FF6B35" />
                  <Text style={styles.detailCardTitle}>Pricing</Text>
                </View>
                <Text style={styles.detailCardContent}>{getFormattedPrice()}</Text>
                {event.pricing.earlyBirdPricing?.enabled && 
                 new Date() < new Date(event.pricing.earlyBirdPricing.deadline) && (
                  <Text style={styles.detailCardSubContent}>
                    Early bird until {new Date(event.pricing.earlyBirdPricing.deadline).toLocaleDateString()}
                  </Text>
                )}
                {event.pricing.description && (
                  <Text style={styles.detailCardSubContent}>{event.pricing.description}</Text>
                )}
                {hasUserPaid() && (
                  <View style={styles.paidStatus}>
                    <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                    <Text style={styles.paidStatusText}>Payment Confirmed</Text>
                  </View>
                )}
              </View>
            )}

            {/* PHASE 4: Enhanced Attendees Card with Check-in Info */}
            <TouchableOpacity 
              style={styles.detailCard}
              onPress={() => navigation.navigate('AttendeeListScreen', { 
                eventId,
                mode: (isHost || isCoHost) ? 'manage' : 'view'
              })}
              activeOpacity={0.8}
              disabled={!event.permissions?.showAttendeesToPublic && !isHost && !isCoHost}
            >
              <View style={styles.detailCardHeader}>
                <Ionicons name="people" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Who's going</Text>
                {(event.permissions?.showAttendeesToPublic || isHost || isCoHost) && (
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                )}
              </View>
              <Text style={styles.detailCardContent}>
                {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} attending
              </Text>
              {/* PHASE 4: Show check-in status for hosts */}
              {(isHost || isCoHost) && checkedInCount > 0 && (
                <Text style={styles.detailCardSubContent}>
                  {checkedInCount} checked in ({Math.round((checkedInCount / attendeeCount) * 100) || 0}%)
                </Text>
              )}
            </TouchableOpacity>

            {/* PHASE 4: Form Requirement Info */}
            {event.requiresFormForCheckIn && event.checkInForm && (
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="document-text" size={24} color="#FF9500" />
                  <Text style={styles.detailCardTitle}>Check-in Requirements</Text>
                </View>
                <Text style={styles.detailCardContent}>Form required for check-in</Text>
                <Text style={styles.detailCardSubContent}>
                  {event.checkInForm.title || 'Check-in form'}
                </Text>
              </View>
            )}
          </View>

          {/* Event Photos Section */}
          {eventPhotos.length > 0 && (
            <View style={styles.photosSection}>
              <View style={styles.photosSectionHeader}>
                <Text style={styles.photosSectionTitle}>Photos ({eventPhotos.length})</Text>
                {eventPhotos.length > 6 && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('EventPhotosScreen', { eventId })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.seeAllPhotosText}>See All</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <FlatList
                data={eventPhotos.slice(0, 6)}
                renderItem={renderPhotoItem}
                keyExtractor={(item) => item._id}
                numColumns={3}
                style={styles.photosGrid}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Action Buttons */}
          {renderActionButtons()}
        </View>
      </ScrollView>

      {/* PayPal WebView Modal */}
      <Modal
        visible={showPayPalWebView}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowPayPalWebView(false)}
      >
        <SafeAreaView style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              style={styles.webViewCloseButton}
              onPress={() => setShowPayPalWebView(false)}
            >
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>PayPal Payment</Text>
            <View style={{ width: 24 }} />
          </View>
          
          {payPalApprovalUrl && (
            <WebView
              source={{ uri: payPalApprovalUrl }}
              onNavigationStateChange={handlePayPalWebViewNavigation}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color="#3797EF" />
                  <Text style={styles.webViewLoadingText}>Loading PayPal...</Text>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shareModal}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Share Event</Text>
              <TouchableOpacity
                onPress={() => setShowShareModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.shareOptions}>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={shareViaMessages}
                activeOpacity={0.8}
              >
                <View style={styles.shareOptionIcon}>
                  <Ionicons name="chatbubble" size={24} color="#34C759" />
                </View>
                <Text style={styles.shareOptionText}>Messages</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={shareViaGeneric}
                activeOpacity={0.8}
              >
                <View style={styles.shareOptionIcon}>
                  <Ionicons name="share" size={24} color="#3797EF" />
                </View>
                <Text style={styles.shareOptionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={copyEventLink}
                activeOpacity={0.8}
              >
                <View style={styles.shareOptionIcon}>
                  <Ionicons name="link" size={24} color="#FF9500" />
                </View>
                <Text style={styles.shareOptionText}>Copy Link</Text>
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
    backgroundColor: '#FFFFFF',
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
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Cover Image
  coverContainer: {
    height: 280,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 44,
    right: 60,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privacyBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  priceBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  earlyBirdText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },

  // Content
  contentContainer: {
    padding: 20,
  },
  headerSection: {
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },

  // Description
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
  },

  // Host Section
  hostSection: {
    marginBottom: 24,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  hostDetails: {
    flex: 1,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  coHostText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Detail Cards
  detailsContainer: {
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailCardTitle: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  detailCardContent: {
    fontSize: 16,
    color: '#000000',
    marginLeft: 36,
  },
  detailCardSubContent: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 36,
    marginTop: 2,
  },
  paidStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 36,
  },
  paidStatusText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Photos Section
  photosSection: {
    marginBottom: 24,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photosSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  seeAllPhotosText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  photosGrid: {
    marginHorizontal: -4,
  },
  photoItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },

  // Action Buttons
  actionContainer: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  primaryAction: {
    flex: 2,
  },
  scannerAction: {
    flex: 2,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryAction: {
    backgroundColor: '#F8F8F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  secondaryActionText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  leaveAction: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flex: 2,
  },
  leaveActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledAction: {
    opacity: 0.6,
  },

  // WebView Modal
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  webViewCloseButton: {
    padding: 8,
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  webViewLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  // Share Modal
  shareModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  shareOption: {
    alignItems: 'center',
    minWidth: 80,
  },
  shareOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shareOptionText: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
  },
});