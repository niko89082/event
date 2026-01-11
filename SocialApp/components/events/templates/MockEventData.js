// components/events/templates/MockEventData.js - Mock event data for testing
export const getMockFeaturedEvents = () => {
  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(22, 0, 0, 0);
  
  const thisWeekend = new Date(now);
  thisWeekend.setDate(now.getDate() + (6 - now.getDay())); // Next Saturday
  thisWeekend.setHours(18, 0, 0, 0);

  return [
    {
      _id: 'mock-featured-1',
      title: 'Rooftop Techno Night',
      location: 'The Bunker • Downtown LA',
      time: tonight.toISOString(),
      coverImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
      attendeeCount: 42,
      attendees: [
        { _id: 'user1', profilePicture: 'https://i.pravatar.cc/150?img=1' },
        { _id: 'user2', profilePicture: 'https://i.pravatar.cc/150?img=2' },
      ],
      isFeatured: true,
    },
    {
      _id: 'mock-featured-2',
      title: 'Golden Hour Hike',
      location: 'Griffith Park • Los Angeles',
      time: thisWeekend.toISOString(),
      coverImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      attendeeCount: 12,
      attendees: [
        { _id: 'user3', profilePicture: 'https://i.pravatar.cc/150?img=3' },
      ],
      isFeatured: true,
    },
    {
      _id: 'mock-featured-3',
      title: 'Sunset Yoga Session',
      location: 'Santa Monica Beach',
      time: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      coverImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
      attendeeCount: 28,
      attendees: [
        { _id: 'user4', profilePicture: 'https://i.pravatar.cc/150?img=4' },
        { _id: 'user5', profilePicture: 'https://i.pravatar.cc/150?img=5' },
      ],
      isFeatured: true,
    },
  ];
};

export const getMockFeedEvents = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + (6 - now.getDay())); // Next Saturday
  saturday.setHours(21, 0, 0, 0);

  const sunday = new Date(now);
  sunday.setDate(now.getDate() + (7 - now.getDay())); // Next Sunday
  sunday.setHours(19, 30, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  nextWeek.setHours(18, 0, 0, 0);

  return [
    {
      _id: 'mock-feed-1',
      title: 'Neon Art Gala',
      location: 'The Broad Museum',
      time: tomorrow.toISOString(),
      coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
      attendeeCount: 15,
      friendsGoingCount: 3,
      attendees: [
        { _id: 'user1', profilePicture: 'https://i.pravatar.cc/150?img=1' },
        { _id: 'user2', profilePicture: 'https://i.pravatar.cc/150?img=2' },
        { _id: 'user3', profilePicture: 'https://i.pravatar.cc/150?img=3' },
      ],
    },
    {
      _id: 'mock-feed-2',
      title: 'Underground Beats',
      location: 'Warehouse 42, Arts District',
      time: saturday.toISOString(),
      coverImage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400',
      attendeeCount: 24,
      friendsGoingCount: 8,
      attendees: [
        { _id: 'user4', profilePicture: 'https://i.pravatar.cc/150?img=4' },
        { _id: 'user5', profilePicture: 'https://i.pravatar.cc/150?img=5' },
        { _id: 'user6', profilePicture: 'https://i.pravatar.cc/150?img=6' },
      ],
    },
    {
      _id: 'mock-feed-3',
      title: 'Open Mic Comedy',
      location: 'Laugh Factory',
      time: sunday.toISOString(),
      coverImage: null, // Test placeholder
      attendeeCount: 8,
      friendsGoingCount: 2,
      attendees: [
        { _id: 'user7', profilePicture: 'https://i.pravatar.cc/150?img=7' },
        { _id: 'user8', profilePicture: 'https://i.pravatar.cc/150?img=8' },
      ],
    },
    {
      _id: 'mock-feed-4',
      title: 'Tech Networking Mixer',
      location: 'WeWork Santa Monica',
      time: nextWeek.toISOString(),
      coverImage: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400',
      attendeeCount: 45,
      friendsGoingCount: 15,
      attendees: [
        { _id: 'user9', profilePicture: 'https://i.pravatar.cc/150?img=9' },
        { _id: 'user10', profilePicture: 'https://i.pravatar.cc/150?img=10' },
        { _id: 'user11', profilePicture: 'https://i.pravatar.cc/150?img=11' },
      ],
    },
  ];
};


