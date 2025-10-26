const mongoose = require('mongoose');

// Global collision override model - shared across all users
const collisionOverrideSchema = new mongoose.Schema({
  // Use a single document with ID 'global' to store all overrides
  _id: {
    type: String,
    default: 'global'
  },
  // Map of "x,y,layer" -> boolean (true = collision ON, false = collision OFF)
  overrides: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  modifiedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CollisionOverride', collisionOverrideSchema);
