// hooks/useUserEvents.js - COMPREHENSIVE DEBUG VERSION
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
    console.log('❌ useUserEvents: No userId provided');
    setLoading(false);
    return;
  }

  // Avoid unnecessary refetches (cache for 2 minutes)
  const now = Date.now();
  if (!forceRefresh && lastFetch && (now - lastFetch) < 2 * 60 * 1000) {
    console.log('⚡ useUserEvents: Using cached data, skipping fetch');
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    setError(null);

    console.log('🔄 useUserEvents: Starting fetch for userId:', userId);
    
    // ✅ FIX: Use multiple approaches to get hosting events
    console.log('🔄 Making multiple API calls to ensure we catch all hosting events...');

    // 1. Try the main hosted events endpoint (remove isActive requirement)
    // 2. Try the user's events endpoint specifically  
    // 3. Get user profile for attending events
    const [hostedEventsResponse, userEventsResponse, userResponse] = await Promise.all([
      // Method 1: Direct hosted events query (most reliable)
      api.get(`/api/events`, {
        params: {
          host: userId,
          upcoming: true,
          limit: 50
        }
      }).catch(error => {
        console.warn('❌ Hosted events fetch failed:', error.message);
        return { data: { events: [] } };
      }),
      
      // Method 2: User events endpoint (backup)
      api.get(`/api/users/${userId}/events`, {
        params: {
          type: 'hosted',
          includePast: false,
          limit: 50
        }
      }).catch(error => {
        console.warn('❌ User events fetch failed:', error.message);
        return { data: { events: [] } };
      }),
      
      // Method 3: Profile for attending events
      api.get(`/api/profile/${userId}`).catch(error => {
        console.warn('❌ User profile fetch failed:', error.message);
        return { data: { attendingEvents: [] } };
      })
    ]);

    console.log('📦 Raw API Responses:', {
      hostedEventsResponse: {
        status: hostedEventsResponse.status,
        eventsCount: hostedEventsResponse.data.events?.length || 0,
        dataKeys: Object.keys(hostedEventsResponse.data)
      },
      userEventsResponse: {
        status: userEventsResponse.status, 
        eventsCount: userEventsResponse.data.events?.length || 0,
        dataKeys: Object.keys(userEventsResponse.data)
      },
      userResponse: {
        status: userResponse.status,
        attendingEventsCount: userResponse.data.attendingEvents?.length || 0
      }
    });

    // Combine all possible hosted events sources
    const method1Events = hostedEventsResponse.data.events || [];
    const method2Events = userEventsResponse.data.events || [];
    const user = userResponse.data;
    const userAttendingEvents = user.attendingEvents || [];

    // Combine and deduplicate hosted events
    const allPotentialHostedEvents = [...method1Events, ...method2Events];
    const uniqueHostedEvents = allPotentialHostedEvents.filter((event, index, self) => 
      index === self.findIndex(e => e._id === event._id)
    );

    console.log('📊 Combined Data Sources:', {
      method1Events: method1Events.length,
      method2Events: method2Events.length, 
      uniqueHostedEvents: uniqueHostedEvents.length,
      userAttendingEvents: userAttendingEvents.length,
      currentUserId: userId
    });

    // Process main hosted events (filter for upcoming and where user is actually host)
    const mainHostedEvents = uniqueHostedEvents.filter(event => {
      const isUpcoming = new Date(event.time) > new Date();
      const eventHostId = String(event.host?._id || event.host);
      const currentUserId = String(userId);
      const isUserMainHost = eventHostId === currentUserId;
      
      console.log(`🎯 Main Host Filter: "${event.title}"`, {
        isUpcoming,
        eventHostId,
        currentUserId,
        isUserMainHost,
        shouldInclude: isUpcoming && isUserMainHost
      });
      
      return isUpcoming && isUserMainHost;
    });

    // Process cohosted events (from attending events where user is cohost)
    const cohostEvents = userAttendingEvents.filter(event => {
      const isUpcoming = new Date(event.time) > new Date();
      const eventHostId = String(event.host?._id || event.host);
      const currentUserId = String(userId);
      const isMainHost = eventHostId === currentUserId;
      const isCohost = event.coHosts?.some(cohost => 
        String(cohost._id || cohost) === currentUserId
      );
      
      const shouldInclude = isUpcoming && !isMainHost && isCohost;
      
      console.log(`🎯 Cohost Filter: "${event.title}"`, {
        isUpcoming,
        isMainHost,
        isCohost,
        shouldInclude
      });
      
      return shouldInclude;
    });

    // Process pure attending events
    const pureAttendingEvents = userAttendingEvents.filter(event => {
      const isUpcoming = new Date(event.time) > new Date();
      const eventHostId = String(event.host?._id || event.host);
      const currentUserId = String(userId);
      const isMainHost = eventHostId === currentUserId;
      const isCohost = event.coHosts?.some(cohost => 
        String(cohost._id || cohost) === currentUserId
      );
      
      const shouldInclude = isUpcoming && !isMainHost && !isCohost;
      
      return shouldInclude;
    });

    // Combine hosting events (main hosted + cohosted)
    const allHostingEvents = [...mainHostedEvents, ...cohostEvents];
    const uniqueHostingEvents = allHostingEvents.filter((event, index, self) => 
      index === self.findIndex(e => e._id === event._id)
    );

    console.log('🎉 FINAL CATEGORIZATION:', {
      userId,
      mainHostedEvents: {
        count: mainHostedEvents.length,
        titles: mainHostedEvents.map(e => e.title)
      },
      cohostEvents: {
        count: cohostEvents.length,
        titles: cohostEvents.map(e => e.title)
      },
      uniqueHostingEvents: {
        count: uniqueHostingEvents.length,
        titles: uniqueHostingEvents.map(e => e.title)
      },
      pureAttendingEvents: {
        count: pureAttendingEvents.length,
        titles: pureAttendingEvents.map(e => e.title)
      }
    });

    // Update state
    setHostingEvents(uniqueHostingEvents);
    setAttendingEvents(pureAttendingEvents);
    setLastFetch(now);

  } catch (error) {
    console.error('❌ useUserEvents fetch error:', error);
    setError('Failed to load user events');
    setHostingEvents([]);
    setAttendingEvents([]);
  } finally {
    setLoading(false);
  }
}, [userId]);

  // Initial fetch when userId changes
  useEffect(() => {
    fetchUserEvents();
  }, [fetchUserEvents]);

  // Refresh function for external use
  const refresh = useCallback(() => {
    console.log('🔄 useUserEvents: Manual refresh triggered');
    return fetchUserEvents(true);
  }, [fetchUserEvents]);

  // Force refresh function that bypasses cache
  const forceRefresh = useCallback(() => {
    console.log('🔄 useUserEvents: Force refresh triggered (bypassing cache)');
    setLastFetch(null); // Clear cache timestamp
    return fetchUserEvents(true);
  }, [fetchUserEvents]);

  // Clear function for cleanup
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
    forceRefresh,
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