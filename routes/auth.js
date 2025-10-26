const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { redirectIfAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('username')
    .isLength({ min: 1 })
    .withMessage('Username is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  body('preferredLanguage')
    .optional()
    .isIn(['javascript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift'])
    .withMessage('Invalid preferred language')
];

const loginValidation = [
  body('login')
    .notEmpty()
    .withMessage('Email or username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register route
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', { 
    title: 'Join CodeQuest',
    errors: [],
    formData: null
  });
});

router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register', {
        title: 'Join CodeQuest',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { username, email, password, preferredLanguage, age } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.render('auth/register', {
          title: 'Join CodeQuest',
          errors: [{ msg: 'An account with this email already exists' }],
          formData: req.body
        });
      } else {
        return res.render('auth/register', {
          title: 'Join CodeQuest',
          errors: [{ msg: 'This username is already taken' }],
          formData: req.body
        });
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      age: age ? parseInt(age) : null,
      preferredLanguage: preferredLanguage || 'javascript'
    });

    await user.save();

    // Set success message and redirect to login
    req.session.success = 'Account created successfully! Please log in to start your CodeQuest journey.';
    res.redirect('/auth/login');

  } catch (err) {
    console.error('Registration error:', err);
    
    // More specific error handling
    let errorMessage = 'Registration failed. Please try again.';
    if (err.name === 'MongoServerError' && err.code === 11000) {
      errorMessage = 'This email or username is already registered.';
    } else if (err.name === 'ValidationError') {
      errorMessage = Object.values(err.errors).map(e => e.message).join(' ');
    }
    
    res.status(500).render('error', { 
      title: 'Registration Error',
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
});

// Login route
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', { 
    title: 'Continue Your Quest',
    errors: [],
    formData: null
  });
});

router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Continue Your Quest',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { login, password, rememberMe } = req.body;

    // Find user by email or username
    const user = await User.findByLogin(login);
    if (!user) {
      return res.render('auth/login', {
        title: 'Continue Your Quest',
        errors: [{ msg: 'Invalid email/username or password' }],
        formData: req.body
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Continue Your Quest',
        errors: [{ msg: 'Invalid email/username or password' }],
        formData: req.body
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.render('auth/login', {
        title: 'Continue Your Quest',
        errors: [{ msg: 'Your account has been deactivated. Please contact support.' }],
        formData: req.body
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create session
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.success = `Welcome back, ${user.username}! Ready to continue your coding quest?`;

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: rememberMe ? '7d' : '24h' }
    );

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    res.redirect('/dashboard');

  } catch (error) {
    console.error('Login error:', error);
    req.session.error = 'Login failed. Please try again.';
    res.redirect('/auth/login');
  }
});

// Logout route - POST method (fallback for any remaining forms)
router.post('/logout', (req, res) => {
  try {
    // Clear all authentication cookies first
    res.clearCookie('authToken', { path: '/' });
    res.clearCookie('connect.sid', { path: '/' });
    res.clearCookie('gameState', { path: '/' });
    res.clearCookie('playerData', { path: '/' });
    
    // Clear session data
    if (req.session) {
      req.session.userId = null;
      req.session.username = null;
      req.session.destroy((err) => {
        // Always redirect, never return JSON error
        res.redirect('/?message=logged_out');
      });
    } else {
      res.redirect('/?message=logged_out');
    }
  } catch (error) {
    console.error('POST Logout error:', error);
    // Force redirect even on error - never return JSON
    res.redirect('/?message=logged_out');
  }
});

// GET logout route - primary logout method
router.get('/logout', (req, res) => {
  console.log('GET Logout route accessed');
  try {
    // Clear all authentication cookies first
    res.clearCookie('authToken', { path: '/' });
    res.clearCookie('connect.sid', { path: '/' });
    res.clearCookie('gameState', { path: '/' });
    res.clearCookie('playerData', { path: '/' });
    console.log('Cookies cleared');
    
    // Clear session data
    if (req.session) {
      console.log('Session exists, clearing...');
      req.session.userId = null;
      req.session.username = null;
      req.session.destroy((err) => {
        if (err) {
          console.log('Session destroy error (non-critical):', err);
        }
        console.log('Redirecting to home page');
        res.redirect('/?message=logged_out');
      });
    } else {
      console.log('No session found, redirecting...');
      res.redirect('/?message=logged_out');
    }
  } catch (error) {
    console.error('GET Logout error:', error);
    res.redirect('/?message=logged_out');
  }
});

// Alternative logout route for testing
router.get('/logout-alt', (req, res) => {
  console.log('Alternative logout route accessed');
  // Simple logout - just clear everything and redirect
  res.clearCookie('authToken');
  res.clearCookie('connect.sid');
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  } else {
    res.redirect('/');
  }
});

// Forgot password route (placeholder)
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Reset Password' });
});

module.exports = router;

