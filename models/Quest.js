const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: true
  }],
  correctAnswer: {
    type: Number,
    required: true,
    min: 0
  },
  explanation: {
    type: String,
    default: ''
  }
});

const questSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quest title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Quest description is required']
  },
  lesson: {
    title: String,
    content: String, // Main lesson text/tutorial
    examples: [String], // Code examples
    keyPoints: [String], // Important points to remember
    isInteractive: { type: Boolean, default: false } // For special quests like name entry
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  category: {
    type: String,
    enum: ['javascript', 'python', 'algorithms', 'debugging', 'frontend', 'backend', 'general'],
    default: 'javascript'
  },
  questions: [questionSchema],
  rewards: {
    experience: {
      type: Number,
      default: 10
    },
    coins: {
      type: Number,
      default: 5
    },
    badges: [{
      type: String
    }]
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quest'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 10
  },
  questType: {
    type: String,
    enum: ['tutorial', 'lesson', 'challenge', 'interactive'],
    default: 'lesson'
  }
}, {
  timestamps: true
});

// Index for efficient queries
questSchema.index({ difficulty: 1, category: 1, isActive: 1 });
questSchema.index({ order: 1 });

// Static method to get quests by difficulty
questSchema.statics.getByDifficulty = function(difficulty) {
  return this.find({ 
    difficulty: difficulty, 
    isActive: true 
  }).sort({ order: 1 });
};

// Static method to get next quest for user
questSchema.statics.getNextQuest = async function(userId) {
  const UserProgress = mongoose.model('UserProgress');
  
  // Get completed quests for user
  const completedQuests = await UserProgress.find({
    userId: userId,
    status: 'completed'
  }).select('questId');
  
  const completedQuestIds = completedQuests.map(progress => progress.questId);
  
  // Find next available quest
  return this.findOne({
    _id: { $nin: completedQuestIds },
    isActive: true
  }).sort({ order: 1 });
};

module.exports = mongoose.model('Quest', questSchema);
