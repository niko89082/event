const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { createNotification } = require('../utils/notifications');
const protect = require('../middleware/auth');

// Send a follow request
router.post('/follow/:id', protect, async (req, res) => {
    try {
        const userToFollow = await User.findById(req.params.id);
        if (!userToFollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user.id === req.params.id) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        if (userToFollow.followRequests.includes(req.user.id)) {
            return res.status(400).json({ message: 'Follow request already sent' });
        }

        if (userToFollow.isPublic) {
            if (userToFollow.followers.includes(req.user.id)) {
                return res.status(400).json({ message: 'You are already following this user' });
            }

            userToFollow.followers.push(req.user.id);
            req.user.following.push(userToFollow.id);
        } else {
            userToFollow.followRequests.push(req.user.id);
            await createNotification(userToFollow._id, 'follow-request', `${req.user.username} sent you a follow request`);
        }

        await userToFollow.save();
        await req.user.save();

        res.status(200).json({ message: userToFollow.isPublic ? 'User followed' : 'Follow request sent' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Accept a follow request
router.post('/accept/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const requestUser = await User.findById(req.params.id);

        if (!user.followRequests.includes(req.params.id)) {
            return res.status(404).json({ message: 'Follow request not found' });
        }

        user.followRequests.pull(req.params.id);
        user.followers.push(req.params.id);
        requestUser.following.push(req.user.id);

        await user.save();
        await requestUser.save();

        res.status(200).json({ message: 'Follow request accepted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Decline a follow request
router.delete('/decline/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.followRequests.includes(req.params.id)) {
            return res.status(404).json({ message: 'Follow request not found' });
        }

        user.followRequests.pull(req.params.id);
        await user.save();

        res.status(200).json({ message: 'Follow request declined' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Cancel a follow request
router.delete('/cancel/:id', protect, async (req, res) => {
    try {
        const userToUnfollow = await User.findById(req.params.id);

        if (!userToUnfollow || !userToUnfollow.followRequests.includes(req.user.id)) {
            return res.status(404).json({ message: 'Follow request not found' });
        }

        userToUnfollow.followRequests.pull(req.user.id);
        await userToUnfollow.save();

        res.status(200).json({ message: 'Follow request canceled' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Unfollow a user
router.delete('/unfollow/:id', protect, async (req, res) => {
    try {
        const userToUnfollow = await User.findById(req.params.id);
        if (!userToUnfollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!req.user.following.includes(req.params.id)) {
            return res.status(400).json({ message: 'You are not following this user' });
        }

        req.user.following.pull(req.params.id);
        userToUnfollow.followers.pull(req.user.id);

        await req.user.save();
        await userToUnfollow.save();

        res.status(200).json({ message: 'User unfollowed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;