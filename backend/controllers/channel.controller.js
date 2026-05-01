const prisma = require('../config/prisma');

// Helper: check if user is a member of a channel
const getMembership = (channelId, userId) =>
  prisma.channelMember.findUnique({
    where: { user_id_channel_id: { user_id: userId, channel_id: channelId } }
  });

// GET /api/channels — only channels user belongs to
const getChannels = async (req, res) => {
  try {
    const memberships = await prisma.channelMember.findMany({
      where: { user_id: req.user.id },
      include: {
        channel: {
          include: {
            members: {
              select: { user_id: true, role: true }
            }
          }
        }
      }
    });
    const channels = memberships.map(m => ({ ...m.channel, userRole: m.role }));
    res.status(200).json(channels);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/channels/public — public channels user has NOT joined (for discovery)
const getPublicChannels = async (req, res) => {
  try {
    const joinedChannelIds = (await prisma.channelMember.findMany({
      where: { user_id: req.user.id },
      select: { channel_id: true }
    })).map(m => m.channel_id);

    const channels = await prisma.channel.findMany({
      where: {
        is_private: false,
        id: { notIn: joinedChannelIds }
      },
      orderBy: { created_at: 'asc' }
    });
    res.status(200).json(channels);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/channels — create a channel
const createChannel = async (req, res) => {
  try {
    const { name, description, is_private } = req.body;

    const existingChannel = await prisma.channel.findUnique({ where: { name } });
    if (existingChannel) {
      return res.status(400).json({ message: 'Channel name already taken' });
    }

    const channel = await prisma.channel.create({
      data: {
        name,
        description,
        is_private: is_private || false,
        created_by: req.user.id,
        members: {
          create: { user_id: req.user.id, role: 'admin' }
        }
      },
      include: {
        members: { select: { user_id: true, role: true } }
      }
    });

    res.status(201).json({ ...channel, userRole: 'admin' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/channels/:id/join — join a public channel
const joinChannel = async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    if (channel.is_private) {
      return res.status(403).json({ message: 'This is a private channel. You need an invitation.' });
    }

    // Already a member?
    const existing = await getMembership(id, req.user.id);
    if (existing) return res.status(400).json({ message: 'Already a member' });

    await prisma.channelMember.create({
      data: { user_id: req.user.id, channel_id: id, role: 'member' }
    });

    const updated = await prisma.channel.findUnique({
      where: { id },
      include: { members: { select: { user_id: true, role: true } } }
    });

    res.json({ ...updated, userRole: 'member' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/channels/:id/leave — leave a channel
const leaveChannel = async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    // Creator cannot leave without transferring ownership or deleting
    if (channel.created_by === req.user.id) {
      return res.status(400).json({ message: 'You are the creator. Transfer admin or delete the group instead.' });
    }

    await prisma.channelMember.delete({
      where: { user_id_channel_id: { user_id: req.user.id, channel_id: id } }
    });

    res.json({ message: 'Left channel successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/channels/:id/invite — admin invites a user
const inviteToChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const membership = await getMembership(id, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can invite users' });
    }

    const existing = await getMembership(id, userId);
    if (existing) return res.status(400).json({ message: 'User is already a member' });

    await prisma.channelMember.create({
      data: { user_id: userId, channel_id: id, role: 'member' }
    });

    res.json({ message: 'User invited successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/channels/:id/members/:userId — admin removes a user
const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const membership = await getMembership(id, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Use leave channel to remove yourself' });
    }

    await prisma.channelMember.delete({
      where: { user_id_channel_id: { user_id: userId, channel_id: id } }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/channels/:id/members/:userId/promote — admin promotes a user
const promoteToAdmin = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const membership = await getMembership(id, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can promote members' });
    }

    await prisma.channelMember.update({
      where: { user_id_channel_id: { user_id: userId, channel_id: id } },
      data: { role: 'admin' }
    });

    res.json({ message: 'Member promoted to admin' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/channels/:id — admin deletes the whole channel
const deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    if (channel.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the creator can delete this channel' });
    }

    // Cascade deletes messages and memberships via schema onDelete
    await prisma.channel.delete({ where: { id } });

    res.json({ message: 'Channel deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/channels/:id/info — full channel info with members + roles
const getChannelInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const membership = await getMembership(id, req.user.id);
    if (!membership) return res.status(403).json({ message: 'You are not a member of this channel' });

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, avatar_url: true } }
          }
        }
      }
    });

    res.json({ ...channel, userRole: membership.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
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
};
