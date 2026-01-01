# Feed Logic Explanation: For You vs Activity Feeds

## Overview

The app has two main feed types displayed in tabs on the FeedScreen:
1. **For You** - Personalized feed (intended to show mixed content from followed + non-followed accounts)
2. **Activity** - Social interactions feed (shows what your network is doing)

## Current Implementation

### Backend Endpoint
Both feeds use the **same endpoint**: `/api/feed/activity` but with different `feedType` parameters

**For You Feed:**
- Calls: `GET /api/feed/activity?page=1&limit=15&feedType=for-you`
- ✅ **Backend now respects** the `feedType` parameter
- Returns **only posts** from all users (not just followed)
- Shows: regular_post, text_post, review_post
- **Excludes**: Activity items (comments, likes, joins, invitations)
- **Privacy**: Only public posts (no followers-only or private)

**Activity Feed:**
- Calls: `GET /api/feed/activity?page=1&limit=15` (or `feedType=activity`)
- Returns **friend-based activities** only
- Shows: Posts from followed users, comments from friends, event joins, invitations, event creations
- **Excludes**: Memories, event reminders (notifications only)

### Activity Types Fetched

The backend fetches these activity types (from `routes/feed.js`):

#### Post Types (High Priority)
1. **regular_post** - Photo posts from followed users
   - Weight: 2.0, Priority: high, Max Age: 7 days
   - Includes: photos with captions, event context

2. **text_post** - Text-only posts
   - Weight: 2.0, Priority: high, Max Age: 7 days
   - Includes: text content, no images

3. **review_post** - Review posts (movies/songs)
   - Weight: 2.2, Priority: high, Max Age: 7 days
   - Includes: rating, media info, poster/album art

#### Social Interaction Types (Activity Feed Only)
4. **photo_comment** - Comments on regular photos
   - Weight: 1.2, Priority: medium, Max Age: 7 days
   - Shows: "X commented on Y's photo"
   - **Only in Activity feed** (friend-based)

5. **event_invitation** - Event invitations
   - Weight: 2.0, Priority: high, Max Age: 14 days
   - Shows: "X invited you to event Y"
   - **Only in Activity feed**

6. **friend_event_join** - Friends joining events
   - Weight: 1.1, Priority: medium, Max Age: 3 days
   - Shows: "X and Y are going to event Z"
   - **Only in Activity feed**

7. **event_created** - New events created
   - Weight: 1.3, Priority: medium, Max Age: 7 days
   - Shows: "X created event Y"
   - **Only in Activity feed** (from followed users)

8. **friend_cohost_added** - Co-host added to event
   - Weight: 1.3, Priority: medium, Max Age: 7 days
   - Shows: "X added Y as co-host to event Z"
   - **Only in Activity feed**

#### ❌ Removed from Feeds
- **event_reminder** - Moved to notifications only (not in feed)
- **memory_post, memory_created, memory_photo_upload, memory_photo_comment** - Not in initial release

### Scoring Algorithm

Activities are scored using `calculateActivityScore()`:

```javascript
score = recencyScore × priorityMultiplier × engagementScore × weight
```

Where:
- **recencyScore**: Exponential decay based on age (hours)
- **priorityMultiplier**: high=2.0, medium=1.0, low=0.5
- **engagementScore**: Based on likes/comments (logarithmic)
- **weight**: Activity type weight (from ACTIVITY_TYPES config)

Activities are then:
1. Filtered by maxAge (removed if too old)
2. Sorted by score (highest first)
3. Then by timestamp (newest first) if scores are equal
4. Paginated (15 per page)

### Privacy Filtering

All activities respect privacy settings:
- **Public events**: Visible to everyone
- **Followers-only events**: Visible if user follows the host
- **Private events**: Completely excluded from feeds
- **Personal posts**: Visible if user follows the poster

## Frontend Rendering

### Component Structure

```
FeedScreen
├── ForYouFeed (tab 0)
│   └── ActivityList
│       ├── PostComposer (header)
│       └── Activities (rendered by type)
│
└── ActivityFeed (tab 1)
    └── ActivityList
        ├── PostComposer (header)
        └── Activities (rendered by type)
```

### Activity Rendering Logic

`ActivityList.js` routes activities to specific components:

- **regular_post, text_post, review_post, memory_post** → `PostActivityComponent`
- **memory_photo_upload** → `MemoryPostActivityComponent`
- **photo_comment** → `PhotoCommentActivity`
- **memory_photo_comment** → `MemoryPhotoCommentActivity`
- **event_invitation** → `EventInvitationActivity`
- **event_created** → `EventCreatedActivityAlternative`
- **friend_event_join** → `FriendEventActivityRedesigned`
- **event_reminder** → `EventReminderActivity`
- **memory_created** → `MemoryCreatedActivity`
- **friend_cohost_added** → (handled by activity store)

### PostActivityComponent

Handles rendering of:
- **regular_post**: Photo + caption
- **text_post**: Text only (no image)
- **review_post**: Review card with rating + media info
- **memory_post**: Memory photo with badge

All post types include:
- User header (avatar, username, timestamp)
- Caption/text content
- Image (if applicable)
- Comments section (latest comment + input)
- Like/comment counts

## Key Differences (Intended vs Current)

### Current Behavior (✅ Implemented)

**For You Feed:**
- ✅ Shows posts from all users (not just followed)
- ✅ Algorithm-driven personalization (scored by engagement)
- ✅ Only posts (regular_post, text_post, review_post)
- ✅ Excludes activity items (comments, likes, joins)
- ✅ Only public posts (no followers-only or private)
- ✅ Backend respects `feedType=for-you` parameter

**Activity Feed:**
- ✅ Shows friend-based activities only
- ✅ Posts from followed users
- ✅ Social interactions (comments, joins, invitations)
- ✅ Excludes memories and event reminders
- ✅ Backend respects `feedType=activity` (or no parameter)

## Data Flow

```
User opens FeedScreen
  ↓
Selects "For You" or "Activity" tab
  ↓
Component calls API: GET /api/feed/activity
  ↓
Backend fetches all activity types in parallel:
  - fetchRegularPosts()
  - fetchMemoryPosts()
  - fetchPhotoComments()
  - fetchMemoryPhotoComments()
  - fetchEventInvitations()
  - fetchFriendEventJoins()
  - fetchEventReminders()
  - fetchMemoriesCreated()
  - fetchEventCreations()
  - fetchMemoryPhotoUploads()
  - fetchCoHostActivities()
  ↓
Backend combines all activities
  ↓
Filters by maxAge
  ↓
Calculates scores
  ↓
Sorts by score, then timestamp
  ↓
Paginates (15 per page)
  ↓
Returns to frontend
  ↓
ActivityList renders each activity by type
  ↓
User sees feed
```

## Post Type Structures

### regular_post
```javascript
{
  _id: "photo_id",
  activityType: "regular_post",
  user: { _id, username, profilePicture, fullName },
  paths: ["/uploads/photos/..."],
  caption: "Post caption text",
  postType: "photo",
  event: { _id, title, time, location } | null,
  userLiked: boolean,
  likeCount: number,
  commentCount: number,
  timestamp: Date,
  score: number
}
```

### text_post
```javascript
{
  _id: "photo_id",
  activityType: "text_post",
  user: { _id, username, profilePicture, fullName },
  textContent: "Text post content...",
  postType: "text",
  caption: "Same as textContent",
  userLiked: boolean,
  likeCount: number,
  commentCount: number,
  timestamp: Date,
  score: number
}
```

### review_post
```javascript
{
  _id: "photo_id",
  activityType: "review_post",
  user: { _id, username, profilePicture, fullName },
  postType: "photo",
  review: {
    type: "movie" | "song",
    mediaId: "tmdb_123",
    title: "Movie Title",
    artist: "Director Name",
    year: 2024,
    poster: "https://...",
    rating: 4.5,
    ratingType: "stars",
    genre: ["Action", "Drama"],
    duration: 120,
    externalUrl: "https://..."
  },
  caption: "My review text...",
  paths: ["/uploads/photos/..."], // Optional: review with photo
  userLiked: boolean,
  likeCount: number,
  commentCount: number,
  timestamp: Date,
  score: number
}
```

### photo_comment
```javascript
{
  _id: "photo_comment_comment_id",
  activityType: "photo_comment",
  timestamp: Date,
  data: {
    comment: {
      _id: "comment_id",
      text: "Comment text",
      createdAt: Date
    },
    photo: {
      _id: "photo_id",
      url: "/uploads/photos/...",
      caption: "Photo caption"
    },
    commenter: { _id, username, fullName, profilePicture },
    photoOwner: { _id, username, fullName, profilePicture }
  },
  score: number
}
```

### memory_photo_upload
```javascript
{
  _id: "memory_photo_upload_photo_id",
  activityType: "memory_photo_upload",
  timestamp: Date,
  data: {
    photo: {
      _id: "photo_id",
      url: "/uploads/memory-photos/...",
      caption: "Memory caption",
      likeCount: number,
      commentCount: number
    },
    memory: {
      _id: "memory_id",
      title: "Memory Title",
      creator: "user_id"
    },
    uploader: { _id, username, fullName, profilePicture }
  },
  score: number
}
```

## Recommendations

1. **Differentiate Feeds**: Backend should respect `feedType` parameter
   - For You: Include posts from non-followed accounts, prioritize engagement
   - Activity: Filter to interaction types only (comments, joins, invitations)

2. **Separate Endpoints**: Consider creating `/api/feed/for-you` and `/api/feed/activity`

3. **Feed-Specific Scoring**: Different scoring algorithms for each feed type

4. **Content Filtering**: Activity feed should exclude regular posts, focus on interactions

