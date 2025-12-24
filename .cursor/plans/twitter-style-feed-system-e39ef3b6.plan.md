---
name: Twitter-Style Feed System Implementation Plan
overview: ""
todos: []
---

# Twitter-Style Feed System Implementation Plan

## Current State Analysis

**GOOD NEWS**: Most of the infrastructure already exists! Your codebase has:

- ✅ Photo upload system (`/api/photos/create` endpoint)
- ✅ Like/Comment functionality on photos
- ✅ Activity feed system (`/api/feed/activity`)
- ✅ Friends system (not followers)
- ✅ Post details screen, comments, likes
- ✅ Posts store for state management
- ✅ Profile screen showing user posts
- ✅ Privacy controls and permissions

**The Issue**: These features are de-emphasized and event-centric. Users primarily upload to events rather than their personal feed.---

## What Already Works (No Changes Needed)

### Backend

1. **Post Creation**: `/api/photos/create` endpoint exists for non-event posts
2. **Photo Model**: Has all necessary fields (likes, comments, caption, user, etc.)
3. **Activity Feed**: `/api/feed/activity` aggregates different activity types
4. **Friends System**: Proper friends (not followers) with privacy
5. **Like/Comment Routes**: `/api/photos/like/:photoId`, `/api/photos/comment/:photoId`
6. **Privacy Middleware**: Already filters content based on friendship status

### Frontend

1. **CreatePostScreen**: Working photo upload UI (Step 1: Pick photo, Step 2: Add caption)
2. **PostsStore**: Zustand store managing post state, likes, comments
3. **PostDetails**: Full post view with comments
4. **Profile Posts Grid**: Shows user's posts in grid layout
5. **ActivityFeed Component**: Renders activity items with like/comment

---

## What Needs to Change

### 1. **Frontend: Make Personal Posts Primary**

#### Current State

- "Activity" tab shows event invitations, friend requests, event joins
- Personal posts are buried in the activity feed
- Create post is hidden or event-focused

#### Required Changes

- **FeedScreen.js**: Add a "Posts" sub-tab alongside "Activity" and "Events"
                                                                - Posts sub-tab shows ONLY friend posts (photo posts from friends)
                                                                - Activity sub-tab keeps current behavior
                                                                - Events sub-tab keeps current behavior
- **Navigation**: Make "Create Post" more prominent
                                                                - Add FAB (Floating Action Button) on Posts feed
                                                                - Or add "+" icon in header
- **ProfileScreen**: 
                                                                - Keep existing Posts tab functionality
                                                                - Ensure it shows nicely formatted photo grid
                                                                - Already working, might need minor UI polish

#### Component Structure

```javascript
FeedScreen
├── Main Tabs: [Activity, Events]
├── Sub Tabs (when Activity selected): [Posts, All Activity]
│   ├── Posts → Shows friend photo posts only
│   └── All Activity → Current activity feed
```



### 2. **Backend: Optimize Feed for Posts**

#### Current State

- `/api/feed/activity` returns mixed content (events, invitations, posts)
- Regular posts (`regular_post`) exist but are mixed with everything else

#### Required Changes

- **New Endpoint**: `/api/feed/posts` (or enhance existing)
  ```javascript
    GET /api/feed/posts
            - Returns ONLY photo posts from friends
            - Sorted by recency (newest first)
            - Includes: photo URL, caption, user info, like count, comment count, userLiked
            - Privacy filtered (friends only)
            - Pagination support
  ```


OR

- **Enhance Existing**: Modify `/api/feed/activity` to accept `?type=posts`
                                                                - When `type=posts`, return only `regular_post` and `memory_post` types
                                                                - Filter out event-related activities

### 3. **UI/UX Improvements**

#### Home Feed (Posts Tab)

- Show posts in card format (like Twitter/Instagram)
- Each post card shows:
                                                                - User avatar + username
                                                                - Photo (full width)
                                                                - Caption
                                                                - Like button + count (❤️)
                                                                - Comment button + count (💬)
                                                                - Timestamp

#### Create Post Flow

Already good! Just make more accessible:

- Add FAB on Posts feed screen
- Or prominent "+" button in header

#### Profile Screen

- Already shows posts grid ✅
- Consider adding a "Posts" count stat at top

---

## Implementation Steps

### Phase 1: Backend Feed Endpoint (2-3 hours)

**File**: `routes/feed.js`Add new endpoint or query parameter:

```javascript
router.get('/feed/posts', protect, async (req, res) => {
  // Similar to existing /feed/activity but:
  // 1. Only fetch regular_post and memory_post types
  // 2. Sort by uploadDate/createdAt desc
  // 3. Include full post data (photo, caption, user, stats)
  // 4. Privacy filter: friends only
  // 5. Pagination
});
```

This is ~100-150 lines of code, mostly copy-pasting from existing `fetchRegularPosts()` and `fetchMemoryPosts()`.

### Phase 2: Frontend Posts Sub-Tab (3-4 hours)

**File**: `SocialApp/screens/FeedScreen.js`

1. Add sub-tab system when "Activity" main tab is selected:
   ```javascript
      const SUB_TABS = ['Posts', 'All Activity'];
   ```




2. Create or use existing `PostsFeed` component:

                                                                                                - Fetch from `/api/feed/posts`
                                                                                                - Render post cards with photo, caption, like/comment
                                                                                                - Use existing `postsStore` for state management
                                                                                                - Infinite scroll pagination

3. Wire up sub-tab switching (similar to main tabs)

**Files to modify**:

- `SocialApp/screens/FeedScreen.js` (~200 lines added/modified)
- Create `SocialApp/components/PostsFeed.js` (or reuse existing) (~150-200 lines)
- Create `SocialApp/components/PostCard.js` (if doesn't exist) (~100-150 lines)

### Phase 3: Create Post Access (1-2 hours)

**Files**:

- `SocialApp/screens/FeedScreen.js`: Add FAB or header button
- Navigation: Ensure `CreatePostScreen` is accessible

Simply add:

```javascript
<TouchableOpacity 
  style={styles.fab}
  onPress={() => navigation.navigate('CreatePostScreen')}
>
  <Ionicons name="add" size={30} color="#fff" />
</TouchableOpacity>
```



### Phase 4: Polish & Testing (2-3 hours)

- Test feed loading, pagination
- Test like/comment on posts feed
- Test privacy (only friends' posts show)
- UI polish (spacing, colors, animations)
- Handle edge cases (no friends, no posts)

---

## Time Estimation

| Phase | Task | Hours ||-------|------|-------|| 1 | Backend posts feed endpoint | 2-3 || 2 | Frontend sub-tab + posts feed | 3-4 || 3 | Create post button/access | 1-2 || 4 | Polish, testing, bug fixes | 2-3 || **TOTAL** | | **8-12 hours** |

### Breakdown by Developer Level

- **Experienced Developer**: 8-10 hours (familiar with codebase)
- **Mid-Level Developer**: 10-14 hours (some learning curve)
- **Junior Developer**: 14-18 hours (more research/debugging)

---

## Key Design Decisions

### 1. Friends-Only Feed

Since you use a friends system (not followers), posts will only show from accepted friends. This is more private than Twitter but similar to early Facebook.

### 2. Sub-Tab Approach

Rather than replacing the Activity feed, add Posts as a sub-tab. This preserves existing functionality while adding the new feature.**Alternative**: Make Posts a main tab, move Activity under Events. This is more aggressive but cleaner.

### 3. Post Types

- **Regular Posts**: Personal photos uploaded via `/photos/create`
- **Memory Posts**: Photos from shared memories (already implemented)
- Both appear in feed

### 4. No Retweets/Shares (For Now)

Keep it simple initially. Users post photos, like, comment. Sharing can be added later.---

## Files to Modify

### Backend (3 files)

1. `routes/feed.js` - Add posts endpoint or enhance existing (~100-150 lines)
2. `models/Photo.js` - Maybe add indexes for performance (minimal)
3. `routes/photos.js` - Already complete ✅

### Frontend (4-6 files)

1. `SocialApp/screens/FeedScreen.js` - Add sub-tabs, wire up posts feed (~200 lines)
2. `SocialApp/components/PostsFeed.js` - New component or modify existing (~150-200 lines)
3. `SocialApp/components/PostCard.js` - Individual post card (~100-150 lines)
4. `SocialApp/screens/CreatePostScreen.js` - Minor tweaks if needed (~20 lines)
5. `SocialApp/navigation/MainTabs.js` - Add create post navigation (~10 lines)
6. `SocialApp/stores/postsStore.js` - Already complete ✅

---

## Alternative: Simpler Approach (6-8 hours)

If you want the absolute minimum viable version:

1. **Backend**: Modify existing `/api/feed/activity` to accept `?filter=posts`

                                                                                                - Just filter the activity types to `regular_post` and `memory_post`
                                                                                                - **2 hours**

2. **Frontend**: Replace "Activity" tab content with a posts-only feed

                                                                                                - Fetch `/api/feed/activity?filter=posts`
                                                                                                - Render using existing `ActivityFeed` component
                                                                                                - **2 hours**

3. **Add Create Button**: FAB on feed screen

                                                                                                - **1 hour**

4. **Polish**: Test and fix bugs

                                                                                                - **1-3 hours**

This gives you a Twitter-style feed in **6-8 hours** but loses the full activity feed (you'd need to move that elsewhere).---

## Recommendations

1. **Start with Sub-Tab Approach**: Preserves all existing functionality
2. **Build Backend Endpoint First**: Get data flowing correctly
3. **Reuse Existing Components**: `PostCard`, `ActivityFeed` patterns
4. **Test Privacy**: Ensure only friends' posts show
5. **Consider Memory Posts**: They're already implemented, include them

---

## What This Gets You

After implementation:

- ✅ Home feed shows photos from friends
- ✅ Users can post photos with captions
- ✅ Like and comment on posts
- ✅ Privacy-controlled (friends only)
- ✅ Profile shows user's posts in grid
- ✅ Post detail view with full comments
- ✅ Activity feed still works (events, invitations, etc.)

Essentially: **Twitter + Instagram hybrid for your social event app**.