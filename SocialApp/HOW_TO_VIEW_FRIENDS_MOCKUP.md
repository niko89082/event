# How to View Friends Tab Mockup

The Friends tab now has a redesigned activity feed that matches the design specification. Since you don't have content yet, the component automatically shows mock data.

## Viewing the Mockup

1. **Navigate to Events Screen**: Open the app and go to the Events screen
2. **Select Friends Tab**: Tap on the "Friends" tab at the top
3. **View Mock Data**: The screen will automatically display mock activity items showing:
   - A "Create New Event" card with dashed border
   - "Friends' Activity" section with sample activities:
     - Sophie Miller is going to "Neon Art Gala"
     - Liam Wilson created "Underground Beats"
     - Noah & Emma are interested in "Sunset Yoga"

## Enabling Mock Data Mode

If you want to force mock data mode (useful for testing/design review), you can:

### Option 1: Modify EventsFeedSection.js
In `SocialApp/components/events/EventsFeedSection.js`, change line 14 to:
```javascript
if (activeTab === 'friends') {
  return (
    <FriendsActivityFeed
      navigation={navigation}
      currentUserId={currentUserId}
      useMockData={true}  // Force mock data
    />
  );
}
```

### Option 2: Modify EventsScreen.js
In `SocialApp/screens/EventsScreen.js`, add `useMockData={true}` prop:
```javascript
<EventsFeedSection 
  navigation={navigation}
  activeTab={tab}
  currentUserId={currentUser?._id}
  useMockData={true}  // Add this line
/>
```

## Mock Data Details

The mock data includes:
- **3 sample activities** with different types (going, created, interested)
- **Realistic timestamps** (2 hours ago, 5 hours ago, yesterday)
- **Event cards** with dates, categories, locations, and friend counts
- **Profile picture placeholders** (will show actual images when real data is available)

## When Real Data is Available

Once you have real friends' activity data, the component will automatically:
1. Try to fetch real data from the API
2. Transform it into the activity feed format
3. Fall back to mock data only if the API is unavailable or returns no results

## Design Features

The new Friends tab includes:
- ✅ "Create New Event" card with dashed border and blue plus icon
- ✅ "Friends' Activity" section header
- ✅ Activity cards with profile pictures (supports single or multiple users)
- ✅ Activity text (e.g., "Sophie Miller is going to", "Liam Wilson created an event")
- ✅ Timestamps (e.g., "2 hours ago", "Yesterday")
- ✅ Three-dot menu button for each activity
- ✅ Embedded event cards showing:
  - Event image/placeholder
  - Date and time (formatted as "TOMORROW • 8 PM" or "SAT, NOV 12 • 9 PM")
  - Category tag (e.g., "Art", "Music")
  - Event title
  - Location
  - Friends going count with avatars

