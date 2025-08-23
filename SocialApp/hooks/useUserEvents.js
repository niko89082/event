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
      console.log('🔄 API calls will be made to:', {
        hostedEventsURL: `/api/events?host=${userId}&upcoming=true&limit=50`,
        userProfileURL: `/api/profile/${userId}`
      });

      // Fetch main hosted events and user profile
      const [mainHostedResponse, userResponse] = await Promise.all([
        api.get(`/api/events`, {
          params: {
            host: userId,
            upcoming: true,
            limit: 50
          }
        }).catch(error => {
          console.warn('❌ Main hosted events fetch failed:', error.message);
          console.warn('❌ Error details:', error.response?.data);
          return { data: { events: [] } };
        }),

        api.get(`/api/profile/${userId}`).catch(error => {
          console.warn('❌ User profile fetch failed:', error.message);
          console.warn('❌ Error details:', error.response?.data);
          return { data: { attendingEvents: [] } };
        })
      ]);

      console.log('📦 Raw API Responses:', {
        mainHostedResponse: {
          status: mainHostedResponse.status,
          dataKeys: Object.keys(mainHostedResponse.data),
          eventsCount: mainHostedResponse.data.events?.length || 'undefined'
        },
        userResponse: {
          status: userResponse.status,
          dataKeys: Object.keys(userResponse.data),
          attendingEventsCount: userResponse.data.attendingEvents?.length || 'undefined'
        }
      });

      const mainHostedEvents = mainHostedResponse.data.events || mainHostedResponse.data || [];
      const user = userResponse.data;
      const userAttendingEvents = user.attendingEvents || [];

      console.log('📊 Extracted Raw Data:', {
        mainHostedEvents: mainHostedEvents.length,
        userAttendingEvents: userAttendingEvents.length,
        currentUserId: userId
      });

      // DEBUG: Log every single event and its host
      console.log('🔍 DEBUGGING MAIN HOSTED EVENTS:');
      mainHostedEvents.forEach((event, index) => {
        const eventHost = event.host?._id || event.host;
        const isUserMainHost = String(eventHost) === String(userId);
        console.log(`  Event ${index + 1}: "${event.title}"`, {
          eventId: event._id,
          hostField: eventHost,
          currentUserId: userId,
          isUserMainHost,
          time: event.time,
          coHostsCount: event.coHosts?.length || 0
        });
      });

      console.log('🔍 DEBUGGING USER ATTENDING EVENTS:');
      userAttendingEvents.forEach((event, index) => {
        const eventHost = event.host?._id || event.host;
        const isUserMainHost = String(eventHost) === String(userId);
        const isUserCohost = event.coHosts?.some(cohost => 
          String(cohost._id || cohost) === String(userId)
        );
        console.log(`  Attending Event ${index + 1}: "${event.title}"`, {
          eventId: event._id,
          hostField: eventHost,
          currentUserId: userId,
          isUserMainHost,
          isUserCohost,
          time: event.time,
          coHostsIds: event.coHosts?.map(ch => ch._id || ch) || []
        });
      });

      // Process cohosted events
      const cohostEvents = userAttendingEvents.filter((event, index) => {
        // Must be upcoming
        const isUpcoming = new Date(event.time) > new Date();
        
        // Must NOT be the main host
        const eventHostId = String(event.host?._id || event.host);
        const currentUserId = String(userId);
        const isMainHost = eventHostId === currentUserId;
        
        // Must be listed as cohost
        const isCohost = event.coHosts?.some(cohost => 
          String(cohost._id || cohost) === currentUserId
        );
        
        const shouldInclude = isUpcoming && !isMainHost && isCohost;
        
        console.log(`🎯 Cohost Filter Event ${index + 1}: "${event.title}"`, {
          isUpcoming,
          isMainHost,
          isCohost,
          shouldInclude,
          eventHostId,
          currentUserId,
          comparison: eventHostId === currentUserId
        });
        
        return shouldInclude;
      });

      // Process pure attending events
      const pureAttendingEvents = userAttendingEvents.filter((event, index) => {
        // Must be upcoming
        const isUpcoming = new Date(event.time) > new Date();
        
        // Must not be the main host
        const eventHostId = String(event.host?._id || event.host);
        const currentUserId = String(userId);
        const isMainHost = eventHostId === currentUserId;
        
        // Must not be a cohost
        const isCohost = event.coHosts?.some(cohost => 
          String(cohost._id || cohost) === currentUserId
        );
        
        const shouldInclude = isUpcoming && !isMainHost && !isCohost;
        
        console.log(`👥 Attending Filter Event ${index + 1}: "${event.title}"`, {
          isUpcoming,
          isMainHost,
          isCohost,
          shouldInclude,
          eventHostId,
          currentUserId
        });
        
        return shouldInclude;
      });

      // Combine hosting events
      const allHostingEvents = [...mainHostedEvents, ...cohostEvents];
      
      // Remove duplicates
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

      // 🚨 CRITICAL DEBUG: Check for the problematic events
      console.log('🚨 HOSTING TAB WILL SHOW:');
      uniqueHostingEvents.forEach((event, index) => {
        const eventHost = event.host?._id || event.host;
        const isUserMainHost = String(eventHost) === String(userId);
        console.log(`  ${index + 1}. "${event.title}" - Host: ${eventHost} (User is main host: ${isUserMainHost})`);
      });

      // Update state
      setHostingEvents(uniqueHostingEvents);
      setAttendingEvents(pureAttendingEvents);
      setLastFetch(now);

    } catch (error) {
      console.error('❌ useUserEvents fetch error:', error);
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));
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