const mongoose = require('mongoose');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Parent = require('../models/Parent');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const {
  cleanStr,
  findUserConflict,
  createUserRecord,
  rollbackUser,
  signUserToken
} = require('../utils/userSync');

const STUDENT_POPULATE = [
  {
    path: 'classId',
    select: 'name section roomNumber academicYear status',
    populate: { path: 'classTeacher', select: 'name phone email role' }
  },
  {
    path: 'parentId',
    select: 'name phone cnic address status'
  }
];

/**
 * POST /api/auth/register
 * Admin / SuperAdmin only — public self-registration is disabled.
 */
exports.register = async (req, res) => {
  let createdUser = null;
  try {
    if (!req.user || !['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Self-registration is disabled. Only an authenticated admin can register users.'
      });
    }

    const {
      firstName,
      lastName,
      fullName,
      fatherName,
      cnic,
      phone,
      guardianMobile,
      guardianEmail,
      pin,
      confirmPin,
      address,
      city,
      gender,
      dob,
      enrollmentProgram,
      classId,
      parentId,
      status,
      username,
      picture
    } = req.body || {};

    const resolvedFirst = cleanStr(firstName);
    const resolvedLast = cleanStr(lastName);
    const resolvedFullName =
      cleanStr(fullName) || [resolvedFirst, resolvedLast].filter(Boolean).join(' ').trim();

    if (!resolvedFullName || !fatherName || !cnic || !guardianMobile || !guardianEmail || !pin || !address || !city || !enrollmentProgram) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const pinRegex = /^\d{4}$/;
    if (!pinRegex.test(String(pin).trim())) {
      return res.status(400).json({ error: 'PIN must be exactly 4 numeric digits' });
    }

    if (confirmPin && String(pin).trim() !== String(confirmPin).trim()) {
      return res.status(400).json({ error: 'PIN and Confirm PIN do not match' });
    }

    const cleanCnic = String(cnic).trim();
    const existingStudent = await Student.findOne({ cnic: cleanCnic });
    if (existingStudent) {
      return res.status(400).json({ error: 'A student with this B-Form / CNIC is already registered' });
    }

    const conflict = await findUserConflict({
      username,
      cnic: cleanCnic,
      phone
    });
    if (conflict) {
      return res.status(400).json({ error: `A user with this ${conflict.field} already exists` });
    }

    const hashedPin = await bcrypt.hash(String(pin).trim(), 10);

    let pictureUrl = req.file ? `/uploads/${req.file.filename}` : null;
    if (!pictureUrl && picture) {
      try {
        if (typeof picture === 'string' && picture.startsWith('data:image')) {
          const matches = picture.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (matches) {
            let ext = matches[1].toLowerCase();
            if (ext === 'jpeg') ext = 'jpg';
            const buffer = Buffer.from(matches[2], 'base64');
            const filename = `student-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
            const uploadDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadDir, filename), buffer);
            pictureUrl = `/uploads/${filename}`;
          }
        } else if (typeof picture === 'string' && (picture.startsWith('http') || picture.startsWith('/'))) {
          pictureUrl = picture;
        }
      } catch (picErr) {
        console.warn('Failed to save student picture from payload:', picErr.message);
      }
    }

    const nameParts = resolvedFullName.split(/\s+/);
    const derivedFirst = resolvedFirst || nameParts[0] || resolvedFullName;
    const derivedLast = resolvedLast || nameParts.slice(1).join(' ') || '';

    createdUser = await createUserRecord({
      username,
      name: resolvedFullName,
      cnic: cleanCnic,
      phone,
      email: guardianEmail,
      gender: gender || 'Male',
      dob: dob ? new Date(dob) : undefined,
      address,
      city,
      pictureUrl,
      pinHash: hashedPin,
      role: 'student',
      status: 'Active',
      createdBy: req.user.userId || req.user.id || null
    });

    const targetStatus =
      status || (classId && parentId ? 'Enrolled' : 'approved');

    const newStudent = await Student.create({
      userId: createdUser._id,
      firstName: derivedFirst,
      lastName: derivedLast,
      fullName: resolvedFullName,
      fatherName: String(fatherName).trim(),
      cnic: cleanCnic,
      bFormNo: cleanCnic,
      guardianMobile: String(guardianMobile).trim(),
      guardianEmail: String(guardianEmail).trim().toLowerCase(),
      pin: hashedPin,
      address: String(address).trim(),
      city: String(city).trim(),
      gender: gender || 'Male',
      ...(dob ? { dob: new Date(dob) } : {}),
      ...(classId ? { classId } : {}),
      ...(parentId ? { parentId } : {}),
      enrollmentProgram: String(enrollmentProgram).trim(),
      pictureUrl,
      status: targetStatus
    });

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully by admin!',
      user: createdUser,
      student: {
        id: newStudent._id,
        _id: newStudent._id,
        userId: createdUser._id,
        firstName: newStudent.firstName,
        lastName: newStudent.lastName,
        fullName: newStudent.fullName,
        cnic: newStudent.cnic,
        status: newStudent.status
      }
    });
  } catch (error) {
    await rollbackUser(createdUser);
    console.error('[Register Error]:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Server error during registration'
    });
  }
};

/**
 * POST /api/auth/login-pin (and /api/auth/login)
 * Unified login against the central `users` table for superadmin, admin, student, teacher, parent.
 */
exports.loginWithPin = async (req, res) => {
  try {
    const { cnic, username, phone, identifier, pin, password } = req.body || {};
    const rawIdentifier = cnic || username || phone || identifier;
    const rawSecret = pin !== undefined && pin !== null && pin !== '' ? pin : password;

    if (!rawIdentifier || !rawSecret) {
      return res.status(400).json({ error: 'CNIC / Phone / Username and PIN / Password are required' });
    }

    const trimmedIdentifier = String(rawIdentifier).trim();
    const lowerIdentifier = trimmedIdentifier.toLowerCase();
    const cleanSecret = String(rawSecret).trim();

    const buildUserQuery = () => ({
      $or: [
        { username: lowerIdentifier },
        { cnic: trimmedIdentifier },
        { phone: trimmedIdentifier },
        { email: lowerIdentifier }
      ]
    });

    let matchedUser = await User.findOne(buildUserQuery()).select('+pinHash');

    const defaultSuperAdminUsername = (process.env.SUPERADMIN_USERNAME || 'superadmin').toLowerCase();
    const defaultSuperAdminCnic = process.env.SUPERADMIN_CNIC || '00000-0000000-0';
    const defaultSuperAdminPhone = process.env.SUPERADMIN_PHONE || '03000000000';
    const isDefaultSuperAdminIdentifier =
      lowerIdentifier === defaultSuperAdminUsername ||
      trimmedIdentifier === defaultSuperAdminCnic ||
      trimmedIdentifier === defaultSuperAdminPhone;

    // Auto-seed default SuperAdmin if no superadmin exists yet in `users`
    if (!matchedUser && isDefaultSuperAdminIdentifier) {
      const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
      if (!existingSuperAdmin) {
        await User.ensureDefaultSuperAdmin();
        matchedUser = await User.findOne(buildUserQuery()).select('+pinHash');
      }
    }

    if (matchedUser) {
      if (matchedUser.status !== 'Active') {
        return res.status(403).json({
          success: false,
          error: 'Your user account is Inactive. Please contact administration.',
          message: 'Your user account is Inactive. Please contact administration.'
        });
      }

      if (!matchedUser.pinHash) {
        return res.status(403).json({
          success: false,
          error: 'No PIN/password has been set for this account. Please contact administration.',
          message: 'No PIN/password has been set for this account. Please contact administration.'
        });
      }

      const isPinMatch = await bcryptjs.compare(cleanSecret, matchedUser.pinHash);
      if (!isPinMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. Please try again.',
          message: 'Invalid credentials. Please try again.'
        });
      }

      User.findByIdAndUpdate(matchedUser._id, { lastLoginAt: new Date() }).catch(() => null);

      const userRole = matchedUser.role || 'student';
      const userObj =
        typeof matchedUser.toJSON === 'function' ? matchedUser.toJSON() : { ...matchedUser };
      delete userObj.pinHash;

      if (userRole === 'superadmin' || userRole === 'admin') {
        const token = signUserToken(matchedUser);

        return res.status(200).json({
          success: true,
          message: `${matchedUser.name} authenticated successfully!`,
          role: userRole,
          token,
          user: userObj
        });
      }

      if (userRole === 'student') {
        const studentOr = [{ userId: matchedUser._id }];
        if (matchedUser.cnic) studentOr.push({ cnic: matchedUser.cnic });
        const student = await Student.findOne({ $or: studentOr });

        if (student) {
          if (student.status === 'pending') {
            return res.status(403).json({
              error: 'Your registration is currently PENDING admin approval. Please try again after approval.',
              status: 'pending'
            });
          }
          if (student.status === 'rejected' || student.status === 'Suspended') {
            return res.status(403).json({
              error: `Your student account is ${student.status}. Please contact administration.`,
              status: student.status
            });
          }
          if (typeof student.populate === 'function') {
            await student.populate(STUDENT_POPULATE);
          }
        }

        const studentData = student
          ? typeof student.toObject === 'function'
            ? student.toObject()
            : { ...student }
          : {
              _id: matchedUser._id,
              userId: matchedUser._id,
              fullName: matchedUser.name,
              cnic: matchedUser.cnic,
              role: 'student',
              status: 'Enrolled'
            };
        delete studentData.pin;

        const token = signUserToken(matchedUser, student);

        return res.status(200).json({
          success: true,
          message: 'Login successful!',
          role: 'student',
          token,
          user: userObj,
          student: studentData
        });
      }

      if (userRole === 'teacher') {
        const teacherOr = [{ userId: matchedUser._id }];
        if (matchedUser.phone) teacherOr.push({ phone: matchedUser.phone });
        if (matchedUser.cnic) teacherOr.push({ cnic: matchedUser.cnic });
        const teacher = await Teacher.findOne({ $or: teacherOr });

        const token = signUserToken(matchedUser, teacher);
        return res.status(200).json({
          success: true,
          message: 'Teacher authenticated successfully',
          role: 'teacher',
          token,
          user: userObj,
          ...(teacher ? { teacher } : {})
        });
      }

      if (userRole === 'parent') {
        const parentOr = [{ userId: matchedUser._id }];
        if (matchedUser.phone) parentOr.push({ phone: matchedUser.phone });
        if (matchedUser.cnic) parentOr.push({ cnic: matchedUser.cnic });
        const parent = await Parent.findOne({ $or: parentOr });

        const token = signUserToken(matchedUser, parent);
        return res.status(200).json({
          success: true,
          message: 'Parent authenticated successfully',
          role: 'parent',
          token,
          user: userObj,
          ...(parent ? { parent } : {})
        });
      }
    }

    return res.status(404).json({
      success: false,
      error: 'No account found with this CNIC / Phone / Username',
      message: 'No account found with this CNIC / Phone / Username'
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ error: error.message || 'Server error during login' });
  }
};

// GET /api/auth/me - Return the authenticated user and linked role profile
exports.getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const userId = req.user.userId || req.user.id;
    const canQueryUsers =
      mongoose.connection.readyState === 1 || User.findById !== mongoose.Model.findById;
    const user =
      canQueryUsers && mongoose.Types.ObjectId.isValid(userId)
        ? await User.findById(userId)
        : null;

    if (req.user.role === 'student') {
      const studentLookupId = req.user.studentId || req.user.id;
      let student = await Student.findById(studentLookupId).populate(STUDENT_POPULATE);
      if (!student && req.user.userId) {
        student = await Student.findOne({ userId: req.user.userId }).populate(STUDENT_POPULATE);
      }
      if (!student && !user) {
        return res.status(404).json({ success: false, message: 'Student record not found' });
      }
      const studentData = student
        ? typeof student.toObject === 'function'
          ? student.toObject()
          : { ...student }
        : null;
      if (studentData) delete studentData.pin;
      return res.status(200).json({
        success: true,
        role: (student && student.role) || 'student',
        ...(user ? { user } : {}),
        ...(studentData ? { student: studentData } : {})
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found' });
    }

    if (user.role === 'teacher') {
      const teacher = await Teacher.findOne({
        $or: [{ userId: user._id }, ...(req.user.teacherId ? [{ _id: req.user.teacherId }] : [])]
      });
      return res.status(200).json({
        success: true,
        role: user.role,
        user,
        ...(teacher ? { teacher } : {})
      });
    }

    if (user.role === 'parent') {
      const parent = await Parent.findOne({
        $or: [{ userId: user._id }, ...(req.user.parentId ? [{ _id: req.user.parentId }] : [])]
      });
      return res.status(200).json({
        success: true,
        role: user.role,
        user,
        ...(parent ? { parent } : {})
      });
    }

    return res.status(200).json({
      success: true,
      role: user.role || req.user.role,
      user
    });
  } catch (error) {
    console.error('[Get Me Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
  }
};

// GET /api/auth/users - List users in the central `users` table (SuperAdmin / Admin protected)
exports.getUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query || {};
    const query = {};

    if (role && role !== 'All' && role !== 'all') {
      query.role = role;
    }

    if (status && status !== 'All' && status !== 'all') {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { username: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { cnic: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } }
      ];
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('[Get Users Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// GET /api/auth/users/:id - Get single user by ID (SuperAdmin / Admin protected)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID format' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let profile = null;
    if (user.role === 'student') profile = await Student.findOne({ userId: user._id }).populate(STUDENT_POPULATE);
    else if (user.role === 'teacher') profile = await Teacher.findOne({ userId: user._id });
    else if (user.role === 'parent') profile = await Parent.findOne({ userId: user._id });

    return res.status(200).json({
      success: true,
      user,
      ...(profile ? { profile } : {})
    });
  } catch (error) {
    console.error('[Get User By ID Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
  }
};

/**
 * POST /api/auth/users
 * Create a user of any allowed role in the `users` table (SuperAdmin / Admin protected).
 * Only SuperAdmin can create `superadmin` or `admin` accounts.
 * Admin and SuperAdmin can create `student`, `teacher`, or `parent` accounts.
 */
exports.createUser = async (req, res) => {
  let createdUser = null;
  try {
    const {
      username,
      name,
      cnic,
      phone,
      email,
      gender,
      dob,
      address,
      city,
      pictureUrl,
      pin,
      password,
      role,
      status,
      // Optional role-specific fields
      fatherName,
      classId,
      parentId,
      bFormNo,
      rollNo,
      enrollmentProgram,
      teacherRole
    } = req.body || {};

    const targetRole = String(role || 'student').trim().toLowerCase();
    const validRoles = ['superadmin', 'admin', 'student', 'teacher', 'parent'];
    if (!validRoles.includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    if (['superadmin', 'admin'].includes(targetRole) && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only SuperAdmin can create admin or superadmin users'
      });
    }

    if (['superadmin', 'admin'].includes(targetRole) && (!username || !String(username).trim())) {
      return res.status(400).json({ success: false, message: 'Username is required for admin accounts' });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const rawSecret = pin !== undefined && pin !== null && pin !== '' ? pin : password;
    if (['superadmin', 'admin'].includes(targetRole)) {
      if (!rawSecret || !/^\d{4,8}$/.test(String(rawSecret).trim())) {
        return res.status(400).json({ success: false, message: 'PIN must be 4 to 8 numeric digits' });
      }
    } else if (rawSecret !== undefined && rawSecret !== null && String(rawSecret).trim() !== '') {
      if (String(rawSecret).trim().length < 4) {
        return res.status(400).json({ success: false, message: 'PIN/Password must be at least 4 characters' });
      }
    }

    const pinHash = rawSecret && String(rawSecret).trim()
      ? await User.hashPin(String(rawSecret).trim())
      : undefined;

    createdUser = await createUserRecord({
      username,
      name,
      cnic,
      phone,
      email,
      gender,
      dob: dob ? new Date(dob) : undefined,
      address,
      city,
      pictureUrl,
      pinHash,
      role: targetRole,
      status: status || 'Active',
      createdBy: req.user?.userId || req.user?.id || null
    });

    let profile = null;
    if (targetRole === 'teacher' && phone && String(phone).trim()) {
      profile = await Teacher.create({
        userId: createdUser._id,
        name: createdUser.name,
        phone: createdUser.phone,
        email: createdUser.email,
        cnic: createdUser.cnic,
        role: teacherRole || 'Hifz Teacher',
        passwordHash: pinHash,
        status: createdUser.status
      });
    } else if (targetRole === 'parent' && phone && String(phone).trim() && cnic && String(cnic).trim()) {
      profile = await Parent.create({
        userId: createdUser._id,
        name: createdUser.name,
        phone: createdUser.phone,
        cnic: createdUser.cnic,
        address: createdUser.address,
        passwordHash: pinHash,
        status: createdUser.status
      });
    } else if (targetRole === 'student' && fatherName && String(fatherName).trim()) {
      const studentStatus = classId && parentId ? 'Enrolled' : 'approved';
      profile = await Student.create({
        userId: createdUser._id,
        fullName: createdUser.name,
        fatherName: String(fatherName).trim(),
        cnic: createdUser.cnic,
        bFormNo: bFormNo ? String(bFormNo).trim() : createdUser.cnic,
        rollNo: rollNo ? String(rollNo).trim() : undefined,
        gender: gender || 'Male',
        dob: dob ? new Date(dob) : undefined,
        address: createdUser.address,
        city: createdUser.city,
        enrollmentProgram,
        pictureUrl: createdUser.pictureUrl,
        ...(classId ? { classId } : {}),
        ...(parentId ? { parentId } : {}),
        pin: pinHash,
        status: studentStatus
      });
    }

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: createdUser,
      ...(profile ? { profile } : {})
    });
  } catch (error) {
    await rollbackUser(createdUser);
    console.error('[Create User Error]:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A user with this username, CNIC, or phone already exists'
      });
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create user',
      error: error.message
    });
  }
};
