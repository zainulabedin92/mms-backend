const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');

// GET /api/classes - Fetch all active classes (populates classTeacher name & phone)
router.get('/', classController.getClasses);

// POST /api/classes - Create a new class and assign a classTeacher
router.post('/', classController.createClass);

// GET /api/classes/:id - Get single class by ID
router.get('/:id', classController.getClassById);

// PUT /api/classes/:id - Update class details
router.put('/:id', classController.updateClass);

module.exports = router;
