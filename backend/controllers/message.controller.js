require('dotenv').config();
const prisma = require('../config/prisma');
const { getIo } = require('../sockets/socket');
const supabase = require('../config/supabase');

const getMessages = async (req, res) => {
  try {
    const { channelId, receiverId } = req.query;

    let whereClause = {};
    if (channelId) {
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) return res.status(404).json({ message: 'Channel not found' });
      
      const membership = await prisma.channelMember.findUnique({
        where: { user_id_channel_id: { user_id: req.user.id, channel_id: channelId } }
      });
      if (!membership) return res.status(403).json({ message: 'You must join this channel to view messages' });

      whereClause = { channel_id: channelId };
    } else if (receiverId) {
      whereClause = {
        OR: [
          { sender_id: req.user.id, receiver_id: receiverId },
          { sender_id: receiverId, receiver_id: req.user.id }
        ]
      };
    } else {
      return res.status(400).json({ message: 'Channel ID or Receiver ID is required' });
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, username: true, avatar_url: true }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { content, channelId, receiverId } = req.body;
    let fileUrl = null;

    if (!content && !req.file) {
      return res.status(400).json({ message: 'Message content or file is required' });
    }

    if (req.file) {
      try {
        console.log(`Uploading file to Supabase: ${req.file.originalname}`);
        
        // Generate a unique filename
        const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
        
        const { data, error } = await supabase.storage
          .from('chat-files')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false
          });

        if (error) {
          throw error;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('chat-files')
          .getPublicUrl(fileName);
          
        fileUrl = publicUrlData.publicUrl;
        console.log(`File uploaded successfully: ${fileUrl}`);
      } catch (uploadError) {
        console.error("Supabase Upload Error:", uploadError);
        return res.status(500).json({ message: 'Failed to upload file to Supabase', error: uploadError.message });
      }
    }

    if (channelId) {
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) return res.status(404).json({ message: 'Channel not found' });
      
      const membership = await prisma.channelMember.findUnique({
        where: { user_id_channel_id: { user_id: req.user.id, channel_id: channelId } }
      });
      if (!membership) return res.status(403).json({ message: 'You must join this channel to send messages' });
    } else if (receiverId) {
      // Strictly enforce conversation existence. 
      // Conversations are now ONLY created when a Message Request is accepted.
      const existingConv = await prisma.conversation.findFirst({
        where: {
          OR: [
            { user1_id: req.user.id, user2_id: receiverId },
            { user1_id: receiverId, user2_id: req.user.id }
          ]
        }
      });

      if (!existingConv) {
        return res.status(403).json({ message: 'You must send a message request and have it accepted before messaging this user.' });
      }
    }

    const message = await prisma.message.create({
      data: {
        content,
        file_url: fileUrl,
        sender_id: req.user.id,
        channel_id: channelId || null,
        receiver_id: receiverId || null
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar_url: true }
        }
      }
    });

    const io = getIo();
    if (channelId) {
      io.to(channelId).emit('new_message', message);
    } else if (receiverId) {
      // True private messaging: emit only to receiver and sender rooms
      io.to(receiverId).emit('new_private_message', message);
      io.to(req.user.id).emit('new_private_message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const messageId = id;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Allow: own message OR channel admin
    const isOwnMessage = message.sender_id === req.user.id;
    let isChannelAdmin = false;

    if (!isOwnMessage && message.channel_id) {
      const membership = await prisma.channelMember.findUnique({
        where: { user_id_channel_id: { user_id: req.user.id, channel_id: message.channel_id } }
      });
      isChannelAdmin = membership?.role === 'admin';
    }

    if (!isOwnMessage && !isChannelAdmin) {
      return res.status(403).json({ message: 'You cannot delete this message' });
    }

    if (message.file_url) {
      try {
        // Extract filename from Supabase URL
        // Example URL: https://[projectId].supabase.co/storage/v1/object/public/chat-files/12345-filename.pdf
        const urlParts = message.file_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        console.log(`Deleting Supabase file: ${fileName}`);
        const { error } = await supabase.storage
          .from('chat-files')
          .remove([fileName]);
          
        if (error) {
          console.error("Supabase Deletion Error Details:", error);
        }
      } catch (storageError) {
        console.error("Supabase Deletion Error:", storageError);
      }
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    const io = getIo();
    io.emit('delete_message', { messageId, channelId: message.channel_id });

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error("Delete Message Error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ message: 'Content is required' });

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) return res.status(404).json({ message: 'Message not found' });
    
    if (message.sender_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id },
      data: { content, is_edited: true },
      include: { sender: { select: { id: true, username: true, avatar_url: true } } }
    });

    const io = getIo();
    if (message.channel_id) {
      io.to(message.channel_id).emit('edit_message', updatedMessage);
    } else {
      io.emit('edit_message', updatedMessage);
    }

    res.json(updatedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error editing message' });
  }
};

module.exports = { getMessages, sendMessage, deleteMessage, editMessage };
