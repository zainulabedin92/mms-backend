const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// GET /api/admin/pending
router.get('/pending', adminController.getPendingStudents);

// GET /api/admin/students
router.get('/students', adminController.getAllStudents);

// PATCH /api/admin/approve/:id
router.patch('/approve/:id', adminController.approveStudent);

module.exports = router;
