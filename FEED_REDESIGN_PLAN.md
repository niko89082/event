# Feed Page Redesign Plan

## Overview
This document outlines the complete redesign of the feed/home page based on the provided design references. The redesign focuses on modernizing the navigation structure, improving post creation accessibility, and aligning with contemporary social media app patterns.

---

## 🎯 Key Design Changes

### 1. **Bottom Tab Navigation Restructure**

#### Current Structure:
- **3 Tabs:** Home, Create, Profile
- Search is in the header (top right)
- Events are integrated into the home feed tabs

#### New Structure:
- **5 Tabs:** Home, Search, Create (larger), Events Hub, Profile
- Search moves from header to bottom tab navigation
- Events Hub becomes a dedicated bottom tab
- Create button is **slightly larger** than other tab icons (prominent but not overwhelming)

#### Visual Specifications:
```
┌─────────────────────────────────────┐
│  [Home] [Search] [CREATE] [Events] [Profile]  │
│    🏠     🔍      ➕      📅      👤          │
│                                         │
│  Create icon: 36-38px (others: 28-30px)│
│  Create always blue (#1976D2)          │
└─────────────────────────────────────┘
```

**Tab Order (Left to Right):**
1. **Home** - House icon (home/home-outline)
2. **Search** - Magnifying glass icon (search/search-outline)
3. **Create** - Plus/add-circle icon (add-circle/add-circle-outline) - **LARGER SIZE**
4. **Events Hub** - Calendar icon (calendar/calendar-outline)
5. **Profile** - Person icon (person/person-outline)

---

### 2. **Home Screen Header Changes**

#### Current Header:
- Left: Search icon
- Center: "Social" title
- Right: Notifications icon

#### New Header:
- Left: Profile picture (small, circular) OR placeholder icon
- Center: "SocialEvents" or "Social" title (light blue #3797EF)
- Right: Notifications icon (with badge if unread)

**Note:** Search icon removed from header (moved to bottom tab)

---

### 3. **Home Screen Content Structure**

#### Current Structure:
- Top tabs: "Activity" and "Events"
- Content scrolls below tabs

#### New Structure:
- **"What's happening?" Input Area** (Facebook-style post composer)
- **Top tabs:** "For You" and "Activity" (replacing "Activity" and "Events")
- Content feed below

---

### 4. **"What's happening?" Post Composer**

#### Location:
- Positioned as the **first item in the feed content** (scrolls with feed)
- Appears below the "For You"/"Activity" tabs
- **NOT fixed** - scrolls away when user scrolls down
- Essentially acts as the first "post" in the feed

#### Design Specifications:
```
┌─────────────────────────────────────┐
│  Header (Profile | Title | Notifications) │
├─────────────────────────────────────┤
│  [For You] [Activity]               │ ← Tabs (Fixed, hides on scroll)
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ [Profile Pic] What's happening?│ │ ← Post Composer (Scrolls with feed)
│  │         [Image] [Calendar] [⭐] │ │
│  └───────────────────────────────┘ │
├─────────────────────────────────────┤
│  Feed Content...                    │
└─────────────────────────────────────┘
```

#### Scroll Behavior:
- **Header:** Hides when scrolling down, shows when scrolling up (fixed position when visible)
- **Tab Bar:** Hides when scrolling down, shows when scrolling up (fixed position when visible)
- **Post Composer:** Scrolls with feed content (NOT fixed - it's part of the scrollable list)

#### Components:
1. **Profile Picture** (left side, circular, 40-44px)
   - Shows user's profile picture
   - Fallback: Person icon placeholder

2. **Text Input** (center, flexible width)
   - Placeholder: "What's happening?"
   - Rounded rectangle with subtle border
   - Tappable - navigates to CreatePostScreen when tapped
   - Height: ~48-52px

3. **Action Icons** (right side, horizontal row)
   - **Image icon** - Opens image picker
   - **Calendar icon** - Opens event creation
   - **Star icon** - Opens review/movie/music selector
   - Icons: 24-28px, spaced evenly

4. **Visual Style:**
   - Background: White or very light gray (#F8F9FA)
   - Border: Subtle border (1px, #E1E1E1) or shadow
   - Padding: 12-16px horizontal, 10-12px vertical
   - Rounded corners: 12-16px

#### Interaction Behavior:
- **Tap on input area:** Navigate to `CreatePostScreen` (full screen post creation)
- **Tap on image icon:** Quick image picker (can open modal or navigate)
- **Tap on calendar icon:** Navigate to `CreateEventScreen`
- **Tap on star icon:** Open review selector modal

---

### 5. **Home Screen Tab Changes**

#### Current Tabs:
- "Activity" (left)
- "Events" (right)

#### New Tabs:
- **"For You"** (left) - Algorithmic/personalized feed
- **"Activity"** (right) - Chronological activity feed

#### Tab Styling:
- Active tab: Blue underline (#3797EF), bold text
- Inactive tab: Gray text (#8E8E93), normal weight
- Tab height: 44px
- Underline height: 2-3px
- Smooth transitions between tabs

#### Content for Each Tab:

- **"For You" Tab:**
  - **Mix of content types:** Posts, Events, Reviews
  - **Mix of accounts:** Both followed AND non-followed accounts
  - **Algorithm-driven:** Personalized based on user interests, engagement patterns
  - **Discovery focus:** Helps users discover new content and accounts
  - Similar to Instagram's "For You" or TikTok's "For You Page"

- **"Activity" Tab:**
  - **Social interactions and activity:**
    - "Liked by X followers" (when someone you follow likes something)
    - "Commented by X (following)" (when someone you follow comments)
    - "Posted by X (following)" (posts from people you follow)
    - "X followers are going to this event" (when people you follow RSVP to events)
    - Other social activity notifications
  - **Chronological:** Time-ordered (newest first)
  - **Focus:** Shows what your network is doing, not just their posts
  - Similar to Facebook's "Activity Feed" or LinkedIn's activity updates

---

## 📐 Layout Specifications

### Screen Hierarchy:
```
┌─────────────────────────────────────────┐
│ Status Bar                              │
├─────────────────────────────────────────┤
│ Header (Fixed, hides on scroll, z-index: 1000) │
│ [Profile] [Title] [Notifications]       │
├─────────────────────────────────────────┤
│ Tab Bar (Fixed, hides on scroll, z-index: 999) │
│ [For You] [Activity]                     │
├─────────────────────────────────────────┤
│ Feed Content (Scrollable)                │
│ ┌─────────────────────────────────────┐ │
│ │ Post Composer (Scrolls with feed)   │ │ ← First item in feed
│ │ [Pic] What's happening? [Icons]     │ │
│ └─────────────────────────────────────┘ │
│ - Posts                                 │
│ - Events                                │
│ - Reviews                               │
│ ...                                     │
├─────────────────────────────────────────┤
│ Bottom Tab Navigation (Fixed)            │
│ [Home] [Search] [CREATE] [Events] [Profile]│
└─────────────────────────────────────────┘
```

### Scroll Behavior Details:

**Fixed Elements (hide on scroll):**
- **Header:** Hides when scrolling down, reappears when scrolling up
- **Tab Bar:** Hides when scrolling down, reappears when scrolling up
- **Bottom Tab Navigation:** Always visible (never hides)

**Scrollable Elements:**
- **Post Composer:** First item in the feed, scrolls away naturally
- **Feed Content:** All posts, events, reviews scroll normally

### Spacing & Dimensions:
- **Header height:** 56px + safe area
- **Post composer height:** ~72-80px (including padding)
- **Tab bar height:** 44px
- **Bottom tab bar height:** 85px (with safe area)
- **Create button size:** 36-38px (vs 28-30px for others)
- **Profile pic in composer:** 40-44px diameter

---

## 🔄 Navigation Flow Changes

### Bottom Tab Navigation:
1. **Home Tab** → FeedScreen (with new structure)
2. **Search Tab** → SearchScreen (existing, now in bottom nav)
3. **Create Tab** → CreateStackNavigator (existing, larger button)
4. **Events Hub Tab** → EventsHubScreen (new dedicated screen)
5. **Profile Tab** → ProfileScreen (existing)

### Post Creation Flow:
- **Option 1:** Tap "What's happening?" input → Full CreatePostScreen
- **Option 2:** Tap Create tab → CreateStackNavigator → Choose post type
- **Option 3:** Tap image/calendar/star icons → Quick actions

---

## 🎨 Visual Design Guidelines

### Colors:
- **Primary Blue:** #3797EF (tabs, active states)
- **Secondary Blue:** #1976D2 (Create button)
- **Text Primary:** #000000
- **Text Secondary:** #8E8E93
- **Background:** #FFFFFF (main), #F8F9FA (feed)
- **Border:** #E1E1E1

### Typography:
- **Header Title:** 27px, bold (700), #3797EF
- **Tab Labels:** 16px, semibold (600)
- **Post Composer Placeholder:** 16px, regular, #8E8E93
- **Post Content:** 15-16px, regular

### Shadows & Elevation:
- **Header:** Subtle shadow (elevation: 2-4)
- **Post Composer:** Light shadow or border
- **Bottom Tab Bar:** Top shadow (elevation: 8)
- **Create Button:** Slight elevation when active

---

## 📱 Component Architecture

### New Components Needed:
1. **PostComposer** - "What's happening?" input area
   - Location: `SocialApp/components/PostComposer.js`
   - Props: `navigation`, `currentUser`, `onPostCreated` (callback)

2. **EventsHubScreen** - Dedicated events screen
   - Location: `SocialApp/screens/EventsHubScreen.js`
   - Can reuse existing EventsHub component

### Modified Components:
1. **MainTabNavigator.js**
   - Add Search tab
   - Add Events Hub tab
   - Make Create button larger
   - Reorder tabs

2. **FeedScreen.js**
   - Add PostComposer as first item in feed (scrolls with content)
   - Change tabs from "Activity/Events" to "For You/Activity"
   - Remove search icon from header
   - Add profile picture to header
   - Implement scroll-based hiding for header and tab bar
   - Post composer should NOT be fixed - it scrolls with feed

3. **ActivityFeed.js / ActivityFeedContainer.js**
   - Split into two distinct feeds:
     - **ForYouFeed:** Mix of posts/events/reviews from followed + non-followed accounts
     - **ActivityFeed:** Social interactions (likes, comments, RSVPs from network)
   - Different API endpoints or filtering logic for each

---

## 🔧 Implementation Steps

### Phase 1: Bottom Tab Navigation
1. Update `MainTabNavigator.js`:
   - Add SearchStack as tab
   - Add EventsHubScreen as tab
   - Adjust Create button size (36-38px)
   - Reorder tabs: Home, Search, Create, Events, Profile

### Phase 2: Header Updates
1. Update `FeedScreen.js` header:
   - Remove search icon
   - Add profile picture on left
   - Keep title and notifications

### Phase 3: Post Composer
1. Create `PostComposer.js` component
2. Integrate into feed content as **first item** (scrolls with feed, NOT fixed)
3. Wire up navigation to CreatePostScreen
4. Add quick action icons (image, calendar, star)
5. Ensure it scrolls away naturally when user scrolls down

### Phase 4: Tab Changes
1. Update tabs in `FeedScreen.js`:
   - Change "Activity" → "For You" (left)
   - Keep "Activity" (right)
   - Remove "Events" tab (moved to bottom nav)

2. Update content logic:
   - **"For You" tab:** 
     - Mix of posts, events, reviews
     - From both followed AND non-followed accounts
     - Algorithm-driven personalization
   - **"Activity" tab:**
     - Social interactions: "Liked by X followers", "Commented by X", "Posted by X", "X followers going to event"
     - Chronological activity feed
     - Shows what your network is doing

### Phase 5: Events Hub Screen
1. Create `EventsHubScreen.js`
2. Reuse existing `EventsHub` component
3. Add to bottom tab navigation

---

## 🎯 User Experience Improvements

### Benefits:
1. **Easier Post Creation:** "What's happening?" input is always visible at top
2. **Better Navigation:** Search and Events are now easily accessible via bottom tabs
3. **Modern Design:** Aligns with Instagram, Twitter/X, and Facebook patterns
4. **Clearer Organization:** Events have dedicated space, feed is focused on social content
5. **Prominent Create:** Larger Create button encourages content creation

### User Flows:
- **Quick Post:** Tap "What's happening?" → Type → Post
- **Search:** Tap Search tab → Search users/events
- **Browse Events:** Tap Events tab → Browse all events
- **View Feed:** Stay on Home tab → Switch between "For You" and "Activity"

---

## ⚠️ Considerations

### Backward Compatibility:
- Ensure existing navigation still works
- Update any hardcoded navigation paths
- Test deep linking

### Performance:
- PostComposer should be lightweight (no heavy renders)
- Tab switching should be smooth
- Feed scrolling should remain performant

### Accessibility:
- All icons need accessibility labels
- Tab navigation should support screen readers
- Post composer should be keyboard accessible

---

## 📝 Notes

- **"For You" Feed:** Should include both followed and non-followed accounts for discovery. If personalization isn't ready, can start with a mix of followed accounts + trending/popular content.
- **"Activity" Feed:** Focus on social interactions - what your network is doing (likes, comments, RSVPs), not just their posts. This is different from a traditional feed.
- **Post Composer:** Must scroll with feed content (NOT fixed). It's essentially the first "post" in the feed that allows quick post creation.
- **Scroll Behavior:** Header and Tab Bar hide on scroll down, show on scroll up. This gives more screen real estate for content.
- **Events Hub:** Can be a simple wrapper around existing EventsHub component
- **Create Button Size:** Start with 36px, adjust based on visual balance

---

## ✅ Checklist

- [ ] Update MainTabNavigator (5 tabs, larger Create button)
- [ ] Create PostComposer component
- [ ] Update FeedScreen header (remove search, add profile pic)
- [ ] Integrate PostComposer into FeedScreen
- [ ] Change tabs to "For You" and "Activity"
- [ ] Create EventsHubScreen
- [ ] Update navigation flows
- [ ] Test all user flows
- [ ] Update any broken navigation references
- [ ] Polish animations and transitions

---

**Ready to implement?** This plan provides a complete roadmap for the redesign. Each phase can be implemented independently, allowing for incremental updates and testing.

