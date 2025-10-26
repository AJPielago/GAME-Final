const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const questRoutes = require('./routes/quests');
const adminRoutes = require('./routes/admin');

const app = express();

// Security middleware with less restrictive CSP for development
app.use(helmet({
  contentSecurityPolicy: false, // Temporarily disable CSP for development
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: false,
  frameguard: false,
  hidePoweredBy: true,
  hsts: false,
  ieNoOpen: true,
  noSniff: true,
  xssFilter: true
}));

app.use(mongoSanitize());

// Rate limiting - Increased limits for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased from 100 to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Relaxed rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // increased from 5 to 100 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

// Database connection with enhanced error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mydb', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

// Connect to MongoDB
connectDB().then(() => {
  console.log('MongoDB connection established successfully');
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Middleware for parsing request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware for serving static files with proper MIME types and debugging
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    // Disable caching for JS files in development
    if (process.env.NODE_ENV !== 'production' && filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Set proper MIME type for .js files
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Set proper MIME type for .css files
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    console.log('Serving static file:', filePath);
  },
  fallthrough: true,
  dotfiles: 'ignore',
  etag: true,
  extensions: ['html', 'htm'],
  index: false,
  maxAge: '1d',
  redirect: false
}));

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Test route to verify file serving
app.get('/test-file', (req, res) => {
  const testFilePath = path.join(__dirname, 'public', 'test.txt');
  const fs = require('fs');
  
  // Create a test file if it doesn't exist
  if (!fs.existsSync(testFilePath)) {
    fs.writeFileSync(testFilePath, 'Test file content');
  }
  
  res.sendFile(testFilePath);
});

// Debug route for map file
app.get('/images/maps2/map.tmj', (req, res) => {
  console.log('Map file requested');
  const fs = require('fs');
  const filePath = path.join(__dirname, 'public', 'images', 'maps2', 'map.tmj');
  
  if (fs.existsSync(filePath)) {
    console.log('Map file found, sending...');
    res.sendFile(filePath);
  } else {
    console.error('Map file not found at:', filePath);
    res.status(404).send('Map file not found');
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Remove duplicate body parser middleware
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/codequest',
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', './views');

// Disable view cache in development for hot reloading
if (process.env.NODE_ENV !== 'production') {
  app.set('view cache', false);
  
  // Clear EJS cache on every request in development
  app.use((req, res, next) => {
    // Clear require cache for EJS templates
    Object.keys(require.cache).forEach(key => {
      if (key.includes('views') && key.endsWith('.ejs')) {
        delete require.cache[key];
      }
    });
    next();
  });
  
  console.log('View caching disabled for development');
}

// Add nonce to all views
app.use((req, res, next) => {
  res.locals.nonce = res.locals.nonce || require('crypto').randomBytes(16).toString('base64');
  next();
});

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? { id: req.session.userId, username: req.session.username } : null;
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  req.session.success = null;
  req.session.error = null;
  next();
});

// Routes
app.use('/', indexRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/api/quests', questRoutes);
app.use('/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    error: {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CodeQuest server running on port ${PORT}`);
});

