// middleware/upload.js - Upload middleware for memory photos
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const memoryPhotosDir = path.join(uploadsDir, 'memory-photos');
const photosDir = path.join(uploadsDir, 'photos');
const eventCoversDir = path.join(uploadsDir, 'event-covers');

// Create directories if they don't exist
[uploadsDir, memoryPhotosDir, photosDir, eventCoversDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created upload directory: ${dir}`);
  }
});

// Configure storage for memory photos
const memoryPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, memoryPhotosDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = 'memory-' + uniqueSuffix + fileExtension;
    cb(null, fileName);
  }
});

// Configure storage for regular photos
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, photosDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = 'photo-' + uniqueSuffix + fileExtension;
    cb(null, fileName);
  }
});

// File filter for images only
const imageFileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
  }
};

// Memory photo upload configuration
const memoryPhotoUpload = multer({
  storage: memoryPhotoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per upload for memories
  },
  fileFilter: imageFileFilter
});

// Regular photo upload configuration
const photoUpload = multer({
  storage: photoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Max 10 files per upload for events
  },
  fileFilter: imageFileFilter
});

// Profile picture upload configuration
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = 'profile-' + uniqueSuffix + fileExtension;
    cb(null, fileName);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
    files: 1
  },
  fileFilter: imageFileFilter
});

// Create middleware wrapper to handle the req.headers issue
const createUploadMiddleware = (upload) => {
  return (req, res, next) => {
    // Ensure req.headers exists to prevent the transfer-encoding error
    if (!req.headers) {
      req.headers = {};
    }
    
    // Call the multer middleware
    upload(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        console.error('❌ Multer error:', error);
        
        switch (error.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(400).json({ 
              message: 'File too large. Maximum size is 10MB.',
              code: 'FILE_TOO_LARGE'
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({ 
              message: 'Too many files. Maximum is 5 files per upload.',
              code: 'TOO_MANY_FILES'
            });
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({ 
              message: 'Unexpected file field.',
              code: 'UNEXPECTED_FILE'
            });
          default:
            return res.status(400).json({ 
              message: `Upload error: ${error.message}`,
              code: error.code
            });
        }
      }
      
      if (error && error.message === 'Only image files (JPEG, PNG, GIF, WebP) are allowed!') {
        return res.status(400).json({ 
          message: 'Only image files (JPEG, PNG, GIF, WebP) are allowed!',
          code: 'INVALID_FILE_TYPE'
        });
      }
      
      if (error) {
        console.error('❌ Upload error:', error);
        return res.status(500).json({ 
          message: 'Upload failed',
          details: error.message 
        });
      }
      
      next();
    });
  };
};

// Export different upload configurations with proper error handling
module.exports = {
  // For memory photos (single file)
  single: createUploadMiddleware(memoryPhotoUpload.single('photo')),
  
  // For memory photos (multiple files)
  array: createUploadMiddleware(memoryPhotoUpload.array('photos', 5)),
  
  // For regular event photos
  eventPhotos: createUploadMiddleware(photoUpload.array('photos', 10)),
  
  // For profile pictures
  profile: createUploadMiddleware(profileUpload.single('profilePicture')),
  
  // Generic single photo upload (uses memory photo storage)
  photo: createUploadMiddleware(memoryPhotoUpload.single('photo')),
  
  // Raw multer instances for custom use
  memoryPhotoUpload,
  photoUpload,
  profileUpload,
  
  // Utility function to handle multer errors
  handleMulterError: (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      console.error('❌ Multer error:', error);
      
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({ 
            message: 'File too large. Maximum size is 10MB.',
            code: 'FILE_TOO_LARGE'
          });
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({ 
            message: 'Too many files. Maximum is 5 files per upload.',
            code: 'TOO_MANY_FILES'
          });
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({ 
            message: 'Unexpected file field.',
            code: 'UNEXPECTED_FILE'
          });
        default:
          return res.status(400).json({ 
            message: `Upload error: ${error.message}`,
            code: error.code
          });
      }
    }
    
    if (error.message === 'Only image files (JPEG, PNG, GIF, WebP) are allowed!') {
      return res.status(400).json({ 
        message: 'Only image files (JPEG, PNG, GIF, WebP) are allowed!',
        code: 'INVALID_FILE_TYPE'
      });
    }
    
    next(error);
  }
};