const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// POST /api/students - Register student (Admin flow: auto-link/create parent & assign class)
router.post('/', studentController.registerStudent);

// GET /api/students - List all students with query filters
router.get('/', studentController.getStudents);

// GET /api/students/:id - Get student details by ID
router.get('/:id', studentController.getStudentById);

module.exports = router;
