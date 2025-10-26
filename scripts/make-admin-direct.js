/**
 * Script to make a user an admin by directly accessing MongoDB
 * Usage: node scripts/make-admin-direct.js <user_id>
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function makeAdminDirect(userId) {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/codequest');
  
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    
    // Try to find the user in the users collection first
    let user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    // If not found, try the User collection (case-sensitive)
    if (!user) {
      user = await db.collection('User').findOne({ _id: new ObjectId(userId) });
    }

    if (!user) {
      console.error(`❌ User not found with ID: ${userId}`);
      console.log('Available collections:');
      const collections = await db.listCollections().toArray();
      collections.forEach(c => console.log(`- ${c.name}`));
      return;
    }

    // Determine which collection the user is in
    const collectionName = user._id ? 'users' : 'User';
    
    // Update the user's role to admin
    const result = await db.collection(collectionName).updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role: 'admin' } }
    );

    if (result.matchedCount === 0) {
      // Try the other collection name
      const altCollection = collectionName === 'users' ? 'User' : 'users';
      await db.collection(altCollection).updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role: 'admin' } }
      );
    }
    
    // Verify the update
    let updatedUser = await db.collection(collectionName).findOne({ _id: new ObjectId(userId) });
    if (!updatedUser) {
      const altCollection = collectionName === 'users' ? 'User' : 'users';
      updatedUser = await db.collection(altCollection).findOne({ _id: new ObjectId(userId) });
    }

    console.log(`✅ Successfully made user ${user.username || user.email} an admin!`);
    console.log('Updated user details:', {
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role
    });
    
    if (updatedUser.role !== 'admin') {
      console.warn('⚠️ Warning: Role field may not have been updated correctly');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ObjectId')) {
      console.log('Make sure the user ID is a valid MongoDB ObjectId');
    }
  } finally {
    await client.close();
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/make-admin-direct.js <user_id>');
  console.error('Example: node scripts/make-admin-direct.js 68e927da368cbcb05447ad67');
  process.exit(1);
}

makeAdminDirect(userId);
