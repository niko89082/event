// routes/group.js
const express = require('express');
const Group = require('../models/Group');
const Event = require('../models/Event');
const Photo = require('../models/Photo');
const Memory = require('../models/Memory');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

// Create a group
router.post('/create', protect, async (req, res) => {
  const { name, description } = req.body;
  const creator = req.user._id;

  try {
    const group = new Group({
      name,
      description,
      members: [creator],
    });

    await group.save();
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Invite a user to join a group
router.post('/invite/:groupId', protect, async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.members.includes(userId)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    group.members.push(userId);
    await group.save();

    const user = await User.findById(userId);
    user.groups.push(group._id);
    await user.save();

    res.status(200).json({ message: 'User invited to group', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a group event
router.post('/event/create', protect, async (req, res) => {
  const { groupId, title, description, time, location } = req.body;
  const creator = req.user._id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const event = new Event({
      title,
      description,
      time,
      location,
      host: creator,
      group: groupId,
    });

    await event.save();
    group.events.push(event._id);
    await group.save();

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a memory for a group
router.post('/memory/create', protect, async (req, res) => {
  const { groupId, title, date } = req.body;
  const creator = req.user._id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const memory = new Memory({
      title,
      date,
      group: groupId,
      createdBy: creator,
    });

    await memory.save();
    group.memories.push(memory._id);
    await group.save();

    res.status(201).json(memory);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a photo to a memory
router.post('/memory/:memoryId/photo', protect, async (req, res) => {
  const { memoryId } = req.params;
  const { path } = req.body;
  const userId = req.user._id;

  try {
    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    const photo = new Photo({
      user: userId,
      memory: memoryId,
      path,
    });

    await photo.save();
    memory.photos.push(photo._id);
    await memory.save();

    res.status(201).json(photo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/:groupId/rename', protect, async (req, res) => {
  const { groupId } = req.params;
  const { newName } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // If you only allow the group’s "creator" to rename:
    // if (!group.creator.equals(req.user._id)) {
    //   return res.status(403).json({ message: 'Only the group creator can rename.' });
    // }

    group.name = newName;
    await group.save();

    return res.json({ message: 'Group renamed', group });
  } catch (err) {
    console.error('Error renaming group:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:groupId/remove', protect, async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body; // user to remove

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // If only the group creator can remove:
    // if (!group.creator.equals(req.user._id)) {
    //   return res.status(403).json({ message: 'Not authorized to remove users' });
    // }

    // If user is not in the group
    if (!group.members.includes(userId)) {
      return res.status(400).json({ message: 'User is not a member' });
    }

    // Remove them
    group.members = group.members.filter(m => m.toString() !== userId);
    await group.save();

    // Also remove from user's list of groups if your user model references it
    const user = await User.findById(userId);
    if (user) {
      user.groups = user.groups.filter(g => g.toString() !== groupId);
      await user.save();
    }

    return res.json({ message: 'User removed from group', group });
  } catch (err) {
    console.error('Error removing user from group:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});


module.exports = router;