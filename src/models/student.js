const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    rollNo: {
      type: String,
      unique: true,
      index: true,
      trim: true
    },
    fullName: {
      type: String,
      required: [true, 'Student full name is required'],
      trim: true
    },
    fatherName: {
      type: String,
      required: [true, 'Father name is required'],
      trim: true
    },
    dob: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Male'
    },
    bFormNo: {
      type: String,
      trim: true,
      index: true
    },
    admissionDate: {
      type: Date,
      default: Date.now
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class assignment (classId) is required'],
      index: true
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      required: [true, 'Parent / Guardian reference (parentId) is required'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['Enrolled', 'Completed', 'Suspended', 'pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid student status'
      },
      default: 'Enrolled',
      index: true
    },

    // Optional legacy & profile fields for backward compatibility with mobile app / admin
    pictureUrl: { type: String, default: null },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    enrollmentProgram: { type: String, trim: true },
    cnic: { type: String, trim: true, sparse: true, index: true },
    guardianMobile: { type: String, trim: true },
    guardianEmail: { type: String, trim: true, lowercase: true },
    pin: { type: String }, // optional PIN for legacy mobile login
    role: { type: String, default: 'student' }
  },
  {
    timestamps: true
  }
);

// Virtual alias for registrationNo
StudentSchema.virtual('registrationNo').get(function () {
  return this.rollNo;
});

// Auto-generate rollNo before validation if not provided
StudentSchema.pre('validate', function () {
  // If fullName is missing but firstName/lastName are supplied (from legacy callers)
  if (!this.fullName && (this.firstName || this.lastName)) {
    this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  // Auto-generate unique rollNo if not provided
  if (!this.rollNo) {
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    this.rollNo = `MMS-${year}-${randomDigits}`;
  }
});

module.exports = mongoose.model('Student', StudentSchema);