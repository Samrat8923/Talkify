const { Server } = require('socket.io');
const prisma = require('../config/prisma');

let io;
// Map to track active users: socketId -> userId
const activeUsers = new Map();

// Helper to broadcast active users
const broadcastActiveUsers = () => {
  const userIds = Array.from(new Set(activeUsers.values()));
  io.emit('active_users', userIds);
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // User joins a channel
    socket.on('join_channel', (channelId) => {
      socket.join(channelId);
      console.log(`Socket ${socket.id} joined channel ${channelId}`);
    });

    // User leaves a channel
    socket.on('leave_channel', (channelId) => {
      socket.leave(channelId);
      console.log(`Socket ${socket.id} left channel ${channelId}`);
    });

    // Handle typing indicator
    socket.on('typing', ({ channelId, username }) => {
      socket.to(channelId).emit('user_typing', { username });
    });

    socket.on('stop_typing', ({ channelId }) => {
      socket.to(channelId).emit('user_stop_typing');
    });

    // Handle user online status
    socket.on('user_online', async (userId) => {
      socket.userId = userId;
      socket.join(userId); // Join private room for direct messages
      activeUsers.set(socket.id, userId);
      broadcastActiveUsers();
      
      await prisma.user.update({
        where: { id: userId },
        data: { is_online: true }
      });
      io.emit('user_status_change', { userId, is_online: true });
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      
      if (activeUsers.has(socket.id)) {
        const userId = activeUsers.get(socket.id);
        activeUsers.delete(socket.id);
        broadcastActiveUsers();
        
        // If the user has no more active socket connections, mark offline in DB
        if (!Array.from(activeUsers.values()).includes(userId)) {
          await prisma.user.update({
            where: { id: userId },
            data: { is_online: false }
          }).catch(err => console.error("Error updating offline status", err));
          io.emit('user_status_change', { userId, is_online: false });
        }
      }
    });
  });
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIo };
