const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded student images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve admin web portal statically
app.use('/admin', express.static(path.join(__dirname, '../public')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Healthcheck & Root Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'Madaris Management System (MMS) Backend API',
    version: '1.0.0',
    adminPortal: '/admin',
    endpoints: {
      register: 'POST /api/auth/register',
      loginPin: 'POST /api/auth/login-pin',
      pendingStudents: 'GET /api/admin/pending',
      approveStudent: 'PATCH /api/admin/approve/:id'
    }
  });
});

module.exports = app;
