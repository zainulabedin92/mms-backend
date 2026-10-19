require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const { exec } = require('child_process');

const PORT = process.env.PORT || 5000;

// Automatically reverse port for connected Android devices (physical or emulator)
function setupAdbReverse() {
  exec(`adb reverse tcp:${PORT} tcp:${PORT}`, (err) => {
    if (!err) {
      console.log(`[ADB Reverse] Port ${PORT} successfully reversed for Android device(s)`);
    }
  });
}

// Connect to MongoDB & Start Server
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` 🕌 Madaris Management System (MMS) Backend Server `);
    console.log(`====================================================`);
    console.log(`[API Server] Running on http://localhost:${PORT}`);
    console.log(`[Admin Portal] Open http://localhost:${PORT}/admin in browser`);
    console.log(`[Android Device Base URL] http://localhost:${PORT} (via adb reverse)`);
    console.log(`[Android Emulator Base URL] http://10.0.2.2:${PORT}`);
    console.log(`====================================================`);
    setupAdbReverse();
  });
}).catch(err => {
  console.error('[Fatal Error] Failed to start server:', err);
});
