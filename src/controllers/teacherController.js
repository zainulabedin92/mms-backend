const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const User = require('../models/User');
const {
  cleanStr,
  findUserConflict,
  createUserRecord,
  rollbackUser,
  signUserToken
} = require('../utils/userSync');

/**
 * @desc    Teacher login (phone, CNIC, or username + password/PIN) against central `users` table.
 * @route   POST /api/teachers/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { identifier, phone, cnic, username, password, pin } = req.body || {};
    const credential = String(identifier || phone || cnic || username || '').trim();
    const secret = String(password || pin || '').trim();

    if (!credential || !secret) {
      return res.status(400).json({ success: false, message: 'Phone/CNIC and password are required' });
    }

    const user = await User.findOne({
      role: 'teacher',
      $or: [
        { phone: credential },
        { cnic: credential },
        { username: credential.toLowerCase() }
      ]
    }).select('+pinHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. No teacher found in users table with this Phone, CNIC, or Username.'
      });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Your teacher account is Inactive. Please contact administration.'
      });
    }

    if (!user.pinHash) {
      return res.status(403).json({
        success: false,
        message: 'No portal password has been set for this teacher. Please ask the Super Admin to set one.'
      });
    }

    const isMatch = await bcrypt.compare(secret, user.pinHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }).catch(() => null);

    const teacherOr = [{ userId: user._id }];
    if (user.phone) teacherOr.push({ phone: user.phone });
    const teacher = await Teacher.findOne({ $or: teacherOr });

    const token = signUserToken(user, teacher);

    return res.status(200).json({
      success: true,
      message: 'Teacher authenticated successfully',
      role: 'teacher',
      token,
      user,
      ...(teacher ? { teacher } : {})
    });
  } catch (error) {
    console.error('[Teacher Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during teacher authentication',
      error: error.message
    });
  }
};

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
 * @desc    Create a new teacher (stores basic info in `users` table + teacher profile in `teachers`)
 * @route   POST /api/teachers
 * @access  SuperAdmin / Admin (JWT)
 */
exports.createTeacher = async (req, res) => {
  let createdUser = null;
  try {
    const {
      name,
      phone,
      email,
      cnic,
      username,
      address,
      city,
      gender,
      pictureUrl,
      role,
      password,
      pin,
      status
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Teacher name is required'
      });
    }

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Teacher phone number is required'
      });
    }

    const cleanPhone = String(phone).trim();
    const existingTeacher = await Teacher.findOne({ phone: cleanPhone });
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'A teacher with this phone number already exists'
      });
    }

    const teacherRawSecret =
      pin !== undefined && pin !== null && String(pin).trim() !== ''
        ? String(pin).trim()
        : password !== undefined && password !== null && String(password).trim() !== ''
        ? String(password).trim()
        : '1234';
    const passwordHash = await bcrypt.hash(teacherRawSecret, 10);

    const teacherStatus = status || 'Active';

    createdUser = await createUserRecord({
      username,
      name: String(name).trim(),
      phone: cleanPhone,
      cnic: cleanStr(cnic),
      email: cleanStr(email)?.toLowerCase(),
      address: cleanStr(address),
      city: cleanStr(city),
      gender,
      pictureUrl: pictureUrl || null,
      pinHash: passwordHash,
      role: 'teacher',
      status: teacherStatus,
      createdBy: req.user ? req.user.userId || req.user.id || null : null
    });

    const teacher = await Teacher.create({
      userId: createdUser._id,
      name: String(name).trim(),
      phone: cleanPhone,
      email: cleanStr(email)?.toLowerCase(),
      cnic: cleanStr(cnic),
      role: role || 'Hifz Teacher',
      passwordHash,
      status: teacherStatus
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      teacherPin: teacherRawSecret,
      user: createdUser,
      teacher
    });
  } catch (error) {
    await rollbackUser(createdUser);
    console.error('[Create Teacher Error]:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A teacher with this phone/email/CNIC already exists'
      });
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create teacher',
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

/**
 * @desc    Update a teacher (syncs basic info to `users` table)
 * @route   PUT /api/teachers/:id
 * @access  SuperAdmin / Admin (JWT)
 */
exports.updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, cnic, address, city, gender, role, status, password, pin } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Teacher ID format' });
    }

    const existingTeacher = await Teacher.findById(id);
    if (!existingTeacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const $set = {};
    const $unset = {};
    const userSet = {};
    const userUnset = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Teacher name is required' });
      }
      $set.name = String(name).trim();
      userSet.name = $set.name;
    }

    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (!cleanPhone) {
        return res.status(400).json({ success: false, message: 'Teacher phone number is required' });
      }
      const duplicate = await Teacher.findOne({ phone: cleanPhone, _id: { $ne: id } });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Another teacher with this phone number already exists'
        });
      }
      $set.phone = cleanPhone;
      userSet.phone = cleanPhone;
    }

    if (email !== undefined) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (cleanEmail) {
        $set.email = cleanEmail;
        userSet.email = cleanEmail;
      } else {
        $unset.email = '';
        userUnset.email = '';
      }
    }

    if (cnic !== undefined) {
      const cleanCnic = String(cnic || '').trim();
      if (cleanCnic) {
        $set.cnic = cleanCnic;
        userSet.cnic = cleanCnic;
      } else {
        $unset.cnic = '';
        userUnset.cnic = '';
      }
    }

    if (address !== undefined) {
      const cleanAddress = String(address || '').trim();
      if (cleanAddress) userSet.address = cleanAddress;
      else userUnset.address = '';
    }
    if (city !== undefined) {
      const cleanCity = String(city || '').trim();
      if (cleanCity) userSet.city = cleanCity;
      else userUnset.city = '';
    }
    if (gender) userSet.gender = gender;

    if (role) $set.role = role;
    if (status) {
      $set.status = status;
      userSet.status = status;
    }

    const rawSecret = password !== undefined && password !== null && password !== '' ? password : pin;
    if (rawSecret && String(rawSecret).trim()) {
      const hashed = await bcrypt.hash(String(rawSecret).trim(), 10);
      $set.passwordHash = hashed;
      userSet.pinHash = hashed;
    }

    if (existingTeacher.userId && (userSet.phone || userSet.cnic)) {
      const conflict = await findUserConflict(
        { phone: userSet.phone, cnic: userSet.cnic },
        existingTeacher.userId
      );
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `Another user with this ${conflict.field} already exists`
        });
      }
    }

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    const userUpdate = {};
    if (Object.keys(userSet).length) userUpdate.$set = userSet;
    if (Object.keys(userUnset).length) userUpdate.$unset = userUnset;

    if (!Object.keys(update).length && !Object.keys(userUpdate).length) {
      return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
    }

    const teacher = Object.keys(update).length
      ? await Teacher.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      : existingTeacher;

    if (existingTeacher.userId && Object.keys(userUpdate).length) {
      await User.findByIdAndUpdate(existingTeacher.userId, userUpdate, { runValidators: true }).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      message: 'Teacher updated successfully',
      teacher
    });
  } catch (error) {
    console.error('[Update Teacher Error]:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A teacher with this phone/email/CNIC already exists'
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update teacher',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a teacher (also unassigns them as classTeacher and removes linked `users` entry)
 * @route   DELETE /api/teachers/:id
 * @access  SuperAdmin (JWT)
 */
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Teacher ID format' });
    }

    const teacher = await Teacher.findByIdAndDelete(id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    if (teacher.userId) {
      await User.findByIdAndDelete(teacher.userId).catch(() => null);
    }

    const unassigned = await Class.updateMany({ classTeacher: id }, { $set: { classTeacher: null } });

    return res.status(200).json({
      success: true,
      message: 'Teacher deleted successfully',
      unassignedClasses: unassigned.modifiedCount || 0,
      teacher: { _id: teacher._id, name: teacher.name }
    });
  } catch (error) {
    console.error('[Delete Teacher Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete teacher',
      error: error.message
    });
  }
};
