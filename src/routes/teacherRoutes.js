const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/teachers/login - Teacher login (phone/CNIC + password/PIN) -> issues teacher JWT
router.post('/login', teacherController.login);

// GET /api/teachers - List all teachers
router.get('/', teacherController.getTeachers);

// POST /api/teachers - Create a new teacher (SuperAdmin / Admin only)
router.post('/', authenticate, authorize('superadmin', 'admin'), teacherController.createTeacher);

// GET /api/teachers/:id - Get teacher by ID
router.get('/:id', teacherController.getTeacherById);

// PUT /api/teachers/:id - SuperAdmin / Admin: Edit teacher
router.put('/:id', authenticate, authorize('superadmin', 'admin'), teacherController.updateTeacher);

// DELETE /api/teachers/:id - SuperAdmin only: Delete teacher (unassigns from classes)
router.delete('/:id', authenticate, authorize('superadmin'), teacherController.deleteTeacher);

module.exports = router;
