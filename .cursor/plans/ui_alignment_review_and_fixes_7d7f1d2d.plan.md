---
name: UI Alignment Review and Fixes
overview: Comprehensive review of UI alignment issues across all user-facing screens with specific recommendations for spacing, alignment, and visual consistency improvements.
todos: []
---

# UI Alignmen

t Review and Fixes

## Overview

This plan identifies alignment issues, spacing inconsistencies, and UI improvements needed across all user-facing screens in the React Native app.

## Critical Alignment Issues by Screen

### 1. FeedScreen (Main Home Feed)

**Issues:**

- **Header alignment**: The "Social" title container has inconsistent vertical centering with search/notification buttons
- **Tab bar positioning**: Main tabs (Activity/Events) have inconsistent spacing from header (currently 8px gap, should be standardized)
- **Sub-tab overlap risk**: Sub-tabs in EventsHub positioned at 144px may overlap with main tabs when scrolling
- **Tab button alignment**: Tab buttons have inconsistent padding (reduced to 28px height but padding calculations may cause misalignment)
- **Content padding**: ActivityFeed content starts immediately without proper top padding to account for animated tab bars

**Recommendations:**

- Standardize header height to exactly 56px with consistent vertical centering
- Increase gap between main tabs and sub-tabs to minimum 16px clearance
- Use consistent padding scale (4px increments) for all tab elements
- Add proper content padding top that accounts for both header and tab bar heights

### 2. ProfileScreen

**Issues:**

- **Stats container alignment**: Stats container uses 90% width with center alignment, but numbers and labels may not align perfectly
- **Profile image centering**: Avatar section has marginBottom: 16 but no explicit horizontal centering constraints
- **Tab bar alignment**: Tab bar has paddingTop: 16 which creates inconsistent spacing from profile header
- **Event/Memory cards**: Cards in grid have inconsistent margins (marginBottom: 16) but no horizontal alignment standardization
- **Action buttons row**: Edit Profile button and QR button have gap: 8 but different flex values causing misalignment
- **Bio text alignment**: Bio has maxWidth: 280 but no explicit center alignment

**Recommendations:**

- Use flexbox with explicit alignItems: 'center' for stats container
- Standardize card margins to 16px horizontal, 12px vertical
- Align tab bar to use consistent 12px padding from profile header
- Use consistent button heights (48px) for all action buttons
- Center bio text explicitly with textAlign: 'center' and remove maxWidth constraint

### 3. EventDetailsScreen

**Issues:**

- **Back button positioning**: Back button positioned at top: 50px which may not account for safe area on all devices
- **Cover image overlap**: Content container has negative marginTop causing overlap calculations that may be inconsistent
- **Badge row alignment**: Integrated badge row uses flexDirection: 'row' with space-between but badges may not align properly
- **Detail cards**: Detail cards have marginLeft: 36 for content but icons are at different positions
- **Attendee photos**: Attendee photo row has gap: 8 but photos may not align with text below
- **Bottom action bar**: Bottom bar positioned absolutely at bottom: 20px but may overlap with safe area insets
- **Price badge alignment**: Price badge in integrated row may not align with left badges vertically

**Recommendations:**

- Use SafeAreaView insets for back button positioning instead of fixed 50px
- Standardize content overlap to exactly 40% of cover image height
- Align all detail card content to start at same left position (use consistent icon + marginLeft pattern)
- Use flexbox with alignItems: 'center' for attendee photos row
- Account for safe area bottom inset in bottom action bar positioning
- Vertically center all badges in integrated badge row

### 4. PostDetailsScreen

**Issues:**

- **Header alignment**: Custom header has paddingVertical: 12 but buttons may not align with title
- **Author section**: Author info has paddingVertical: 12 but avatar and text may not align perfectly
- **Event context alignment**: Event context text appears below username but spacing (marginTop: 2) may be too tight
- **Like count alignment**: Like count positioned with marginLeft: 4 but may not align with heart icon properly
- **Comment items**: Comment avatars are 32px with marginRight: 12, but comment bubbles may not align with avatar baseline
- **Comment input**: Input container has paddingVertical: 12 but avatar, input, and button may not align vertically
- **Action buttons row**: Left actions have marginRight: 15 but spacing between buttons is inconsistent

**Recommendations:**

- Use flexbox with alignItems: 'center' for header row
- Standardize avatar + text alignment with consistent marginRight: 12
- Increase event context marginTop to 4px for better visual separation
- Align like count with heart icon using flexDirection: 'row' and alignItems: 'center'
- Use consistent vertical alignment for comment items (alignItems: 'flex-start' for multi-line)
- Center-align comment input row elements vertically
- Use consistent gap: 12 for all action button spacing

### 5. CreateEventScreen

**Issues:**

- **Cover section**: Cover section has height: 200 but overlay button positioned at bottom: 16, right: 16 may not align
- **Form sections**: Sections have marginBottom: 32 but input groups have marginBottom: 20 creating inconsistent spacing
- **Date/Time row**: DateTimeRow uses gap: 12 but buttons have flex: 1 with marginRight: 8 and marginLeft: 8 creating asymmetry
- **Privacy button**: Privacy button content uses flexDirection: 'row' but icon, text, and chevron may not align vertically
- **Co-host items**: Co-host items have padding: 12 but avatar (40px) and text may not align properly
- **Modal content**: Modals have paddingBottom: 34 but header has paddingVertical: 16 creating inconsistent spacing
- **Category modal items**: Category items have paddingVertical: 16 but text and checkmark may not align

**Recommendations:**

- Standardize section spacing to 24px between major sections, 16px between input groups
- Use consistent gap values (8px or 12px) instead of mixing marginLeft/marginRight
- Center-align all button content vertically using alignItems: 'center'
- Use consistent avatar + text alignment pattern (40px avatar, 12px marginRight)
- Standardize modal padding to 16px horizontal, 20px vertical
- Align modal list items with consistent padding and vertical centering

### 6. NotificationScreen

**Issues:**

- **Notification items**: Items have paddingVertical: 18 but icon container (48px) may not align with text content
- **Friend request actions**: Action buttons have gap: 12 but buttons may not align with notification content
- **Icon container**: Icon container has marginTop: 4 which creates misalignment with first line of text
- **Notification content**: Content uses flex: 1 but text container has marginBottom: 8 creating inconsistent spacing
- **Empty state**: Empty state has paddingVertical: 60 but icon, title, and subtitle may not be perfectly centered
- **Section headers**: Section headers have paddingVertical: 12 but icon and text may not align

**Recommendations:**

- Remove marginTop: 4 from icon container, use alignItems: 'flex-start' for notification row
- Standardize notification item padding to 16px vertical, 20px horizontal
- Align friend request action buttons with notification content using consistent margins
- Center empty state content with flex: 1, justifyContent: 'center', alignItems: 'center'
- Use consistent icon + text alignment in section headers (alignItems: 'center')

### 7. SearchScreen

**Issues:**

- **Search input**: Input container has paddingVertical: 10 but icon and input may not align vertically
- **Tab container**: Tabs have paddingVertical: 12 but active tab indicator may not align with text
- **User rows**: User rows have paddingVertical: 12 but avatar (50px), text, and button may not align
- **Action buttons**: Action buttons have paddingVertical: 6 but icon and text may not align
- **Event rows**: Event image (50px) and event info may not align at top
- **Section headers**: Section headers have paddingVertical: 8 but may not align with content below
- **Empty states**: Empty states have paddingVertical: 60 but content may not be perfectly centered

**Recommendations:**

- Center-align search input row elements vertically
- Align tab text and indicator using consistent padding and border positioning
- Use flexbox with alignItems: 'center' for user rows
- Center-align action button content (icon + text)
- Align event image and info to top using alignItems: 'flex-start'
- Standardize section header spacing to 12px vertical
- Use consistent centering for all empty states

### 8. CreatePostScreen

**Issues:**

- **Step indicator**: Step dots are 32px but connectors have width: 60 creating potential misalignment
- **Progress bar**: Progress bar has paddingHorizontal: 40 but may not align with step indicator
- **Photo preview**: Preview image is 200x200 but container may have inconsistent padding
- **Caption input**: Input has minHeight: 120 but character count may not align with input
- **Event selector**: Selector has padding: 16 but icon, text, and chevron may not align
- **Step actions**: Action buttons have gap: 12 but Back and Share buttons may have different heights
- **Modal header**: Modal header has paddingVertical: 16 but Cancel, Title, and Clear may not align

**Recommendations:**

- Align step indicator and progress bar to same horizontal padding
- Center photo preview with consistent margins
- Right-align character count with input using flexDirection: 'row', justifyContent: 'space-between'
- Center-align event selector content vertically
- Standardize button heights to 48px for all action buttons
- Center-align modal header content vertically

## Cross-Screen Consistency Issues

### Spacing System

**Current Problems:**

- Mixed use of 8px, 12px, 16px, 20px, 24px, 32px without clear hierarchy
- Some screens use gap property, others use marginLeft/marginRight
- Inconsistent padding between similar components

**Recommendations:**

- Establish 4px base spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48
- Use gap property consistently for flexbox rows
- Standardize: 16px for card padding, 12px for list item padding, 8px for tight spacing

### Typography Alignment

**Current Problems:**

- Text elements have inconsistent lineHeight values
- Some text uses textAlign: 'center', others rely on container alignment
- Font sizes vary (12, 13, 14, 16, 18, 20, 24, 28) without clear hierarchy

**Recommendations:**

- Standardize lineHeight to 1.2x font size for single line, 1.5x for multi-line
- Use explicit textAlign properties instead of relying on container alignment
- Establish typography scale: 12 (caption), 14 (body), 16 (body large), 18 (subheading), 20 (heading), 24 (title)

### Button Alignment

**Current Problems:**

- Button heights vary: 28px, 32px, 40px, 44px, 48px
- Icon + text alignment inconsistent across buttons
- Padding values vary: paddingVertical 6-16px, paddingHorizontal 12-24px

**Recommendations:**

- Standardize primary button: 48px height, 16px vertical padding, 24px horizontal padding
- Standardize secondary button: 44px height, 12px vertical padding, 20px horizontal padding
- Use flexDirection: 'row', alignItems: 'center', gap: 8 for all icon + text buttons

### Card/Item Alignment

**Current Problems:**

- Card padding varies: 12px, 16px, 20px
- Border radius inconsistent: 8px, 12px, 16px, 20px
- Image aspect ratios not standardized

**Recommendations:**

- Standardize card padding to 16px
- Use consistent border radius: 12px for cards, 8px for small elements, 16px for large cards
- Standardize image containers with consistent aspect ratios

### Header Alignment

**Current Problems:**

- Header heights vary: 56px, variable based on safe area
- Back button positioning inconsistent
- Title centering methods vary (flex: 1 vs absolute positioning)

**Recommendations:**

- Standardize header to 56px + safe area top
- Use consistent back button: 40px square, 16px from left edge
- Center titles using flex: 1 with textAlign: 'center'

### Modal Alignment

**Current Problems:**

- Modal padding inconsistent: 16px, 20px, 32px
- Header alignment varies
- Content padding not standardized

**Recommendations:**

- Standardize modal padding: 20px horizontal, 16px vertical
- Use consistent header: 56px height, 16px horizontal padding
- Standardize list item padding: 16px vertical, 20px horizontal

## Priority Fixes

### High Priority (Affects Core UX)

1. FeedScreen tab bar overlap prevention
2. ProfileScreen stats container alignment
3. EventDetailsScreen detail card content alignment
4. PostDetailsScreen comment alignment
5. Cross-screen button height standardization

### Medium Priority (Visual Polish)

1. Consistent spacing system implementation
2. Typography alignment standardization
3. Card padding consistency
4. Modal alignment fixes
5. Header alignment standardization

### Low Priority (Refinement)

1. Empty state centering improvements
2. Icon + text alignment refinements