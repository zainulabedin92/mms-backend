const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TeacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Teacher name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Teacher phone number is required'],
      unique: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    cnic: {
      type: String,
      trim: true,
      index: true
    },
    role: {
      type: String,
      enum: {
        values: [
          'Hifz Teacher',
          'Nazra Teacher',
          'Darse Nizami Teacher',
          'Head Teacher',
          'Tajweed Teacher',
          'General Teacher'
        ],
        message: '{VALUE} is not a valid teacher role'
      },
      default: 'Hifz Teacher'
    },
    passwordHash: {
      type: String,
      select: false
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Method to verify teacher password if credentials are set
TeacherSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove sensitive fields from JSON serialization
TeacherSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('Teacher', TeacherSchema);
