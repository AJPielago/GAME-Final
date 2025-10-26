/**
 * Script to list all users and their roles
 * Usage: node scripts/list-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function listUsers() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codequest', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB\n');

    // Get all users
    const users = await User.find()
      .select('username email role isActive level experience')
      .sort({ createdAt: -1 });

    if (users.length === 0) {
      console.log('No users found.');
      process.exit(0);
    }

    console.log(`Found ${users.length} users:\n`);
    console.log('┌────────────────────┬────────────────────────────┬─────────┬────────┬───────┬────────────┐');
    console.log('│ Username           │ Email                      │ Role    │ Active │ Level │ Experience │');
    console.log('├────────────────────┼────────────────────────────┼─────────┼────────┼───────┼────────────┤');

    users.forEach(user => {
      const username = (user.username || '').padEnd(18).substring(0, 18);
      const email = (user.email || '').padEnd(26).substring(0, 26);
      const role = (user.role || 'player').padEnd(7);
      const active = (user.isActive ? 'Yes' : 'No').padEnd(6);
      const level = String(user.level || 1).padStart(5);
      const exp = String(user.experience || 0).padStart(10);

      console.log(`│ ${username} │ ${email} │ ${role} │ ${active} │ ${level} │ ${exp} │`);
    });

    console.log('└────────────────────┴────────────────────────────┴─────────┴────────┴───────┴────────────┘\n');

    // Count by role
    const adminCount = users.filter(u => u.role === 'admin').length;
    const playerCount = users.filter(u => u.role !== 'admin').length;
    
    console.log(`Admins: ${adminCount} | Players: ${playerCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listUsers();
