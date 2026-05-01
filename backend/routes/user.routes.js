const express = require('express');
const { getAllUsers, searchUsers, startConversation, getRecentConversations } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', protect, getAllUsers);
router.get('/search', protect, searchUsers);
router.get('/conversations', protect, getRecentConversations);
router.post('/conversations', protect, startConversation);

module.exports = router;
