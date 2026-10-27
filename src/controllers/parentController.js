const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Parent = require('../models/Parent');
const Student = require('../models/Student');

/**
 * Generate JWT token for authenticated parent
 */
const generateToken = (parent) => {
  const secret = process.env.JWT_SECRET || 'supersecretmmskey123';
  return jwt.sign(
    {
      id: parent._id,
      role: 'parent',
      phone: parent.phone,
      cnic: parent.cnic
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );
};

/**
 * @desc    Parent Authentication / Login
 * @route   POST /api/parents/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { identifier, phone, cnic, password } = req.body;

    // Support phone/cnic passed individually or via generic 'identifier' field
    const loginCredential = (identifier || phone || cnic || '').trim();

    if (!loginCredential || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone/CNIC and password are required'
      });
    }

    // Look up parent by either phone or cnic (explicitly select passwordHash)
    const parent = await Parent.findOne({
      $or: [{ phone: loginCredential }, { cnic: loginCredential }]
    }).select('+passwordHash');

    if (!parent) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. No parent found with this Phone or CNIC.'
      });
    }

    // Check account status
    if (parent.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Your parent account is Inactive. Please contact administration.'
      });
    }

    // Verify password using bcryptjs
    const isMatch = await bcrypt.compare(password, parent.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.'
      });
    }

    // Generate JWT token
    const token = generateToken(parent);

    // Sanitize output
    const parentData = parent.toObject();
    delete parentData.passwordHash;

    return res.status(200).json({
      success: true,
      message: 'Parent authenticated successfully',
      token,
      parent: parentData
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
 * @desc    Get all children enrolled for the logged-in parent
 *          Populates class and assigned classTeacher details
 * @route   GET /api/parents/my-children
 * @access  Protected (Parent JWT required)
 */
exports.getMyChildren = async (req, res) => {
  try {
    const parentId = req.user.id;

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
    const parent = await Parent.findById(req.user.id);
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
