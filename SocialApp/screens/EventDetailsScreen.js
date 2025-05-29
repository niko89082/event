// screens/EventDetailsScreen.js - Enhanced with Privacy System Integration (COMPLETE)
import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, FlatList,
  ActivityIndicator, TouchableOpacity, Alert, Dimensions, 
  SafeAreaView, StatusBar, Modal, Animated, Share
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useStripe } from '@stripe/stripe-react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function EventDetailsScreen() {
  const { eventId } = useRoute().params ?? {};
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attending, setAttending] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [permissions, setPermissions] = useState({});
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      },
      headerTransparent: true,
      headerTitle: '',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.8}
        >
          <View style={styles.headerButtonBackground}>
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <TouchableOpacity
            onPress={handleShare}
            style={styles.headerButton}
            activeOpacity={0.8}
          >
            <View style={styles.headerButtonBackground}>
              <Ionicons name="share-outline" size={22} color="#000000" />
            </View>
          </TouchableOpacity>
          {event?.userRelation?.isHost && (
            <>
              <TouchableOpacity
                onPress={() => navigation.navigate('EventPrivacyManagerScreen', { eventId })}
                style={styles.headerButton}
                activeOpacity={0.8}
              >
                <View style={styles.headerButtonBackground}>
                  <Ionicons name="shield-outline" size={20} color="#000000" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditEventScreen', { eventId })}
                style={styles.headerButton}
                activeOpacity={0.8}
              >
                <View style={styles.headerButtonBackground}>
                  <Ionicons name="create-outline" size={20} color="#000000" />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      ),
    });
  }, [navigation, event]);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      checkPermissions();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/events/${eventId}`);
      setEvent(data);
      setAttending(data.userRelation?.isAttending || false);
      setJoinRequestSent(data.userRelation?.hasRequestedToJoin || false);
    } catch (e) {
      console.error('Event fetch error:', e);
      if (e.response?.status === 403) {
        Alert.alert('Access Denied', e.response.data.message, [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', 'Unable to load event');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const actions = ['view', 'join', 'invite', 'edit'];
      const permissionChecks = await Promise.all(
        actions.map(action => 
          api.get(`/api/events/${eventId}/permissions/${action}`)
            .then(res => ({ [action]: res.data.allowed }))
            .catch(() => ({ [action]: false }))
        )
      );
      
      const permissionsObj = permissionChecks.reduce((acc, perm) => ({ ...acc, ...perm }), {});
      setPermissions(permissionsObj);
    } catch (e) {
      console.error('Permission check error:', e);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    
    try {
      await Share.share({
        message: `Check out this event: ${event.title}\n\nWhen: ${new Date(event.time).toLocaleDateString()}\nWhere: ${event.location}`,
        title: event.title,
        url: `socialapp://event/${event._id}` // Deep link
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleJoinEvent = async () => {
    if (!event) return;

    try {
      // Check if approval is required
      if (event.permissions?.canJoin === 'approval-required') {
        setShowJoinModal(true);
        return;
      }

      if (event.price > 0) {
        await handlePayment();
      } else {
        await api.post(`/api/events/attend/${eventId}`, { paymentConfirmed: true });
        setAttending(true);
        fetchEvent(); // Refresh event data
      }
    } catch (e) {
      console.error('Join event error:', e);
      Alert.alert('Error', e.response?.data?.message || 'Unable to join event');
    }
  };

  const handlePayment = async () => {
    try {
      const { data } = await api.post(`/api/events/attend/${eventId}`);
      
      const paymentIntent = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
        merchantDisplayName: 'Social Events',
        returnURL: 'socialapp://stripe-redirect',
      });

      if (paymentIntent.error) {
        return Alert.alert('Payment Error', paymentIntent.error.message);
      }

      const payment = await presentPaymentSheet();
      if (payment.error) {
        return Alert.alert('Payment Error', payment.error.message);
      }

      await api.post(`/api/events/attend/${eventId}`, { paymentConfirmed: true });
      setAttending(true);
      fetchEvent();
      Alert.alert('Success', 'Payment completed and you\'re now attending!');
    } catch (e) {
      console.error('Payment error:', e);
      Alert.alert('Payment Error', 'Payment failed. Please try again.');
    }
  };

  const handleJoinRequest = async (message = '') => {
    try {
      await api.post(`/api/events/join-request/${eventId}`, { message });
      setJoinRequestSent(true);
      setShowJoinModal(false);
      Alert.alert('Request Sent', 'Your join request has been sent to the event host.');
    } catch (e) {
      console.error('Join request error:', e);
      Alert.alert('Error', e.response?.data?.message || 'Failed to send join request');
    }
  };

  const handleLeaveEvent = () => {
    Alert.alert(
      'Leave Event',
      'Are you sure you want to leave this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/events/attend/${eventId}`);
              setAttending(false);
              fetchEvent();
            } catch (e) {
              console.error('Leave event error:', e);
            }
          }
        }
      ]
    );
  };

  const renderPhoto = ({ item }) => (
    <TouchableOpacity
      style={styles.photoThumbnail}
      onPress={() => navigation.navigate('PostDetailsScreen', { postId: item._id })}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: `http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={styles.photoImage}
      />
    </TouchableOpacity>
  );

  const renderJoinRequestModal = () => (
    <Modal
      visible={showJoinModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowJoinModal(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Join Request</Text>
          <TouchableOpacity onPress={() => handleJoinRequest()}>
            <Text style={styles.modalSendText}>Send</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalContent}>
          <Text style={styles.modalDescription}>
            This event requires approval to join. Your request will be sent to the event host.
          </Text>
          
          <View style={styles.eventPreview}>
            <Text style={styles.eventPreviewTitle}>{event?.title}</Text>
            <Text style={styles.eventPreviewDate}>
              {new Date(event?.time).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderPrivacyBadge = () => {
    if (!event?.privacyLevel || event.privacyLevel === 'public') return null;

    const badges = {
      friends: { icon: 'people', text: 'Friends Only', color: '#34C759' },
      private: { icon: 'lock-closed', text: 'Private', color: '#FF9500' },
      secret: { icon: 'eye-off', text: 'Secret', color: '#FF3B30' }
    };

    const badge = badges[event.privacyLevel];
    if (!badge) return null;

    return (
      <View style={[styles.privacyBadge, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon} size={12} color="#FFFFFF" />
        <Text style={styles.privacyBadgeText}>{badge.text}</Text>
      </View>
    );
  };

  const renderActionButton = () => {
    if (!event) return null;

    const isHost = event.userRelation?.isHost;
    const isCoHost = event.userRelation?.isCoHost;
    const isPast = Date.now() > new Date(event.time).getTime();

    if (isPast) {
      return (
        <View style={styles.actionContainer}>
          <Text style={styles.pastEventText}>This event has ended</Text>
        </View>
      );
    }

    if (isHost || isCoHost) {
      return (
        <View style={styles.actionContainer}>
          <View style={styles.hostActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('QrScanScreen', { eventId })}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code" size={20} color="#3797EF" />
              <Text style={styles.secondaryButtonText}>Check-In</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('AttendeeListScreen', { eventId })}
              activeOpacity={0.8}
            >
              <Ionicons name="people" size={20} color="#3797EF" />
              <Text style={styles.secondaryButtonText}>Attendees</Text>
            </TouchableOpacity>

            {permissions.invite && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('InviteUsersScreen', { eventId })}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={20} color="#3797EF" />
                <Text style={styles.secondaryButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    if (attending) {
      return (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.attendingButton}
            onPress={handleLeaveEvent}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            <Text style={styles.attendingButtonText}>Going</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (joinRequestSent) {
      return (
        <View style={styles.actionContainer}>
          <View style={styles.requestSentButton}>
            <Ionicons name="time" size={24} color="#FF9500" />
            <Text style={styles.requestSentText}>Request Sent</Text>
          </View>
        </View>
      );
    }

    // Show join button if user can join
    if (permissions.join !== false) {
      const buttonText = event.price > 0 ? `Join - $${event.price}` : 'Join Event';
      
      return (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoinEvent}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
            <Text style={styles.joinButtonText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="calendar-outline" size={80} color="#C7C7CC" />
        <Text style={styles.errorTitle}>Event not found</Text>
        <Text style={styles.errorSubtitle}>
          This event may have been deleted or is no longer available.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const hero = event.coverImage
    ? (event.coverImage.startsWith('http')
        ? event.coverImage
        : `http://${API_BASE_URL}:3000${event.coverImage}`)
    : null;

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

  const attendeeCount = event.attendees?.length || 0;
  const spotsLeft = event.maxAttendees ? event.maxAttendees - attendeeCount : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.animatedHeaderTitle} numberOfLines={1}>{event.title}</Text>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          {hero ? (
            <Image source={{ uri: hero }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="calendar-outline" size={80} color="#C7C7CC" />
            </View>
          )}
          <View style={styles.heroOverlay} />
          {renderPrivacyBadge()}
        </View>

        {/* Main Content */}
        <View style={styles.contentContainer}>
          {/* Event Header */}
          <View style={styles.eventHeader}>
            <View style={styles.categoryContainer}>
              {event.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{event.category}</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.eventTitle}>{event.title}</Text>
            
            {/* Host Info */}
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
              <Text style={styles.hostName}>Hosted by {event.host?.username}</Text>
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

            {/* Attendees Card */}
            <TouchableOpacity 
              style={styles.detailCard}
              onPress={() => navigation.navigate('AttendeeListScreen', { eventId })}
              activeOpacity={0.8}
              disabled={!event.permissions?.showAttendeesToPublic && !event.userRelation?.isHost}
            >
              <View style={styles.detailCardHeader}>
                <Ionicons name="people" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Who's going</Text>
                {(event.permissions?.showAttendeesToPublic || event.userRelation?.isHost) && (
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                )}
              </View>
              <Text style={styles.detailCardContent}>
                {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} attending
              </Text>
              {spotsLeft !== null && spotsLeft > 0 && (
                <Text style={styles.detailCardSubContent}>
                  {spotsLeft} spots remaining
                </Text>
              )}
            </TouchableOpacity>

            {/* Price Card */}
            {event.price > 0 && (
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="card" size={24} color="#3797EF" />
                  <Text style={styles.detailCardTitle}>Price</Text>
                </View>
                <Text style={styles.detailCardContent}>${event.price.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionTitle}>About this event</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsWrapper}>
                {event.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Photos Section */}
          {event.photos && event.photos.length > 0 && (
            <View style={styles.photosContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Photos</Text>
                <Text style={styles.photoCount}>{event.photos.length}</Text>
              </View>
              <FlatList
                data={event.photos.slice(0, 6)}
                keyExtractor={p => p._id}
                renderItem={renderPhoto}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosList}
              />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Action Button */}
      {renderActionButton()}
      
      {/* Join Request Modal */}
      {renderJoinRequestModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  goBackButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  goBackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Header
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  animatedHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    margin: 16,
    zIndex: 1001,
  },
  headerRightContainer: {
    flexDirection: 'row',
  },
  headerButtonBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },

  // Hero Section
  heroContainer: {
    height: SCREEN_WIDTH * 0.75,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  privacyBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privacyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Content
  contentContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 32,
    paddingHorizontal: 20,
  },

  // Event Header
  eventHeader: {
    marginBottom: 32,
  },
  categoryContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: '#F0F8FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3797EF',
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 34,
    marginBottom: 16,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },

  // Detail Cards
  detailsContainer: {
    marginBottom: 32,
  },
  detailCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },
  detailCardContent: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    lineHeight: 22,
  },
  detailCardSubContent: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },

  // Description
  descriptionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },

  // Tags
  tagsContainer: {
    marginBottom: 32,
  },
  tagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -8,
  },
  tag: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginTop: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },

  // Photos
  photosContainer: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  photoCount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  photosList: {
    paddingLeft: 0,
  },
  photoThumbnail: {
    marginRight: 12,
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },

  // Action Container
  actionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  attendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9F0',
    borderWidth: 2,
    borderColor: '#34C759',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  attendingButtonText: {
    color: '#34C759',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  requestSentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F0',
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  requestSentText: {
    color: '#FF9500',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  pastEventText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Host Actions
  hostActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
  },
  secondaryButtonText: {
    color: '#3797EF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Modal Styles
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
    marginBottom: 24,
  },
  eventPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  eventPreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  eventPreviewDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
});