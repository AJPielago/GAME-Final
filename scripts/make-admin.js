/**
 * Script to make a user an admin
 * Usage: node scripts/make-admin.js <username_or_email>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function makeAdmin(identifier) {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codequest', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    });

    if (!user) {
      console.error(`❌ User not found: ${identifier}`);
      process.exit(1);
    }

    // Update user role to admin
    user.role = 'admin';
    await user.save();

    console.log(`✅ Successfully made ${user.username} (${user.email}) an admin!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get identifier from command line arguments
const identifier = process.argv[2];

if (!identifier) {
  console.error('Usage: node scripts/make-admin.js <username_or_email>');
  process.exit(1);
}

makeAdmin(identifier);
