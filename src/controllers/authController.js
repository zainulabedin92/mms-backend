const Student = require('../models/Student');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      fatherName,
      cnic,
      guardianMobile,
      guardianEmail,
      pin,
      confirmPin,
      address,
      city,
      enrollmentProgram,
      picture
    } = req.body;

    // Required fields validation
    if (!firstName || !lastName || !fatherName || !cnic || !guardianMobile || !guardianEmail || !pin || !address || !city || !enrollmentProgram) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // PIN 4-digit validation
    const pinRegex = /^\d{4}$/;
    if (!pinRegex.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 numeric digits' });
    }

    // PIN match validation
    if (confirmPin && pin !== confirmPin) {
      return res.status(400).json({ error: 'PIN and Confirm PIN do not match' });
    }

    // Check duplicate CNIC
    const existingStudent = await Student.findOne({ cnic: cnic.trim() });
    if (existingStudent) {
      return res.status(400).json({ error: 'A student with this B-Form / CNIC is already registered' });
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // Picture URL format
    let pictureUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Handle picture from JSON base64 or URL
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

    // Create Student record
    const newStudent = await Student.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fatherName: fatherName.trim(),
      cnic: cnic.trim(),
      guardianMobile: guardianMobile.trim(),
      guardianEmail: guardianEmail.trim().toLowerCase(),
      pin: hashedPin,
      address: address.trim(),
      city: city.trim(),
      enrollmentProgram: enrollmentProgram.trim(),
      pictureUrl,
      status: 'pending'
    });

    return res.status(201).json({
      message: 'Registration submitted successfully! Awaiting admin approval.',
      student: {
        id: newStudent._id,
        firstName: newStudent.firstName,
        lastName: newStudent.lastName,
        cnic: newStudent.cnic,
        status: newStudent.status
      }
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({ error: error.message || 'Server error during registration' });
  }
};

// POST /api/auth/login-pin
exports.loginWithPin = async (req, res) => {
  try {
    //console.log("Login attempt started...");
    const { cnic, pin } = req.body;
    //console.log("CNIC: " + cnic, "PIN: " + pin);

    if (!cnic || !pin) {
      return res.status(400).json({ error: 'CNIC and 4-digit PIN are required' });
    }

    const trimmedCnic = cnic.trim();
    const cleanPin = pin.trim();

    // Check for SuperAdmin credentials (Muhtamim Console)
    const isSuperAdminIdentifier =
      trimmedCnic.toLowerCase() === 'superadmin' ||
      trimmedCnic.toLowerCase() === 'admin' ||
      trimmedCnic.toLowerCase() === 'super admin' ||
      trimmedCnic.toLowerCase() === 'muhtamim' ||
      trimmedCnic === '00000-0000000-0' ||
      trimmedCnic === '0000000000000' ||
      trimmedCnic === '99999-9999999-9' ||
      trimmedCnic === '03000000000';

    if (isSuperAdminIdentifier && (cleanPin === '1234' || cleanPin === '0000' || cleanPin === '7860')) {
      return res.status(200).json({
        message: 'SuperAdmin Muhtamim authenticated successfully!',
        role: 'superadmin',
        student: {
          id: 'superadmin-root',
          firstName: 'Hazrat Maulana',
          lastName: 'Muhtamim Sahib',
          cnic: trimmedCnic,
          role: 'superadmin',
          status: 'approved',
          enrollmentProgram: 'Markazi Idara Console'
        }
      });
    }

    // Find student in DB (by CNIC or guardian mobile)
    const student = await Student.findOne({
      $or: [
        { cnic: trimmedCnic },
        { guardianMobile: trimmedCnic }
      ]
    });
    if (!student) {
      return res.status(404).json({ error: 'No account found with this CNIC / Mobile' });
    }

    // Check Approval Status
    if (student.status === 'pending') {
      return res.status(403).json({
        error: 'Your registration is currently PENDING admin approval. Please try again after approval.',
        status: 'pending'
      });
    }

    if (student.status === 'rejected') {
      return res.status(403).json({
        error: 'Your registration has been REJECTED by Madaris admin.',
        status: 'rejected'
      });
    }

    // Verify PIN
    const isMatch = await bcrypt.compare(pin, student.pin);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid 4-digit PIN. Please try again.' });
    }

    // Convert student object and sanitize PIN before sending
    const studentData = student.toObject();
    delete studentData.pin;

    return res.status(200).json({
      message: 'Login successful!',
      role: student.role || 'student',
      student: studentData
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ error: error.message || 'Server error during login' });
  }
};
