const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mms_db', {
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`====================================================`);
    console.error(`[MongoDB Warning] Could not connect to MongoDB database.`);
    console.error(`Details: ${error.message}`);
    console.error(`Please ensure MongoDB service is running on 127.0.0.1:27017 or update MONGO_URI in .env`);
    console.error(`====================================================`);
  }
};

module.exports = connectDB;
