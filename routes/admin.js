const express = require('express');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const Quest = require('../models/Quest');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Admin Analytics Dashboard
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    // Get all users with their data
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Get user progress data
    const userProgressData = await UserProgress.find().lean();
    
    // Create a map of user progress by userId
    const progressMap = {};
    userProgressData.forEach(progress => {
      progressMap[progress.userId.toString()] = progress;
    });

    // Calculate statistics
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const playerUsers = users.filter(u => u.role === 'player').length;
    
    // Calculate average stats
    const avgLevel = users.reduce((sum, u) => sum + (u.level || 0), 0) / totalUsers || 0;
    const avgExperience = users.reduce((sum, u) => sum + (u.experience || 0), 0) / totalUsers || 0;
    const avgPixelCoins = users.reduce((sum, u) => sum + (u.pixelCoins || 0), 0) / totalUsers || 0;
    
    const totalMonstersDefeated = users.reduce((sum, u) => sum + (u.gameStats?.monstersDefeated || 0), 0);
    const totalQuestsCompleted = users.reduce((sum, u) => sum + (u.gameStats?.questsCompleted || 0), 0);
    const totalCodeLines = users.reduce((sum, u) => sum + (u.gameStats?.codeLinesWritten || 0), 0);
    const totalPlayTime = users.reduce((sum, u) => sum + (u.gameStats?.playTime || 0), 0);

    // Character type distribution
    const characterTypes = {};
    users.forEach(u => {
      const type = u.characterType || 'knight';
      characterTypes[type] = (characterTypes[type] || 0) + 1;
    });

    // JS Level distribution
    const jsLevels = {};
    users.forEach(u => {
      const level = u.jsLevel || 'beginner';
      jsLevels[level] = (jsLevels[level] || 0) + 1;
    });

    // Enrich user data with progress information
    const enrichedUsers = users.map(user => {
      const progress = progressMap[user._id.toString()];
      return {
        ...user,
        progressData: progress || null
      };
    });

    res.render('admin/analytics', {
      title: 'Admin Analytics Dashboard',
      users: enrichedUsers,
      stats: {
        totalUsers,
        activeUsers,
        adminUsers,
        playerUsers,
        avgLevel: avgLevel.toFixed(2),
        avgExperience: avgExperience.toFixed(0),
        avgPixelCoins: avgPixelCoins.toFixed(0),
        totalMonstersDefeated,
        totalQuestsCompleted,
        totalCodeLines,
        totalPlayTime,
        avgPlayTime: (totalPlayTime / totalUsers || 0).toFixed(0)
      },
      distributions: {
        characterTypes,
        jsLevels
      }
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load analytics data',
      error: error
    });
  }
});

// API endpoint to get user details
router.get('/api/user/:userId', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    const progress = await UserProgress.findOne({ userId: req.params.userId }).lean();
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        ...user,
        progress
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
});

module.exports = router;
