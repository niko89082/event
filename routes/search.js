const express  = require('express');
const chrono   = require('chrono-node');
const Event    = require('../models/Event');
const User     = require('../models/User');
const Photo    = require('../models/Photo');
const protect  = require('../middleware/auth');
const SearchService = require('../services/searchService');

const router = express.Router();

/* ───── helpers ────────────────────────────────────────────── */

const buildDateFilter = (raw) => {
  if (!raw) return null;
  const parsed = chrono.parseDate(raw);
  if (!parsed) return null;
  const start  = new Date(parsed.setHours(0, 0, 0, 0));
  const end    = new Date(parsed.setHours(23, 59, 59, 999));
  return { $gte: start, $lte: end };
};

/* ───── /search/users?q=alice&limit=20&skip=0 ─────────────────────────────── */

router.get('/users', protect, async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = parseInt(req.query.limit || 20);
  const skip = parseInt(req.query.skip || 0);

  if (!q || q.length < 1) return res.json([]);

  try {
    const userId = req.user._id;
    const results = await SearchService.searchUsers(q, userId, { limit, skip });
    res.json(results);
  } catch (err) {
    console.error('/search/users →', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* ───── /search/events?q=concert&when=this%20weekend&limit=30&skip=0 ─────── */

router.get('/events', protect, async (req, res) => {
  const q = (req.query.q || '').trim();
  const whenRaw = req.query.when || '';
  const limit = parseInt(req.query.limit || 30);
  const skip = parseInt(req.query.skip || 0);

  if (!q || q.length < 1) return res.json([]);

  try {
    const userId = req.user._id;
    const results = await SearchService.searchEvents(q, userId, { 
      limit, 
      skip, 
      when: whenRaw 
    });
    res.json(results);
  } catch (err) {
    console.error('/search/events →', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* ───── /search/posts?q=text&limit=30&skip=0 ─────────────────────────────── */

router.get('/posts', protect, async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = parseInt(req.query.limit || 30);
  const skip = parseInt(req.query.skip || 0);

  if (!q || q.length < 1) return res.json([]);

  try {
    const userId = req.user._id;
    const results = await SearchService.searchPosts(q, userId, { limit, skip });
    res.json(results);
  } catch (err) {
    console.error('/search/posts →', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* ───── /search/unified?q=query&types=users,events,posts&limit=10 ───── */

router.get('/unified', protect, async (req, res) => {
  try {
    const { q: query, types, limit = 10, skip = 0, when } = req.query;
    const userId = req.user._id;

    if (!query || query.trim().length < 1) {
      return res.json({
        query: '',
        results: {
          users: [],
          events: [],
          posts: [],
          songs: [],
          movies: []
        },
        metadata: {
          totalResults: 0,
          searchTime: 0,
          hasMore: false
        }
      });
    }

    // Parse types parameter
    const typeArray = types 
      ? types.split(',').map(t => t.trim().toLowerCase())
      : ['users', 'events', 'posts', 'songs', 'movies'];

    const results = await SearchService.unifiedSearch(query, userId, {
      types: typeArray,
      limit: parseInt(limit),
      skip: parseInt(skip),
      when
    });

    res.json(results);
  } catch (err) {
    console.error('/search/unified →', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* ───── /search/suggestions?q=qu ───── */

router.get('/suggestions', protect, async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    const userId = req.user._id;

    if (!query || query.trim().length < 2) {
      return res.json({
        suggestions: [],
        recent: [],
        trending: []
      });
    }

    const suggestions = await SearchService.getSuggestions(query, userId, {
      limit: parseInt(limit)
    });

    res.json(suggestions);
  } catch (err) {
    console.error('/search/suggestions →', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;