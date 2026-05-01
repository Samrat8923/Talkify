const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, email: true, avatar_url: true, role: true, created_at: true }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    
    // Check if username already exists
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, id: { not: req.user.id } }
      });
      if (existing) return res.status(400).json({ message: 'Username is already taken' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { username },
      select: { id: true, username: true, email: true, avatar_url: true, role: true }
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid current password' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password_hash }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const fileName = `avatars/${Date.now()}-${req.file.originalname.replace(/\\s+/g, '_')}`;
    
    const { error } = await supabase.storage
      .from('chat-files')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('chat-files')
      .getPublicUrl(fileName);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar_url: publicUrlData.publicUrl },
      select: { id: true, username: true, email: true, avatar_url: true, role: true }
    });

    res.json(user);
  } catch (error) {
    console.error("Avatar Upload Error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getProfile, updateProfile, updatePassword, updateAvatar };
