const mongoose = require('mongoose');
require('dotenv').config();

async function checkConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Successfully connected to MongoDB');
    
    // List all databases
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.listDatabases();
    console.log('\nAvailable databases:');
    result.databases.forEach(db => console.log(`- ${db.name}`));
    
    // List collections in the connected database
    const dbName = mongoose.connection.db.databaseName;
    console.log(`\nCollections in ${dbName}:`);
    const collections = await mongoose.connection.db.listCollections().toArray();
    collections.forEach(collection => console.log(`- ${collection.name}`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure MongoDB is running locally');
    console.log('2. Check if the database name in .env matches exactly (case-sensitive)');
    console.log('3. Try connecting with MongoDB Compass first to verify credentials');
    process.exit(1);
  }
}

checkConnection();
