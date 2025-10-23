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
import ShareEventModal from '../components/ShareEventModal';
import { FEATURES } from '../config/features';

const PHOTO_FEATURES_ENABLED = false;

// Overlay configuration - toggle between options
const OVERLAY_CONFIG = {
  // Option 1: Dynamic content sliding over static image (default)
  // Content overlaps the bottom 40% of the cover image, creating a card-style layout
  // As user scrolls, content slides down revealing more of the image behind it
  DYNAMIC_CONTENT: false,
  
  // Option 2: Show entire image with no overlay
  // Content appears below the full cover image with no overlap
  // Shows the complete uploaded photo without any cropping
  NO_OVERLAY: false,
};

// TO TEST DIFFERENT OPTIONS:
// For Option 1 (Dynamic content sliding over image): Set DYNAMIC_CONTENT: true, NO_OVERLAY: false
// For Option 2 (Show entire image): Set DYNAMIC_CONTENT: false, NO_OVERLAY: true

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
  
  // NEW: Attendee profile photos state
  const [attendeePhotos, setAttendeePhotos] = useState([]);
  const [attendeePhotosLoading, setAttendeePhotosLoading] = useState(false);
  
  // Enhanced modal

  const [showShareModal, setShowShareModal] = useState(false);


  // NEW: UI Enhancement states
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));

  // FIXED: Photo moderation states (MISSING BEFORE)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [moderatingPhotos, setModeratingPhotos] = useState(false);

  // Enhanced image handling state
  const [coverImageDimensions, setCoverImageDimensions] = useState(null);
  const [coverImageLoading, setCoverImageLoading] = useState(false);

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
                onPress={handleShareInvite}
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
                  onPress={handleShareInvite}
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

  // Enhanced image handling - calculate optimal dimensions
  useEffect(() => {
    if (event?.coverImage && !coverImageDimensions) {
      setCoverImageLoading(true);
      const imageUrl = `http://${API_BASE_URL}:3000${event.coverImage}`;
      
      console.log('🖼️ DEBUG: Starting image dimension calculation for:', imageUrl);
      
      Image.getSize(
        imageUrl,
        (width, height) => {
          const aspectRatio = width / height;
          const screenWidth = SCREEN_WIDTH;
          
          console.log('🖼️ DEBUG: Original image dimensions:', { width, height, aspectRatio });
          console.log('🖼️ DEBUG: Screen width:', screenWidth);
          
          // Calculate height based on aspect ratio
          let calculatedHeight = screenWidth / aspectRatio;
          
          console.log('🖼️ DEBUG: Initial calculated height:', calculatedHeight);
          
          // Apply constraints - more flexible for different image types
          const MIN_HEIGHT = 200;  // Reduced minimum for better small image display
          const MAX_HEIGHT = 500;  // Reduced maximum to prevent excessive overlap
          
          if (calculatedHeight < MIN_HEIGHT) {
            console.log('🖼️ DEBUG: Height too small, applying MIN_HEIGHT:', MIN_HEIGHT);
            calculatedHeight = MIN_HEIGHT;
          } else if (calculatedHeight > MAX_HEIGHT) {
            console.log('🖼️ DEBUG: Height too large, applying MAX_HEIGHT:', MAX_HEIGHT);
            calculatedHeight = MAX_HEIGHT;
          }
          
          console.log('🖼️ DEBUG: Final calculated height:', calculatedHeight);
          
          setCoverImageDimensions({
            width: screenWidth,
            height: calculatedHeight,
            aspectRatio: aspectRatio
          });
          setCoverImageLoading(false);
        },
        (error) => {
          console.warn('🖼️ DEBUG: Failed to get image dimensions:', error);
          setCoverImageLoading(false);
          // Fallback to default height
          console.log('🖼️ DEBUG: Using fallback dimensions');
          setCoverImageDimensions({
            width: SCREEN_WIDTH,
            height: 300,
            aspectRatio: 1.5
          });
        }
      );
    }
  }, [event?.coverImage, coverImageDimensions]);

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
  <ShareEventModal
  visible={showShareModal}
  onClose={() => setShowShareModal(false)}
  event={event}
  currentUser={currentUser}
  onInviteSuccess={handleInviteSuccess}
/>
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

  // NEW: Instagram-style text generation for who's going
  const generateWhosGoingText = () => {
    if (!attendeePhotos.length) return null;
    
    // Get all friends attending (not just visible ones)
    const friendsAttending = attendeePhotos.filter(attendee => attendee.isFriend);
    const nonFriendsAttending = attendeePhotos.filter(attendee => !attendee.isFriend);
    
    // If no friends are attending, don't show text
    if (friendsAttending.length === 0) return null;
    
    // Get friend usernames
    const friendNames = friendsAttending.map(friend => friend.username || friend.displayName || 'Unknown');
    const remainingCount = realTimeAttendeeCount - attendeePhotos.length;
    const totalOthers = remainingCount + nonFriendsAttending.length;
    
    // Smart text generation
    let text = '';
    
    if (friendNames.length === 1 && totalOthers === 0) {
      // Just one friend, no others
      text = `${friendNames[0]} is going`;
    } else if (friendNames.length === 1 && totalOthers === 1) {
      // One friend and one other
      text = `${friendNames[0]} and 1 other friend are going`;
    } else if (friendNames.length === 1 && totalOthers > 1) {
      // One friend and multiple others
      text = `${friendNames[0]} and ${totalOthers} other friends are going`;
    } else if (friendNames.length === 2 && totalOthers === 0) {
      // Just two friends, no others
      text = `${friendNames[0]} and ${friendNames[1]} are going`;
    } else if (friendNames.length === 2 && totalOthers === 1) {
      // Two friends and one other
      text = `${friendNames[0]}, ${friendNames[1]} and 1 other friend are going`;
    } else if (friendNames.length === 2 && totalOthers > 1) {
      // Two friends and multiple others
      text = `${friendNames[0]}, ${friendNames[1]} and ${totalOthers} other friends are going`;
    } else {
      // More than 2 friends - truncate intelligently
      const totalOthersWithExtra = totalOthers + (friendNames.length - 2);
      text = `${friendNames[0]}, ${friendNames[1]} and ${totalOthersWithExtra} other friends are going`;
    }
    
    // If text is too long, truncate to 2 names max
    if (text.length > 60) {
      const totalOthersWithExtra = totalOthers + (friendNames.length - 1);
      if (totalOthersWithExtra === 0) {
        text = `${friendNames[0]} is going`;
      } else if (totalOthersWithExtra === 1) {
        text = `${friendNames[0]} and 1 other friend are going`;
      } else {
        text = `${friendNames[0]} and ${totalOthersWithExtra} other friends are going`;
      }
    }
    
    // If still too long, truncate to 1 name max
    if (text.length > 80) {
      const totalOthersWithExtra = totalOthers + (friendNames.length - 1);
      if (totalOthersWithExtra === 0) {
        text = `${friendNames[0]} is going`;
      } else if (totalOthersWithExtra === 1) {
        text = `${friendNames[0]} and 1 other friend are going`;
      } else {
        text = `${friendNames[0]} and ${totalOthersWithExtra} other friends are going`;
      }
    }
    
    return text;
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
    
    if (now < eventTime) return 'upcoming';
    
    // Use endTime if available
    const eventEndTime = event?.endTime 
      ? new Date(event.endTime)
      : new Date(eventTime.getTime() + (2 * 60 * 60 * 1000));
    
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

  // NEW: Fetch attendee profile photos with prioritization
  const fetchAttendeePhotos = async () => {
    try {
      setAttendeePhotosLoading(true);
      
      // Fetch attendees
      const attendeesResponse = await api.get(`/api/events/${eventId}/attendees`);
      const attendees = attendeesResponse.data.attendees || [];
      
      // Fetch current user's friends for prioritization
      const friendsResponse = await api.get('/api/friends/list?status=accepted');
      const friends = friendsResponse.data.friends || [];
      const friendIds = friends.map(f => f._id);
      
      // Prioritize attendees: friends first, then users with profile pictures
      const prioritizedAttendees = attendees
        .map(attendee => ({
          ...attendee,
          isFriend: friendIds.includes(attendee._id),
          hasProfilePicture: !!attendee.profilePicture
        }))
        .sort((a, b) => {
          // Friends first
          if (a.isFriend && !b.isFriend) return -1;
          if (!a.isFriend && b.isFriend) return 1;
          
          // Then users with profile pictures
          if (a.hasProfilePicture && !b.hasProfilePicture) return -1;
          if (!a.hasProfilePicture && b.hasProfilePicture) return 1;
          
          return 0;
        })
        .slice(0, 4); // Show only first 4 attendees
      
      console.log(`✅ Attendee photos fetched: ${prioritizedAttendees.length} attendees`);
      setAttendeePhotos(prioritizedAttendees);
      
    } catch (error) {
      console.error('❌ Error fetching attendee photos:', error);
      setAttendeePhotos([]);
    } finally {
      setAttendeePhotosLoading(false);
    }
  };

  // PHASE 4: Refresh on focus (instead of polling)
  useFocusEffect(
    React.useCallback(() => {
      fetchEvent();
      fetchEventPhotos();
      fetchAttendeePhotos();
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
  const handleShareInvite = () => {
  setShowShareModal(true);
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

const handleInviteSuccess = (result) => {
  // Refresh event data to show updated invite counts
  fetchEvent();
  console.log('✅ Invites sent successfully:', result);
};
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
                fetchAttendeePhotos();
              }}
              tintColor="#3797EF"
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* Enhanced Cover Image Header - Dynamic height */}
          <View style={[
            styles.coverContainer,
            coverImageDimensions && { height: coverImageDimensions.height }
          ]}>
            {event.coverImage ? (
              <Image
                source={{ uri: `http://${API_BASE_URL}:3000${event.coverImage}` }}
                style={styles.coverImage}
                resizeMode="cover"
                onLoad={() => {
                  console.log('🖼️ DEBUG: Cover image loaded successfully');
                }}
                onError={(error) => {
                  console.log('🖼️ DEBUG: Cover image failed to load:', error);
                }}
              />
            ) : (
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.coverImage}
              />
            )}
            
            {/* Loading overlay */}
            {coverImageLoading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
            
            {/* Debug overlay showing dimensions */}
            {__DEV__ && coverImageDimensions && (
              <View style={styles.debugOverlay}>
                <Text style={styles.debugText}>
                  H: {Math.round(coverImageDimensions.height)}px
                </Text>
                <Text style={styles.debugText}>
                  AR: {coverImageDimensions.aspectRatio.toFixed(2)}
                </Text>
                <Text style={styles.debugText}>
                  Overlay: {OVERLAY_CONFIG.NO_OVERLAY 
                    ? `Full image (${Math.round(coverImageDimensions.height - 10)}px)` 
                    : `-${Math.round(coverImageDimensions.height * 0.4 - 10)}px`
                  }
                </Text>
              </View>
            )}
          </View>

          {/* Enhanced Content with integrated badges */}
          <Animated.View 
            style={[
              styles.contentContainer,
              // Option 1: Dynamic content sliding over static image
              OVERLAY_CONFIG.DYNAMIC_CONTENT && !OVERLAY_CONFIG.NO_OVERLAY && {
                marginTop: coverImageDimensions 
                  ? -(coverImageDimensions.height * 0.4) + 10 // Move details section UP by 10px for better curvature overlay
                  : -110 // Move details section UP by 10px for better default experience
              },
              // Option 2: Show entire image with no overlay
              OVERLAY_CONFIG.NO_OVERLAY && {
                marginTop: coverImageDimensions 
                  ? coverImageDimensions.height - 10 // Move details section UP by 10px (cover image appears lower)
                  : 290 // Move details section UP by 10px (cover image appears lower)
              },
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Integrated Badges Row */}
            <View style={styles.integratedBadgeRow}>
              {/* Debug info for content positioning */}
              {__DEV__ && coverImageDimensions && (
                <View style={styles.contentDebugInfo}>
                  <Text style={styles.contentDebugText}>
                    Content overlay: {OVERLAY_CONFIG.NO_OVERLAY 
                      ? `Full image (${Math.round(coverImageDimensions.height - 10)}px)` 
                      : `-${Math.round(coverImageDimensions.height * 0.4 - 10)}px`
                    }
                  </Text>
                </View>
              )}
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

            {/* Enhanced Host Information - Equal Treatment */}
            <View style={styles.hostSection}>
              <View style={styles.hostInfo}>
                <Text style={styles.hostSectionTitle}>Hosted by</Text>
                <FlatList
                  data={[event.host, ...(event.coHosts || [])]}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => `${item._id || item}-${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.hostProfilePhoto}
                      onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{
                          uri: item.profilePicture
                            ? `http://${API_BASE_URL}:3000${item.profilePicture}`
                            : 'https://placehold.co/48x48.png?text=👤'
                        }}
                        style={styles.hostProfileImage}
                      />
                    </TouchableOpacity>
                  )}
                />
              </View>
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
                <Text style={styles.detailCardSubContent}>
                  {formattedTime}
                  {event.endTime && (
                    <> - {new Date(event.endTime).toLocaleTimeString([], { 
                      hour: 'numeric', 
                      minute: '2-digit', 
                      hour12: true 
                    })}</>
                  )}
                </Text>
                {event.endTime && (
                  <Text style={styles.endTimeText}>
                    Event ends at {new Date(event.endTime).toLocaleTimeString([], { 
                      hour: 'numeric', 
                      minute: '2-digit', 
                      hour12: true 
                    })}
                  </Text>
                )}
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

              {/* Enhanced Attendees Card with real-time data and profile photos */}
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
                {/* Attendee Profile Photos */}
                {attendeePhotos.length > 0 && (
                  <View style={styles.attendeePhotosContainer}>
                    <View style={styles.attendeePhotosRow}>
                      {attendeePhotos.map((attendee, index) => {
                        const isLastVisible = index === attendeePhotos.length - 1;
                        const remainingCount = realTimeAttendeeCount - attendeePhotos.length;
                        const showOverlay = isLastVisible && remainingCount > 0;
                        
                        return (
                          <TouchableOpacity
                            key={attendee._id}
                            style={styles.attendeePhotoContainer}
                            onPress={() => navigation.navigate('ProfileScreen', { userId: attendee._id })}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{
                                uri: attendee.profilePicture
                                  ? `http://${API_BASE_URL}:3000${attendee.profilePicture}`
                                  : 'https://placehold.co/48x48.png?text=👤'
                              }}
                              style={styles.attendeePhoto}
                            />
                            {showOverlay && (
                              <View style={styles.moreAttendeesOverlay}>
                                <Text style={styles.moreAttendeesOverlayText}>
                                  +{remainingCount}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                
                {/* Fallback text when no photos available */}
                {attendeePhotos.length === 0 && (
                  <Text style={styles.detailCardContent}>
                    {realTimeAttendeeCount} {realTimeAttendeeCount === 1 ? 'person' : 'people'} attending
                  </Text>
                )}
                
                {/* Instagram-style who's going text */}
                {generateWhosGoingText() && (
                  <Text style={styles.whosGoingText}>
                    {generateWhosGoingText()}
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

  // Enhanced Cover Image - Responsive sizing
  coverContainer: {
    height: 300, // Default height, will be overridden dynamically
    position: 'relative',
    width: '100%',
    overflow: 'hidden', // Ensure proper clipping
  },
  coverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0', // Light background while loading
    resizeMode: 'cover', // Ensure proper scaling
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  debugOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
    zIndex: 2,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
  contentDebugInfo: {
    position: 'absolute',
    top: -20,
    left: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  contentDebugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
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
    // marginTop removed - will be set inline with fixed position
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    minHeight: SCREEN_HEIGHT * 0.6, // Ensures content takes enough space
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
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
  },
  hostSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  hostProfilePhoto: {
    marginRight: 12,
  },
  hostProfileImage: {
    width: 48,
    height: 48,
    borderRadius: 24, // Circular
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    marginTop: 8,
  },
  endTimeText: {
    fontSize: 14,
    color: '#3797EF',
    marginLeft: 36,
    marginTop: 4,
    fontWeight: '600',
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

  // Attendee Profile Photos Styles
  attendeePhotosContainer: {
    marginTop: 8,
    marginLeft: 0,
    paddingHorizontal: 16,
  },
  attendeePhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  attendeePhotoContainer: {
    position: 'relative',
  },
  attendeePhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#F6F6F6',
  },
  friendIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  moreAttendeesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreAttendeesOverlayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  whosGoingText: {
    fontSize: 14,
    color: '#000000',
    marginTop: 8,
    marginLeft: 0,
    paddingHorizontal: 16,
    fontWeight: '500',
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