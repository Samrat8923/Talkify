const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { admin } = require('../middleware/admin.middleware');
const { getUsers, getMessages, deleteUser, deleteMessage, toggleBanUser } = require('../controllers/admin.controller');

const router = express.Router();

// Protected Admin Routes
router.get('/users', protect, admin, getUsers);
router.get('/messages', protect, admin, getMessages);
router.delete('/user/:id', protect, admin, deleteUser);
router.delete('/message/:id', protect, admin, deleteMessage);
router.put('/user/:id/ban', protect, admin, toggleBanUser);

module.exports = router;
