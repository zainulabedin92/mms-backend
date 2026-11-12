const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');

// POST /api/students - Register student (Admin/SuperAdmin only: creates user + student & links/creates parent)
router.post('/', authenticate, authorize('superadmin', 'admin'), studentController.registerStudent);

// GET /api/students - List all students with query filters (scoped to self if student token)
router.get('/', optionalAuthenticate, studentController.getStudents);

// GET /api/students/:id - Get student details by ID
router.get('/:id', optionalAuthenticate, studentController.getStudentById);

// PUT /api/students/:id - SuperAdmin, Admin or Teacher: Edit student record
router.put('/:id', authenticate, authorize('superadmin', 'admin', 'teacher'), studentController.updateStudent);

// PATCH /api/students/:id - SuperAdmin, Admin or Teacher: Partially update student record
router.patch('/:id', authenticate, authorize('superadmin', 'admin', 'teacher'), studentController.updateStudent);

// DELETE /api/students/:id - SuperAdmin only: Delete student record
router.delete('/:id', authenticate, authorize('superadmin'), studentController.deleteStudent);

module.exports = router;
