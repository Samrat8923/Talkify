const express = require('express');
const { getMessages, sendMessage, deleteMessage, editMessage } = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

// GET /api/messages?channelId=... or ?receiverId=...
router.get('/', protect, getMessages);

// POST /api/messages
router.post('/', protect, upload.single('file'), sendMessage);

// PUT /api/messages/:id
router.put('/:id', protect, editMessage);

// DELETE /api/messages/:id
router.delete('/:id', protect, deleteMessage);

module.exports = router;
