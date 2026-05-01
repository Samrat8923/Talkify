const prisma = require('../config/prisma');
const supabase = require('../config/supabase');

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, email: true, is_online: true, is_banned: true, role: true, created_at: true },
      orderBy: { created_at: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      include: {
        sender: { select: { username: true } },
        channel: { select: { name: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 100 // Limit to latest 100 for performance
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    // Cannot delete yourself
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    // Cascade delete might be needed if foreign keys dictate, 
    // but Prisma relation onDelete: Cascade can handle it if configured.
    // If not, we manually delete their messages first.
    await prisma.message.deleteMany({
      where: { OR: [{ sender_id: id }, { receiver_id: id }] }
    });

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await prisma.message.findUnique({ where: { id } });
    
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.file_url) {
      const urlParts = message.file_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      await supabase.storage.from('chat-files').remove([fileName]);
    }

    await prisma.message.delete({ where: { id } });
    
    // Broadcast delete so UI updates
    const { getIo } = require('../sockets/socket');
    getIo().emit('delete_message', { messageId: id });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting message' });
  }
};

const toggleBanUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Cannot ban yourself' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot ban an admin' });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { is_banned: !user.is_banned },
      select: { id: true, is_banned: true, username: true }
    });

    res.json({ message: `User ${updatedUser.is_banned ? 'banned' : 'unbanned'} successfully`, user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error banning user' });
  }
};

module.exports = { getUsers, getMessages, deleteUser, deleteMessage, toggleBanUser };
