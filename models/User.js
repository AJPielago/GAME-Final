const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  inGameName: {
    type: String,
    trim: true,
    default: null
  },
  age: {
    type: Number,
    min: [5, 'Age must be at least 5'],
    max: [120, 'Age must be less than 120'],
    default: null
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  jsLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  characterAvatar: {
    type: String,
    default: '/images/characters/tinyKnight .gif'
  },
  characterType: {
    type: String,
    enum: ['knight', 'mage', 'druid', 'paladin'],
    default: 'knight'
  },
  codingStyle: {
    type: String,
    enum: ['aggressive', 'methodical', 'creative'],
    default: 'aggressive'
  },
  learningGoals: [{
    type: String,
    enum: ['frontend', 'backend', 'algorithms', 'frameworks']
  }],
  jsSkills: [{
    name: String,
    level: { type: Number, min: 1, max: 10 },
    unlockedAt: { type: Date, default: Date.now }
  }],
  pixelCoins: {
    type: Number,
    default: 0
  },
  gameStats: {
    monstersDefeated: { type: Number, default: 0 },
    questsCompleted: { type: Number, default: 0 },
    codeLinesWritten: { type: Number, default: 0 },
    playTime: { type: Number, default: 0 } // in minutes
  },
  level: {
    type: Number,
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  badges: [{
    type: String
    // Removed enum restriction to allow any badge names
  }],
  achievements: [{
    name: String,
    description: String,
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  gameState: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    savedAt: { type: mongoose.Schema.Types.Mixed }
  },
  role: {
    type: String,
    enum: ['player', 'admin'],
    default: 'player'
  },
  extendedGameState: {
    collectedRewards: [{ type: mongoose.Schema.Types.Mixed }],
    activeQuests: [{ type: mongoose.Schema.Types.Mixed }],
    completedQuests: [{ type: mongoose.Schema.Types.Mixed }],
    interactedNPCs: [{ type: mongoose.Schema.Types.Mixed }],
    questProgress: { type: mongoose.Schema.Types.Mixed, default: {} },
    playerDirection: { type: String, default: 'right' },
    currentAnimation: { type: String, default: 'idle' },
    collisionOverrides: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  questHistory: [{
    questId: { type: Number, required: true },
    questName: String,
    completedAt: { type: Date, default: Date.now },
    quizScore: {
      correct: { type: Number, default: 0 },
      wrong: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 }
    },
    quizAnswers: [{
      question: String,
      options: [String],
      correctAnswer: Number,
      userAnswer: Number,
      isCorrect: Boolean
    }],
    challengeCompleted: { type: Boolean, default: false },
    challengeCode: String,
    totalXP: { type: Number, default: 0 },
    totalGold: { type: Number, default: 0 }
  }],
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get user without password
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Static method to find user by email or username
userSchema.statics.findByLogin = function(login) {
  return this.findOne({
    $or: [
      { email: login.toLowerCase() },
      { username: login }
    ]
  });
};

module.exports = mongoose.model('User', userSchema);

