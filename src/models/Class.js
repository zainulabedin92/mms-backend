const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required (e.g. Hifz - Batch A)'],
      trim: true
    },
    section: {
      type: String,
      trim: true,
      default: 'A'
    },
    roomNumber: {
      type: String,
      trim: true
    },
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      index: true,
      default: null
    },
    academicYear: {
      type: String,
      trim: true,
      default: () => {
        const year = new Date().getFullYear();
        return `${year}-${year + 1}`;
      }
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

// Compound index to avoid duplicate class names in the same section and academic year
ClassSchema.index({ name: 1, section: 1, academicYear: 1 });

module.exports = mongoose.model('Class', ClassSchema);
