const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is authenticated via session
const requireAuth = async (req, res, next) => {
  if (!req.session.userId) {
    // Check if this is an API/AJAX request (expects JSON response)
    const isApiRequest = req.path.startsWith('/api/') || 
                         req.path.startsWith('/game/') ||
                         req.headers.accept?.includes('application/json') ||
                         req.headers['content-type']?.includes('application/json');
    
    if (isApiRequest) {
      // Return JSON error for API requests
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required. Please log in.',
        redirectTo: '/auth/login'
      });
    }
    
    // Redirect to login for regular page requests
    req.session.error = 'Please log in to access this page.';
    return res.redirect('/auth/login');
  }

  // Check if user is active
  try {
    const user = await User.findById(req.session.userId).select('isActive');
    if (!user || !user.isActive) {
      // Clear session for inactive users
      req.session.userId = null;
      req.session.username = null;
      
      // Check if this is an API/AJAX request
      const isApiRequest = req.path.startsWith('/api/') || 
                           req.path.startsWith('/game/') ||
                           req.headers.accept?.includes('application/json') ||
                           req.headers['content-type']?.includes('application/json');
      
      if (isApiRequest) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account has been deactivated.',
          redirectTo: '/auth/login'
        });
      }
      
      req.session.error = 'Your account has been deactivated.';
      return res.redirect('/auth/login');
    }
  } catch (error) {
    console.error('Error checking user status:', error);
    // On error, allow access to prevent lockout, but log the error
  }

  next();
};

// Middleware to check JWT token (optional, for API routes)
const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies.authToken || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token or user not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Middleware to redirect authenticated users away from auth pages
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
};

// Middleware to get user data for templates
const getUserData = async (req, res, next) => {
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      res.locals.user = user;
    } catch (error) {
      console.error('Error fetching user data:', error);
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  next();
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    req.session.error = 'Please log in to access this page.';
    return res.redirect('/auth/login');
  }
  
  try {
    const user = await User.findById(req.session.userId).select('role isActive');
    if (!user || user.role !== 'admin' || !user.isActive) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        error: { status: 403 }
      });
    }
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while checking permissions.',
      error: { status: 500 }
    });
  }
};

module.exports = {
  requireAuth,
  verifyToken,
  redirectIfAuthenticated,
  getUserData,
  requireAdmin
};
