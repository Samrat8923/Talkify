const prisma = require('../config/prisma');

const admin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Not authorized as an admin' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error authorizing admin' });
  }
};

module.exports = { admin };
