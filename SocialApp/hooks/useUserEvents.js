// hooks/useUserEvents.js - Centralized logic to determine user's event participation
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const useUserEvents = (userId) => {
  const [hostingEvents, setHostingEvents] = useState([]);
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Derived state for tab visibility
  const hasHostingEvents = hostingEvents.length > 0;
  const hasAttendingEvents = attendingEvents.length > 0;

  const fetchUserEvents = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Avoid unnecessary refetches (cache for 2 minutes)
    const now = Date.now();
    if (!forceRefresh && lastFetch && (now - lastFetch) < 2 * 60 * 1000) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔄 useUserEvents: Fetching user events for userId:', userId);

      // Parallel fetch for better performance
      const [hostedResponse, userResponse] = await Promise.all([
        // Fetch hosted events
        api.get(`/api/events`, {
          params: {
            host: userId,
            upcoming: true,
            limit: 50 // Reasonable limit for tab determination
          }
        }).catch(error => {
          console.warn('Hosted events fetch failed:', error);
          return { data: { events: [] } };
        }),

        // Fetch user profile for attending events
        api.get(`/api/profile/${userId}`).catch(error => {
          console.warn('User profile fetch failed:', error);
          return { data: { attendingEvents: [] } };
        })
      ]);

      const hostedEvents = hostedResponse.data.events || hostedResponse.data || [];
      const user = userResponse.data;
      const userAttendingEvents = user.attendingEvents || [];

      // Process cohosted events (user is in attendingEvents but listed as cohost)
      const cohostEvents = userAttendingEvents.filter(event => {
        // Must be upcoming
        if (new Date(event.time) <= new Date()) return false;

        // Must not be the main host
        if (String(event.host._id || event.host) === String(userId)) return false;

        // Must be listed as cohost
        return event.coHosts?.some(cohost => 
          String(cohost._id || cohost) === String(userId)
        );
      });

      // Process pure attending events (not hosting, not cohosting)
      const pureAttendingEvents = userAttendingEvents.filter(event => {
        // Must be upcoming
        if (new Date(event.time) <= new Date()) return false;

        // Must not be the main host
        if (String(event.host._id || event.host) === String(userId)) return false;

        // Must not be a cohost
        const isCohost = event.coHosts?.some(cohost => 
          String(cohost._id || cohost) === String(userId)
        );
        
        return !isCohost;
      });

      // Combine hosted + cohosted for "hosting" tab
      const allHostingEvents = [...hostedEvents, ...cohostEvents];
      
      // Remove duplicates (in case an event appears in both lists)
      const uniqueHostingEvents = allHostingEvents.filter((event, index, self) => 
        index === self.findIndex(e => e._id === event._id)
      );

      // Update state
      setHostingEvents(uniqueHostingEvents);
      setAttendingEvents(pureAttendingEvents);
      setLastFetch(now);

      console.log('✅ useUserEvents: Events categorized', {
        userId,
        hostedCount: hostedEvents.length,
        cohostCount: cohostEvents.length,
        totalHostingCount: uniqueHostingEvents.length,
        attendingCount: pureAttendingEvents.length,
        hasHostingEvents: uniqueHostingEvents.length > 0,
        hasAttendingEvents: pureAttendingEvents.length > 0
      });

    } catch (error) {
      console.error('useUserEvents fetch error:', error);
      setError('Failed to load user events');
      setHostingEvents([]);
      setAttendingEvents([]);
    } finally {
      setLoading(false);
    }
  }, [userId, lastFetch]);

  // Initial fetch when userId changes
  useEffect(() => {
    fetchUserEvents();
  }, [fetchUserEvents]);

  // Refresh function for external use
  const refresh = useCallback(() => {
    return fetchUserEvents(true);
  }, [fetchUserEvents]);

  // Clear function for cleanup (e.g., logout)
  const clear = useCallback(() => {
    setHostingEvents([]);
    setAttendingEvents([]);
    setLoading(false);
    setError(null);
    setLastFetch(null);
  }, []);

  return {
    // Event data
    hostingEvents,
    attendingEvents,
    
    // Tab visibility flags
    hasHostingEvents,
    hasAttendingEvents,
    
    // State
    loading,
    error,
    lastFetch,
    
    // Actions
    refresh,
    clear,
    
    // Summary for debugging
    summary: {
      totalHosting: hostingEvents.length,
      totalAttending: attendingEvents.length,
      shouldShowHostingTab: hasHostingEvents,
      shouldShowAttendingTab: hasAttendingEvents
    }
  };
};