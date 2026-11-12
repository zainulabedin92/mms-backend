const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Parent = require('../models/Parent');
const Student = require('../models/Student');
const User = require('../models/User');
const {
  cleanStr,
  findUserConflict,
  createUserRecord,
  rollbackUser,
  signUserToken
} = require('../utils/userSync');

/**
 * Resolve the Parent document ID for the authenticated parent user
 */
const resolveAuthenticatedParentId = async (reqUser) => {
  if (!reqUser) return null;
  if (reqUser.parentId) return reqUser.parentId;
  if (reqUser.userId) {
    const linked = await Parent.findOne({ userId: reqUser.userId });
    if (linked) return linked._id;
  }
  return reqUser.id;
};

/**
 * @desc    Parent Authentication / Login against central `users` table
 * @route   POST /api/parents/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { identifier, phone, cnic, username, password, pin } = req.body || {};

    const loginCredential = String(identifier || phone || cnic || username || '').trim();
    const secret = String(password !== undefined && password !== null && password !== '' ? password : pin || '').trim();

    if (!loginCredential || !secret) {
      return res.status(400).json({
        success: false,
        message: 'Phone/CNIC and password are required'
      });
    }

    const user = await User.findOne({
      role: 'parent',
      $or: [
        { phone: loginCredential },
        { cnic: loginCredential },
        { username: loginCredential.toLowerCase() }
      ]
    }).select('+pinHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. No parent found in users table with this Phone, CNIC, or Username.'
      });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Your parent account is Inactive. Please contact administration.'
      });
    }

    if (!user.pinHash) {
      return res.status(403).json({
        success: false,
        message: 'No portal password has been set for this parent. Please contact administration.'
      });
    }

    const isMatch = await bcrypt.compare(secret, user.pinHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.'
      });
    }

    User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }).catch(() => null);

    const parentOr = [{ userId: user._id }];
    if (user.phone) parentOr.push({ phone: user.phone });
    if (user.cnic) parentOr.push({ cnic: user.cnic });
    const parent = await Parent.findOne({ $or: parentOr });

    const token = signUserToken(user, parent);

    return res.status(200).json({
      success: true,
      message: 'Parent authenticated successfully',
      role: 'parent',
      token,
      user,
      ...(parent ? { parent } : {})
    });
  } catch (error) {
    console.error('[Parent Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during parent authentication',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new parent / guardian (stores basic info in `users` + parent profile in `parents`)
 * @route   POST /api/parents
 * @access  SuperAdmin / Admin (JWT)
 */
exports.createParent = async (req, res) => {
  let createdUser = null;
  try {
    const {
      name,
      phone,
      cnic,
      email,
      username,
      address,
      city,
      gender,
      pictureUrl,
      password,
      pin,
      status
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Parent / Guardian name is required' });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    if (!cnic || !String(cnic).trim()) {
      return res.status(400).json({ success: false, message: 'CNIC number is required' });
    }

    const cleanPhone = String(phone).trim();
    const cleanCnic = String(cnic).trim();

    const existingParent = await Parent.findOne({
      $or: [{ phone: cleanPhone }, { cnic: cleanCnic }]
    });
    if (existingParent) {
      return res.status(400).json({
        success: false,
        message: 'A parent with this phone number or CNIC already exists'
      });
    }

    const rawSecret = password !== undefined && password !== null && password !== '' ? password : pin;
    const numericCnicDigits = cleanCnic.replace(/\D/g, '');
    const defaultPlainPassword =
      rawSecret && String(rawSecret).trim()
        ? String(rawSecret).trim()
        : numericCnicDigits.length >= 6
          ? numericCnicDigits.slice(-6)
          : '123456';

    const hashedPassword = await bcrypt.hash(defaultPlainPassword, 10);
    const parentStatus = status || 'Active';

    createdUser = await createUserRecord({
      username,
      name: String(name).trim(),
      phone: cleanPhone,
      cnic: cleanCnic,
      email: cleanStr(email)?.toLowerCase(),
      address: cleanStr(address),
      city: cleanStr(city),
      gender,
      pictureUrl: pictureUrl || null,
      pinHash: hashedPassword,
      role: 'parent',
      status: parentStatus,
      createdBy: req.user ? req.user.userId || req.user.id || null : null
    });

    const parent = await Parent.create({
      userId: createdUser._id,
      name: String(name).trim(),
      phone: cleanPhone,
      cnic: cleanCnic,
      address: cleanStr(address),
      passwordHash: hashedPassword,
      status: parentStatus
    });

    return res.status(201).json({
      success: true,
      message: 'Parent created successfully',
      user: createdUser,
      parent,
      ...(!(rawSecret && String(rawSecret).trim()) && {
        credentials: {
          phone: parent.phone,
          cnic: parent.cnic,
          defaultPassword: defaultPlainPassword,
          note: 'Share this temporary password with the parent for portal login'
        }
      })
    });
  } catch (error) {
    await rollbackUser(createdUser);
    console.error('[Create Parent Error]:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A parent with this phone, CNIC, or username already exists'
      });
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create parent',
      error: error.message
    });
  }
};

/**
 * @desc    Get all children enrolled for the logged-in parent
 *          Populates class and assigned classTeacher details
 * @route   GET /api/parents/my-children
 * @access  Protected (Parent JWT required)
 */
exports.getMyChildren = async (req, res) => {
  try {
    const parentId = await resolveAuthenticatedParentId(req.user);

    const children = await Student.find({ parentId })
      .populate({
        path: 'classId',
        select: 'name section roomNumber academicYear status',
        populate: {
          path: 'classTeacher',
          select: 'name phone email role'
        }
      })
      .sort({ fullName: 1 });

    return res.status(200).json({
      success: true,
      count: children.length,
      children
    });
  } catch (error) {
    console.error('[Get My Children Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve children records',
      error: error.message
    });
  }
};

/**
 * @desc    Get profile details of the authenticated parent
 * @route   GET /api/parents/profile
 * @access  Protected (Parent JWT required)
 */
exports.getProfile = async (req, res) => {
  try {
    const parentId = await resolveAuthenticatedParentId(req.user);
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      parent
    });
  } catch (error) {
    console.error('[Get Parent Profile Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching parent profile',
      error: error.message
    });
  }
};

/**
 * @desc    List all parents (Admin use)
 * @route   GET /api/parents
 * @access  Admin
 */
exports.getAllParents = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { cnic: { $regex: term, $options: 'i' } }
      ];
    }

    const parents = await Parent.find(query).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: parents.length,
      parents
    });
  } catch (error) {
    console.error('[Get All Parents Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch parents list',
      error: error.message
    });
  }
};

/**
 * @desc    Update a parent / guardian profile (syncs basic info to `users` table)
 * @route   PUT /api/parents/:id
 * @access  SuperAdmin / Admin (JWT)
 */
exports.updateParent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, cnic, email, address, city, gender, status, password, pin } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Parent ID format' });
    }

    const existingParent = await Parent.findById(id);
    if (!existingParent) {
      return res.status(404).json({ success: false, message: 'Parent profile not found' });
    }

    const $set = {};
    const $unset = {};
    const userSet = {};
    const userUnset = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Parent name is required' });
      }
      $set.name = String(name).trim();
      userSet.name = $set.name;
    }

    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (!cleanPhone) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
      }
      const duplicate = await Parent.findOne({ phone: cleanPhone, _id: { $ne: id } });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Another parent with this phone number already exists'
        });
      }
      $set.phone = cleanPhone;
      userSet.phone = cleanPhone;
    }

    if (cnic !== undefined) {
      const cleanCnic = String(cnic).trim();
      if (!cleanCnic) {
        return res.status(400).json({ success: false, message: 'CNIC number is required' });
      }
      const duplicate = await Parent.findOne({ cnic: cleanCnic, _id: { $ne: id } });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Another parent with this CNIC already exists'
        });
      }
      $set.cnic = cleanCnic;
      userSet.cnic = cleanCnic;
    }

    if (email !== undefined) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (cleanEmail) userSet.email = cleanEmail;
      else userUnset.email = '';
    }

    if (address !== undefined) {
      const cleanAddress = String(address || '').trim();
      if (cleanAddress) {
        $set.address = cleanAddress;
        userSet.address = cleanAddress;
      } else {
        $unset.address = '';
        userUnset.address = '';
      }
    }

    if (city !== undefined) {
      const cleanCity = String(city || '').trim();
      if (cleanCity) userSet.city = cleanCity;
      else userUnset.city = '';
    }

    if (gender) userSet.gender = gender;

    if (status) {
      $set.status = status;
      userSet.status = status;
    }

    const rawSecret = password !== undefined && password !== null && password !== '' ? password : pin;
    if (rawSecret && String(rawSecret).trim()) {
      if (String(rawSecret).trim().length < 4) {
        return res.status(400).json({
          success: false,
          message: 'New password/PIN must be at least 4 characters'
        });
      }
      const hashed = await bcrypt.hash(String(rawSecret).trim(), 10);
      $set.passwordHash = hashed;
      userSet.pinHash = hashed;
    }

    if (existingParent.userId && (userSet.phone || userSet.cnic)) {
      const conflict = await findUserConflict(
        { phone: userSet.phone, cnic: userSet.cnic },
        existingParent.userId
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

    const parent = Object.keys(update).length
      ? await Parent.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      : existingParent;

    if (existingParent.userId && Object.keys(userUpdate).length) {
      await User.findByIdAndUpdate(existingParent.userId, userUpdate, { runValidators: true }).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      message: 'Parent updated successfully',
      parent
    });
  } catch (error) {
    console.error('[Update Parent Error]:', error);
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'Field';
      return res.status(400).json({
        success: false,
        message: `A parent with this ${duplicateField} already exists`
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update parent',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a parent / guardian profile (and linked `users` entry)
 *          Blocked while students are still linked (Student.parentId is required)
 * @route   DELETE /api/parents/:id
 * @access  SuperAdmin (JWT)
 */
exports.deleteParent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Parent ID format' });
    }

    const linkedChildren = await Student.countDocuments({ parentId: id });
    if (linkedChildren > 0) {
      return res.status(409).json({
        success: false,
        message: `This parent is linked to ${linkedChildren} student(s). Delete or re-assign those students first.`,
        count: linkedChildren
      });
    }

    const parent = await Parent.findByIdAndDelete(id);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent profile not found' });
    }

    if (parent.userId) {
      await User.findByIdAndDelete(parent.userId).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      message: 'Parent deleted successfully',
      parent: { _id: parent._id, name: parent.name }
    });
  } catch (error) {
    console.error('[Delete Parent Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete parent',
      error: error.message
    });
  }
};
