const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { optionalAuthenticate } = require('../middleware/auth');

// GET /api/admin/pending
router.get('/pending', optionalAuthenticate, adminController.getPendingStudents);

// GET /api/admin/students
router.get('/students', optionalAuthenticate, adminController.getAllStudents);

// PATCH /api/admin/approve/:id
router.patch('/approve/:id', adminController.approveStudent);

module.exports = router;
