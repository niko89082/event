# How to View Feed Template Designs

## Quick Access

The Feed Template Screen is already set up and ready to view! Here are the ways to access it:

### Method 1: Long-Press on Header Title (Easiest)
1. Open the app and navigate to the **Feed Screen**
2. **Long-press** on the "Social Events" title in the header
3. The template screen will open automatically

### Method 2: Via Code Navigation
If you want to add a button or access it programmatically:

```javascript
// From any screen in the FeedStack
navigation.navigate('FeedTemplateScreen');
```

### Method 3: Add a Debug Button (Optional)
You can add a visible button in `FeedScreen.js` for easier access:

```javascript
// Add this button next to the notification button
<TouchableOpacity 
  style={styles.templateButton}
  onPress={() => navigation.navigate('FeedTemplateScreen')}
>
  <Ionicons name="document-text-outline" size={24} color="#000000" />
</TouchableOpacity>
```

## What You'll See

The template screen shows examples of all post types:

1. **Regular Post (Photo)** - Photo with caption
2. **Text Post** - Text-only post
3. **Text + Photo Post** - Combined content
4. **Review Post** - Movie/song review with rating
5. **Photo Comment Activity** - Comment on a photo
6. **Memory Post** - Memory photo (if enabled)
7. **Memory Photo Comment** - Comment on memory
8. **Event Invitation** - Event invite card
9. **Friend Event Join** - Friends joining events
10. **Event Created** - New event announcement
11. **Event Reminder** - Upcoming event alert
12. **Memory Created** - New memory announcement
13. **Memory Photo Upload** - Photo added to memory

## Notes

- The template uses **placeholder data** (not real posts)
- Images show as **placeholders with icons**
- All timestamps are set to "2h ago" for consistency
- This is a **debugging/design reference tool** only

## File Location

- Template Screen: `SocialApp/screens/FeedTemplateScreen.js`
- Navigation: Already added to `SocialApp/navigation/FeedStack.js`
- Guide: `FEED_TEMPLATE_GUIDE.md`

## Troubleshooting

If the long-press doesn't work:
1. Make sure you're on the Feed Screen (not another tab)
2. Long-press directly on the "Social Events" text
3. Check console for any navigation errors

If you want to remove the long-press feature:
- Just change `TouchableOpacity` back to `View` in `FeedScreen.js` header title sections


