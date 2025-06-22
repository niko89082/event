// middleware/guestPassSecurity.js - Security middleware for guest passes
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

// HTTPS redirect middleware
const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
};

// Rate limiting configurations
const rateLimiters = {
  // Guest pass creation - stricter limits
  createGuestPass: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 guest passes per IP per 15 minutes
    message: {
      error: 'Too many guest passes created from this IP',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // RSVP submission - prevent spam
  rsvp: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // 3 RSVP attempts per IP per 5 minutes
    message: {
      error: 'Too many RSVP attempts from this IP',
      retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // QR scanning - prevent abuse
  scan: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 scans per minute (reasonable for event check-in)
    message: {
      error: 'Too many scan attempts',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // General API rate limiting
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP per 15 minutes
    message: {
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  })
};

// Security headers for guest pass routes
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Token validation middleware
const validateGuestPassToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Basic token format validation
    if (typeof token !== 'string' || token.length < 10) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /script/i,
      /<.*>/,
      /javascript:/i,
      /data:/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(token))) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    next();
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Nonce verification for replay attack prevention
const verifyNonce = (storedNonce, providedNonce) => {
  if (!storedNonce || !providedNonce) {
    return false;
  }
  
  // Use crypto.timingSafeEqual to prevent timing attacks
  const storedBuffer = Buffer.from(storedNonce, 'hex');
  const providedBuffer = Buffer.from(providedNonce, 'hex');
  
  if (storedBuffer.length !== providedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(storedBuffer, providedBuffer);
};

// QR code rotation utility
const rotateQRCode = async (guestPass) => {
  const newCode = crypto.randomBytes(32).toString('hex');
  guestPass.qrData.code = newCode;
  guestPass.qrData.generatedAt = new Date();
  await guestPass.save();
  return newCode;
};

// Cleanup expired guest passes (run as cron job)
const cleanupExpiredPasses = async () => {
  try {
    const expiredPasses = await GuestPass.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      {
        status: 'expired'
      }
    );
    
    console.log(`Marked ${expiredPasses.modifiedCount} guest passes as expired`);
  } catch (error) {
    console.error('Error cleaning up expired passes:', error);
  }
};

module.exports = {
  httpsRedirect,
  rateLimiters,
  securityHeaders,
  validateGuestPassToken,
  verifyNonce,
  rotateQRCode,
  cleanupExpiredPasses
};