# Feed Template Screen Guide

## Overview

The `FeedTemplateScreen` is a debugging tool that displays examples of all post types that can appear in the For You and Activity feeds.

## Accessing the Template Screen

### Option 1: Via Navigation (Recommended)
Add a button or link in your app to navigate to the template screen:

```javascript
navigation.navigate('FeedTemplateScreen');
```

### Option 2: Direct Import
Import and use the component directly:

```javascript
import FeedTemplateScreen from './screens/FeedTemplateScreen';

// Use in your navigation or as a standalone screen
```

## Post Types Shown

The template screen displays examples of all 13 post types:

### 1. Regular Post (Photo)
- **Type**: `regular_post`
- **Shows**: Photo with caption, user info, engagement metrics
- **Can include**: Event context badge

### 2. Text Post
- **Type**: `text_post`
- **Shows**: Text content only, no images
- **Features**: Like and comment functionality

### 3. Text + Photo Post
- **Type**: `regular_post` with both text and photo
- **Shows**: Caption + image
- **Common**: Most common post type

### 4. Review Post
- **Type**: `review_post`
- **Shows**: Movie/song review card with:
  - Media poster/album art placeholder
  - Title, artist/director, year
  - Star rating (1-5)
  - Genre tags
  - Review text caption

### 5. Photo Comment Activity
- **Type**: `photo_comment`
- **Shows**: "X commented on Y's photo"
- **Displays**: Comment text + original photo preview

### 6. Memory Post
- **Type**: `memory_post`
- **Shows**: Photo from shared memory
- **Features**: Memory badge, caption, engagement metrics

### 7. Memory Photo Comment
- **Type**: `memory_photo_comment`
- **Shows**: "X commented on a photo in Memory Y"
- **Displays**: Comment text + memory photo preview

### 8. Event Invitation
- **Type**: `event_invitation`
- **Shows**: Event card with invitation message
- **Features**: Event cover image, title, time, inviter info

### 9. Friend Event Join
- **Type**: `friend_event_join`
- **Shows**: "X and Y are going to event Z"
- **Displays**: Event card with friend avatars

### 10. Event Created
- **Type**: `event_created`
- **Shows**: "X created event Y"
- **Displays**: Event card with details

### 11. Event Reminder
- **Type**: `event_reminder`
- **Shows**: "Event starts in X hours"
- **Features**: Urgent styling, countdown timer

### 12. Memory Created
- **Type**: `memory_created`
- **Shows**: "X created memory Y"
- **Displays**: Memory card with description

### 13. Memory Photo Upload
- **Type**: `memory_photo_upload`
- **Shows**: "X added a photo to memory Y"
- **Displays**: Photo preview

## Using for Debugging

### Check Post Structure
1. Open the template screen
2. Compare template structure with actual feed posts
3. Verify all fields are present and correctly formatted

### Test Rendering
1. Use template as reference for expected UI
2. Compare with actual `PostActivityComponent` rendering
3. Identify missing or incorrectly displayed fields

### Validate Activity Types
1. Ensure all activity types are represented
2. Check that routing in `ActivityList.js` matches template
3. Verify component mapping is correct

## Integration with FeedScreen

To add a debug button to FeedScreen (for development only):

```javascript
// In FeedScreen.js, add to header or as a debug button
<TouchableOpacity
  onPress={() => navigation.navigate('FeedTemplateScreen')}
  style={styles.debugButton}
>
  <Text>View Templates</Text>
</TouchableOpacity>
```

## Notes

- Template uses placeholder data (not real posts)
- Images are shown as placeholders with icons
- All timestamps are set to "2h ago" for consistency
- Engagement metrics (likes/comments) are example numbers
- Template is for visual reference only, not functional

## Related Files

- `FEED_LOGIC_EXPLANATION.md` - Detailed feed logic documentation
- `SocialApp/components/ActivityList.js` - Activity routing logic
- `SocialApp/components/PostActivityComponent.js` - Post rendering component
- `routes/feed.js` - Backend feed endpoint


