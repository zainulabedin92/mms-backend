// src/controllers/studentController.js
const Student = require('../models/Student');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Student Registration
exports.register = async (req, res) => {
  try {
    const { pin, confirmPin, ...otherData } = req.body;
    if (pin !== confirmPin) return res.status(400).json({ error: "PINs do not match" });

    const hashedPin = await bcrypt.hash(pin, 10);
    const pictureUrl = req.file ? req.file.path : null;

    const student = await Student.create({ ...otherData, pin: hashedPin, pictureUrl });
    res.status(201).json({ message: "Registration submitted. Awaiting admin approval.", studentId: student._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PIN Login for React Native
exports.loginWithPin = async (req, res) => {
  try {
    console.log("Login attempt started...");
    const { cnic, pin } = req.body;
    console.log("CNIC: " + cnic, "PIN: " + pin);
    const student = await Student.findOne({ cnic });
    console.log("STUDENT: " + student);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.status !== 'approved') return res.status(403).json({ error: "Account is pending admin approval." });

    const isMatch = await bcrypt.compare(pin, student.pin);
    if (!isMatch) return res.status(401).json({ error: "Invalid PIN" });

    res.status(200).json({ message: "Login successful", student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin Approval & Email Dispatch
exports.approveStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    if (!student) return res.status(404).json({ error: "Student not found" });

    // Send confirmation email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: student.guardianEmail,
      subject: 'MMS Registration Approved',
      text: `Assalam-o-Alaikum, the registration for ${student.firstName} ${student.lastName} has been approved. You may now log in to the MMS app using your 4-digit PIN.`
    });

    res.status(200).json({ message: "Student approved and email sent successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};