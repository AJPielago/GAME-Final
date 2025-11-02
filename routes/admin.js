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

    // Level distribution for graph (1-50 in bins of 5, plus 50+)
    const levelDistribution = {};
    users.forEach(u => {
      const level = u.level || 1;
      if (level <= 50) {
        const binStart = Math.floor((level - 1) / 5) * 5 + 1;
        const binEnd = Math.min(binStart + 4, 50);
        const binKey = `${binStart}-${binEnd}`;
        levelDistribution[binKey] = (levelDistribution[binKey] || 0) + 1;
      } else {
        levelDistribution['50+'] = (levelDistribution['50+'] || 0) + 1;
      }
    });

    console.log('Final levelDistribution object:', levelDistribution);
    console.log('levelDistribution entries:', Object.entries(levelDistribution));
    console.log('Converted array:', Object.entries(levelDistribution).map(([key, value]) => ({ label: key, value })));
    console.log('Character types object:', characterTypes);
    console.log('JS levels object:', jsLevels);
    console.log('Total users for charts:', totalUsers);

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
        characterTypes: characterTypes || {},
        jsLevels: jsLevels || {}
      },
      chartData: {
        characterTypes: characterTypes && typeof characterTypes === 'object' ? Object.entries(characterTypes).map(([key, value]) => ({ label: key, value })) : [],
        jsLevels: jsLevels && typeof jsLevels === 'object' ? Object.entries(jsLevels).map(([key, value]) => ({ label: key, value })) : [],
        levelDistribution: levelDistribution && typeof levelDistribution === 'object' ? Object.entries(levelDistribution).map(([key, value]) => ({ label: key, value })) : [],
        stats: {
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          adminUsers: adminUsers || 0,
          avgLevel: parseFloat((avgLevel || 0).toFixed(2)),
          totalQuestsCompleted: totalQuestsCompleted || 0,
          totalMonstersDefeated: totalMonstersDefeated || 0,
          totalPlayTime: Math.floor((totalPlayTime || 0) / 60) // Convert to hours
        }
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

// Printable Report Route
router.get('/analytics/print', requireAdmin, async (req, res) => {
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

    // Level distribution for graph (1-50 in bins of 5, plus 50+)
    const levelDistribution = {};
    users.forEach(u => {
      const level = u.level || 1;
      if (level <= 50) {
        const binStart = Math.floor((level - 1) / 5) * 5 + 1;
        const binEnd = Math.min(binStart + 4, 50);
        const binKey = `${binStart}-${binEnd}`;
        levelDistribution[binKey] = (levelDistribution[binKey] || 0) + 1;
      } else {
        levelDistribution['50+'] = (levelDistribution['50+'] || 0) + 1;
      }
    });

    // JS Level distribution
    const jsLevels = {};
    users.forEach(u => {
      const level = u.jsLevel || 'beginner';
      jsLevels[level] = (jsLevels[level] || 0) + 1;
    });

    console.log('Level distribution calculated:', levelDistribution);
    console.log('Character types calculated:', characterTypes);
    console.log('JS levels calculated:', jsLevels);

    // User registration over time (last 30 days, group by day)
    const registrationData = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    users.forEach(u => {
      try {
        if (u.createdAt) {
          const createdAt = new Date(u.createdAt);
          if (createdAt >= thirtyDaysAgo) {
            const dateKey = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
            registrationData[dateKey] = (registrationData[dateKey] || 0) + 1;
          }
        }
      } catch (error) {
        console.warn('Error processing user creation date:', error);
      }
    });

    // Sort registration dates
    const sortedDates = Object.keys(registrationData).sort();
    const registrationChartData = sortedDates.map(date => ({
      date,
      count: registrationData[date]
    }));

    // Quest completion distribution
    const questCompletionDistribution = {};
    users.forEach(u => {
      const quests = u.gameStats?.questsCompleted || 0;
      if (quests === 0) {
        questCompletionDistribution['0'] = (questCompletionDistribution['0'] || 0) + 1;
      } else if (quests <= 5) {
        questCompletionDistribution['1-5'] = (questCompletionDistribution['1-5'] || 0) + 1;
      } else if (quests <= 10) {
        questCompletionDistribution['6-10'] = (questCompletionDistribution['6-10'] || 0) + 1;
      } else if (quests <= 20) {
        questCompletionDistribution['11-20'] = (questCompletionDistribution['11-20'] || 0) + 1;
      } else {
        questCompletionDistribution['20+'] = (questCompletionDistribution['20+'] || 0) + 1;
      }
    });

    // Enrich user data with progress information
    const enrichedUsers = users.map(user => {
      const progress = progressMap[user._id.toString()];
      return {
        ...user,
        progressData: progress || null
      };
    });

    res.render('admin/analytics-print', {
      title: 'CodeQuest Analytics Report',
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
        jsLevels,
        levelDistribution,
        questCompletionDistribution
      },
      reportDate: new Date().toLocaleString(),
      reportPeriod: 'Last 30 Days Activity'
    });
  } catch (error) {
    console.error('=== ERROR IN PRINT ROUTE ===');
    console.error('Error generating printable report:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    console.error('=== END ERROR ===');
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to generate printable report',
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

    console.log('Main analytics chartData passed to template');
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
});

// Create new user
router.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role, inGameName, age, characterType, jsLevel } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'player',
      inGameName: inGameName || null,
      age: age ? parseInt(age) : null,
      characterType: characterType || 'knight',
      jsLevel: jsLevel || 'beginner',
      level: 1,
      experience: 0,
      pixelCoins: 0,
      badges: [],
      achievements: [],
      gameStats: {
        monstersDefeated: 0,
        questsCompleted: 0,
        codeLinesWritten: 0,
        playTime: 0
      },
      gameState: {
        x: 32,
        y: 32,
        savedAt: null
      },
      extendedGameState: {
        collectedRewards: [],
        activeQuests: [],
        completedQuests: [],
        interactedNPCs: [],
        questProgress: {},
        playerDirection: 'right',
        currentAnimation: 'idle'
      },
      questHistory: [],
      isActive: true
    });

    await newUser.save();

    console.log(`✅ Admin created new user: ${username} (${role})`);
    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// Update user
router.put('/api/users/:userId', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const updates = req.body;

    // Don't allow password updates through this endpoint for security
    delete updates.password;
    delete updates._id;

    // Validate role if provided
    if (updates.role && !['admin', 'player'].includes(updates.role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "admin" or "player"'
      });
    }

    // Validate email uniqueness if email is being changed
    if (updates.email) {
      const existingEmail = await User.findOne({
        email: updates.email,
        _id: { $ne: userId }
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Validate username uniqueness if username is being changed
    if (updates.username) {
      const existingUsername = await User.findOne({
        username: updates.username,
        _id: { $ne: userId }
      });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Convert age to number if provided
    if (updates.age !== undefined) {
      updates.age = updates.age ? parseInt(updates.age) : null;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ Admin updated user: ${updatedUser.username}`);
    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// Delete user
router.delete('/api/users/:userId', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Prevent admin from deleting themselves
    if (userId === req.session.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete associated user progress
    await UserProgress.deleteMany({ userId: userId });

    // Delete the user
    await User.findByIdAndDelete(userId);

    console.log(`✅ Admin deleted user: ${user.username}`);
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

module.exports = router;
