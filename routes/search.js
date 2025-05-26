const express  = require('express');
const chrono   = require('chrono-node');
const Event    = require('../models/Event');
const User     = require('../models/User');
const protect  = require('../middleware/auth');

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

/* ───── /search/users?q=alice ─────────────────────────────── */

router.get('/users', protect, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const users = await User.find(
      { $text: { $search: q }, isPublic: true },
      { score: { $meta: 'textScore' }, username: 1, displayName: 1, profilePicture: 1 }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);

    /* prefix boost */
    users.forEach((u) => {
      if (u.username.toLowerCase().startsWith(q.toLowerCase())) u.score += 5;
    });

    res.json(users);
  } catch (err) {
    console.error('/search/users →', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───── /search/events?q=concert&when=this%20weekend ─────── */

router.get('/events', protect, async (req, res) => {
  const q       = (req.query.q || '').trim();
  const whenRaw = req.query.when || '';

  const dateFilter = buildDateFilter(whenRaw);

  const match = {
    isPublic: true,
    ...(q ? { $text: { $search: q } } : {}),
    ...(dateFilter ? { time: dateFilter } : {}),
  };

  try {
    const events = await Event.find(
      match,
      { score: { $meta: 'textScore' }, title: 1, time: 1, coverImage: 1, location: 1 }
    )
      .sort({ score: { $meta: 'textScore' }, time: 1 })
      .limit(30)
      .populate('host', 'username');

    res.json(events);
  } catch (err) {
    console.error('/search/events →', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;