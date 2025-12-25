# Twitter Features Setup Guide

This guide covers the manual setup steps needed for the Twitter-like features (posts, reviews, etc.).

## Quick Setup Checklist

- [x] Install dependencies (`npm install` - axios was added)
- [ ] Add API keys to `.env` file (TMDB and Spotify - optional)
- [ ] Restart backend server after adding API keys
- [ ] Test creating a text post
- [ ] Test creating a review post
- [ ] Verify Posts and Photos tabs appear on profile

## 1. Environment Variables Setup

### Location
Add these variables to your **root `.env` file** (same directory as `server.js`):

```bash
# Movie Reviews API (TMDB)
TMDB_API_KEY=your_tmdb_api_key_here

# Song Reviews API (Spotify)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### Getting API Keys

#### TMDB (Movies) - FREE
1. Go to https://www.themoviedb.org/
2. Sign up for a free account
3. Go to Settings → API
4. Request an API key (automatic approval)
5. Copy the API key to your `.env` file

**Rate Limits:** Free tier allows 40 requests per 10 seconds

#### Spotify (Songs) - FREE
1. Go to https://developer.spotify.com/
2. Log in with your Spotify account
3. Go to Dashboard: https://developer.spotify.com/dashboard
4. Click "Create an app"
5. Fill in app name/description and save
6. Copy **Client ID** and **Client Secret** to your `.env` file

**Rate Limits:** Very generous for development use

### Testing Without API Keys

**Good news:** The app works without API keys! It will use mock data:
- Movie searches return sample results (e.g., "Inception")
- Song searches return sample results (e.g., "Bohemian Rhapsody")

This lets you test the feature immediately. Add real API keys later for production.

## 2. Manual Steps After Implementation

### Step 1: Install Dependencies
The new review services require `axios`. Install it:
```bash
npm install
```
This will install `axios` (and any other missing dependencies).

### Step 2: Restart Backend Server
After adding API keys to `.env`, restart your server:

```bash
# Stop server (Ctrl+C) and restart
npm start
# or
node server.js
```

### Step 2: Verify Database Schema
The Photo model has been updated with new fields. If you have existing data:
- **New fields are optional** - existing posts will continue to work
- **No migration needed** - MongoDB will add fields automatically when new posts are created
- **Indexes are created automatically** on first server start

### Step 3: Test the Features

#### Test Text Posts
1. Open Create Post screen
2. Type some text (no photo needed)
3. Tap "Post"
4. Verify it appears in your feed and profile

#### Test Reviews
1. Open Create Post screen
2. Tap the movie icon (🎬) or music icon (🎵)
3. Search for a movie/song
4. Select one and rate it (1-5 stars)
5. Add optional text
6. Post it
7. Verify the review card appears in the post

#### Test Profile Tabs
1. Go to any profile
2. Verify you see tabs: **Posts**, **Photos**, **Events**, **Memories**
3. **Posts tab:** Shows all posts chronologically (Twitter-style)
4. **Photos tab:** Shows photos in grid (Instagram-style)

## 3. What Changed

### Backend Changes
- ✅ `models/Photo.js` - Added new fields (postType, textContent, review, etc.)
- ✅ `routes/photos.js` - Added text post and repost endpoints
- ✅ `routes/reviews.js` - NEW: Movie/song search endpoints
- ✅ `services/tmdbService.js` - NEW: TMDB API integration
- ✅ `services/spotifyService.js` - NEW: Spotify API integration
- ✅ `middleware/privacy.js` - Simplified (all posts public by default)
- ✅ `routes/feed.js` - Updated to prioritize posts
- ✅ `routes/profile.js` - Returns all posts (public by default)

### Frontend Changes
- ✅ `screens/CreatePostScreen.js` - Complete redesign (Twitter-style)
- ✅ `screens/ProfileScreen.js` - Added Posts and Photos tabs
- ✅ `components/PostCard.js` - NEW: Display all post types
- ✅ `components/PhotoGrid.js` - NEW: Instagram-style grid
- ✅ `components/ReviewCard.js` - NEW: Display reviews
- ✅ `components/MovieReviewSelector.js` - NEW: Movie search/selection
- ✅ `components/SongReviewSelector.js` - NEW: Song search/selection

## 4. Troubleshooting

### Reviews Not Working?
- **Check API keys** in `.env` file
- **Restart server** after adding keys
- **Check console logs** - services log warnings if keys are missing
- **Try mock data** - remove API keys to test with sample data

### Posts Not Showing?
- **Check privacy settings** - all posts should be public by default
- **Verify database** - check if posts have `postType` field
- **Check feed endpoint** - `/api/feed/activity` should include posts

### Profile Tabs Missing?
- **Clear app cache** and restart
- **Check ProfileScreen** - tabs array should include 'Posts' and 'Photos'
- **Verify posts data** - profile endpoint should return posts array

## 5. Next Steps (Optional)

### Production Considerations
1. **Add API keys** for real movie/song data
2. **Set up rate limiting** for review endpoints
3. **Add caching** for popular searches
4. **Monitor API usage** to stay within free tier limits

### Future Enhancements
- Repost button UI component (backend is ready)
- Share functionality
- Post analytics
- Advanced feed algorithms

## 6. API Endpoints Reference

### New Endpoints

**Text Posts:**
- `POST /api/photos/create-text` - Create text-only post

**Reviews:**
- `GET /api/reviews/search-movies?query=...` - Search movies
- `GET /api/reviews/movie/:tmdbId` - Get movie details
- `GET /api/reviews/search-songs?query=...` - Search songs
- `GET /api/reviews/song/:spotifyId` - Get song details

**Reposts:**
- `POST /api/photos/repost/:postId` - Create repost
- `DELETE /api/photos/repost/:postId` - Remove repost

All endpoints require authentication (Bearer token).

---

**Need Help?** Check the console logs - all services log helpful messages about API key status and errors.

