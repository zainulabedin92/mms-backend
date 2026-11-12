const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const classRoutes = require('./routes/classRoutes');
const studentRoutes = require('./routes/studentRoutes');
const parentRoutes = require('./routes/parentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');

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
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/teachers', teacherRoutes);

// Healthcheck & Root Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'Madaris Management System (MMS) Backend API',
    version: '1.1.0',
    adminPortal: '/admin',
    endpoints: {
      classes: {
        listActive: 'GET /api/classes',
        create: 'POST /api/classes',
        getById: 'GET /api/classes/:id',
        update: 'PUT /api/classes/:id'
      },
      students: {
        registerAdminFlow: 'POST /api/students (Admin/SuperAdmin Bearer JWT Required)',
        list: 'GET /api/students',
        getById: 'GET /api/students/:id',
        update: 'PUT / PATCH /api/students/:id (SuperAdmin, Admin or Teacher Bearer JWT Required)',
        delete: 'DELETE /api/students/:id (SuperAdmin Bearer JWT Required)'
      },
      parents: {
        login: 'POST /api/parents/login',
        create: 'POST /api/parents (Admin/SuperAdmin Bearer JWT Required)',
        myChildren: 'GET /api/parents/my-children (Bearer JWT Required)',
        profile: 'GET /api/parents/profile (Bearer JWT Required)',
        list: 'GET /api/parents'
      },
      teachers: {
        login: 'POST /api/teachers/login',
        list: 'GET /api/teachers',
        create: 'POST /api/teachers (Admin/SuperAdmin Bearer JWT Required)',
        getById: 'GET /api/teachers/:id'
      },
      auth: {
        loginPin: 'POST /api/auth/login-pin',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me (Bearer JWT Required)',
        registerAdminOnly: 'POST /api/auth/register (Admin/SuperAdmin Bearer JWT Required)',
        listUsers: 'GET /api/auth/users (Admin/SuperAdmin Bearer JWT Required)',
        createUser: 'POST /api/auth/users (Admin/SuperAdmin Bearer JWT Required)'
      }
    }
  });
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled App Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;

