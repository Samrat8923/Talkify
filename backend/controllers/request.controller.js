const prisma = require('../config/prisma');
const { getIo } = require('../sockets/socket');

// GET /api/requests
const getPendingRequests = async (req, res) => {
  try {
    const requests = await prisma.messageRequest.findMany({
      where: {
        receiver_id: req.user.id,
        status: 'pending'
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar_url: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/requests/status/:userId
const getRequestStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if conversation exists
    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1_id: req.user.id, user2_id: userId },
          { user1_id: userId, user2_id: req.user.id }
        ]
      }
    });

    if (conversation) {
      return res.status(200).json({ status: 'accepted' });
    }

    // Check for pending/rejected requests
    const request = await prisma.messageRequest.findFirst({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id: userId },
          { sender_id: userId, receiver_id: req.user.id }
        ]
      }
    });

    if (!request) {
      return res.status(200).json({ status: 'none' });
    }

    // Hide rejection from sender (Instagram-style)
    if (request.sender_id === req.user.id) {
      return res.status(200).json({ 
        status: request.status === 'rejected' ? 'pending' : request.status,
        requestId: request.id,
        isSender: true
      });
    }

    // Receiver sees true status
    return res.status(200).json({ 
      status: request.status,
      requestId: request.id,
      isSender: false
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/requests
const sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (receiverId === req.user.id) return res.status(400).json({ message: 'Cannot request yourself' });

    const existingConv = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1_id: req.user.id, user2_id: receiverId },
          { user1_id: receiverId, user2_id: req.user.id }
        ]
      }
    });
    if (existingConv) return res.status(400).json({ message: 'Conversation already exists' });

    const existingReq = await prisma.messageRequest.findFirst({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id: receiverId },
          { sender_id: receiverId, receiver_id: req.user.id }
        ]
      }
    });

    if (existingReq) return res.status(400).json({ message: 'Request already exists' });

    const request = await prisma.messageRequest.create({
      data: {
        sender_id: req.user.id,
        receiver_id: receiverId,
        status: 'pending'
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar_url: true }
        }
      }
    });

    const io = getIo();
    io.to(receiverId).emit('new_request', request);

    res.status(201).json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/requests/:id
const respondToRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const request = await prisma.messageRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.receiver_id !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    if (action === 'accept') {
      await prisma.conversation.create({
        data: {
          user1_id: request.sender_id,
          user2_id: request.receiver_id
        }
      });
      await prisma.messageRequest.delete({ where: { id } });

      const io = getIo();
      io.to(request.sender_id).emit('request_accepted', { receiverId: req.user.id });

      return res.status(200).json({ message: 'Request accepted' });
    } else if (action === 'reject') {
      await prisma.messageRequest.update({
        where: { id },
        data: { status: 'rejected' }
      });
      return res.status(200).json({ message: 'Request rejected' });
    }

    res.status(400).json({ message: 'Invalid action' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/requests/:id
const cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.messageRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.sender_id !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    await prisma.messageRequest.delete({ where: { id } });
    res.status(200).json({ message: 'Request cancelled' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPendingRequests,
  getRequestStatus,
  sendRequest,
  respondToRequest,
  cancelRequest
};
