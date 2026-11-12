const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parentController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/parents/login - Authenticate parent using phone or cnic + password/PIN
router.post('/login', parentController.login);

// POST /api/parents - Create a new parent / guardian (SuperAdmin / Admin only)
router.post('/', authenticate, authorize('superadmin', 'admin'), parentController.createParent);

// GET /api/parents/my-children - Protected: Get all children of logged-in parent with populated class and teacher
router.get('/my-children', authenticate, parentController.getMyChildren);

// GET /api/parents/profile - Protected: Get profile of logged-in parent
router.get('/profile', authenticate, parentController.getProfile);

// GET /api/parents - List all parents (Admin use)
router.get('/', parentController.getAllParents);

// PUT /api/parents/:id - SuperAdmin / Admin: Edit parent profile (optional password reset)
router.put('/:id', authenticate, authorize('superadmin', 'admin'), parentController.updateParent);

// DELETE /api/parents/:id - SuperAdmin only: Delete parent (blocked while children are linked)
router.delete('/:id', authenticate, authorize('superadmin'), parentController.deleteParent);

module.exports = router;
