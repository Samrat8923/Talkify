const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  getPendingRequests,
  getRequestStatus,
  sendRequest,
  respondToRequest,
  cancelRequest
} = require('../controllers/request.controller');

router.use(protect);

router.get('/', getPendingRequests);
router.get('/status/:userId', getRequestStatus);
router.post('/', sendRequest);
router.put('/:id', respondToRequest);
router.delete('/:id', cancelRequest);

module.exports = router;
