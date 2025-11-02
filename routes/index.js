const express = require('express');
const User = require('../models/User');
const Quest = require('../models/Quest');
const UserProgress = require('../models/UserProgress');
const CollisionOverride = require('../models/CollisionOverride');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Debug middleware to log all requests
router.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`🔍 API Request: ${req.method} ${req.path}`);
    console.log('📦 Body:', req.body);
    console.log('🔐 Session userId:', req.session?.userId);
  }
  next();
});

// Landing page
router.get('/', async (req, res) => {
  // Handle logout success message
  let successMessage = null;
  if (req.query.message === 'logged_out') {
    successMessage = 'You have been logged out successfully.';
  }
  
  // Get total user count for stats
  let totalUsers = 0;
  try {
    totalUsers = await User.countDocuments({ isActive: true });
  } catch (error) {
    console.error('Error counting users:', error);
  }
  
  // Get full user object if logged in
  let user = null;
  if (req.session.userId) {
    try {
      user = await User.findById(req.session.userId).select('-password');
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }
  
  res.render('index', { 
    title: 'CodeQuest - AI-Driven Programming Education',
    user: user,
    success: successMessage,
    stats: {
      activeCoders: totalUsers,
      languages: 5, // JavaScript, Python, Java, C++, etc.
      challenges: 50 // Total quests/challenges available
    }
  });
});

// Quest data mapping (shared with game.js)
const questData = {
  286: {
    name: 'First Quest',
    description: 'Your first adventure in CodeQuest! Learn the basics and get started.',
    badge: 'First Quest Complete'
  },
  287: {
    name: 'JavaScript History',
    description: 'Discover the fascinating origins of JavaScript and how it became the web\'s most popular language.',
    badge: 'JavaScript Historian'
  },
  279: {
    name: 'JavaScript History',
    description: 'Learn about JavaScript\'s creation by Brendan Eich and its evolution over the years.',
    badge: 'JavaScript Historian'
  },
  288: {
    name: 'Variables & Data Types',
    description: 'Master JavaScript variables using let, const, and var. Learn about strings, numbers, and booleans.',
    badge: 'Variable Master'
  },
  291: {
    name: 'Functions in JavaScript',
    description: 'Learn to create reusable code with functions. Master parameters, return values, and arrow functions.',
    badge: 'Function Expert'
  },
  // Quest 5 - Add the actual ID from your map
  292: {
    name: 'Conditionals (if/else)',
    description: 'Make decisions in code with if/else statements. Learn comparison and logical operators.',
    badge: 'Conditional Champion'
  }
  // Add more quest IDs and data as needed
};

// Helper function to get quest name
function getQuestName(questId) {
  return questData[questId]?.name || `Quest #${questId}`;
}

// Helper function to get quest description
function getQuestDescription(questId) {
  return questData[questId]?.description || 'Complete this quest to progress in your coding journey.';
}

// Dashboard (protected route)
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      req.session.destroy();
      req.session.error = 'User not found. Please log in again.';
      return res.redirect('/auth/login');
    }

    // Get active quests from user's game state
    const activeQuests = user.extendedGameState?.activeQuests || [];
    const completedQuests = user.extendedGameState?.completedQuests || [];
    
    // Log user data for debugging
    console.log('📊 Dashboard - User data:', {
      username: user.username,
      level: user.level,
      experience: user.experience,
      pixelCoins: user.pixelCoins,
      badges: user.badges,
      badgeCount: user.badges ? user.badges.length : 0,
      activeQuests: activeQuests,
      completedQuests: completedQuests,
      extendedGameState: user.extendedGameState
    });
    
    console.log('📋 Quest data being passed:', questData);
    console.log('🔍 Quest IDs to names:');
    completedQuests.forEach(id => {
      console.log(`  Quest ${id}: ${questData[id]?.name || 'NOT FOUND'}`);
    });
    
    // Determine current quest status
    let currentQuestInfo = {
      title: 'No Active Quest',
      description: 'Start a new quest in the game!',
      status: 'none'
    };
    
    if (activeQuests.length > 0) {
      // User has active quests - show the first one with details
      const firstQuestId = activeQuests[0];
      const questInfo = questData[firstQuestId];
      currentQuestInfo = {
        title: questInfo ? questInfo.name : `Quest #${firstQuestId}`,
        description: questInfo ? questInfo.description : 'Continue your adventure in the game',
        status: 'active',
        count: activeQuests.length
      };
    } else if (completedQuests.length > 0) {
      // User completed quests, ready for next
      currentQuestInfo = {
        title: 'Ready for Next Quest',
        description: `You've completed ${completedQuests.length} quest${completedQuests.length > 1 ? 's' : ''}! Find your next adventure.`,
        status: 'ready'
      };
    }

    res.render('dashboard', {
      title: `${user.username}'s CodeQuest Dashboard`,
      user: user,
      questProgress: { 
        completed: completedQuests.length, 
        active: activeQuests.length,
        totalCorrectAnswers: 0 
      },
      currentQuest: currentQuestInfo,
      recentQuests: [],
      questData: questData,
      getQuestName: getQuestName,
      getQuestDescription: getQuestDescription
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.session.error = 'Unable to load dashboard. Please try again.';
    res.redirect('/auth/login');
  }
});

// Tutorial page
router.get('/tutorial', async (req, res) => {
  // Get full user object if logged in
  let user = null;
  if (req.session.userId) {
    try {
      user = await User.findById(req.session.userId).select('-password');
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }
  
  res.render('tutorial', {
    title: 'CodeQuest - Tutorial',
    user: user
  });
});

// Profile route (protected)
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      req.session.destroy();
      req.session.error = 'User not found. Please log in again.';
      return res.redirect('/auth/login');
    }

    // Ensure gameStats is initialized
    if (!user.gameStats) {
      user.gameStats = {
        monstersDefeated: 0,
        questsCompleted: 0,
        codeLinesWritten: 0,
        playTime: 0
      };
    }

    // Deduplicate quest history FIRST to get accurate unique quest count
    let uniqueQuests = [];
    if (user.questHistory && user.questHistory.length > 0) {
      const questMap = new Map();
      
      // Process each quest entry - keep only highest scoring attempt per quest
      user.questHistory.forEach(quest => {
        const questId = quest.questId;
        const existing = questMap.get(questId);
        
        // If no existing entry or this one has a higher score, use this one
        if (!existing || quest.quizScore.percentage > existing.quizScore.percentage) {
          questMap.set(questId, quest);
        }
      });
      
      // Convert map to array
      uniqueQuests = Array.from(questMap.values());
      
      console.log(`📊 Quest deduplication: ${user.questHistory.length} total entries → ${uniqueQuests.length} unique quests`);
    }

    // FORCE SYNC: Always sync questsCompleted with UNIQUE quest count
    const actualQuestsCompleted = uniqueQuests.length;
    console.log(`🔄 Profile sync for user ${user.username}:`);
    console.log(`   questHistory.length (raw) = ${user.questHistory ? user.questHistory.length : 0}`);
    console.log(`   questHistory.length (unique) = ${actualQuestsCompleted}`);
    console.log(`   gameStats.questsCompleted = ${user.gameStats.questsCompleted}`);
    
    if (user.gameStats.questsCompleted !== actualQuestsCompleted) {
      console.log(`   ⚠️ MISMATCH! Updating gameStats.questsCompleted from ${user.gameStats.questsCompleted} to ${actualQuestsCompleted}`);
      user.gameStats.questsCompleted = actualQuestsCompleted;
      console.log(`✅ Synced questsCompleted to ${actualQuestsCompleted}`);
    } else {
      console.log(`   ✅ Already in sync: ${actualQuestsCompleted}`);
    }

    // Calculate and sync codeLinesWritten from UNIQUE quests only
    if (uniqueQuests.length > 0) {
      const totalCodeLines = uniqueQuests.reduce((total, quest) => {
        let lines = 0;
        // Count quiz questions answered (each question counts as 1 line)
        if (quest.quizAnswers && quest.quizAnswers.length > 0) {
          lines += quest.quizAnswers.length;
        }
        // Count challenge code lines
        if (quest.challengeCompleted && quest.challengeCode) {
          const codeLines = quest.challengeCode.split('\n').filter(line => line.trim().length > 0).length;
          lines += codeLines || 10;
        }
        return total + lines;
      }, 0);
      
      if (user.gameStats.codeLinesWritten !== totalCodeLines) {
        user.gameStats.codeLinesWritten = totalCodeLines;
        console.log(`✅ Synced codeLinesWritten to ${totalCodeLines} (from unique quests)`);
      }
    }

    // Save the synced data
    await user.save();

    // RELOAD the user to get the updated data for the template
    const updatedUser = await User.findById(req.session.userId).select('-password');

    // Apply deduplicated quest history for display
    if (updatedUser.questHistory && updatedUser.questHistory.length > 0) {
      const questMap = new Map();
      
      // Process each quest entry
      updatedUser.questHistory.forEach(quest => {
        const questId = quest.questId;
        const existing = questMap.get(questId);
        
        // If no existing entry or this one has a higher score, use this one
        if (!existing || quest.quizScore.percentage > existing.quizScore.percentage) {
          questMap.set(questId, quest);
        }
      });
      
      // Convert map back to array, sorted by completion date (most recent first)
      updatedUser.questHistory = Array.from(questMap.values())
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      
      console.log(`📊 Deduplicated quest history for display: ${updatedUser.questHistory.length} unique quests`);
      
      // IMPORTANT: Update gameStats to match the deduplicated count for display
      updatedUser.gameStats.questsCompleted = updatedUser.questHistory.length;
      console.log(`✅ Updated display gameStats.questsCompleted to ${updatedUser.gameStats.questsCompleted}`);
    }

    res.render('profile', {
      title: `${updatedUser.username}'s Profile`,
      user: updatedUser,
      questData: questData
    });
  } catch (error) {
    console.error('Profile error:', error);
    req.session.error = 'Unable to load profile. Please try again.';
    res.redirect('/dashboard');
  }
});

// Character Selection route (protected)
router.get('/character-selection', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      req.session.destroy();
      req.session.error = 'User not found. Please log in again.';
      return res.redirect('/auth/login');
    }

    res.render('character-selection', {
      title: `${user.username}'s Character Selection`,
      user: user
    });
  } catch (error) {
    console.error('Character selection error:', error);
    req.session.error = 'Unable to load character selection. Please try again.';
    res.redirect('/dashboard');
  }
});

// Character Selection POST route (protected)
router.post('/character-selection', requireAuth, async (req, res) => {
  try {
    const { avatar, characterType, codingStyle, goals } = req.body;
    
    console.log('🎮 Character Selection POST received:');
    console.log('📦 Request body:', req.body);
    console.log('🎭 Character Type:', characterType);
    console.log('🖼️ Avatar:', avatar);
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.error = 'User not found. Please log in again.';
      return res.redirect('/auth/login');
    }

    console.log('👤 Current user character type BEFORE update:', user.characterType);

    // Update user's character selection
    user.characterAvatar = avatar || '/images/characters/tinyKnight .gif';
    user.characterType = characterType || 'knight';
    user.codingStyle = codingStyle || 'aggressive';
    user.learningGoals = Array.isArray(goals) ? goals : (goals ? [goals] : []);
    
    console.log('👤 User character type AFTER update (before save):', user.characterType);
    
    await user.save();
    
    console.log('✅ Character selection saved to database');
    console.log('👤 User character type AFTER save:', user.characterType);
    
    req.session.success = 'Character selection saved successfully!';
    
    // Check if it's an AJAX request (fetch request)
    const isAjax = req.headers.accept && req.headers.accept.includes('application/json') ||
                   req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                   req.xhr ||
                   req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data');

    console.log('🔍 Is AJAX request?', isAjax);
    console.log('🔍 Accept header:', req.headers.accept);
    console.log('🔍 Content-Type:', req.headers['content-type']);

    if (isAjax) {
      // AJAX request - return JSON
      console.log('📤 Sending JSON response');
      res.json({
        success: true,
        message: 'Character selection saved successfully!',
        character: {
          avatar: user.characterAvatar,
          type: user.characterType
        }
      });
    } else {
      // Regular form submission - redirect to prologue first
      console.log('🎬 Redirecting to /prologue after character selection');
      req.session.success = 'Character selection saved successfully!';
      res.redirect('/prologue');
    }
  } catch (error) {
    console.error('Character selection save error:', error);
    req.session.error = 'Unable to save character selection. Please try again.';
    res.redirect('/character-selection');
  }
});

// Leaderboard route with dynamic sorting
router.get('/leaderboard', async (req, res) => {
  try {
    const rankBy = req.query.rankBy || 'xp'; // Default to XP
    const timePeriod = req.query.timePeriod || 'all';
    
    let topUsers;
    
    if (rankBy === 'badges') {
      // For badges, use aggregation to sort by array length
      topUsers = await User.aggregate([
        { $match: { isActive: true } },
        { $addFields: { badgeCount: { $size: { $ifNull: ['$badges', []] } } } },
        { $sort: { badgeCount: -1, experience: -1 } },
        { $limit: 50 },
        { $project: { username: 1, level: 1, experience: 1, badges: 1, pixelCoins: 1, preferredLanguage: 1 } }
      ]);
    } else {
      // Determine sort field for other cases
      let sortField = {};
      switch(rankBy) {
        case 'level':
          sortField = { level: -1, experience: -1 };
          break;
        case 'gold':
          sortField = { pixelCoins: -1, experience: -1 };
          break;
        case 'xp':
        default:
          sortField = { experience: -1, level: -1 };
          break;
      }

      topUsers = await User.find({ isActive: true })
        .select('username level experience badges pixelCoins preferredLanguage')
        .sort(sortField)
        .limit(50);
    }

    // Get full user object if logged in
    let currentUser = null;
    if (req.session.userId) {
      try {
        currentUser = await User.findById(req.session.userId).select('-password');
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    }

    res.render('leaderboard', {
      title: 'CodeQuest Leaderboard',
      topUsers: topUsers,
      rankBy: rankBy,
      timePeriod: timePeriod,
      user: currentUser
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    const rankBy = req.query.rankBy || 'xp';
    const timePeriod = req.query.timePeriod || 'all';
    // Get full user object if logged in
    let currentUser = null;
    if (req.session.userId) {
      try {
        currentUser = await User.findById(req.session.userId).select('-password');
      } catch (error) {
        console.error('Error fetching user in error handler:', error);
      }
    }

    res.render('leaderboard', {
      title: 'CodeQuest Leaderboard',
      topUsers: [],
      rankBy: rankBy,
      timePeriod: timePeriod,
      user: currentUser
    });
  }
});

// Prologue route (protected) - Shows prologue video before game
router.get('/prologue', requireAuth, async (req, res) => {
  try {
    console.log('Prologue route accessed - showing prologue video');

    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      console.log('User not found for ID:', req.session.userId);
      req.session.destroy();
      req.session.error = 'User not found. Please log in again.';
      return res.redirect('/auth/login');
    }

    console.log('Rendering prologue for user:', user.username);
    res.render('prologue', {
      title: 'CodeQuest - Prologue',
      user: user
    });
  } catch (error) {
    console.error('Prologue route error:', error);
    req.session.error = 'Unable to load prologue. Please try again.';
    res.redirect('/dashboard');
  }
});

// Play Game route (protected) - Redirects to /game for full sequence on refresh
router.get('/play-game', requireAuth, async (req, res) => {
  try {
    console.log('Play Game route accessed - redirecting to /game for full sequence');
    // Redirect to /game which will trigger character selection -> prologue -> game
    return res.redirect('/game');
  } catch (error) {
    console.error('Play Game route error:', error);
    req.session.error = 'Unable to load game. Please try again.';
    res.redirect('/dashboard');
  }
});

// Game Page route (protected) - MODIFIED: Also redirect to character selection for full refresh sequence
router.get('/game-page', requireAuth, async (req, res) => {
  try {
    console.log('Game Page route accessed - redirecting to character selection for full sequence');

    // ALWAYS redirect to character selection to ensure full sequence on every access
    return res.redirect('/character-selection');

  } catch (error) {
    console.error('Game Page route error:', error);
    req.session.error = 'Unable to load game. Please try again.';
    res.redirect('/dashboard');
  }
});

// Game route (protected) - Clears character data on browser refresh, but allows normal game access after prologue
router.get('/game', requireAuth, async (req, res) => {
  try {
    console.log('Game route accessed by user ID:', req.session.userId);
    console.log('Query parameters:', req.query);

    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      console.log('User not found for ID:', req.session.userId);
      req.session.destroy();
      req.session.error = 'User not found. Please log in again.';
      return res.redirect('/auth/login');
    }

    // Check if coming from prologue - if so, allow normal game access
    if (req.query.from === 'prologue') {
      console.log('Coming from prologue - allowing normal game access');
      
      // Check if user has selected a character
      if (!user.characterType || !user.characterAvatar) {
        console.log('No character selected after prologue - redirecting to character selection');
        return res.redirect('/character-selection');
      }

      console.log('Rendering game for user:', user.username);
      console.log('👤 User character type:', user.characterType);
      console.log('🖼️ User character avatar:', user.characterAvatar);
      
      return res.render('game', {
        title: 'CodeQuest - Game',
        user: user,
        _debug: {
          userId: user._id,
          timestamp: new Date().toISOString(),
          nodeEnv: process.env.NODE_ENV || 'development',
          scripts: [
            '/js/game.js',
            '/js/map.js'
          ]
        }
      });
    }

    // Browser refresh detected - clear character data for full sequence
    console.log('Browser refresh detected - clearing character data for full sequence');
    if (user.characterType || user.characterAvatar) {
      user.characterType = null;
      user.characterAvatar = null;
      user.codingStyle = null;
      user.learningGoals = [];
      await user.save();
      console.log('✅ Character data cleared for browser refresh');
    }

    console.log('Redirecting to character selection for full sequence...');
    return res.redirect('/character-selection');
    
  } catch (error) {
    console.error('Game route error:', error);
    req.session.error = 'Unable to load game. Please try again.';
    res.redirect('/dashboard');
  }
});

// Get user profile (protected) - MODIFIED: Always return fresh Level 1 data
router.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // ALWAYS return fresh Level 1 data - ignore database values
    console.log('🔄 Profile API: Returning fresh Level 1 data (database values ignored)');
    
    res.json({
      success: true,
      playerName: user.username || 'Unknown Player',
      inGameName: null,
      pixelCoins: 0,
      experience: 0,
      level: 1,
      badges: [],
      achievements: [],
      gameStats: {
        monstersDefeated: 0,
        questsCompleted: 0,
        codeLinesWritten: 0,
        playTime: 0
      },
      role: user.role || 'player',
      characterType: user.characterType || 'knight'
    });
  } catch (error) {
    console.error('Profile API error:', error);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
});

// Save game state (protected) - Enhanced with better validation
router.post('/game/save', requireAuth, async (req, res) => {
  try {
    console.log('💾 Received save request for user:', req.session.userId);
    console.log('📦 Save data received:', JSON.stringify(req.body, null, 2));
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.error('❌ User not found:', req.session.userId);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { 
      playerName, inGameName, playerPosition, pixelCoins, experience, level, 
      badges, achievements, gameStats, collectedRewards, activeQuests, 
      completedQuests, interactedNPCs, questProgress, playerDirection, currentAnimation, savedAt 
    } = req.body || {};
    
    // Log received inGameName for debugging
    console.log('📥 Received inGameName:', inGameName, 'Type:', typeof inGameName);
    
    // Validate and update player names
    if (typeof playerName === 'string' && playerName.trim()) {
      // Don't overwrite username, but we can store display name
    }
    
    // Update in-game name (character name chosen in first quest)
    if (typeof inGameName === 'string' && inGameName.trim()) {
      user.inGameName = inGameName.trim();
      console.log('👤 Updated inGameName:', user.inGameName);
    } else if (inGameName === null || inGameName === undefined) {
      console.log('⚠️ inGameName is null/undefined, keeping existing value:', user.inGameName);
    } else {
      console.log('❌ Invalid inGameName received:', inGameName);
    }
    
    // Update game position with validation
    if (playerPosition && typeof playerPosition === 'object') {
      const x = Number(playerPosition.x);
      const y = Number(playerPosition.y);
      
      if (!isNaN(x) && !isNaN(y)) {
        user.gameState = {
          x: x,
          y: y,
          savedAt: savedAt || new Date().toISOString()
        };
        console.log('📍 Updated player position:', { x, y });
      } else {
        console.warn('⚠️ Invalid player position data:', playerPosition);
      }
    } else if (playerPosition === null) {
      // Explicitly clear gameState for new game
      user.gameState = null;
      console.log('🗑️ Cleared player position for new game');
      
      // Clear quest history for complete fresh start
      user.questHistory = [];
      console.log('📜 Cleared quest history for new game');
      
      // Clear any additional persistent data that should be reset
      user.characterAvatar = null;
      user.characterType = null;
      user.codingStyle = null;
      user.learningGoals = [];
      console.log('🎭 Cleared character data for new game');
    }
    
    // Determine if this save represents higher progress (higher level)
    const currentLevel = user.level || 1;
    const incomingLevel = typeof level === 'number' && level >= 1 ? level : currentLevel;
    const isHigherProgress = incomingLevel >= currentLevel;
    
    console.log(`🔄 Progress check for user ${user.username}:`);
    console.log(`   Current level: ${currentLevel}, Incoming level: ${incomingLevel}`);
    console.log(`   Is higher progress: ${isHigherProgress}`);
    
    // Update profile data with validation - only update progress fields if level is higher
    if (isHigherProgress) {
      if (typeof pixelCoins === 'number' && pixelCoins >= 0) {
        user.pixelCoins = pixelCoins;
        console.log('💰 Updated pixelCoins:', pixelCoins);
      }
      
      if (typeof experience === 'number' && experience >= 0) {
        user.experience = experience;
        console.log('⭐ Updated experience:', experience);
      }
      
      if (typeof level === 'number' && level >= 1) {
        user.level = level;
        console.log('📊 Updated level:', level);
      }
      
      if (Array.isArray(badges)) {
        user.badges = badges.filter(badge => typeof badge === 'string');
        console.log('🏆 Updated badges:', user.badges);
        console.log('🏆 Badge types:', badges.map(b => typeof b));
      }
      
      if (Array.isArray(achievements)) {
        user.achievements = achievements;
        console.log('🎖️ Updated achievements:', achievements.length);
      }
      
      if (gameStats && typeof gameStats === 'object') {
        user.gameStats = {
          monstersDefeated: Number(gameStats.monstersDefeated) || user.gameStats?.monstersDefeated || 0,
          questsCompleted: Number(gameStats.questsCompleted) || user.gameStats?.questsCompleted || 0,
          codeLinesWritten: Number(gameStats.codeLinesWritten) || user.gameStats?.codeLinesWritten || 0,
          playTime: Number(gameStats.playTime) || user.gameStats?.playTime || 0
        };
        console.log('📈 Updated gameStats:', user.gameStats);
      }
    } else {
      console.log('⚠️ Skipping progress updates - incoming level not higher than current level');
    }
    
    // Store additional game state data with validation
    user.extendedGameState = {
      collectedRewards: Array.isArray(collectedRewards) ? collectedRewards.filter(r => typeof r === 'string' || typeof r === 'number') : [],
      activeQuests: Array.isArray(activeQuests) ? activeQuests.filter(q => typeof q === 'string' || typeof q === 'number') : [],
      completedQuests: Array.isArray(completedQuests) ? completedQuests.filter(q => typeof q === 'string' || typeof q === 'number') : [],
      interactedNPCs: Array.isArray(interactedNPCs) ? interactedNPCs.filter(n => typeof n === 'string' || typeof n === 'number') : [],
      questProgress: questProgress && typeof questProgress === 'object' ? questProgress : {},
      playerDirection: ['left', 'right', 'up', 'down'].includes(playerDirection) ? playerDirection : 'right',
      currentAnimation: ['idle', 'walk', 'attack', 'hurt'].includes(currentAnimation) ? currentAnimation : 'idle'
    };
    
    // Note: Collision overrides are now saved globally via /api/collision-overrides/save
    
    console.log('🎮 Updated extendedGameState:', user.extendedGameState);
    
    // Save to database with detailed error handling
    try {
      // Mark fields as modified to ensure they save
      if (user.isModified('badges')) {
        console.log('📝 Badges field modified, will save');
      }
      if (user.isModified('gameState')) {
        console.log('📝 GameState field modified, will save');
      }
      if (user.isModified('extendedGameState')) {
        console.log('📝 ExtendedGameState field modified, will save');
      }
      
      await user.save({ validateBeforeSave: true });
      console.log('✅ Game saved successfully for user:', user.username);
      console.log('✅ Final badges in DB:', user.badges);
    } catch (saveError) {
      console.error('❌ Database save error:', saveError);
      console.error('❌ Save error name:', saveError.name);
      console.error('❌ Save error message:', saveError.message);
      if (saveError.errors) {
        console.error('❌ Validation errors:', JSON.stringify(saveError.errors, null, 2));
        // Log each validation error separately
        Object.keys(saveError.errors).forEach(key => {
          console.error(`❌ Field '${key}':`, saveError.errors[key].message);
        });
      }
      throw saveError; // Re-throw to be caught by outer catch
    }

    res.json({ 
      success: true, 
      message: 'Game saved successfully',
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Save game error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Check for specific error types
    let errorMessage = 'Failed to save game';
    if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    } else if (error.name === 'CastError') {
      errorMessage = 'Invalid data type: ' + error.message;
    } else {
      errorMessage = error.message || 'Unknown error';
    }
    
    // Send more detailed error information
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      errorType: error.name,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Load game state (protected) - DISABLED: Always return no save data for fresh start
router.get('/game/load', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // ALWAYS return no save data - force fresh start every time
    console.log('🔄 Auto-load disabled - returning no save data for fresh start');
    return res.json({ success: false, message: 'No save data found (auto-load disabled)' });
  } catch (error) {
    console.error('Load game error:', error);
    res.status(500).json({ success: false, message: 'Failed to load game' });
  }
});

// Delete game save (protected)
router.delete('/game/delete', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Reset game-related data
    user.inGameName = null; // Reset in-game character name
    user.pixelCoins = 0;
    user.experience = 0;
    user.level = 1;
    user.badges = [];
    user.achievements = [];
    user.gameStats = {
      monstersDefeated: 0,
      questsCompleted: 0,
      codeLinesWritten: 0,
      playTime: 0
    };
    user.gameState = {
      x: 32,
      y: 32,
      savedAt: null
    };
    user.extendedGameState = {
      collectedRewards: [],
      activeQuests: [],
      completedQuests: [],
      interactedNPCs: [],
      questProgress: {}, // Reset quest progress tracking
      playerDirection: 'right',
      currentAnimation: 'idle'
    };
    
    // Note: Collision overrides are global and not deleted with user saves
    
    await user.save();
    console.log('✅ Game data deleted for user:', user.username);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete game data' });
  }
});

// Save quest history (protected)
router.post('/api/quest-history', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { questId, questName, quizScore, quizAnswers, challengeCompleted, challengeCode, totalXP, totalGold } = req.body;

    // Create quest history entry
    const questHistoryEntry = {
      questId,
      questName,
      completedAt: new Date(),
      quizScore: {
        correct: quizScore.correct || 0,
        wrong: quizScore.wrong || 0,
        total: quizScore.total || 0,
        percentage: quizScore.percentage || 0
      },
      quizAnswers: quizAnswers || [],
      challengeCompleted: challengeCompleted || false,
      challengeCode: challengeCode || '',
      totalXP: totalXP || 0,
      totalGold: totalGold || 0
    };

    // Add to quest history array
    if (!user.questHistory) {
      user.questHistory = [];
    }
    
    console.log(`📚 Before saving quest history for user ${user.username}:`);
    console.log(`   Current questHistory.length = ${user.questHistory.length}`);
    console.log(`   Adding quest: ${questName}`);
    
    // Check if this quest has already been completed
    const existingQuestIndex = user.questHistory.findIndex(q => q.questId === questId);
    
    if (existingQuestIndex >= 0) {
      console.log(`⚠️ Quest ${questId} (${questName}) already exists in history at index ${existingQuestIndex}`);
      console.log(`   Skipping duplicate quest recording`);
      
      // Return success but don't add duplicate
      res.json({ success: true, message: 'Quest already recorded (duplicate skipped)' });
      return;
    }
    
    user.questHistory.push(questHistoryEntry);
    
    console.log(`   After push: questHistory.length = ${user.questHistory.length}`);

    // Sync gameStats with actual quest history data
    if (!user.gameStats) {
      user.gameStats = {
        monstersDefeated: 0,
        questsCompleted: 0,
        codeLinesWritten: 0,
        playTime: 0
      };
    }
    
    // Update questsCompleted
    console.log(`   Before sync: gameStats.questsCompleted = ${user.gameStats.questsCompleted}`);
    user.gameStats.questsCompleted = user.questHistory.length;
    console.log(`   After sync: gameStats.questsCompleted = ${user.gameStats.questsCompleted}`);

    // Calculate and update codeLinesWritten from all quests
    const totalCodeLines = user.questHistory.reduce((total, quest) => {
      let lines = 0;
      // Count quiz questions answered (each question counts as 1 line)
      if (quest.quizAnswers && quest.quizAnswers.length > 0) {
        lines += quest.quizAnswers.length;
      }
      // Count challenge code lines
      if (quest.challengeCompleted && quest.challengeCode) {
        const codeLines = quest.challengeCode.split('\n').filter(line => line.trim().length > 0).length;
        lines += codeLines || 10;
      }
      return total + lines;
    }, 0);
    user.gameStats.codeLinesWritten = totalCodeLines;

    await user.save();
    console.log('📚 Quest history saved for user:', user.username, 'Quest:', questName);
    console.log('📊 Updated gameStats - Quests:', user.gameStats.questsCompleted, 'Code Lines:', user.gameStats.codeLinesWritten);

    res.json({ success: true, message: 'Quest history saved successfully' });
  } catch (error) {
    console.error('Quest history save error:', error);
    res.status(500).json({ success: false, message: 'Failed to save quest history' });
  }
});

// Update user profile (protected)
router.post('/api/update-profile', requireAuth, async (req, res) => {
  try {
    console.log('📝 Profile update request received:', req.body);
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.error('❌ User not found:', req.session.userId);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { username, inGameName, age, email } = req.body;
    console.log('👤 Current user:', user.username, 'Updating to:', { username, inGameName, age, email });

    // Validate username if provided
    if (username && username !== user.username) {
      console.log('🔄 Username change requested:', user.username, '->', username);
      
      // Check username format
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        console.error('❌ Invalid username format:', username);
        return res.status(400).json({ success: false, message: 'Username must be 3-30 characters and contain only letters, numbers, _ and -' });
      }
      
      // Check if username is already taken
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        console.error('❌ Username already taken:', username);
        return res.status(400).json({ success: false, message: 'Username is already taken' });
      }
      user.username = username;
      console.log('✅ Username updated');
    }

    // Validate age if provided
    if (age !== undefined && age !== null && age !== '') {
      const ageNum = parseInt(age);
      if (ageNum < 5 || ageNum > 120) {
        console.error('❌ Invalid age:', age);
        return res.status(400).json({ success: false, message: 'Age must be between 5 and 120' });
      }
      user.age = ageNum;
      console.log('✅ Age updated to:', ageNum);
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      console.log('📧 Email change requested:', user.email, '->', email);
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.error('❌ Email already in use:', email);
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
      user.email = email;
      console.log('✅ Email updated');
    }

    // Update in-game name
    if (inGameName !== undefined) {
      user.inGameName = inGameName || null;
      console.log('✅ In-game name updated to:', inGameName || 'null');
    }

    await user.save();
    console.log('✅ Profile saved successfully for user:', user.username);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to update profile: ' + error.message });
  }
});

// ============================================
// GLOBAL COLLISION OVERRIDE ROUTES
// ============================================

// Save global collision overrides (ADMIN ONLY)
router.post('/api/collision-overrides/save', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.session.userId).select('role');
    if (!user || user.role !== 'admin') {
      console.log('⚠️ Non-admin user attempted to save collision overrides:', req.session.userId);
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Only administrators can modify collision overrides.' 
      });
    }
    
    const { overrides } = req.body;
    
    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid overrides data' });
    }
    
    console.log('🔧 Admin saving global collision overrides:', Object.keys(overrides).length, 'tiles');
    
    // Find or create the global collision override document
    let collisionDoc = await CollisionOverride.findById('global');
    
    if (!collisionDoc) {
      // Create new document if it doesn't exist
      collisionDoc = new CollisionOverride({
        _id: 'global',
        overrides: overrides,
        modifiedBy: req.session.userId || 'unknown'
      });
    } else {
      // Update existing document
      collisionDoc.overrides = overrides;
      collisionDoc.modifiedBy = req.session.userId || 'unknown';
      collisionDoc.lastModified = new Date();
    }
    
    await collisionDoc.save();
    console.log('✅ Global collision overrides saved successfully');
    
    res.json({ 
      success: true, 
      message: 'Collision overrides saved globally',
      count: Object.keys(overrides).length
    });
  } catch (error) {
    console.error('❌ Failed to save collision overrides:', error);
    res.status(500).json({ success: false, message: 'Failed to save collision overrides' });
  }
});

// Load global collision overrides (public - anyone can load)
router.get('/api/collision-overrides/load', async (req, res) => {
  try {
    console.log('📥 Loading global collision overrides...');
    
    const collisionDoc = await CollisionOverride.findById('global');
    
    if (!collisionDoc || !collisionDoc.overrides) {
      console.log('ℹ️ No global collision overrides found');
      return res.json({ 
        success: true, 
        overrides: {},
        count: 0
      });
    }
    
    const overrideCount = Object.keys(collisionDoc.overrides).length;
    console.log('✅ Loaded global collision overrides:', overrideCount, 'tiles');
    
    res.json({ 
      success: true, 
      overrides: collisionDoc.overrides,
      count: overrideCount,
      lastModified: collisionDoc.lastModified
    });
  } catch (error) {
    console.error('❌ Failed to load collision overrides:', error);
    res.status(500).json({ success: false, message: 'Failed to load collision overrides' });
  }
});

module.exports = router;

