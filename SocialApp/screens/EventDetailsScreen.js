import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, FlatList,
  ActivityIndicator, TouchableOpacity, Alert, Dimensions, SafeAreaView, StatusBar,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useStripe } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventDetailsScreen() {
  const { eventId } = useRoute().params ?? {};
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

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
        <TouchableOpacity
          onPress={shareEvent}
          style={styles.headerButton}
          activeOpacity={0.8}
        >
          <View style={styles.headerButtonBackground}>
            <Ionicons name="share-outline" size={22} color="#000000" />
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/events/${eventId}`);
      setEvent(data);
    } catch (e) {
      console.error('Event fetch error:', e);
      Alert.alert('Error', e.response?.data?.message || 'Unable to load event');
    } finally {
      setLoading(false);
    }
  };

  const shareEvent = () => {
    if (!event) return;
    navigation.navigate('SelectChatScreen', {
      shareType: 'event',
      shareId: event._id
    });
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
        <Text style={styles.errorSubtitle}>This event may have been deleted or is no longer available.</Text>
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

  const past = Date.now() > new Date(event.time).getTime();
  const host = String(event.host?._id) === String(currentUser?._id);
  const attending = event.attendees?.some(u => String(u._id) === String(currentUser?._id));
  const attendeeCount = event.attendees?.length || 0;
  const spotsLeft = event.maxAttendees ? event.maxAttendees - attendeeCount : null;

  const attend = async () => {
    try {
      if (event.price <= 0) {
        await api.post(`/api/events/attend/${eventId}`, { paymentConfirmed: true });
        fetchEvent();
        return;
      }

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
      fetchEvent();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Unable to attend');
    }
  };

  const unattend = async () => {
    try {
      await api.delete(`/api/events/attend/${eventId}`);
      fetchEvent();
    } catch (e) {
      console.log(e.response?.data || e);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
              {!event.isPublic && (
                <View style={styles.privateBadge}>
                  <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                  <Text style={styles.privateText}>Private</Text>
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
            >
              <View style={styles.detailCardHeader}>
                <Ionicons name="people" size={24} color="#3797EF" />
                <Text style={styles.detailCardTitle}>Who's going</Text>
                <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
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
      </ScrollView>

      {/* Action Button */}
      {!past && (
        <View style={styles.actionContainer}>
          {host ? (
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
                onPress={() => navigation.navigate('EditEventScreen', { eventId })}
                activeOpacity={0.8}
              >
                <Ionicons name="create" size={20} color="#3797EF" />
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionButton,
                attending ? styles.attendingButton : styles.attendButton
              ]}
              onPress={attending ? unattend : attend}
              activeOpacity={0.8}
            >
              <Ionicons
                name={attending ? "checkmark-circle" : "add-circle"}
                size={24}
                color={attending ? "#34C759" : "#FFFFFF"}
              />
              <Text style={[
                styles.actionButtonText,
                attending ? styles.attendingButtonText : styles.attendButtonText
              ]}>
                {attending ? 'Going' : event.price > 0 ? `Attend - $${event.price}` : 'Attend'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
  scrollView: {
    flex: 1,
  },
  headerButton: {
    margin: 16,
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
    background: 'linear-gradient(transparent, rgba(0,0,0,0.1))',
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
    marginRight: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3797EF',
  },
  privateBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  privateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
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
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  photosList: {
    paddingRight: 20,
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

  // Action Button
  actionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
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
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 4,
  },
  secondaryButtonText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  attendButton: {
    backgroundColor: '#3797EF',
  },
  attendingButton: {
    backgroundColor: '#F0F9F0',
    borderWidth: 2,
    borderColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  attendButtonText: {
    color: '#FFFFFF',
  },
  attendingButtonText: {
    color: '#34C759',
  },
});