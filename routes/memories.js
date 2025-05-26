const express       = require('express');
const multer        = require('multer');
const path          = require('path');
const fs            = require('fs');
const protect       = require('../middleware/auth');

const Memory        = require('../models/Memory');
const MemoryPhoto   = require('../models/MemoryPhoto');
const Conversation  = require('../models/Conversation');

const router = express.Router();

/* ── ensure folder for memory‑exclusive photos ────────────────────── */
const memoryDir = path.join(__dirname, '..', 'uploads', 'memory-photos');
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

/* ── Multer config ────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, memoryDir),
  filename:    (_, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

/* helper: confirm user is participant in conversation */
async function ensureParticipant(conversationId, userId) {
  const convo = await Conversation.findById(conversationId);
  if (!convo) return { ok: false, msg: 'Conversation not found' };
  const ok = convo.participants.some((p) => p.toString() === userId.toString());
  return ok ? { ok: true, convo } : { ok: false, msg: 'Not authorized' };
}

/* ───────────────────────────────────────────────────────────────────
   POST /memories/conversation/:conversationId
──────────────────────────────────────────────────────────────────── */
router.post('/conversation/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const check = await ensureParticipant(conversationId, req.user._id);
    if (!check.ok) return res.status(401).json({ message: check.msg });

    const memory = await Memory.create({
      title: req.body.title,
      date:  req.body.date || Date.now(),
      conversation: conversationId,
      createdBy: req.user._id,
    });

    res.status(201).json({ memory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /memories/conversation/:conversationId
──────────────────────────────────────────────────────────────────── */
router.get('/conversation/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const check = await ensureParticipant(conversationId, req.user._id);
    if (!check.ok) return res.status(401).json({ message: check.msg });

    const memories = await Memory.find({ conversation: conversationId })
      .populate('createdBy', 'username')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username' },
          { path: 'comments.user', select: 'username' },
        ],
      })
      .sort({ createdAt: -1 });

    res.json({ memories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /memories/:memoryId
──────────────────────────────────────────────────────────────────── */
router.get('/:memoryId', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId)
      .populate('createdBy', 'username')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username' },
          { path: 'comments.user', select: 'username' },
        ],
      });

    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    const check = await ensureParticipant(memory.conversation, req.user._id);
    if (!check.ok) return res.status(401).json({ message: check.msg });

    res.json({ memory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   POST /memories/:memoryId/photo
──────────────────────────────────────────────────────────────────── */
router.post('/:memoryId/photo', protect, upload.single('photo'), async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId);
    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    const check = await ensureParticipant(memory.conversation, req.user._id);
    if (!check.ok) return res.status(401).json({ message: check.msg });

    const relPath = `/uploads/memory-photos/${req.file.filename}`;

    const photo = await MemoryPhoto.create({
      user:   req.user._id,
      memory: memory._id,
      path:   relPath,
    });

    memory.photos.push(photo._id);
    await memory.save();

    const populated = await Memory.findById(memory._id)
      .populate('createdBy', 'username')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username' },
          { path: 'comments.user', select: 'username' },
        ],
      });

    res.status(201).json({ memory: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   POST /memories/:memoryId/photo/:photoId/comment
──────────────────────────────────────────────────────────────────── */
router.post('/:memoryId/photo/:photoId/comment', protect, async (req, res) => {
  try {
    const memory   = await Memory.findById(req.params.memoryId);
    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    const check = await ensureParticipant(memory.conversation, req.user._id);
    if (!check.ok) return res.status(401).json({ message: check.msg });

    if (!memory.photos.includes(req.params.photoId))
      return res.status(400).json({ message: 'Photo not in this memory' });

    const photo = await MemoryPhoto.findById(req.params.photoId);
    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    photo.comments.push({ user: req.user._id, text: req.body.text });
    await photo.save();

    const populated = await MemoryPhoto.findById(photo._id)
      .populate('user', 'username')
      .populate('comments.user', 'username');

    res.status(201).json({ photo: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   POST /memories/:memoryId/photo/:photoId/like  (toggle)
──────────────────────────────────────────────────────────────────── */
router.post('/:memoryId/photo/:photoId/like', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId);
    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    const check = await ensureParticipant(memory.conversation, req.user._id);
    if (!check.ok) return res.status(401).json({ message: check.msg });

    if (!memory.photos.includes(req.params.photoId))
      return res.status(400).json({ message: 'Photo not in memory' });

    const photo = await MemoryPhoto.findById(req.params.photoId);
    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    const idx = photo.likes.findIndex(
      (u) => u.toString() === req.user._id.toString()
    );
    if (idx > -1) photo.likes.splice(idx, 1);
    else          photo.likes.push(req.user._id);

    await photo.save();

    const populated = await MemoryPhoto.findById(photo._id)
      .populate('user', 'username')
      .populate('comments.user', 'username');

    res.json({ photo: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;