const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parentController');
const { authenticate } = require('../middleware/auth');

// POST /api/parents/login - Authenticate parent using phone or cnic + password
router.post('/login', parentController.login);

// GET /api/parents/my-children - Protected: Get all children of logged-in parent with populated class and teacher
router.get('/my-children', authenticate, parentController.getMyChildren);

// GET /api/parents/profile - Protected: Get profile of logged-in parent
router.get('/profile', authenticate, parentController.getProfile);

// GET /api/parents - List all parents (Admin use)
router.get('/', parentController.getAllParents);

module.exports = router;
