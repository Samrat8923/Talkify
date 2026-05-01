const multer = require('multer');

// Use memory storage to buffer files in memory before uploading to Supabase
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

module.exports = upload;
