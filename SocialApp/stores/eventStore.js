// stores/eventStore.js - Complete centralized state management for events and RSVP status
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import api from '../services/api';

const useEventStore = create(
  subscribeWithSelector((set, get) => ({
    // State
    events: new Map(), // Store events by ID for efficient lookups
    loading: false,
    error: null,
    lastFetch: null,
    feedCache: {
      following: { data: [], lastFetch: null, hasMore: true },
      discover: { data: [], lastFetch: null, hasMore: true },
      nearby: { data: [], lastFetch: null, hasMore: true }
    },

    // Actions
    setEvents: (eventsArray, currentUserId = null) => {
      const eventsMap = new Map();
      eventsArray.forEach(event => {
        eventsMap.set(event._id, {
          ...event,
          isAttending: event.attendees?.some(a => 
            (typeof a === 'string' ? a : a._id) === currentUserId
          ) || false,
          attendeeCount: event.attendees?.length || 0,
          checkedInCount: event.checkedIn?.length || 0,
          isHost: String(event.host?._id || event.host) === String(currentUserId),
          lastUpdated: Date.now()
        });
      });
      set({ events: eventsMap, lastFetch: Date.now() });
    },

    addEvent: (event, currentUserId = null) => {
      const { events } = get();
      const newEvents = new Map(events);
      newEvents.set(event._id, {
        ...event,
        isAttending: event.attendees?.some(a => 
          (typeof a === 'string' ? a : a._id) === currentUserId
        ) || false,
        attendeeCount: event.attendees?.length || 0,
        checkedInCount: event.checkedIn?.length || 0,
        isHost: String(event.host?._id || event.host) === String(currentUserId),
        lastUpdated: Date.now()
      });
      set({ events: newEvents });
    },

    updateEvent: (eventId, updates) => {
      const { events } = get();
      const existingEvent = events.get(eventId);
      if (existingEvent) {
        const newEvents = new Map(events);
        newEvents.set(eventId, { 
          ...existingEvent, 
          ...updates, 
          lastUpdated: Date.now() 
        });
        set({ events: newEvents });
      }
    },

    getEvent: (eventId) => {
      const { events } = get();
      return events.get(eventId);
    },

    // Enhanced RSVP toggle with comprehensive error handling and payment support
    toggleRSVP: async (eventId, currentUserId, eventData = null) => {
      const { events, updateEvent, addEvent } = get();
      let event = events.get(eventId);
      
      // If event not in store, use provided eventData
      if (!event && eventData) {
        await addEvent(eventData, currentUserId);
        event = events.get(eventId);
      }
      
      if (!event || !currentUserId) {
        console.warn('Cannot toggle RSVP: event not found or no user ID');
        return { success: false, error: 'Invalid event or user' };
      }

      const wasAttending = event.isAttending;
      const newAttending = !wasAttending;
      const newCount = wasAttending ? event.attendeeCount - 1 : event.attendeeCount + 1;

      // Optimistic update
      updateEvent(eventId, {
        isAttending: newAttending,
        attendeeCount: newCount
      });

      console.log('🔄 Optimistic RSVP toggle:', {
        eventId,
        wasAttending,
        newAttending,
        newCount
      });

      try {
        let response;
        
        if (newAttending) {
          // Joining event
          if (event.permissions?.canJoin === 'approval-required') {
            // Join request flow
            response = await api.post(`/api/events/request-join/${eventId}`, {
              message: 'I would like to join this event.'
            });
            
            // For approval-required events, don't change attending status immediately
            updateEvent(eventId, {
              isAttending: false, // Revert optimistic update
              attendeeCount: event.attendeeCount, // Revert count
              joinRequestSent: true // Add flag for UI
            });
            
            console.log('📝 Join request sent for approval-required event');
            return { type: 'request', success: true };
            
          } else {
            // Direct join
            response = await api.post(`/api/events/attend/${eventId}`);
          }
        } else {
          // Leaving event
          response = await api.delete(`/api/events/attend/${eventId}`);
        }

        console.log('✅ RSVP API response:', response.data);

        // Sync with server response
        let serverAttending = newAttending; // Default to optimistic value
        let serverCount = newCount; // Default to optimistic value

        // Handle different response formats
        if (response.data.attending !== undefined) {
          serverAttending = response.data.attending;
        } else if (response.data.isAttending !== undefined) {
          serverAttending = response.data.isAttending;
        } else if (response.data.attendees) {
          // Check if user is in attendees array
          serverAttending = response.data.attendees.some(a => 
            (typeof a === 'string' ? a : a._id) === currentUserId
          );
          serverCount = response.data.attendees.length;
        }

        if (response.data.attendeeCount !== undefined) {
          serverCount = response.data.attendeeCount;
        }

        // Update with server values
        updateEvent(eventId, {
          isAttending: serverAttending,
          attendeeCount: serverCount,
          joinRequestSent: false // Clear any request flags
        });

        console.log('✅ RSVP synced with server:', {
          eventId,
          serverAttending,
          serverCount
        });

        return { type: 'attend', success: true, attending: serverAttending };

      } catch (error) {
        console.error('❌ RSVP toggle failed:', error);
        
        // Revert optimistic update on error
        updateEvent(eventId, {
          isAttending: wasAttending,
          attendeeCount: event.attendeeCount,
          joinRequestSent: false
        });

        // Check for specific error types
        if (error.response?.status === 402) {
          // Payment required
          return { type: 'payment_required', error: error.response.data };
        }

        if (error.response?.status === 403) {
          // Permission denied
          return { 
            type: 'permission_denied', 
            error: error.response.data.message || 'Permission denied' 
          };
        }

        return { 
          success: false, 
          error: error.response?.data?.message || 'Failed to update attendance' 
        };
      }
    },

    // Handle payment completion for events
    confirmEventPayment: async (eventId, paymentData) => {
      try {
        const response = await api.post(`/api/events/attend/${eventId}`, {
          paymentConfirmed: true,
          ...paymentData
        });

        // Update event with payment confirmed and attending status
        const { updateEvent } = get();
        updateEvent(eventId, {
          isAttending: true,
          userHasPaid: true,
          attendeeCount: response.data.attendeeCount || response.data.attendees?.length
        });

        console.log('✅ Event payment confirmed and attendance updated');
        return response.data;

      } catch (error) {
        console.error('❌ Event payment confirmation failed:', error);
        throw error;
      }
    },

    // Update attendee count (for hosts/managers)
    updateAttendeeCount: (eventId, newCount, checkedInCount = null) => {
      const { updateEvent } = get();
      const updates = { attendeeCount: newCount };
      
      if (checkedInCount !== null) {
        updates.checkedInCount = checkedInCount;
      }
      
      updateEvent(eventId, updates);
    },

    // Handle check-in status updates
    updateCheckInStatus: (eventId, userId, isCheckedIn) => {
      const { events, updateEvent } = get();
      const event = events.get(eventId);
      
      if (!event) return;

      let newCheckedInCount = event.checkedInCount || 0;
      
      if (isCheckedIn) {
        newCheckedInCount += 1;
      } else {
        newCheckedInCount = Math.max(0, newCheckedInCount - 1);
      }

      updateEvent(eventId, {
        checkedInCount: newCheckedInCount
      });
    },

    // Feed management with caching
    updateFeedCache: (feedType, data, hasMore = false) => {
      const { feedCache } = get();
      set({
        feedCache: {
          ...feedCache,
          [feedType]: {
            data,
            lastFetch: Date.now(),
            hasMore
          }
        }
      });
    },

    appendToFeedCache: (feedType, newData) => {
      const { feedCache } = get();
      const currentFeed = feedCache[feedType] || { data: [], lastFetch: null, hasMore: true };
      
      set({
        feedCache: {
          ...feedCache,
          [feedType]: {
            ...currentFeed,
            data: [...currentFeed.data, ...newData],
            lastFetch: Date.now()
          }
        }
      });
    },

    // Bulk operations for feed updates
    syncEventsFromFeed: (feedEvents, currentUserId = null) => {
      const { events } = get();
      const newEvents = new Map(events);
      
      feedEvents.forEach(feedEvent => {
        const existingEvent = newEvents.get(feedEvent._id);
        if (existingEvent) {
          // Update existing event with any new data, but preserve optimistic updates
          // Only update if server data is newer or if we don't have lastUpdated
          const serverIsNewer = !existingEvent.lastUpdated || 
            (feedEvent.lastUpdated && feedEvent.lastUpdated > existingEvent.lastUpdated);
          
          if (serverIsNewer) {
            newEvents.set(feedEvent._id, {
              ...existingEvent,
              ...feedEvent,
              isAttending: feedEvent.attendees?.some(a => 
                (typeof a === 'string' ? a : a._id) === currentUserId
              ) || false,
              attendeeCount: feedEvent.attendees?.length || 0,
              checkedInCount: feedEvent.checkedIn?.length || 0,
              isHost: String(feedEvent.host?._id || feedEvent.host) === String(currentUserId),
              lastUpdated: Date.now()
            });
          }
        } else {
          // Add new event
          newEvents.set(feedEvent._id, {
            ...feedEvent,
            isAttending: feedEvent.attendees?.some(a => 
              (typeof a === 'string' ? a : a._id) === currentUserId
            ) || false,
            attendeeCount: feedEvent.attendees?.length || 0,
            checkedInCount: feedEvent.checkedIn?.length || 0,
            isHost: String(feedEvent.host?._id || feedEvent.host) === String(currentUserId),
            lastUpdated: Date.now()
          });
        }
      });

      set({ events: newEvents });
    },

    // Remove attendee (for hosts)
    removeAttendee: async (eventId, userId) => {
      try {
        await api.post(`/api/events/${eventId}/remove-attendee`, { userId });
        
        // Update attendee count
        const { events, updateEvent } = get();
        const event = events.get(eventId);
        if (event) {
          updateEvent(eventId, {
            attendeeCount: Math.max(0, event.attendeeCount - 1)
          });
        }

        console.log('✅ Attendee removed successfully');
        return true;

      } catch (error) {
        console.error('❌ Remove attendee failed:', error);
        throw error;
      }
    },

    // Bulk check-in
    bulkCheckIn: async (eventId, attendeeIds) => {
      try {
        const response = await api.post(`/api/events/${eventId}/bulk-checkin`, {
          attendeeIds
        });

        // Update checked-in count
        const { updateEvent } = get();
        updateEvent(eventId, {
          checkedInCount: response.data.checkedInCount || attendeeIds.length
        });

        console.log('✅ Bulk check-in completed');
        return response.data;

      } catch (error) {
        console.error('❌ Bulk check-in failed:', error);
        throw error;
      }
    },

    // Search and filter events
    searchEvents: async (query, filters = {}) => {
      try {
        const response = await api.get('/api/events/search', {
          params: { q: query, ...filters }
        });
        
        return response.data.events || [];
      } catch (error) {
        console.error('❌ Event search failed:', error);
        return [];
      }
    },

    // Clear all events (useful for logout)
    clearEvents: () => {
      set({ 
        events: new Map(), 
        loading: false, 
        error: null,
        feedCache: {
          following: { data: [], lastFetch: null, hasMore: true },
          discover: { data: [], lastFetch: null, hasMore: true },
          nearby: { data: [], lastFetch: null, hasMore: true }
        }
      });
    },

    // Get events as array (useful for FlatList)
    getEventsArray: () => {
      const { events } = get();
      return Array.from(events.values());
    },

    // Get events by type/filter
    getEventsByFilter: (filter = 'all') => {
      const { events } = get();
      const allEvents = Array.from(events.values());
      
      switch (filter) {
        case 'attending':
          return allEvents.filter(event => event.isAttending);
        case 'hosting':
          return allEvents.filter(event => event.isHost);
        case 'upcoming':
          return allEvents.filter(event => new Date(event.time) > new Date());
        case 'past':
          return allEvents.filter(event => new Date(event.time) <= new Date());
        case 'paid':
          return allEvents.filter(event => event.pricing && !event.pricing.isFree);
        case 'free':
          return allEvents.filter(event => !event.pricing || event.pricing.isFree);
        default:
          return allEvents;
      }
    },

    // Check if data is stale and needs refresh
    needsRefresh: (maxAge = 5 * 60 * 1000) => { // 5 minutes default
      const { lastFetch } = get();
      return !lastFetch || (Date.now() - lastFetch) > maxAge;
    },

    // Get feed cache
    getFeedCache: (feedType) => {
      const { feedCache } = get();
      return feedCache[feedType] || { data: [], lastFetch: null, hasMore: true };
    },

    // Set loading state
    setLoading: (loading) => set({ loading }),

    // Set error state
    setError: (error) => set({ error }),

    // Real-time updates (for WebSocket integration)
    handleRealTimeUpdate: (update) => {
      const { type, eventId, data } = update;
      const { updateEvent } = get();

      switch (type) {
        case 'attendee_joined':
          updateEvent(eventId, {
            attendeeCount: data.attendeeCount,
            isAttending: data.userId === data.currentUserId ? true : undefined
          });
          break;
        case 'attendee_left':
          updateEvent(eventId, {
            attendeeCount: data.attendeeCount,
            isAttending: data.userId === data.currentUserId ? false : undefined
          });
          break;
        case 'attendee_checked_in':
          updateEvent(eventId, {
            checkedInCount: data.checkedInCount
          });
          break;
        case 'event_updated':
          updateEvent(eventId, data.updates);
          break;
        default:
          console.log('Unhandled real-time update:', update);
      }
    }
  }))
);

export default useEventStore;