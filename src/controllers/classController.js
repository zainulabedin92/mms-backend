const mongoose = require('mongoose');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');

/**
 * @desc    Fetch all active classes (populates classTeacher name & phone)
 * @route   GET /api/classes
 * @access  Public / Admin
 */
exports.getClasses = async (req, res) => {
  try {
    const { status, academicYear } = req.query;

    const query = {};
    if (status) {
      if (status !== 'all') query.status = status;
    } else {
      query.status = 'Active'; // Default to active classes
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    const classes = await Class.find(query)
      .populate({
        path: 'classTeacher',
        select: 'name phone email role status'
      })
      .sort({ name: 1, section: 1 });

    return res.status(200).json({
      success: true,
      count: classes.length,
      classes
    });
  } catch (error) {
    console.error('[Get Classes Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch classes',
      error: error.message
    });
  }
};

/**
 * @desc    Get a single class by ID
 * @route   GET /api/classes/:id
 * @access  Public / Admin
 */
exports.getClassById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Class ID format'
      });
    }

    const classItem = await Class.findById(id).populate({
      path: 'classTeacher',
      select: 'name phone email role status'
    });

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    return res.status(200).json({
      success: true,
      class: classItem
    });
  } catch (error) {
    console.error('[Get Class By ID Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching class details',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new class and assign a classTeacher
 * @route   POST /api/classes
 * @access  Admin
 */
exports.createClass = async (req, res) => {
  try {
    const { name, section, roomNumber, classTeacher, academicYear, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Class name is required (e.g. Hifz - Batch A)'
      });
    }

    // Verify teacher if classTeacher ID is provided
    let assignedTeacher = null;
    if (classTeacher) {
      if (!mongoose.Types.ObjectId.isValid(classTeacher)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid classTeacher ID format'
        });
      }

      assignedTeacher = await Teacher.findById(classTeacher);
      if (!assignedTeacher) {
        return res.status(404).json({
          success: false,
          message: 'Assigned teacher not found'
        });
      }
    }

    // Create the class
    const newClass = await Class.create({
      name: name.trim(),
      section: section ? section.trim() : 'A',
      roomNumber: roomNumber ? roomNumber.trim() : undefined,
      classTeacher: classTeacher || null,
      academicYear: academicYear ? academicYear.trim() : undefined,
      status: status || 'Active'
    });

    // Populate teacher details for response
    await newClass.populate({
      path: 'classTeacher',
      select: 'name phone email role'
    });

    return res.status(201).json({
      success: true,
      message: 'Class created successfully',
      class: newClass
    });
  } catch (error) {
    console.error('[Create Class Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create class',
      error: error.message
    });
  }
};

/**
 * @desc    Update a class
 * @route   PUT /api/classes/:id
 * @access  Admin
 */
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, section, roomNumber, classTeacher, academicYear, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Class ID format'
      });
    }

    if (classTeacher && !mongoose.Types.ObjectId.isValid(classTeacher)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid classTeacher ID format'
      });
    }

    if (classTeacher) {
      const teacherExists = await Teacher.findById(classTeacher);
      if (!teacherExists) {
        return res.status(404).json({
          success: false,
          message: 'Assigned teacher not found'
        });
      }
    }

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      {
        ...(name && { name: name.trim() }),
        ...(section && { section: section.trim() }),
        ...(roomNumber !== undefined && { roomNumber: roomNumber.trim() }),
        ...(classTeacher !== undefined && { classTeacher: classTeacher || null }),
        ...(academicYear && { academicYear: academicYear.trim() }),
        ...(status && { status })
      },
      { new: true, runValidators: true }
    ).populate({
      path: 'classTeacher',
      select: 'name phone email role'
    });

    if (!updatedClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      class: updatedClass
    });
  } catch (error) {
    console.error('[Update Class Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update class',
      error: error.message
    });
  }
};
