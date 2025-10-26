const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quest',
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'failed'],
    default: 'not_started'
  },
  currentQuestion: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  answers: [{
    questionIndex: Number,
    selectedAnswer: Number,
    isCorrect: Boolean,
    attemptedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completedAt: {
    type: Date
  },
  timeSpent: {
    type: Number, // in minutes
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for efficient user-quest queries
userProgressSchema.index({ userId: 1, questId: 1 }, { unique: true });
userProgressSchema.index({ userId: 1, status: 1 });

// Instance method to calculate completion percentage
userProgressSchema.methods.getCompletionPercentage = function() {
  if (!this.populated('questId') && !this.questId.questions) {
    return 0;
  }
  const totalQuestions = this.questId.questions ? this.questId.questions.length : 0;
  if (totalQuestions === 0) return 0;
  
  return Math.round((this.currentQuestion / totalQuestions) * 100);
};

// Instance method to calculate score percentage
userProgressSchema.methods.getScorePercentage = function() {
  if (!this.populated('questId') && !this.questId.questions) {
    return 0;
  }
  const totalQuestions = this.questId.questions ? this.questId.questions.length : 0;
  if (totalQuestions === 0) return 0;
  
  return Math.round((this.correctAnswers / totalQuestions) * 100);
};

// Static method to get user's progress summary
userProgressSchema.statics.getUserSummary = async function(userId) {
  const summary = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCorrectAnswers: { $sum: '$correctAnswers' },
        totalAttempts: { $sum: '$totalAttempts' },
        totalTimeSpent: { $sum: '$timeSpent' }
      }
    }
  ]);
  
  const result = {
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    totalCorrectAnswers: 0,
    totalAttempts: 0,
    totalTimeSpent: 0
  };
  
  summary.forEach(item => {
    switch(item._id) {
      case 'completed':
        result.completed = item.count;
        break;
      case 'in_progress':
        result.inProgress = item.count;
        break;
      case 'not_started':
        result.notStarted = item.count;
        break;
    }
    result.totalCorrectAnswers += item.totalCorrectAnswers;
    result.totalAttempts += item.totalAttempts;
    result.totalTimeSpent += item.totalTimeSpent;
  });
  
  return result;
};

// Static method to start a quest
userProgressSchema.statics.startQuest = async function(userId, questId) {
  return this.findOneAndUpdate(
    { userId, questId },
    {
      $setOnInsert: {
        userId,
        questId,
        status: 'in_progress',
        startedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );
};

// Static method to submit an answer
userProgressSchema.statics.submitAnswer = async function(userId, questId, questionIndex, selectedAnswer, isCorrect) {
  const update = {
    $push: {
      answers: {
        questionIndex,
        selectedAnswer,
        isCorrect,
        attemptedAt: new Date()
      }
    },
    $inc: {
      totalAttempts: 1
    }
  };
  
  if (isCorrect) {
    update.$inc.correctAnswers = 1;
    update.$set = { currentQuestion: questionIndex + 1 };
  }
  
  return this.findOneAndUpdate(
    { userId, questId },
    update,
    { new: true }
  );
};

module.exports = mongoose.model('UserProgress', userProgressSchema);
