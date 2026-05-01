const express = require('express');
const {
  getChannels,
  getPublicChannels,
  createChannel,
  joinChannel,
  leaveChannel,
  inviteToChannel,
  removeMember,
  promoteToAdmin,
  deleteChannel,
  getChannelInfo
} = require('../controllers/channel.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .get(protect, getChannels)
  .post(protect, createChannel);

router.get('/public', protect, getPublicChannels);

router.get('/:id/info', protect, getChannelInfo);
router.post('/:id/join', protect, joinChannel);
router.post('/:id/leave', protect, leaveChannel);
router.delete('/:id', protect, deleteChannel);

router.post('/:id/invite', protect, inviteToChannel);
router.delete('/:id/members/:userId', protect, removeMember);
router.put('/:id/members/:userId/promote', protect, promoteToAdmin);

module.exports = router;
