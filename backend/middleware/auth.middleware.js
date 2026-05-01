const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Check if user exists and is banned
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { is_banned: true } });
    if (!user) return res.status(401).json({ message: 'Not authorized, user not found' });
    if (user.is_banned) return res.status(403).json({ message: 'Your account has been banned' });

    req.user = { id: decoded.id };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };
