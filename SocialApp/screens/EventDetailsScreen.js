// screens/EventDetailsScreen.js - FIXED: UI state updates when leaving event
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
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';
import useEventStore from '../stores/eventStore'; // Import centralized store

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { eventId } = route.params;

  // Centralized store integration
  const {
    getEvent,
    updateEvent,
    addEvent,
    toggleRSVP,
    confirmEventPayment,
    updateCheckInStatus
  } = useEventStore();

  // Get event from store, fallback to local state for initial load
  const storeEvent = getEvent(eventId);
  const [localEvent, setLocalEvent] = useState(null);
  const event = storeEvent || localEvent;

  // Set transparent header with back button only
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // State
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
  
  // Enhanced modals
  const [showShareInviteModal, setShowShareInviteModal] = useState(false);
  const [shareInviteMode, setShareInviteMode] = useState('share'); // 'share' or 'invite'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Get current state from store or local fallback
  const attendeeCount = event?.attendeeCount || event?.attendees?.length || 0;
  const checkedInCount = event?.checkedInCount || event?.checkedIn?.length || 0;
  const isAttending = event?.isAttending || event?.attendees?.some(a => 
    String(a._id || a) === String(currentUser?._id)
  ) || false;

  // FIXED: Watch for store changes and force re-render
  const [forceUpdate, setForceUpdate] = useState(0);
  
  useEffect(() => {
    // Subscribe to store changes for this specific event
    const unsubscribe = useEventStore.subscribe(
      (state) => state.events.get(eventId),
      (eventData) => {
        if (eventData) {
          console.log('🔄 EventDetailsScreen: Store event updated:', {
            eventId,
            isAttending: eventData.isAttending,
            attendeeCount: eventData.attendeeCount
          });
          // Force component re-render to update UI
          setForceUpdate(prev => prev + 1);
        }
      }
    );

    return unsubscribe;
  }, [eventId]);

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
            // Add user to event attendees using store
            await confirmEventPayment(eventId, {
              provider: 'paypal',
              paypalOrderId: payPalOrderId,
              paypalCaptureId: response.data.captureId
            });
            
            Alert.alert('Success!', 'Payment completed and you\'re now attending the event!');
            
            // Clear the stored order ID
            setPayPalOrderId(null);
            await AsyncStorage.removeItem(`paypal_order_${eventId}`);
            
            // Refresh event data
            await fetchEvent();
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

  // Enhanced fetch event with store integration
  const fetchEvent = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(`/api/events/${eventId}`);
      const eventData = response.data;
      
      // Update both local state and store
      setLocalEvent(eventData);
      addEvent(eventData, currentUser?._id);

      console.log('✅ Event data fetched and updated in store');

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
      console.log(`📸 Fetching photos for event ${eventId}`);
      
      const response = await api.get(`/api/users/event-photos/${eventId}`);
      console.log(`✅ Photos fetched:`, response.data.photos?.length || 0);
      setEventPhotos(response.data.photos || []);
      
    } catch (error) {
      console.error('❌ Error fetching event photos:', error);
      setEventPhotos([]);
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
      eventTitle: event?.title,
      isEventCheckin: true
    });
  };

  // Handle photo upload navigation
  const handleUploadPhoto = () => {
    navigation.navigate('CreatePostScreen', { 
      selectedEventId: eventId,
      preSelectedEvent: {
        _id: eventId,
        title: event?.title
      }
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

      // Payment successful - confirm attendance using store
      await confirmEventPayment(eventId, { provider: 'stripe' });

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

  // FIXED: Enhanced attend event function using centralized store
  const attendEvent = async () => {
    try {
      if (isPaidEvent() && !hasUserPaid()) {
        // Show payment options for paid events
        showPaymentOptions();
        return;
      }

      // For free events or if user already paid, use store's toggleRSVP
      setRequestLoading(true);
      const result = await toggleRSVP(eventId, currentUser._id, event);
      
      if (result.type === 'request') {
        Alert.alert('Request Sent', 'Your join request has been sent to the event host.');
      } else if (result.type === 'payment_required') {
        showPaymentOptions();
      } else if (result.success && result.attending) {
        // FIXED: Force UI update
        console.log('✅ Successfully joined event, updating UI');
        setForceUpdate(prev => prev + 1);
        Alert.alert('Success', 'You are now attending this event!');
      } else if (!result.success) {
        Alert.alert('Error', result.error);
      }
      
    } catch (error) {
      console.error('Attend event error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to join event');
    } finally {
      setRequestLoading(false);
    }
  };

  // FIXED: Enhanced leave event function using centralized store
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
                const result = await toggleRSVP(eventId, currentUser._id, event);
                
                if (result.success && !result.attending) {
                  // FIXED: Force UI update immediately
                  console.log('✅ Successfully left event, updating UI');
                  setForceUpdate(prev => prev + 1);
                  Alert.alert('Left Event', 'You have left the event.');
                } else if (!result.success) {
                  Alert.alert('Error', result.error);
                }
                
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

  // Enhanced Share & Invite functionality
  const handleShareInvite = (mode = 'share') => {
    setShareInviteMode(mode);
    setShowShareInviteModal(true);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUsers([]);
  };

  const searchUsers = async (query) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleSendInvites = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setInviting(true);
      await api.post(`/api/events/invite/${eventId}`, {
        userIds: selectedUsers.map(u => u._id)
      });

      Alert.alert(
        'Invites Sent!', 
        `Successfully invited ${selectedUsers.length} ${selectedUsers.length === 1 ? 'person' : 'people'} to the event.`
      );
      setShowShareInviteModal(false);
      setSelectedUsers([]);
    } catch (error) {
      console.error('Invite error:', error);
      Alert.alert('Error', 'Failed to send invites. Please try again.');
    } finally {
      setInviting(false);
    }
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
  const canInvite = event.canUserInvite?.(currentUser?._id) || isHost || isCoHost;
  const canShare = event.permissions?.canShare !== 'host-only' || isHost || isCoHost;
  const isPast = new Date(event.time) <= new Date();

  // FIXED: Get real-time attendance status from store
  const currentStoreEvent = getEvent(eventId);
  const realTimeIsAttending = currentStoreEvent?.isAttending ?? isAttending;
  const realTimeAttendeeCount = currentStoreEvent?.attendeeCount ?? attendeeCount;

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

  // FIXED: Get join button text and styling with real-time data
  const getJoinButtonInfo = () => {
    if (isPast) {
      return { text: 'Event Ended', disabled: true };
    }

    if (realTimeIsAttending) {
      return { text: 'Going', disabled: false, showWent: true };
    }

    if (event.permissions?.canJoin === 'approval-required') {
      return { text: 'Request to Join', disabled: false };
    }

    if (isPaidEvent() && !hasUserPaid()) {
      return { 
        text: `${getFormattedPrice()}`, 
        disabled: false, 
        isPaid: true 
      };
    }

    return { text: 'Join Event', disabled: false };
  };

  // ✅ Glassmorphic Bottom Action Bar with real-time data
  const renderBottomActionBar = () => {
    const joinButtonInfo = getJoinButtonInfo();

    if (isHost || isCoHost) {
      // Host/Co-host glassmorphic bottom bar
      return (
        <View style={styles.bottomBarContainer}>
          <BlurView 
            style={styles.bottomBar} 
            intensity={40}
            tint="light"
          >
            <View style={styles.bottomBarContent}>
              {/* Scan */}
              <TouchableOpacity
                style={styles.bottomBarButton}
                onPress={handleOpenScanner}
                activeOpacity={0.7}
              >
                <View style={styles.bottomBarButtonInner}>
                  <Ionicons name="scan" size={24} color="#000000" />
                  <Text style={styles.bottomBarButtonText}>Scan</Text>
                </View>
              </TouchableOpacity>

              {/* Invite */}
              <TouchableOpacity
                style={styles.bottomBarButton}
                onPress={() => handleShareInvite('invite')}
                activeOpacity={0.7}
              >
                <View style={styles.bottomBarButtonInner}>
                  <Ionicons name="person-add" size={24} color="#000000" />
                  <Text style={styles.bottomBarButtonText}>Invite</Text>
                </View>
              </TouchableOpacity>

              {/* Add Photos */}
              <TouchableOpacity
                style={styles.bottomBarButton}
                onPress={handleUploadPhoto}
                activeOpacity={0.7}
              >
                <View style={styles.bottomBarButtonInner}>
                  <Ionicons name="camera" size={24} color="#000000" />
                  <Text style={styles.bottomBarButtonText}>Add photos</Text>
                </View>
              </TouchableOpacity>

              {/* Edit */}
              <TouchableOpacity
                style={styles.bottomBarButton}
                onPress={() => navigation.navigate('EditEventScreen', { eventId })}
                activeOpacity={0.7}
              >
                <View style={styles.bottomBarButtonInner}>
                  <Ionicons name="create" size={24} color="#000000" />
                  <Text style={styles.bottomBarButtonText}>Edit</Text>
                </View>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      );
    } else {
      // Regular user glassmorphic bottom bar
      return (
        <View style={styles.bottomBarContainer}>
          <BlurView 
            style={styles.bottomBar} 
            intensity={40}
            tint="light"
          >
            <View style={styles.bottomBarContent}>
              {/* Add Photos (if attending) */}
              {realTimeIsAttending && !isPast && (
                <TouchableOpacity
                  style={styles.bottomBarButton}
                  onPress={handleUploadPhoto}
                  activeOpacity={0.7}
                >
                  <View style={styles.bottomBarButtonInner}>
                    <Ionicons name="camera" size={24} color="#000000" />
                    <Text style={styles.bottomBarButtonText}>Add photos</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Main Action Button (Join/Going) */}
              <TouchableOpacity
                style={[
                  styles.bottomBarMainButton,
                  joinButtonInfo.disabled && styles.bottomBarMainButtonDisabled,
                  joinButtonInfo.showWent && styles.bottomBarWentButton
                ]}
                onPress={joinButtonInfo.showWent ? handleLeaveEvent : attendEvent}
                disabled={joinButtonInfo.disabled || requestLoading}
                activeOpacity={0.7}
              >
                <View style={styles.bottomBarMainButtonInner}>
                  {requestLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      {joinButtonInfo.isPaid && <Ionicons name="card" size={20} color="#FFFFFF" />}
                      {joinButtonInfo.showWent && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                      <Text style={styles.bottomBarMainButtonText}>
                        {joinButtonInfo.text}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Share (if allowed) */}
              {canShare && (
                <TouchableOpacity
                  style={styles.bottomBarButton}
                  onPress={() => handleShareInvite('share')}
                  activeOpacity={0.7}
                >
                  <View style={styles.bottomBarButtonInner}>
                    <Ionicons name="share" size={24} color="#000000" />
                    <Text style={styles.bottomBarButtonText}>Share</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>
      );
    }
  };

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
        contentContainerStyle={styles.scrollContent}
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

            {/* Enhanced Attendees Card with real-time data */}
            <TouchableOpacity 
              style={styles.detailCard}
              onPress={() => navigation.navigate('AttendeeListScreen', { 
                eventId,
                mode: (isHost || isCoHost) ? 'manage' : 'view'
              })}
              activeOpacity={0.8}
              disabled={false}
            >
              <View style={styles.detailCardHeader}>
                <Ionicons name="people" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Who's going</Text>
                {(event.permissions?.showAttendeesToPublic || isHost || isCoHost) && (
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                )}
              </View>
              <Text style={styles.detailCardContent}>
                {realTimeAttendeeCount} {realTimeAttendeeCount === 1 ? 'person' : 'people'} attending
              </Text>
              {/* Show check-in status for hosts */}
              {(isHost || isCoHost) && checkedInCount > 0 && (
                <Text style={styles.detailCardSubContent}>
                  {checkedInCount} checked in ({Math.round((checkedInCount / realTimeAttendeeCount) * 100) || 0}%)
                </Text>
              )}
            </TouchableOpacity>

            {/* Form Requirement Info */}
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
                renderItem={({ item, index }) => (
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
                )}
                keyExtractor={(item) => item._id}
                numColumns={3}
                style={styles.photosGrid}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Glassmorphic Bottom Action Bar */}
      {renderBottomActionBar()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 100,
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
    borderRadius: 12,
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

  // Glassmorphic Bottom Bar Styles
  bottomBarContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    paddingBottom: 0,
  },
  bottomBar: {
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  bottomBarButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  bottomBarButtonInner: {
    alignItems: 'center',
    gap: 4,
  },
  bottomBarButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#000000',
  },
  bottomBarMainButton: {
    flex: 2,
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
  },
  bottomBarMainButtonDisabled: {
    opacity: 0.6,
  },
  bottomBarWentButton: {
    backgroundColor: '#34C759',
  },
  bottomBarMainButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottomBarMainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});