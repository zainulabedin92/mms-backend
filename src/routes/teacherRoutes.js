const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');

// GET /api/teachers - List all teachers
router.get('/', teacherController.getTeachers);

// POST /api/teachers - Create a new teacher
router.post('/', teacherController.createTeacher);

// GET /api/teachers/:id - Get teacher by ID
router.get('/:id', teacherController.getTeacherById);

module.exports = router;
