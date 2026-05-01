const express = require('express');
const { getProfile, updateProfile, updatePassword, updateAvatar } = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

router.get('/', protect, getProfile);
router.put('/update', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.put('/avatar', protect, upload.single('file'), updateAvatar);

module.exports = router;
