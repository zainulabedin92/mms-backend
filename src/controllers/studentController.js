const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Class = require('../models/Class');

/**
 * Helper to generate a unique roll number if not provided
 */
const generateUniqueRollNo = async () => {
  const year = new Date().getFullYear();
  let isUnique = false;
  let candidate = '';

  while (!isUnique) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    candidate = `MMS-${year}-${randomSuffix}`;
    const exists = await Student.findOne({ rollNo: candidate });
    if (!exists) {
      isUnique = true;
    }
  }
  return candidate;
};

/**
 * @desc    Student Registration (Admin Flow)
 *          Auto-links or auto-creates Parent profile and assigns Class
 * @route   POST /api/students
 * @access  Admin / Protected
 */
exports.registerStudent = async (req, res) => {
  try {
    const {
      // Student details
      fullName,
      fatherName,
      dob,
      gender,
      bFormNo,
      admissionDate,
      rollNo,
      classId,
      status,

      // Parent identification / details
      parentId,
      parentCnic,
      parentPhone,
      parentName,
      parentAddress,
      parentPassword,
      parent // Support nested parent object: { name, phone, cnic, address, password }
    } = req.body;

    // 1. Basic validation for student required fields
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Student full name is required'
      });
    }

    if (!fatherName || !fatherName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Father name is required'
      });
    }

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class assignment (classId) is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid classId format'
      });
    }

    // Verify class exists
    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Assigned class not found'
      });
    }

    // 2. Parent Linkage or Auto-Creation Logic
    let resolvedParentId = null;
    let resolvedParent = null;
    let isNewParentCreated = false;
    let defaultPlainPassword = null;

    // Extract parent details from either root or nested parent object
    const pCnic = (parentCnic || (parent && parent.cnic) || '').trim();
    const pPhone = (parentPhone || (parent && parent.phone) || '').trim();
    const pName = (parentName || (parent && parent.name) || fatherName).trim();
    const pAddress = (parentAddress || (parent && parent.address) || '').trim();
    const pPassword = (parentPassword || (parent && parent.password) || '').trim();

    if (parentId) {
      // Direct parentId provided
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid parentId format'
        });
      }

      resolvedParent = await Parent.findById(parentId);
      if (!resolvedParent) {
        return res.status(404).json({
          success: false,
          message: 'Specified parent profile not found'
        });
      }
      resolvedParentId = resolvedParent._id;
    } else {
      // Parent ID not provided: check by CNIC or Phone
      if (!pCnic && !pPhone) {
        return res.status(400).json({
          success: false,
          message: 'Please provide either parentId, or parent details (CNIC/Phone) to link or create parent profile'
        });
      }

      const parentLookupQuery = [];
      if (pCnic) parentLookupQuery.push({ cnic: pCnic });
      if (pPhone) parentLookupQuery.push({ phone: pPhone });

      const existingParent = await Parent.findOne({ $or: parentLookupQuery });

      if (existingParent) {
        // Parent already exists -> link existing parent
        resolvedParent = existingParent;
        resolvedParentId = existingParent._id;
      } else {
        // Parent does not exist -> auto-create parent profile
        if (!pCnic) {
          return res.status(400).json({
            success: false,
            message: 'Parent CNIC is required to create a new parent profile'
          });
        }
        if (!pPhone) {
          return res.status(400).json({
            success: false,
            message: 'Parent Phone is required to create a new parent profile'
          });
        }

        // Determine default password (last 6 digits of CNIC or provided password or fallback)
        const numericCnicDigits = pCnic.replace(/\D/g, '');
        defaultPlainPassword =
          pPassword ||
          (numericCnicDigits.length >= 6 ? numericCnicDigits.slice(-6) : '123456');

        const hashedPassword = await bcrypt.hash(defaultPlainPassword, 10);

        const newParent = await Parent.create({
          name: pName,
          phone: pPhone,
          cnic: pCnic,
          address: pAddress,
          passwordHash: hashedPassword,
          status: 'Active'
        });

        resolvedParent = newParent;
        resolvedParentId = newParent._id;
        isNewParentCreated = true;
      }
    }

    // 3. Roll Number Resolution
    let finalRollNo = rollNo ? rollNo.trim() : null;
    if (finalRollNo) {
      const duplicateRoll = await Student.findOne({ rollNo: finalRollNo });
      if (duplicateRoll) {
        return res.status(400).json({
          success: false,
          message: `Student with roll number "${finalRollNo}" already exists`
        });
      }
    } else {
      finalRollNo = await generateUniqueRollNo();
    }

    // 4. Create and Save the Student Record
    const newStudent = await Student.create({
      rollNo: finalRollNo,
      fullName: fullName.trim(),
      fatherName: fatherName.trim(),
      dob: dob ? new Date(dob) : undefined,
      gender: gender || 'Male',
      bFormNo: bFormNo ? bFormNo.trim() : undefined,
      admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
      classId: classExists._id,
      parentId: resolvedParentId,
      status: status || 'Enrolled'
    });

    // 5. Populate References for response
    await newStudent.populate([
      {
        path: 'classId',
        select: 'name section roomNumber academicYear status',
        populate: {
          path: 'classTeacher',
          select: 'name phone email role'
        }
      },
      {
        path: 'parentId',
        select: 'name phone cnic address status'
      }
    ]);

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      isNewParentCreated,
      ...(isNewParentCreated && {
        parentCredentials: {
          name: resolvedParent.name,
          phone: resolvedParent.phone,
          cnic: resolvedParent.cnic,
          defaultPassword: defaultPlainPassword,
          note: 'Share this temporary password with the parent for portal login'
        }
      }),
      student: newStudent
    });
  } catch (error) {
    console.error('[Student Registration Error]:', error);

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'Field';
      return res.status(400).json({
        success: false,
        message: `Duplicate entry error: A record with this ${duplicateField} already exists`,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to register student',
      error: error.message
    });
  }
};

/**
 * @desc    Fetch all students with class and parent populated
 * @route   GET /api/students
 * @access  Admin / Staff
 */
exports.getStudents = async (req, res) => {
  try {
    const { classId, status, search } = req.query;
    const query = {};

    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      query.classId = classId;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { fullName: { $regex: term, $options: 'i' } },
        { fatherName: { $regex: term, $options: 'i' } },
        { rollNo: { $regex: term, $options: 'i' } },
        { bFormNo: { $regex: term, $options: 'i' } }
      ];
    }

    const students = await Student.find(query)
      .populate({
        path: 'classId',
        select: 'name section roomNumber academicYear status',
        populate: {
          path: 'classTeacher',
          select: 'name phone email role'
        }
      })
      .populate({
        path: 'parentId',
        select: 'name phone cnic address status'
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: students.length,
      students
    });
  } catch (error) {
    console.error('[Get Students Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
};

/**
 * @desc    Get student by ID
 * @route   GET /api/students/:id
 * @access  Admin / Protected
 */
exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Student ID format'
      });
    }

    const student = await Student.findById(id)
      .populate({
        path: 'classId',
        select: 'name section roomNumber academicYear status',
        populate: {
          path: 'classTeacher',
          select: 'name phone email role'
        }
      })
      .populate({
        path: 'parentId',
        select: 'name phone cnic address status'
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    return res.status(200).json({
      success: true,
      student
    });
  } catch (error) {
    console.error('[Get Student By ID Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching student record',
      error: error.message
    });
  }
};