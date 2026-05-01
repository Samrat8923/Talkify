const prisma = require('../config/prisma');

// GET /api/users/search?q=username
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } },
          { username: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        is_online: true
      },
      take: 20
    });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/conversations — start or get a DM conversation
const startConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    if (userId === req.user.id) return res.status(400).json({ message: 'Cannot DM yourself' });

    // Check for existing conversation (either direction)
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1_id: req.user.id, user2_id: userId },
          { user1_id: userId, user2_id: req.user.id }
        ]
      },
      include: {
        user1: { select: { id: true, username: true, avatar_url: true, is_online: true } },
        user2: { select: { id: true, username: true, avatar_url: true, is_online: true } }
      }
    });

    if (existing) return res.status(200).json(existing);

    const conversation = await prisma.conversation.create({
      data: {
        user1_id: req.user.id,
        user2_id: userId
      },
      include: {
        user1: { select: { id: true, username: true, avatar_url: true, is_online: true } },
        user2: { select: { id: true, username: true, avatar_url: true, is_online: true } }
      }
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/conversations — list all DM conversations for the current user
const getRecentConversations = async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1_id: req.user.id },
          { user2_id: req.user.id }
        ]
      },
      include: {
        user1: { select: { id: true, username: true, avatar_url: true, is_online: true } },
        user2: { select: { id: true, username: true, avatar_url: true, is_online: true } }
      }
    });

    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { sender_id: conv.user1_id, receiver_id: conv.user2_id },
              { sender_id: conv.user2_id, receiver_id: conv.user1_id }
            ]
          },
          orderBy: { created_at: 'desc' },
          select: { content: true, file_url: true, created_at: true }
        });

        return {
          ...conv,
          lastMessage: lastMessage || null,
          sortTime: lastMessage ? lastMessage.created_at : conv.created_at
        };
      })
    );

    conversationsWithMessages.sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));

    res.status(200).json(conversationsWithMessages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users — all users (for admin use)
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        avatar_url: true,
        is_online: true,
        role: true,
        is_banned: true
      }
    });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllUsers, searchUsers, startConversation, getRecentConversations };
