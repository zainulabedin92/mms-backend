const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Teacher = require('../models/Teacher');

/**
 * @desc    Fetch all teachers
 * @route   GET /api/teachers
 * @access  Public / Admin
 */
exports.getTeachers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const query = {};

    if (role && role !== 'All') {
      query.role = role;
    }

    if (status && status !== 'all') {
      query.status = status;
    } else if (!status) {
      query.status = 'Active';
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } }
      ];
    }

    const teachers = await Teacher.find(query).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: teachers.length,
      teachers
    });
  } catch (error) {
    console.error('[Get Teachers Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new teacher
 * @route   POST /api/teachers
 * @access  Admin
 */
exports.createTeacher = async (req, res) => {
  try {
    const { name, phone, email, cnic, role, password, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Teacher name is required'
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Teacher phone number is required'
      });
    }

    const existingTeacher = await Teacher.findOne({ phone: phone.trim() });
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'A teacher with this phone number already exists'
      });
    }

    let passwordHash;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const teacher = await Teacher.create({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      cnic: cnic ? cnic.trim() : undefined,
      role: role || 'Hifz Teacher',
      passwordHash,
      status: status || 'Active'
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      teacher
    });
  } catch (error) {
    console.error('[Create Teacher Error]:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A teacher with this phone/email already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create teacher',
      error: error.message
    });
  }
};

/**
 * @desc    Get teacher by ID
 * @route   GET /api/teachers/:id
 * @access  Public / Admin
 */
exports.getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Teacher ID format'
      });
    }

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    return res.status(200).json({
      success: true,
      teacher
    });
  } catch (error) {
    console.error('[Get Teacher By ID Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving teacher record',
      error: error.message
    });
  }
};
