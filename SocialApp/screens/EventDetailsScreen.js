// screens/EventDetailsScreen.js - FIXED: Better UI/UX with proper layout and photo moderation
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
  Animated,
  LayoutAnimation,
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
import useEventStore from '../stores/eventStore';
import { FEATURES } from '../config/features';

const PHOTO_FEATURES_ENABLED = false;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  // Enhanced state management
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

  // NEW: UI Enhancement states
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));

  // FIXED: Photo moderation states (MISSING BEFORE)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [moderatingPhotos, setModeratingPhotos] = useState(false);

  // Get current state from store or local fallback
  const attendeeCount = event?.attendeeCount || event?.attendees?.length || 0;
  const checkedInCount = event?.checkedInCount || event?.checkedIn?.length || 0;
  const isAttending = event?.isAttending || event?.attendees?.some(a => 
    String(a._id || a) === String(currentUser?._id)
  ) || false;

  const [forceUpdate, setForceUpdate] = useState(0);
  // ✅ Enhanced Glassmorphic Bottom Action Bar with photo permissions
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
                  <Ionicons name="scan" size={20} color="#000000" />
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
                  <Ionicons name="person-add" size={20} color="#000000" />
                  <Text style={styles.bottomBarButtonText}>Invite</Text>
                </View>
              </TouchableOpacity>

              {/* Add Photos - Only show if photos are allowed */}
              {canUploadPhotos() && (
                <TouchableOpacity
                  style={styles.bottomBarButton}
                  onPress={handleUploadPhoto}
                  activeOpacity={0.7}
                >
                  <View style={styles.bottomBarButtonInner}>
                    <Ionicons name="camera" size={20} color="#000000" />
                    <Text style={styles.bottomBarButtonText}>Add photos</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Edit */}
              <TouchableOpacity
                style={styles.bottomBarButton}
                onPress={() => navigation.navigate('EditEventScreen', { eventId })}
                activeOpacity={0.7}
              >
                <View style={styles.bottomBarButtonInner}>
                  <Ionicons name="create" size={20} color="#000000" />
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
              {/* Add Photos - Only show if attending AND photos are allowed */}
              {realTimeIsAttending && canUploadPhotos() && !isEventEnded() && (
                <TouchableOpacity
                  style={styles.bottomBarButton}
                  onPress={handleUploadPhoto}
                  activeOpacity={0.7}
                >
                  <View style={styles.bottomBarButtonInner}>
                    <Ionicons name="camera" size={20} color="#000000" />
                    <Text style={styles.bottomBarButtonText}>Add photos</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Main Action Button (Join/Going) */}
              <TouchableOpacity
                style={[
                  styles.bottomBarMainButton,
                  joinButtonInfo.disabled && styles.bottomBarMainButtonDisabled,
                  joinButtonInfo.showWent && styles.bottomBarWentButton,
                  isEventLive() && styles.bottomBarLiveButton
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
                      {joinButtonInfo.isPaid && <Ionicons name="card" size={18} color="#FFFFFF" />}
                      {joinButtonInfo.showWent && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                      {isEventLive() && <Ionicons name="radio" size={18} color="#FFFFFF" />}
                      <Text style={styles.bottomBarMainButtonText}>
                        {isEventLive() && realTimeIsAttending ? 'Live Now' : joinButtonInfo.text}
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
                    <Ionicons name="share" size={20} color="#000000" />
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

  // Enhanced animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
    const renderShareInviteModal = () => (
  <Modal
    visible={showShareInviteModal}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={() => setShowShareInviteModal(false)}
  >
    <SafeAreaView style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <TouchableOpacity
          onPress={() => setShowShareInviteModal(false)}
          style={styles.modalCloseButton}
        >
          <Text style={styles.modalCloseText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>
          {shareInviteMode === 'share' ? 'Share Event' : 'Invite Friends'}
        </Text>
        <View style={styles.modalHeaderSpacer} />
      </View>

      {shareInviteMode === 'share' ? (
        <View style={styles.shareOptionsContainer}>
          <TouchableOpacity
            style={styles.shareOption}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="share" size={24} color="#3797EF" />
            <Text style={styles.shareOptionText}>Share Link</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.shareOption}
            onPress={() => setShareInviteMode('invite')}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add" size={24} color="#3797EF" />
            <Text style={styles.shareOptionText}>Invite Friends</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inviteContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={getSearchPlaceholder()}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              // ✅ FIXED: Trigger search when text changes (was missing in your code)
              searchUsers(text);
            }}
            placeholderTextColor="#8E8E93"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {/* ✅ PHASE 2: Added privacy info section */}
          {event?.privacyLevel && (
            <View style={styles.privacyInfoSection}>
              <View style={styles.privacyInfo}>
                <Ionicons 
                  name={event.privacyLevel === 'private' ? 'lock-closed' : event.privacyLevel === 'friends' ? 'people' : 'globe'} 
                  size={16} 
                  color="#8E8E93" 
                />
                <Text style={styles.privacyText}>
                  {event.privacyLevel === 'friends' 
                    ? 'You can only invite friends to this event'
                    : event.privacyLevel === 'private'
                    ? 'Private event - only friends can be invited'
                    : 'Invite any of your friends to this event'
                  }
                </Text>
              </View>
            </View>
          )}

          {searching && (
            <View style={styles.searchingContainer}>
              <ActivityIndicator size="small" color="#3797EF" />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          )}

          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.userItem,
                  selectedUsers.some(u => u._id === item._id) && styles.userItemSelected
                ]}
                onPress={() => toggleUserSelection(item)}
                activeOpacity={0.7}
              >
                <Image
                  source={{
                    uri: item.profilePicture
                      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
                      : 'https://placehold.co/40x40.png?text=👤'
                  }}
                  style={styles.userAvatar}
                />
                <Text style={styles.userUsername}>
                  {item.displayName || item.username}
                </Text>
                {selectedUsers.some(u => u._id === item._id) && (
                  <Ionicons name="checkmark-circle" size={24} color="#3797EF" />
                )}
              </TouchableOpacity>
            )}
            style={styles.usersList}
          />

          {selectedUsers.length > 0 && (
            <TouchableOpacity
              style={styles.sendInvitesButton}
              onPress={handleSendInvites}
              disabled={inviting}
              activeOpacity={0.7}
            >
              {inviting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendInvitesButtonText}>
                  Send Invites ({selectedUsers.length})
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  </Modal>
);
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

  // NEW: Photo permission helpers
  const canUploadPhotos = () => {
    if (!event?.allowPhotos) return false;
    if (!isAttending && !isHost && !isCoHost) return false;
    return true;
  };

  const canViewPhotos = () => {
    if (!event?.allowPhotos) return false;
    return true; // If photos are allowed, they can be viewed by anyone who can see the event
  };

  const showPhotoSection = () => {
  if (!PHOTO_FEATURES_ENABLED) return false;
  return canViewPhotos() && eventPhotos.length > 0;
};

  // NEW: Event status helpers
  const getEventStatus = () => {
    const now = new Date();
    const eventTime = new Date(event?.time);
    const eventEndTime = new Date(eventTime.getTime() + (2 * 60 * 60 * 1000)); // Assume 2 hours duration
    
    if (now < eventTime) return 'upcoming';
    if (now >= eventTime && now < eventEndTime) return 'live';
    return 'ended';
  };

  const isEventLive = () => getEventStatus() === 'live';
  const isEventEnded = () => getEventStatus() === 'ended';

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

  // Enhanced fetch event photos with permission check
  const fetchEventPhotos = async () => {
  if (!PHOTO_FEATURES_ENABLED) {
    console.log('📸 Photo features disabled');
    return;
  }
  
  try {
    if (!canViewPhotos()) {
      console.log('📸 Photos not allowed for this event');
      setEventPhotos([]);
      return;
    }

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

  // Enhanced photo upload navigation with permission check
  const handleUploadPhoto = () => {
    if (!canUploadPhotos()) {
      if (!event?.allowPhotos) {
        Alert.alert('Photos Disabled', 'Photo sharing has been disabled for this event.');
      } else {
        Alert.alert('Not Attending', 'You must be attending this event to upload photos.');
      }
      return;
    }

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
      
      // Add smooth animation
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
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

  // ============================================
  // PHOTO MODERATION FUNCTIONS
  // ============================================

  // Helper function to check if current user can moderate
  const canModerate = () => {
    return isHost || isCoHost;
  };

  // Handle photo long press for hosts (auto-enter selection mode)
  const handlePhotoLongPress = (photo) => {
  if (!canModerate()) return;
  
  // Haptic feedback - Fixed import
  if (Platform.OS === 'ios') {
    try {
      const { impactAsync, ImpactFeedbackStyle } = require('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available:', error);
    }
  }

  // Enter selection mode automatically
  setSelectionMode(true);
  setSelectedPhotos([photo._id]);
  
  console.log('📸 Entered selection mode with photo:', photo._id);
};


  // Handle photo tap in selection mode
  const handlePhotoTap = (photo) => {
    if (!selectionMode) {
      // Normal tap - view photo
      navigation.navigate('PostDetailsScreen', { postId: photo._id });
      return;
    }

    // Selection mode - toggle selection
    setSelectedPhotos(prev => {
      const isSelected = prev.includes(photo._id);
      if (isSelected) {
        return prev.filter(id => id !== photo._id);
      } else {
        return [...prev, photo._id];
      }
    });
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPhotos([]);
    console.log('📸 Exited selection mode');
  };

  // Remove single photo
  const removeSinglePhoto = async (photoId) => {
  try {
    setModeratingPhotos(true);
    
    // FIXED: Use events router endpoint
    const response = await api.delete(`/api/events/moderate/${photoId}`, {
      data: { reason: 'Removed by host' }
    });

    if (response.data.success) {
      // Remove from local state
      setEventPhotos(prev => prev.filter(p => p._id !== photoId));
      
      Alert.alert(
        'Success',
        'Photo removed from event successfully',
        [{ text: 'OK' }]
      );
    }
    
  } catch (error) {
    console.error('❌ Error removing photo:', error);
    
    let errorMessage = 'Failed to remove photo. Please try again.';
    
    if (error.response?.status === 404) {
      errorMessage = 'Photo not found or moderation feature unavailable.';
    } else if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to remove this photo.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
  } finally {
    setModeratingPhotos(false);
  }
};

  // Remove selected photos (bulk)
  const removeSelectedPhotos = async () => {
  if (selectedPhotos.length === 0) return;

  Alert.alert(
    'Remove Photos',
    `Remove ${selectedPhotos.length} photo${selectedPhotos.length === 1 ? '' : 's'} from event?`,
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: async () => {
          try {
            setModeratingPhotos(true);
            
            // FIXED: Use events router endpoint
            const response = await api.post('/api/events/bulk-moderate', {
              photoIds: selectedPhotos,
              eventId: eventId,
              action: 'remove',
              reason: 'Bulk removed by host'
            });

            if (response.data.success) {
              // Remove from local state
              setEventPhotos(prev => 
                prev.filter(p => !selectedPhotos.includes(p._id))
              );
              
              // Exit selection mode
              exitSelectionMode();
              
              Alert.alert(
                'Success',
                `Successfully removed ${response.data.results.succeeded} photo${response.data.results.succeeded === 1 ? '' : 's'} from the event.`,
                [{ text: 'OK' }]
              );
            }
            
          } catch (error) {
            console.error('❌ Error bulk removing photos:', error);
            
            let errorMessage = 'Failed to remove photos. Please try again.';
            
            if (error.response?.status === 404) {
              errorMessage = 'Photo moderation feature is not available. Please contact support.';
            } else if (error.response?.status === 403) {
              errorMessage = 'You do not have permission to remove these photos.';
            } else if (error.response?.data?.message) {
              errorMessage = error.response.data.message;
            }
            
            Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
          } finally {
            setModeratingPhotos(false);
          }
        }
      }
    ]
  );
};


  // Auto-cleanup for user removal
  const handleUserPhotoCleanup = async (userId, reason = 'User removed from event') => {
  try {
    console.log(`🧹 Auto-cleaning photos for user: ${userId}, reason: ${reason}`);
    
    // FIXED: Use events router endpoint
    const response = await api.post(`/api/events/cleanup-user-photos/${eventId}`, {
      userId: userId,
      reason: reason
    });

    if (response.data.success && response.data.photosRemoved > 0) {
      // Refresh event photos to reflect changes
      await fetchEventPhotos();
      
      console.log(`✅ Auto-cleanup completed: ${response.data.photosRemoved} photos removed`);
    }
    
  } catch (error) {
    console.error('❌ Auto-cleanup error:', error);
    // Don't show error to user as this is background cleanup
  }
};

  // FIXED: Enhanced leave event function using centralized store WITH photo cleanup
  const handleLeaveEvent = async () => {
    try {
      // Check if user paid for this event
      const userPayment = event.paymentHistory?.find(p => 
        p.user === currentUser._id && p.status === 'succeeded'
      );

      let confirmMessage = 'Are you sure you want to leave this event?';
      
      // Add photo cleanup warning
      const userPhotosInEvent = eventPhotos.filter(p => 
        String(p.user._id || p.user) === String(currentUser._id)
      ).length;
      
      if (userPhotosInEvent > 0) {
        confirmMessage += `\n\nNote: Your ${userPhotosInEvent} photo${userPhotosInEvent === 1 ? '' : 's'} will be removed from the event.`;
      }
      
      if (userPayment) {
        confirmMessage += '\n\nYour payment will remain valid if you want to rejoin later.';
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
                
                // Add smooth animation
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                
                // First, leave the event
                const result = await toggleRSVP(eventId, currentUser._id, event);
                
                if (result.success && !result.attending) {
                  // Auto-cleanup user's photos
                  await handleUserPhotoCleanup(currentUser._id, 'User left event');
                  
                  // FIXED: Force UI update immediately
                  console.log('✅ Successfully left event, updating UI');
                  setForceUpdate(prev => prev + 1);
                  Alert.alert('Left Event', 'You have left the event and your photos have been removed.');
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
  const getInviteButtonText = () => {
  switch (event?.privacyLevel) {
    case 'private':
      return isHost || isCoHost ? 'Invite Friends' : 'Share Event';
    case 'friends':
      return 'Invite Friends';
    case 'public':
      return 'Invite & Share';
    default:
      return 'Invite';
  }
};
  const searchUsers = async (query) => {
  if (query.trim().length < 2) {
    setSearchResults([]);
    return;
  }

  try {
    setSearching(true);
    console.log(`🔍 PHASE 2: EventDetails searching friends for query: "${query}"`);
    
    // Use friends-only search endpoint
    const response = await api.get(`/api/users/friends/search`, {
      params: { 
        q: encodeURIComponent(query),
        eventId: eventId,
        limit: 20
      }
    });
    
    console.log(`✅ PHASE 2: EventDetails found ${response.data.length} friends`);
    setSearchResults(response.data);
    
  } catch (error) {
    console.error('Search error:', error);
    
    // Handle error appropriately based on event privacy level
    if (error.response?.status === 404) {
      // No friends found - this is normal, just show empty results
      setSearchResults([]);
    } else {
      console.warn('Failed to search friends:', error.response?.data?.message || error.message);
      setSearchResults([]);
    }
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
    console.log(`📨 PHASE 2: Sending invites to ${selectedUsers.length} friends`);
    
    await api.post(`/api/events/${eventId}/invite`, {
      userIds: selectedUsers.map(u => u._id)
    });

    // Success message with privacy context
    const getSuccessMessage = () => {
      if (event?.privacyLevel === 'friends') {
        return `Successfully invited ${selectedUsers.length} friend${selectedUsers.length === 1 ? '' : 's'} to the event. They will be notified and can join directly.`;
      } else if (event?.privacyLevel === 'private') {
        return `Successfully sent ${selectedUsers.length} private invitation${selectedUsers.length === 1 ? '' : 's'}. Invited users will receive exclusive access to the event.`;
      } else {
        return `Successfully invited ${selectedUsers.length} friend${selectedUsers.length === 1 ? '' : 's'} to the event.`;
      }
    };

    Alert.alert('Invites Sent!', getSuccessMessage());
    setShowShareInviteModal(false);
    setSelectedUsers([]);
    setSearchQuery('');
    setSearchResults([]);
    
  } catch (error) {
    console.error('Invite error:', error);
    
    // Handle specific error cases with user-friendly messages
    if (error.response?.status === 400 && error.response?.data?.message?.includes('friends')) {
      Alert.alert(
        'Friends Only Event',
        'You can only invite friends to this event. Some selected users may not be in your friends list.'
      );
    } else if (error.response?.status === 403) {
      const message = error.response?.data?.message;
      if (message?.includes('private')) {
        Alert.alert(
          'Permission Denied',
          'Only the event host can send invitations to private events.'
        );
      } else {
        Alert.alert(
          'Permission Denied',
          message || 'You do not have permission to invite users to this event.'
        );
      }
    } else {
      Alert.alert(
        'Error', 
        'Failed to send invites. Please check your connection and try again.'
      );
    }
  } finally {
    setInviting(false);
  }
};
const getSearchPlaceholder = () => {
  if (event?.privacyLevel === 'friends') {
    return 'Search your friends...';
  } else if (event?.privacyLevel === 'private') {
    return 'Search friends to invite...';
  } else {
    return 'Search your friends...';
  }
};
  // NEW: Enhanced share functionality
  const handleShare = async () => {
    try {
      const shareUrl = `https://yourapp.com/events/${eventId}`; // Replace with your actual deep link
      const shareContent = {
        message: `Check out this event: ${event.title}\n\n${event.description}\n\n${shareUrl}`,
        url: shareUrl,
        title: event.title
      };

      await Share.share(shareContent);
    } catch (error) {
      console.error('Share error:', error);
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

  // NEW: Enhanced privacy badge with better styling
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

  // NEW: Enhanced status badge
  const renderStatusBadge = () => {
    const status = getEventStatus();
    const statusConfig = {
      upcoming: { icon: 'time', color: '#3797EF', label: 'Upcoming' },
      live: { icon: 'radio', color: '#FF3B30', label: 'Live Now' },
      ended: { icon: 'checkmark-circle', color: '#8E8E93', label: 'Ended' }
    };

    const config = statusConfig[status];

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Ionicons name={config.icon} size={12} color="#FFFFFF" />
        <Text style={styles.statusBadgeText}>{config.label}</Text>
      </View>
    );
  };

  // FIXED: Get join button text and styling with real-time data
  const getJoinButtonInfo = () => {
    if (isEventEnded()) {
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

  // NEW: Enhanced description component with read more functionality
  const renderDescription = () => {
    if (!event.description) return null;

    const isLongDescription = event.description.length > 150;
    const displayText = showFullDescription || !isLongDescription 
      ? event.description 
      : event.description.substring(0, 150) + '...';

    return (
      <View style={styles.descriptionSection}>
        <Text style={styles.descriptionText}>{displayText}</Text>
        {isLongDescription && (
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowFullDescription(!showFullDescription);
            }}
            style={styles.readMoreButton}
            activeOpacity={0.7}
          >
            <Text style={styles.readMoreText}>
              {showFullDescription ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ENHANCED: Photo section with host moderation capabilities
  const renderPhotoSection = () => {
    if (!showPhotoSection() && !selectionMode) return null;

    return (
      <View style={styles.photosSection}>
        {/* Enhanced Header with Selection Mode Controls */}
        <View style={styles.photosSectionHeader}>
          <View style={styles.photosSectionTitleContainer}>
            <Text style={styles.photosSectionTitle}>
              Photos ({eventPhotos.length})
              {!event.allowPhotos && (
                <Text style={styles.photosDisabledText}> • Sharing disabled</Text>
              )}
            </Text>
            
            {/* Selection Mode Indicator */}
            {selectionMode && (
              <View style={styles.selectionModeIndicator}>
                <Text style={styles.selectionModeText}>
                  {selectedPhotos.length} selected
                </Text>
              </View>
            )}
          </View>

          <View style={styles.photosSectionActions}>
            {/* Selection Mode Controls */}
            {selectionMode ? (
              <View style={styles.selectionModeActions}>
                <TouchableOpacity
                  onPress={exitSelectionMode}
                  style={styles.selectionActionButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectionActionButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                {selectedPhotos.length > 0 && (
                  <TouchableOpacity
                    onPress={removeSelectedPhotos}
                    style={[styles.selectionActionButton, styles.removeButton]}
                    disabled={moderatingPhotos}
                    activeOpacity={0.7}
                  >
                    {moderatingPhotos ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.removeButtonText}>
                        Remove ({selectedPhotos.length})
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // Normal Mode Controls
              <>
                {eventPhotos.length > 6 && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('EventPhotosScreen', { eventId })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.seeAllPhotosText}>See All</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* Photos Loading State */}
        {photosLoading ? (
          <View style={styles.photosLoadingContainer}>
            <ActivityIndicator size="small" color="#3797EF" />
            <Text style={styles.photosLoadingText}>Loading photos...</Text>
          </View>
        ) : eventPhotos.length > 0 ? (
          /* Enhanced Photo Grid with Selection Support */
          <FlatList
            data={eventPhotos.slice(0, selectionMode ? eventPhotos.length : 6)}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.photoItem,
                  // Remove the featured photo aspect ratio issue
                  // Selection mode styling
                  selectedPhotos.includes(item._id) && styles.photoItemSelected
                ]}
                onPress={() => handlePhotoTap(item)}
                onLongPress={() => handlePhotoLongPress(item)}
                disabled={moderatingPhotos}
                activeOpacity={0.9}
              >
                {/* Photo Image */}
                <Image
                  source={{ uri: `http://${API_BASE_URL}:3000${item.paths[0]}` }}
                  style={styles.photoImage}
                  loadingIndicatorSource={{ uri: 'https://placehold.co/100x100.png' }}
                />

                {/* Selection Checkbox */}
                {selectionMode && (
                  <View style={styles.photoSelectionOverlay}>
                    <View style={[
                      styles.photoCheckbox,
                      selectedPhotos.includes(item._id) && styles.photoCheckboxSelected
                    ]}>
                      {selectedPhotos.includes(item._id) && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                )}

                {/* Photo overlay for better visual appeal */}
                {!selectionMode && (
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.3)']}
                    style={styles.photoOverlay}
                  />
                )}

                {/* REMOVED: Host indicator for moderation - per user request */}
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item._id}
            numColumns={3}
            style={styles.photosGrid}
            scrollEnabled={false}
          />
        ) : (
          /* Empty States */
          <>
            {/* Photo upload prompt for attendees */}
            {realTimeIsAttending && canUploadPhotos() && !isEventEnded() && (
              <TouchableOpacity
                style={styles.photoUploadPrompt}
                onPress={handleUploadPhoto}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={32} color="#3797EF" />
                <Text style={styles.photoUploadPromptTitle}>Be the first to share photos!</Text>
                <Text style={styles.photoUploadPromptSubtitle}>Tap to add photos from this event</Text>
              </TouchableOpacity>
            )}

            {/* Photo disabled message */}
            {!event.allowPhotos && (
              <View style={styles.photosDisabledContainer}>
                <Ionicons name="camera-off" size={32} color="#8E8E93" />
                <Text style={styles.photosDisabledTitle}>Photo sharing disabled</Text>
                <Text style={styles.photosDisabledSubtitle}>The host has disabled photo sharing for this event</Text>
              </View>
            )}
          </>
        )}

        {/* Selection Mode Instructions */}
        {selectionMode && eventPhotos.length > 0 && (
          <View style={styles.selectionModeInstructions}>
            <Text style={styles.selectionModeInstructionsText}>
              Tap photos to select • Selected photos will be removed from the event
            </Text>
          </View>
        )}
      </View>
    );
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
    // NEW: Enhanced share/invite modal
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* FIXED: Back button moved outside cover image */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
      </View>
      
      <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
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
          {/* Enhanced Cover Image Header - No overlays */}
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
          </View>

          {/* Enhanced Content with integrated badges */}
          <Animated.View 
            style={[
              styles.contentContainer,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Integrated Badges Row */}
            <View style={styles.integratedBadgeRow}>
              <View style={styles.leftBadges}>
                {renderPrivacyBadge()}
                {renderStatusBadge()}
              </View>
              {isPaidEvent() && (
                <View style={styles.priceBadge}>
                  <Ionicons name="card" size={14} color="#FFFFFF" style={styles.priceBadgeIcon} />
                  <Text style={styles.priceBadgeText}>{getFormattedPrice()}</Text>
                  {event.pricing.earlyBirdPricing?.enabled && 
                   new Date() < new Date(event.pricing.earlyBirdPricing.deadline) && (
                    <Text style={styles.earlyBirdText}>Early Bird!</Text>
                  )}
                </View>
              )}
            </View>

            {/* Title and Category */}
            <View style={styles.headerSection}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <View style={styles.categoryRow}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{event.category}</Text>
                </View>
                {event.tags && event.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {event.tags.slice(0, 3).map((tag, index) => (
                      <View key={index} style={styles.tagBadge}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Enhanced Description with Read More */}
            {renderDescription()}

            {/* Enhanced Host Information with Co-hosts */}
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
                      : 'https://placehold.co/48x48.png?text=👤'
                  }}
                  style={styles.hostAvatar}
                />
                <View style={styles.hostDetails}>
                  <Text style={styles.hostName}>Hosted by {event.host?.username}</Text>
                  {event.coHosts && event.coHosts.length > 0 && (
                    <View style={styles.coHostsContainer}>
                      <Text style={styles.coHostLabel}>Co-hosts: </Text>
                      <View style={styles.coHostAvatars}>
                        {event.coHosts.slice(0, 3).map((coHost, index) => (
                          <TouchableOpacity 
                            key={coHost._id || index}
                            onPress={() => navigation.navigate('ProfileScreen', { userId: coHost._id })}
                            style={[styles.coHostAvatar, { marginLeft: index > 0 ? -8 : 0 }]}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{
                                uri: coHost.profilePicture
                                  ? `http://${API_BASE_URL}:3000${coHost.profilePicture}`
                                  : 'https://placehold.co/24x24.png?text=👤'
                              }}
                              style={styles.coHostAvatarImage}
                            />
                          </TouchableOpacity>
                        ))}
                        {event.coHosts.length > 3 && (
                          <View style={[styles.coHostAvatar, styles.coHostOverflow, { marginLeft: -8 }]}>
                            <Text style={styles.coHostOverflowText}>+{event.coHosts.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Enhanced Event Details Cards */}
            <View style={styles.detailsContainer}>
              {/* Date & Time Card with countdown */}
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="calendar" size={24} color="#FF6B6B" />
                  <Text style={styles.detailCardTitle}>When</Text>
                  {isEventLive() && (
                    <View style={styles.liveIndicator}>
                      <Text style={styles.liveIndicatorText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.detailCardContent}>{formattedDate}</Text>
                <Text style={styles.detailCardSubContent}>{formattedTime}</Text>
              </View>

              {/* Location Card */}
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="location" size={24} color="#4ECDC4" />
                  <Text style={styles.detailCardTitle}>Where</Text>
                </View>
                <Text style={styles.detailCardContent}>{event.location}</Text>
              </View>

              {/* Enhanced Pricing Card for Paid Events */}
              {isPaidEvent() && (
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <Ionicons name="card" size={24} color="#FFB347" />
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
                  <Ionicons name="people" size={24} color="#9B59B6" />
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
                    <Ionicons name="document-text" size={24} color="#E67E22" />
                    <Text style={styles.detailCardTitle}>Check-in Requirements</Text>
                  </View>
                  <Text style={styles.detailCardContent}>Form required for check-in</Text>
                  <Text style={styles.detailCardSubContent}>
                    {event.checkInForm.title || 'Check-in form'}
                  </Text>
                </View>
              )}
            </View>

            {/* Enhanced Event Photos Section with permissions */}
            {renderPhotoSection()}
          </Animated.View>
        </ScrollView>

        {/* Enhanced Glassmorphic Bottom Action Bar */}
        {renderBottomActionBar()}

        {/* Enhanced Share/Invite Modal */}
        {renderShareInviteModal()}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // FIXED: Header container for back button
  headerContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  animatedContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80, // Reduced for smaller bottom bar
    paddingTop: 20
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
    textAlign: 'center',
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

  // Enhanced Cover Image - No overlays
  coverContainer: {
    height: 300,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  leftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  privacyBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priceBadgeIcon: {
    marginRight: 4,
  },
  priceBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  earlyBirdText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Enhanced Content
  contentContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32, // Pull up to overlap cover image
    paddingTop: 24, // Add top padding for badges
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  integratedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerSection: {
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    lineHeight: 34,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
  },

  // Enhanced Description
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
  },
  readMoreButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Enhanced Host Section with Co-hosts
  hostSection: {
    marginBottom: 24,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
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
    marginBottom: 4,
  },
  coHostsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  coHostLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  coHostAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coHostAvatar: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
  coHostAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 10,
  },
  coHostOverflow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E1E8ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coHostOverflowText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666666',
  },

  // Enhanced Detail Cards
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
  liveIndicator: {
    backgroundColor: '#FF3B30',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailCardContent: {
    fontSize: 16,
    color: '#000000',
    marginLeft: 36,
    fontWeight: '500',
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

  // Enhanced Photos Section
  photosSection: {
    marginBottom: 24,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 32, // Ensure consistent height
  },
  photosSectionTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photosSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  photosDisabledText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
  },
  photosSectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Selection mode styles
  selectionModeIndicator: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 12,
  },
  selectionModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectionModeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionActionButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectionActionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  seeAllPhotosText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  photosLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  photosLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
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
    position: 'relative',
  },
  photoItemSelected: {
    borderWidth: 3,
    borderColor: '#3797EF',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },

  // Selection overlay
  photoSelectionOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  photoCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCheckboxSelected: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },

  // Photo overlay
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
  },

  // Selection mode instructions
  selectionModeInstructions: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3797EF',
  },
  selectionModeInstructionsText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },

  photoUploadPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E1E8ED',
    borderStyle: 'dashed',
  },
  photoUploadPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
  },
  photoUploadPromptSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  photosDisabledContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
  },
  photosDisabledTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 8,
  },
  photosDisabledSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },

  // FIXED: Smaller Glassmorphic Bottom Bar Styles
  bottomBarContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    paddingBottom: 0,
  },
  bottomBar: {
    borderRadius: 20, // Reduced from 25
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
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 8,    // Reduced from 12
    gap: 6,               // Reduced from 8
  },
  bottomBarButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,   // Reduced from 8
  },
  bottomBarButtonInner: {
    alignItems: 'center',
    gap: 3,               // Reduced from 4
  },
  bottomBarButtonText: {
    fontSize: 10,         // Reduced from 11
    fontWeight: '500',
    color: '#000000',
  },
  bottomBarMainButton: {
    flex: 2,
    backgroundColor: '#3797EF',
    borderRadius: 10,     // Reduced from 12
    paddingVertical: 10,  // Reduced from 12
    paddingHorizontal: 14, // Reduced from 16
    marginHorizontal: 3,  // Reduced from 4
  },
  bottomBarMainButtonDisabled: {
    opacity: 0.6,
  },
  bottomBarWentButton: {
    backgroundColor: '#34C759',
  },
  bottomBarLiveButton: {
    backgroundColor: '#FF3B30',
  },
  bottomBarMainButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,               // Reduced from 6
  },
  bottomBarMainButtonText: {
    fontSize: 13,         // Reduced from 14
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Enhanced Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
    paddingTop: 50, // Account for status bar
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#3797EF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalHeaderSpacer: {
    width: 60,
  },

  // Share Options
  shareOptionsContainer: {
    padding: 20,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  shareOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 12,
  },

  // Invite Container
  inviteContainer: {
    flex: 1,
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  searchingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userUsername: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  sendInvitesButton: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  sendInvitesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  privacyInfoSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privacyText: {
    fontSize: 13,
    color: '#8E8E93',
    flex: 1,
  },
});