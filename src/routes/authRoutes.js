const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/upload');

// POST /api/auth/register (multipart form data with 'picture' file)
router.post('/register', upload.single('picture'), authController.register);

// POST /api/auth/login-pin
router.post('/login-pin', authController.loginWithPin);

module.exports = router;
