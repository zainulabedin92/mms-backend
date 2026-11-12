const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cleanOptionalString = (val) => {
  if (val === undefined || val === null) return undefined;
  const trimmed = String(val).trim();
  return trimmed.length ? trimmed : undefined;
};

/**
 * Central `users` table/collection storing all system users
 * (superadmin, admin, student, teacher, parent) and their basic info.
 * Role-specific attributes live in `students`, `teachers`, and `parents`
 * linked via `userId`.
 */
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      set: cleanOptionalString,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    cnic: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      set: cleanOptionalString,
      index: true
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      set: cleanOptionalString,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      set: cleanOptionalString,
      index: true
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other']
    },
    dob: {
      type: Date
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    pictureUrl: {
      type: String,
      default: null
    },
    pinHash: {
      type: String,
      select: false
    },
    role: {
      type: String,
      enum: {
        values: ['superadmin', 'admin', 'student', 'teacher', 'parent'],
        message: '{VALUE} is not a valid user role'
      },
      required: true,
      default: 'student',
      index: true
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

UserSchema.methods.comparePin = async function (candidatePin) {
  if (!this.pinHash) return false;
  return bcrypt.compare(String(candidatePin), this.pinHash);
};

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return this.comparePin(candidatePassword);
};

UserSchema.statics.hashPin = function (pin) {
  return bcrypt.hash(String(pin), 10);
};

/**
 * Ensure a default Super Admin record exists in the `users` table/collection
 * so fresh installations can log in using the `users` table immediately.
 */
UserSchema.statics.ensureDefaultSuperAdmin = async function () {
  const defaultUsername = (process.env.SUPERADMIN_USERNAME || 'superadmin').toLowerCase().trim();
  const defaultPin = (process.env.SUPERADMIN_PIN || '1234').trim();
  const defaultCnic = (process.env.SUPERADMIN_CNIC || '00000-0000000-0').trim();
  const defaultPhone = (process.env.SUPERADMIN_PHONE || '03000000000').trim();

  let existing = await this.findOne({ username: defaultUsername });
  if (!existing) {
    existing = await this.findOne({ role: 'superadmin' });
  }

  if (existing) {
    const updates = {};
    if (existing.username === defaultUsername && existing.role !== 'superadmin') {
      updates.role = 'superadmin';
    }
    if (existing.status !== 'Active') {
      updates.status = 'Active';
    }
    if (Object.keys(updates).length) {
      existing = await this.findByIdAndUpdate(existing._id, { $set: updates }, { new: true });
    }
    return existing;
  }

  const pinHash = await bcrypt.hash(defaultPin, 10);
  try {
    return await this.create({
      username: defaultUsername,
      name: 'Hazrat Maulana Muhtamim Sahib',
      cnic: defaultCnic,
      phone: defaultPhone,
      email: 'muhtamim@mms.edu',
      pinHash,
      role: 'superadmin',
      status: 'Active'
    });
  } catch (err) {
    if (err.code === 11000) {
      return this.create({
        username: defaultUsername,
        name: 'Hazrat Maulana Muhtamim Sahib',
        email: 'muhtamim@mms.edu',
        pinHash,
        role: 'superadmin',
        status: 'Active'
      });
    }
    throw err;
  }
};

// Never expose pinHash in JSON responses
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.pinHash;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
