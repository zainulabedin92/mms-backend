const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const User = require('../models/User');
const { cleanStr, createUserRecord, rollbackUser } = require('../utils/userSync');

/**
 * Shared populate configuration for Student responses
 */
const STUDENT_POPULATE = [
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
];

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
  let createdStudentUser = null;
  let createdParentUser = null;
  try {
    const {
      // Student details
      fullName,
      firstName,
      lastName,
      fatherName,
      dob,
      gender,
      bFormNo,
      cnic,
      phone,
      email,
      username,
      address,
      city,
      enrollmentProgram,
      pictureUrl,
      guardianMobile,
      guardianEmail,
      pin,
      password,
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
      parentEmail,
      parentPassword,
      parentPin,
      parent // Support nested parent object: { name, phone, cnic, address, email, password, pin }
    } = req.body;

    const resolvedFullName =
      cleanStr(fullName) || [cleanStr(firstName), cleanStr(lastName)].filter(Boolean).join(' ').trim();

    // 1. Basic validation for student required fields
    if (!resolvedFullName) {
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

    const adminUserId = req.user ? req.user.userId || req.user.id || null : null;

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
    const pEmail = (parentEmail || (parent && parent.email) || '').trim().toLowerCase();
    const pPassword = (parentPin || parentPassword || (parent && (parent.pin || parent.password)) || '').trim();

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
        // Parent does not exist -> auto-create parent in `users` & `parents`
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

        // Determine default PIN (provided pin/password, or last 4 digits of CNIC, or '1234')
        const numericCnicDigits = pCnic.replace(/\D/g, '');
        defaultPlainPassword =
          pPassword ||
          (numericCnicDigits.length >= 4 ? numericCnicDigits.slice(-4) : '1234');

        const hashedPassword = await bcrypt.hash(defaultPlainPassword, 10);

        createdParentUser = await createUserRecord({
          name: pName,
          phone: pPhone,
          cnic: pCnic,
          email: pEmail || undefined,
          address: pAddress || undefined,
          pinHash: hashedPassword,
          role: 'parent',
          status: 'Active',
          createdBy: adminUserId
        });

        try {
          const newParent = await Parent.create({
            userId: createdParentUser._id,
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
        } catch (parentErr) {
          await rollbackUser(createdParentUser);
          createdParentUser = null;
          throw parentErr;
        }
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

    // 4. Create Student's central User record in `users` table
    const studentRawSecret =
      pin !== undefined && pin !== null && String(pin).trim() !== ''
        ? String(pin).trim()
        : password !== undefined && password !== null && String(password).trim() !== ''
        ? String(password).trim()
        : '1234';

    const studentPinHash = await bcrypt.hash(studentRawSecret, 10);

    const studentCnic = cleanStr(cnic) || cleanStr(bFormNo);
    const studentStatus = status || 'Enrolled';
    const studentUserStatus = ['Inactive', 'Suspended', 'rejected'].includes(studentStatus)
      ? 'Inactive'
      : 'Active';

    createdStudentUser = await createUserRecord({
      username,
      name: resolvedFullName,
      cnic: studentCnic,
      phone,
      email: cleanStr(email) || cleanStr(guardianEmail),
      gender: gender || 'Male',
      dob: dob ? new Date(dob) : undefined,
      address: cleanStr(address) || pAddress || undefined,
      city,
      pictureUrl: pictureUrl || null,
      pinHash: studentPinHash,
      role: 'student',
      status: studentUserStatus,
      createdBy: adminUserId
    });

    // 5. Create and Save the Student Record linked to `users`
    const newStudent = await Student.create({
      userId: createdStudentUser._id,
      rollNo: finalRollNo,
      fullName: resolvedFullName,
      ...(cleanStr(firstName) ? { firstName: cleanStr(firstName) } : {}),
      ...(cleanStr(lastName) ? { lastName: cleanStr(lastName) } : {}),
      fatherName: fatherName.trim(),
      dob: dob ? new Date(dob) : undefined,
      gender: gender || 'Male',
      bFormNo: bFormNo ? bFormNo.trim() : studentCnic,
      cnic: studentCnic,
      guardianMobile: cleanStr(guardianMobile) || resolvedParent?.phone,
      guardianEmail: cleanStr(guardianEmail)?.toLowerCase() || cleanStr(email)?.toLowerCase(),
      address: cleanStr(address) || pAddress || undefined,
      city: cleanStr(city),
      enrollmentProgram: cleanStr(enrollmentProgram),
      pictureUrl: pictureUrl || null,
      ...(studentPinHash ? { pin: studentPinHash } : {}),
      admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
      classId: classExists._id,
      parentId: resolvedParentId,
      status: studentStatus
    });

    // 6. Populate References for response
    await newStudent.populate(STUDENT_POPULATE);

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      studentPin: studentRawSecret,
      isNewParentCreated,
      ...(isNewParentCreated && {
        parentCredentials: {
          name: resolvedParent.name,
          phone: resolvedParent.phone,
          cnic: resolvedParent.cnic,
          defaultPin: defaultPlainPassword,
          defaultPassword: defaultPlainPassword,
          note: 'Share this 4-digit PIN with the parent for portal login'
        }
      }),
      user: createdStudentUser,
      student: newStudent
    });
  } catch (error) {
    await rollbackUser(createdStudentUser);
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

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to register student',
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

    if (req.user && req.user.role === 'student') {
      query._id = req.user.studentId || req.user.id;
    }

    const students = await Student.find(query)
      .populate(STUDENT_POPULATE)
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

    if (
      req.user &&
      req.user.role === 'student' &&
      String(id) !== String(req.user.studentId || req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Students can only view their own record.'
      });
    }

    const student = await Student.findById(id).populate(STUDENT_POPULATE);

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


// Editable student fields (SuperAdmin) - anything else in the body is ignored
const STUDENT_EDITABLE_FIELDS = [
  'fullName',
  'firstName',
  'lastName',
  'fatherName',
  'rollNo',
  'bFormNo',
  'gender',
  'dob',
  'admissionDate',
  'classId',
  'parentId',
  'status',
  'cnic',
  'guardianMobile',
  'guardianEmail',
  'address',
  'city',
  'enrollmentProgram',
  'pictureUrl'
];

const STUDENT_DATE_FIELDS = new Set(['dob', 'admissionDate']);

/**
 * Parse and validate an incoming date value
 * @returns {Date|null} null if invalid
 */
const parseValidDate = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const REQUIRED_FIELD_MESSAGES = [
  ['fatherName', 'Father name is required'],
  ['classId', 'Class assignment cannot be removed'],
  ['parentId', 'Parent / Guardian reference (parentId) cannot be removed'],
  ['status', 'Student status cannot be empty'],
  ['gender', 'Gender cannot be empty']
];

const REFERENCE_CHECKS = [
  ['classId', Class, 'Invalid classId format', 'Assigned class not found'],
  ['parentId', Parent, 'Invalid parentId format', 'Specified parent profile not found']
];

/**
 * @desc    Update a student record
 * @route   PUT /api/students/:id
 * @route   PATCH /api/students/:id
 * @access  SuperAdmin (JWT)
 */
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Student ID format' });
    }

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};

    const existing = await Student.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    const $set = {};
    const $unset = {};

    for (const field of STUDENT_EDITABLE_FIELDS) {
      if (body[field] === undefined) continue;
      const raw = body[field];

      if (raw === null) {
        $unset[field] = '';
        continue;
      }

      if (STUDENT_DATE_FIELDS.has(field)) {
        if (typeof raw === 'string' && !raw.trim()) {
          $unset[field] = '';
          continue;
        }
        const parsedDate = parseValidDate(raw);
        if (!parsedDate) {
          return res.status(400).json({ success: false, message: `Invalid ${field} date format` });
        }
        $set[field] = parsedDate;
        continue;
      }

      if (typeof raw !== 'string') {
        return res.status(400).json({ success: false, message: `Invalid value for ${field}` });
      }

      const trimmed = raw.trim();
      if (trimmed === '') {
        $unset[field] = '';
      } else {
        $set[field] = trimmed;
      }
    }

    for (const [field, message] of REQUIRED_FIELD_MESSAGES) {
      if ($unset[field] !== undefined) {
        return res.status(400).json({ success: false, message });
      }
    }
    delete $unset.rollNo; // rollNo is the unique identifier; keep existing if blank

    // Keep fullName in sync with legacy firstName / lastName
    if (
      $set.firstName !== undefined ||
      $set.lastName !== undefined ||
      $unset.firstName !== undefined ||
      $unset.lastName !== undefined
    ) {
      const first =
        $unset.firstName !== undefined ? '' : ($set.firstName !== undefined ? $set.firstName : existing.firstName || '');
      const last =
        $unset.lastName !== undefined ? '' : ($set.lastName !== undefined ? $set.lastName : existing.lastName || '');
      const combined = `${first} ${last}`.trim();
      if (combined && $set.fullName === undefined) $set.fullName = combined;
    }
    if ($unset.fullName !== undefined && !$set.fullName) {
      return res.status(400).json({ success: false, message: 'Student name is required' });
    }
    delete $unset.fullName;

    for (const [field, Model, invalidMsg, notFoundMsg] of REFERENCE_CHECKS) {
      if (!$set[field]) continue;
      if (!mongoose.Types.ObjectId.isValid($set[field])) {
        return res.status(400).json({ success: false, message: invalidMsg });
      }
      const doc = await Model.findById($set[field]);
      if (!doc) {
        return res.status(404).json({ success: false, message: notFoundMsg });
      }
    }

    if ($set.rollNo) {
      const duplicateRoll = await Student.findOne({ rollNo: $set.rollNo, _id: { $ne: id } });
      if (duplicateRoll) {
        return res.status(400).json({
          success: false,
          message: `Student with roll number "${$set.rollNo}" already exists`
        });
      }
    }

    if ($set.guardianEmail) $set.guardianEmail = $set.guardianEmail.toLowerCase();

    // Preserve null default for pictureUrl if explicitly cleared
    if ($unset.pictureUrl !== undefined) {
      delete $unset.pictureUrl;
      $set.pictureUrl = null;
    }

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
    }

    const student = await Student.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true
    }).populate(STUDENT_POPULATE);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    if (existing.userId) {
      const userSet = {};
      if ($set.fullName) userSet.name = $set.fullName;
      if ($set.dob) userSet.dob = $set.dob;
      if ($set.gender) userSet.gender = $set.gender;
      if ($set.cnic || $set.bFormNo) userSet.cnic = $set.cnic || $set.bFormNo;
      if ($set.address !== undefined) userSet.address = $set.address;
      if ($set.city !== undefined) userSet.city = $set.city;
      if ($set.pictureUrl !== undefined) userSet.pictureUrl = $set.pictureUrl;
      if ($set.guardianEmail) userSet.email = $set.guardianEmail;
      if ($set.status) {
        userSet.status = ['Inactive', 'Suspended', 'rejected'].includes($set.status)
          ? 'Inactive'
          : 'Active';
      }
      if (Object.keys(userSet).length) {
        await User.findByIdAndUpdate(existing.userId, { $set: userSet }).catch(() => null);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      student
    });
  } catch (error) {
    console.error('[Update Student Error]:', error);
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'Field';
      return res.status(400).json({
        success: false,
        message: `Duplicate entry error: A record with this ${duplicateField} already exists`
      });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a student record
 * @route   DELETE /api/students/:id
 * @access  SuperAdmin (JWT)
 */
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Student ID format' });
    }

    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    if (student.userId) {
      await User.findByIdAndDelete(student.userId).catch(() => null);
    }

    const fullName =
      student.fullName || [student.firstName, student.lastName].filter(Boolean).join(' ').trim();

    return res.status(200).json({
      success: true,
      message: 'Student deleted successfully',
      student: { _id: student._id, fullName, rollNo: student.rollNo }
    });
  } catch (error) {
    console.error('[Delete Student Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message
    });
  }
};
