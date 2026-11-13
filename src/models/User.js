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
  const defaultName = (process.env.SUPERADMIN_NAME || 'Abdullah Zia').trim();
  const defaultPin = (process.env.SUPERADMIN_PIN || '1999').trim();
  const defaultCnic = (process.env.SUPERADMIN_CNIC || '37405-1892303-7').trim();
  const defaultPhone = (process.env.SUPERADMIN_PHONE || '03029148955').trim();
  const defaultEmail = (process.env.SUPERADMIN_EMAIL || 'abdullahzia540@gmail.com').toLowerCase().trim();

  let existing = await this.findOne({ username: defaultUsername }).select('+pinHash');
  if (!existing) {
    existing = await this.findOne({ role: 'superadmin' }).select('+pinHash');
  }

  const pinHash = await bcrypt.hash(defaultPin, 10);

  if (existing) {
    const updates = {};
    if (existing.username !== defaultUsername) updates.username = defaultUsername;
    if (existing.role !== 'superadmin') updates.role = 'superadmin';
    if (existing.status !== 'Active') updates.status = 'Active';
    if (existing.name !== defaultName) updates.name = defaultName;
    if (existing.cnic !== defaultCnic) updates.cnic = defaultCnic;
    if (existing.phone !== defaultPhone) updates.phone = defaultPhone;
    if (existing.email !== defaultEmail) updates.email = defaultEmail;

    const isPinMatch = existing.pinHash ? await bcrypt.compare(defaultPin, existing.pinHash) : false;
    if (!isPinMatch) {
      updates.pinHash = pinHash;
    }

    if (Object.keys(updates).length) {
      existing = await this.findByIdAndUpdate(existing._id, { $set: updates }, { new: true });
    }
    return existing;
  }

  try {
    return await this.create({
      username: defaultUsername,
      name: defaultName,
      cnic: defaultCnic,
      phone: defaultPhone,
      email: defaultEmail,
      pinHash,
      role: 'superadmin',
      status: 'Active'
    });
  } catch (err) {
    if (err.code === 11000) {
      return await this.create({
        username: defaultUsername,
        name: defaultName,
        email: defaultEmail,
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
