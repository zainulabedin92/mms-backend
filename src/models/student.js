const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    cnic: { type: String, required: true, unique: true, trim: true },
    guardianMobile: { type: String, required: true, trim: true },
    guardianEmail: { type: String, required: true, trim: true, lowercase: true },
    pin: { type: String, required: true }, // 4-digit PIN hashed with bcrypt
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    enrollmentProgram: { type: String, required: true, trim: true },
    pictureUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    role: {
      type: String,
      enum: ['student', 'superadmin', 'admin', 'nazim_taleem'],
      default: 'student'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', StudentSchema);