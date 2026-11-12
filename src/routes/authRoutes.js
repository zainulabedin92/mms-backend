const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/auth/register - Admin/SuperAdmin only (public self-registration disabled)
router.post(
  '/register',
  authenticate,
  authorize('superadmin', 'admin'),
  upload.single('picture'),
  authController.register
);

// POST /api/auth/login-pin & POST /api/auth/login - Unified login against `users` table
router.post('/login-pin', authController.loginWithPin);
router.post('/login', authController.loginWithPin);

// GET /api/auth/me - Get currently authenticated user and linked role profile
router.get('/me', authenticate, authController.getMe);

// GET /api/auth/users - List users in the `users` table (SuperAdmin / Admin only)
router.get('/users', authenticate, authorize('superadmin', 'admin'), authController.getUsers);

// GET /api/auth/users/:id - Get single user in the `users` table (SuperAdmin / Admin only)
router.get('/users/:id', authenticate, authorize('superadmin', 'admin'), authController.getUserById);

// POST /api/auth/users - Create user in the `users` table (SuperAdmin / Admin only)
router.post('/users', authenticate, authorize('superadmin', 'admin'), authController.createUser);

module.exports = router;
