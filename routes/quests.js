const express = require('express');
const Quest = require('../models/Quest');
const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all available quests for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const quests = await Quest.find({ isActive: true })
      .sort({ order: 1 })
      .select('title description difficulty category rewards estimatedTime');
    
    // Get user's progress for these quests
    const userProgress = await UserProgress.find({
      userId: req.session.userId,
      questId: { $in: quests.map(q => q._id) }
    });
    
    // Combine quest data with user progress
    const questsWithProgress = quests.map(quest => {
      const progress = userProgress.find(p => p.questId.toString() === quest._id.toString());
      return {
        ...quest.toObject(),
        progress: progress ? {
          status: progress.status,
          completionPercentage: progress.getCompletionPercentage(),
          scorePercentage: progress.getScorePercentage()
        } : {
          status: 'not_started',
          completionPercentage: 0,
          scorePercentage: 0
        }
      };
    });
    
    res.json({ success: true, quests: questsWithProgress });
  } catch (error) {
    console.error('Error fetching quests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quests' });
  }
});

// Get specific quest details
router.get('/:questId', requireAuth, async (req, res) => {
  try {
    const quest = await Quest.findById(req.params.questId);
    if (!quest) {
      return res.status(404).json({ success: false, message: 'Quest not found' });
    }
    
    // Get user's progress for this quest
    const progress = await UserProgress.findOne({
      userId: req.session.userId,
      questId: quest._id
    });
    
    res.json({
      success: true,
      quest: quest.toObject(),
      progress: progress || null,
      hasLesson: !!(quest.lesson && quest.lesson.content)
    });
  } catch (error) {
    console.error('Error fetching quest:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quest' });
  }
});

// Get quest lesson content
router.get('/:questId/lesson', requireAuth, async (req, res) => {
  try {
    const quest = await Quest.findById(req.params.questId);
    if (!quest) {
      return res.status(404).json({ success: false, message: 'Quest not found' });
    }
    
    if (!quest.lesson || !quest.lesson.content) {
      return res.status(404).json({ success: false, message: 'No lesson available for this quest' });
    }
    
    res.json({
      success: true,
      lesson: quest.lesson,
      questTitle: quest.title,
      questType: quest.questType
    });
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lesson' });
  }
});

// Start a quest
router.post('/:questId/start', requireAuth, async (req, res) => {
  try {
    const quest = await Quest.findById(req.params.questId);
    if (!quest) {
      return res.status(404).json({ success: false, message: 'Quest not found' });
    }
    
    const progress = await UserProgress.startQuest(req.session.userId, quest._id);
    
    res.json({
      success: true,
      message: 'Quest started successfully',
      progress: progress
    });
  } catch (error) {
    console.error('Error starting quest:', error);
    res.status(500).json({ success: false, message: 'Failed to start quest' });
  }
});

// Submit an answer
router.post('/:questId/answer', requireAuth, async (req, res) => {
  try {
    const { questionIndex, selectedAnswer } = req.body;
    
    const quest = await Quest.findById(req.params.questId);
    if (!quest) {
      return res.status(404).json({ success: false, message: 'Quest not found' });
    }
    
    if (questionIndex >= quest.questions.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }
    
    const question = quest.questions[questionIndex];
    const isCorrect = selectedAnswer === question.correctAnswer;
    
    // Update user progress
    const progress = await UserProgress.submitAnswer(
      req.session.userId,
      quest._id,
      questionIndex,
      selectedAnswer,
      isCorrect
    );
    
    // Check if quest is completed
    if (progress.currentQuestion >= quest.questions.length) {
      progress.status = 'completed';
      progress.completedAt = new Date();
      progress.score = Math.round((progress.correctAnswers / quest.questions.length) * 100);
      await progress.save();
      
      // Award rewards to user
      const user = await User.findById(req.session.userId);
      if (user) {
        user.experience += quest.rewards.experience;
        user.pixelCoins += quest.rewards.coins;
        user.gameStats.questsCompleted += 1;
        
        // Level up logic
        const newLevel = Math.floor(user.experience / 100) + 1;
        if (newLevel > user.level) {
          user.level = newLevel;
        }
        
        // Award badges
        if (quest.rewards.badges && quest.rewards.badges.length > 0) {
          quest.rewards.badges.forEach(badge => {
            if (!user.badges.includes(badge)) {
              user.badges.push(badge);
            }
          });
        }
        
        await user.save();
      }
    }
    
    res.json({
      success: true,
      isCorrect: isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      progress: progress,
      questCompleted: progress.status === 'completed'
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ success: false, message: 'Failed to submit answer' });
  }
});

// Get user's quest progress summary
router.get('/progress/summary', requireAuth, async (req, res) => {
  try {
    const summary = await UserProgress.getUserSummary(req.session.userId);
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error fetching progress summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch progress summary' });
  }
});

// Get next recommended quest
router.get('/next/recommended', requireAuth, async (req, res) => {
  try {
    const nextQuest = await Quest.getNextQuest(req.session.userId);
    res.json({ success: true, quest: nextQuest });
  } catch (error) {
    console.error('Error fetching next quest:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch next quest' });
  }
});

module.exports = router;
