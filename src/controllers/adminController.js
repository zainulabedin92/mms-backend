const Student = require('../models/Student');
const nodemailer = require('nodemailer');

// Configure Nodemailer transporter
const createTransporter = () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_email@gmail.com') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return null;
};

// GET /api/admin/pending
exports.getPendingStudents = async (req, res) => {
  try {
    const pendingStudents = await Student.find({ status: 'pending' }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: pendingStudents.length,
      students: pendingStudents
    });
  } catch (error) {
    console.error('[Admin Pending Error]:', error);
    return res.status(500).json({ error: error.message || 'Error fetching pending students' });
  }
};

// PATCH /api/admin/approve/:id
exports.approveStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Send email notification to guardianEmail
    const transporter = createTransporter();
    let emailSent = false;

    if (transporter && student.guardianEmail) {
      try {
        await transporter.sendMail({
          from: `"Madaris Management System" <${process.env.EMAIL_USER}>`,
          to: student.guardianEmail,
          subject: 'MMS Application Approved! Welcome to Madaris System',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #047857;">Assalam-o-Alaikum / Greetings!</h2>
              <p>We are pleased to inform you that the registration for <strong>${student.firstName} ${student.lastName}</strong> (CNIC/B-Form: <code>${student.cnic}</code>) has been <span style="color: #047857; font-weight: bold;">APPROVED</span> by the Madaris Administration.</p>
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; borderRadius: 8px; margin: 15px 0;">
                <p style="margin: 0; font-weight: bold;">Student Details:</p>
                <ul style="margin-top: 5px;">
                  <li><strong>Program:</strong> ${student.enrollmentProgram}</li>
                  <li><strong>City:</strong> ${student.city}</li>
                  <li><strong>Father Name:</strong> ${student.fatherName}</li>
                </ul>
              </div>

              <p>The student can now log in to the Madaris Mobile Application using their registered <strong>CNIC</strong> and <strong>4-digit PIN</strong>.</p>
              
              <p style="margin-top: 20px; color: #64748b; font-size: 13px;">Best regards,<br/>Madaris Management System (MMS) Administration</p>
            </div>
          `
        });
        emailSent = true;
        console.log(`[Nodemailer] Approval email sent to ${student.guardianEmail}`);
      } catch (mailErr) {
        console.warn(`[Nodemailer Warning] Failed to send email to ${student.guardianEmail}:`, mailErr.message);
      }
    } else {
      console.log(`[Nodemailer Mock] Student ${student.firstName} approved. (Set EMAIL_USER & EMAIL_PASS in .env for live dispatch). Target: ${student.guardianEmail}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Student approved successfully!',
      emailSent,
      student
    });
  } catch (error) {
    console.error('[Admin Approve Error]:', error);
    return res.status(500).json({ error: error.message || 'Error approving student' });
  }
};
