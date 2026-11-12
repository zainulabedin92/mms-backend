const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { PassThrough } = require('node:stream');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../src/app');
const Student = require('../src/models/Student');
const Class = require('../src/models/Class');
const Parent = require('../src/models/Parent');
const Teacher = require('../src/models/Teacher');
const User = require('../src/models/User');
const bcryptjs = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmmskey123';

const validStudentId = new mongoose.Types.ObjectId().toString();
const validClassId = new mongoose.Types.ObjectId().toString();
const validParentId = new mongoose.Types.ObjectId().toString();
const otherClassId = new mongoose.Types.ObjectId().toString();
const otherParentId = new mongoose.Types.ObjectId().toString();

const superAdminToken = jwt.sign(
  { id: new mongoose.Types.ObjectId().toString(), role: 'superadmin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);
const adminToken = jwt.sign(
  { id: new mongoose.Types.ObjectId().toString(), role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);
const parentToken = jwt.sign({ id: validParentId, role: 'parent' }, JWT_SECRET, {
  expiresIn: '1h'
});
const teacherToken = jwt.sign({ id: new mongoose.Types.ObjectId().toString(), role: 'teacher' }, JWT_SECRET, {
  expiresIn: '1h'
});

const originals = {
  studentFind: Student.find,
  studentFindById: Student.findById,
  studentFindOne: Student.findOne,
  studentCreate: Student.create,
  studentFindByIdAndUpdate: Student.findByIdAndUpdate,
  studentFindByIdAndDelete: Student.findByIdAndDelete,
  classFindById: Class.findById,
  parentFindById: Parent.findById,
  parentFindOne: Parent.findOne,
  parentCreate: Parent.create,
  teacherFindOne: Teacher.findOne,
  teacherCreate: Teacher.create,
  userFindOne: User.findOne,
  userFindById: User.findById,
  userCreate: User.create,
  userCountDocuments: User.countDocuments,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  userFindByIdAndDelete: User.findByIdAndDelete
};

const makeExistingStudent = (overrides = {}) => ({
  _id: validStudentId,
  rollNo: 'MMS-2026-100001',
  fullName: 'Muhammad Ali',
  firstName: 'Muhammad',
  lastName: 'Ali',
  fatherName: 'Ahmad Khan',
  gender: 'Male',
  classId: validClassId,
  parentId: validParentId,
  status: 'Enrolled',
  ...overrides
});

const stubUpdateChain = (resultDoc) => {
  let capturedUpdate = null;
  let capturedOptions = null;

  Student.findByIdAndUpdate = (id, update, options) => {
    capturedUpdate = update;
    capturedOptions = options;
    return {
      populate: async () => resultDoc
    };
  };

  return {
    getCaptured: () => ({ capturedUpdate, capturedOptions })
  };
};

describe('Student Update & Delete APIs', () => {
  afterEach(() => {
    Student.find = originals.studentFind;
    Student.findById = originals.studentFindById;
    Student.findOne = originals.studentFindOne;
    Student.create = originals.studentCreate;
    Student.findByIdAndUpdate = originals.studentFindByIdAndUpdate;
    Student.findByIdAndDelete = originals.studentFindByIdAndDelete;
    Class.findById = originals.classFindById;
    Parent.findById = originals.parentFindById;
    Parent.findOne = originals.parentFindOne;
    Parent.create = originals.parentCreate;
    Teacher.findOne = originals.teacherFindOne;
    Teacher.create = originals.teacherCreate;
    User.findOne = originals.userFindOne;
    User.findById = originals.userFindById;
    User.create = originals.userCreate;
    User.countDocuments = originals.userCountDocuments;
    User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
    User.findByIdAndDelete = originals.userFindByIdAndDelete;
  });

  const request = (method, path, { token, body, headers = {} } = {}) => {
    return new Promise((resolve, reject) => {
      const inSocket = new PassThrough();
      inSocket.remoteAddress = '127.0.0.1';
      const outSocket = new PassThrough();

      const reqHeaders = { host: '127.0.0.1' };
      for (const [k, v] of Object.entries(headers)) {
        reqHeaders[k.toLowerCase()] = v;
      }
      if (token) reqHeaders.authorization = `Bearer ${token}`;

      const req = new http.IncomingMessage(inSocket);
      req.method = method;
      req.url = path;
      req.headers = reqHeaders;

      if (body !== undefined) {
        const payload = JSON.stringify(body);
        reqHeaders['content-type'] = 'application/json';
        reqHeaders['content-length'] = String(Buffer.byteLength(payload));
        req.push(Buffer.from(payload));
      }
      req.push(null);

      const res = new http.ServerResponse(req);
      const chunks = [];
      outSocket.on('data', (chunk) => chunks.push(chunk));
      res.assignSocket(outSocket);

      res.on('finish', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const sepIndex = raw.indexOf('\r\n\r\n');
          const rawBody = sepIndex >= 0 ? raw.slice(sepIndex + 4) : raw;
          resolve({
            status: res.statusCode,
            data: rawBody ? JSON.parse(rawBody) : null
          });
        } catch (err) {
          reject(err);
        }
      });

      app(req, res);
    });
  };

  it('documents update and delete student endpoints on GET /', async () => {
    const { status, data } = await request('GET', '/');
    assert.equal(status, 200);
    assert.match(data.endpoints.students.update, /\/api\/students\/:id/);
    assert.match(data.endpoints.students.delete, /DELETE \/api\/students\/:id/);
  });

  it('authenticates superadmin against User table on POST /api/auth/login-pin and rejects wrong PIN', async () => {
    const superAdminId = new mongoose.Types.ObjectId();
    const pinHash = await bcryptjs.hash('1234', 4);

    User.findByIdAndUpdate = async () => null;
    User.findOne = () => ({
      select: async () => ({
        _id: superAdminId,
        username: 'superadmin',
        name: 'Hazrat Maulana Muhtamim Sahib',
        cnic: '00000-0000000-0',
        phone: '03000000000',
        role: 'superadmin',
        status: 'Active',
        pinHash
      })
    });

    // Wrong PIN against matched user in `users` table -> 401
    const wrongPinRes = await request('POST', '/api/auth/login-pin', {
      body: { cnic: 'superadmin', pin: '9999' }
    });
    assert.equal(wrongPinRes.status, 401);

    // Correct PIN against matched user in `users` table -> 200 + JWT
    const { status, data } = await request('POST', '/api/auth/login-pin', {
      body: { cnic: 'superadmin', pin: '1234' }
    });
    assert.equal(status, 200);
    assert.equal(data.role, 'superadmin');
    assert.equal(data.user.username, 'superadmin');
    assert.equal(data.user.pinHash, undefined);
    assert.equal(data.student, undefined);
    assert.ok(data.token);

    // Confirm issued token authorizes DELETE route (reaches ID validation)
    const delRes = await request('DELETE', '/api/students/bad-id', { token: data.token });
    assert.equal(delRes.status, 400);
  });

  it('auto-seeds missing superadmin on login-pin even when other users exist and never returns a student payload', async () => {
    const superAdminId = new mongoose.Types.ObjectId();
    const pinHash = await bcryptjs.hash('1234', 4);
    let seeded = false;
    const origEnsure = User.ensureDefaultSuperAdmin;

    try {
      User.findByIdAndUpdate = async () => null;
      User.ensureDefaultSuperAdmin = async () => {
        seeded = true;
      };
      User.findOne = (query) => {
        if (query && query.role === 'superadmin') {
          return Promise.resolve(seeded ? { _id: superAdminId, role: 'superadmin' } : null);
        }
        return {
          select: async () =>
            seeded
              ? {
                  _id: superAdminId,
                  username: 'superadmin',
                  name: 'Hazrat Maulana Muhtamim Sahib',
                  cnic: '00000-0000000-0',
                  phone: '03000000000',
                  role: 'superadmin',
                  status: 'Active',
                  pinHash
                }
              : null
        };
      };

      const { status, data } = await request('POST', '/api/auth/login-pin', {
        body: { cnic: '00000-0000000-0', pin: '1234' }
      });
      assert.equal(status, 200);
      assert.equal(seeded, true);
      assert.equal(data.role, 'superadmin');
      assert.equal(data.user.role, 'superadmin');
      assert.equal(data.student, undefined);
      assert.ok(data.token);
    } finally {
      User.ensureDefaultSuperAdmin = origEnsure;
    }
  });

  describe('Auth guards on PUT, PATCH, DELETE /api/students/:id', () => {
    it('rejects unauthenticated requests with 401', async () => {
      for (const method of ['PUT', 'PATCH', 'DELETE']) {
        const res = await request(method, `/api/students/${validStudentId}`);
        assert.equal(res.status, 401);
        assert.equal(res.data.success, false);
      }
    });

    it('rejects non-staff JWTs (parent) with 403', async () => {
      for (const method of ['PUT', 'PATCH', 'DELETE']) {
        const res = await request(method, `/api/students/${validStudentId}`, {
          token: parentToken,
          body: method === 'DELETE' ? undefined : { fullName: 'Test' }
        });
        assert.equal(res.status, 403);
        assert.equal(res.data.success, false);
      }
    });

    it('allows teacher JWT to edit (PUT/PATCH) but forbids DELETE', async () => {
      Student.findById = async () => makeExistingStudent();
      const updatedDoc = makeExistingStudent({ city: 'Lahore' });
      stubUpdateChain(updatedDoc);

      for (const method of ['PUT', 'PATCH']) {
        const res = await request(method, `/api/students/${validStudentId}`, {
          token: teacherToken,
          body: { city: 'Lahore' }
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.success, true);
      }

      let deleteCalled = false;
      Student.findByIdAndDelete = async () => {
        deleteCalled = true;
        return makeExistingStudent();
      };
      const delRes = await request('DELETE', `/api/students/${validStudentId}`, { token: teacherToken });
      assert.equal(delRes.status, 403);
      assert.equal(deleteCalled, false);
    });
  });

  describe('PUT & PATCH /api/students/:id', () => {
    it('returns 400 for invalid student ID', async () => {
      const res = await request('PUT', '/api/students/not-an-object-id', {
        token: superAdminToken,
        body: { fullName: 'Ali' }
      });
      assert.equal(res.status, 400);
      assert.equal(res.data.message, 'Invalid Student ID format');
    });

    it('returns 404 when student does not exist', async () => {
      Student.findById = async () => null;
      const res = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { fullName: 'Ali' }
      });
      assert.equal(res.status, 404);
      assert.equal(res.data.message, 'Student record not found');
    });

    it('returns 400 when body is missing or contains no editable fields', async () => {
      Student.findById = async () => makeExistingStudent();

      const noBody = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken
      });
      assert.equal(noBody.status, 400);
      assert.equal(noBody.data.message, 'No valid fields provided to update');

      const unknownOnly = await request('PATCH', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { role: 'superadmin', pin: '9999' }
      });
      assert.equal(unknownOnly.status, 400);
      assert.equal(unknownOnly.data.message, 'No valid fields provided to update');
    });

    it('rejects clearing required fields', async () => {
      Student.findById = async () => makeExistingStudent();

      const cases = [
        [{ fatherName: '' }, 'Father name is required'],
        [{ classId: null }, 'Class assignment cannot be removed'],
        [{ parentId: '' }, 'Parent / Guardian reference (parentId) cannot be removed'],
        [{ status: '' }, 'Student status cannot be empty'],
        [{ gender: '' }, 'Gender cannot be empty'],
        [{ fullName: '   ' }, 'Student name is required']
      ];

      for (const [body, expectedMsg] of cases) {
        const res = await request('PUT', `/api/students/${validStudentId}`, {
          token: superAdminToken,
          body
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.message, expectedMsg);
      }
    });

    it('rejects object injection / invalid non-string values and invalid dates', async () => {
      Student.findById = async () => makeExistingStudent();

      const objRes = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { fullName: { $ne: '' } }
      });
      assert.equal(objRes.status, 400);
      assert.equal(objRes.data.message, 'Invalid value for fullName');

      const dobRes = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { dob: 'not-a-valid-date' }
      });
      assert.equal(dobRes.status, 400);
      assert.equal(dobRes.data.message, 'Invalid dob date format');
    });

    it('validates classId, parentId, and duplicate rollNo', async () => {
      Student.findById = async () => makeExistingStudent();

      const badClass = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { classId: 'bad-id' }
      });
      assert.equal(badClass.status, 400);

      Class.findById = async () => null;
      const missingClass = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { classId: otherClassId }
      });
      assert.equal(missingClass.status, 404);

      const badParent = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { parentId: 'bad-id' }
      });
      assert.equal(badParent.status, 400);

      Parent.findById = async () => null;
      const missingParent = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { parentId: otherParentId }
      });
      assert.equal(missingParent.status, 404);

      Student.findOne = async () => ({ _id: new mongoose.Types.ObjectId() });
      const dupRoll = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { rollNo: 'MMS-2026-999999' }
      });
      assert.equal(dupRoll.status, 400);
      assert.match(dupRoll.data.message, /already exists/);
    });

    it('updates allowed fields, normalizes values, clears optional fields, and keeps firstName/lastName synced', async () => {
      Student.findById = async () => makeExistingStudent();
      Student.findOne = async () => null;
      Class.findById = async () => ({ _id: otherClassId, name: 'Hifz B' });
      Parent.findById = async () => ({ _id: otherParentId, name: 'Parent Two' });

      const updatedDoc = makeExistingStudent({
        fullName: 'Khan',
        lastName: 'Khan',
        classId: { _id: otherClassId, name: 'Hifz B' },
        parentId: { _id: otherParentId, name: 'Parent Two' },
        guardianEmail: 'guardian@example.com',
        pictureUrl: null
      });
      delete updatedDoc.firstName;

      const spy = stubUpdateChain(updatedDoc);

      const res = await request('PATCH', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: {
          firstName: '',
          lastName: ' Khan ',
          classId: otherClassId,
          parentId: otherParentId,
          guardianEmail: ' GUARDIAN@Example.COM ',
          address: '',
          dob: '2014-05-10',
          pictureUrl: null,
          rollNo: '',
          ignoredField: 'nope'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.message, 'Student updated successfully');
      assert.deepEqual(res.data.student, updatedDoc);

      const { capturedUpdate, capturedOptions } = spy.getCaptured();
      assert.deepEqual(capturedOptions, { new: true, runValidators: true });
      assert.equal(capturedUpdate.$set.fullName, 'Khan');
      assert.equal(capturedUpdate.$set.lastName, 'Khan');
      assert.equal(capturedUpdate.$set.classId, otherClassId);
      assert.equal(capturedUpdate.$set.parentId, otherParentId);
      assert.equal(capturedUpdate.$set.guardianEmail, 'guardian@example.com');
      assert.equal(capturedUpdate.$set.pictureUrl, null);
      assert.ok(capturedUpdate.$set.dob instanceof Date);
      assert.equal(capturedUpdate.$set.ignoredField, undefined);
      assert.equal(capturedUpdate.$unset.firstName, '');
      assert.equal(capturedUpdate.$unset.address, '');
      assert.equal(capturedUpdate.$unset.rollNo, undefined);
    });

    it('returns 400 on Mongoose ValidationError and duplicate key error', async () => {
      Student.findById = async () => makeExistingStudent();

      Student.findByIdAndUpdate = () => ({
        populate: async () => {
          const err = new Error('Invalid status');
          err.name = 'ValidationError';
          throw err;
        }
      });

      const valRes = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { status: 'InvalidStatus' }
      });
      assert.equal(valRes.status, 400);

      Student.findByIdAndUpdate = () => ({
        populate: async () => {
          const err = new Error('dup key');
          err.code = 11000;
          err.keyPattern = { rollNo: 1 };
          throw err;
        }
      });

      const dupRes = await request('PUT', `/api/students/${validStudentId}`, {
        token: superAdminToken,
        body: { fullName: 'Updated Name' }
      });
      assert.equal(dupRes.status, 400);
      assert.match(dupRes.data.message, /rollNo/);
    });
  });

  describe('POST /api/teachers/login', () => {
    const Teacher = require('../src/models/Teacher');
    const bcrypt = require('bcryptjs');
    const origTeacherFindOne = Teacher.findOne;
    const origUserFindOne = User.findOne;
    const origUserUpdate = User.findByIdAndUpdate;
    afterEach(() => {
      Teacher.findOne = origTeacherFindOne;
      User.findOne = origUserFindOne;
      User.findByIdAndUpdate = origUserUpdate;
    });

    it('authenticates teachers strictly from central users table and issues a teacher JWT that can edit but not delete students', async () => {
      const pinHash = await bcrypt.hash('5678', 4);
      const userId = new mongoose.Types.ObjectId();
      const teacherId = new mongoose.Types.ObjectId();

      User.findByIdAndUpdate = async () => null;
      User.findOne = () => ({
        select: async () => ({
          _id: userId,
          name: 'Qari Ahmad',
          phone: '03001112233',
          role: 'teacher',
          status: 'Active',
          pinHash
        })
      });
      Teacher.findOne = async () => ({
        _id: teacherId,
        userId,
        name: 'Qari Ahmad',
        phone: '03001112233',
        status: 'Active'
      });

      const bad = await request('POST', '/api/teachers/login', {
        body: { identifier: '03001112233', password: 'wrong' }
      });
      assert.equal(bad.status, 401);

      const ok = await request('POST', '/api/teachers/login', {
        body: { identifier: '03001112233', password: '5678' }
      });
      assert.equal(ok.status, 200);
      assert.equal(ok.data.role, 'teacher');
      assert.equal(jwt.verify(ok.data.token, JWT_SECRET).role, 'teacher');

      const del = await request('DELETE', `/api/students/${validStudentId}`, { token: ok.data.token });
      assert.equal(del.status, 403);
    });

    it('rejects teacher login if user record is absent from users table or has no password set', async () => {
      User.findOne = () => ({ select: async () => null });
      const missingRes = await request('POST', '/api/teachers/login', {
        body: { identifier: '03001112233', password: '5678' }
      });
      assert.equal(missingRes.status, 401);

      User.findOne = () => ({
        select: async () => ({ _id: 'u1', phone: '0300', role: 'teacher', status: 'Active' })
      });
      const res = await request('POST', '/api/teachers/login', {
        body: { identifier: '0300', password: '1234' }
      });
      assert.equal(res.status, 403);
    });
  });

  describe('DELETE /api/students/:id', () => {
    it('returns 400 for invalid student ID', async () => {
      const res = await request('DELETE', '/api/students/invalid-id', {
        token: superAdminToken
      });
      assert.equal(res.status, 400);
      assert.equal(res.data.message, 'Invalid Student ID format');
    });

    it('returns 404 when student record is not found', async () => {
      Student.findByIdAndDelete = async () => null;
      const res = await request('DELETE', `/api/students/${validStudentId}`, {
        token: superAdminToken
      });
      assert.equal(res.status, 404);
      assert.equal(res.data.message, 'Student record not found');
    });

    it('deletes student and returns summary payload', async () => {
      Student.findByIdAndDelete = async () =>
        makeExistingStudent({ fullName: 'Zaid Bilal', rollNo: 'MMS-2026-222222' });

      const res = await request('DELETE', `/api/students/${validStudentId}`, {
        token: superAdminToken
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.message, 'Student deleted successfully');
      assert.deepEqual(res.data.student, {
        _id: validStudentId,
        fullName: 'Zaid Bilal',
        rollNo: 'MMS-2026-222222'
      });
    });

    it('falls back to firstName + lastName when legacy student lacks fullName', async () => {
      Student.findByIdAndDelete = async () => ({
        _id: validStudentId,
        firstName: 'Usman',
        lastName: 'Tariq',
        rollNo: 'MMS-2026-333333'
      });

      const res = await request('DELETE', `/api/students/${validStudentId}`, {
        token: superAdminToken
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.student.fullName, 'Usman Tariq');
    });
  });

  describe('Central `users` table & Admin-only user registration', () => {
    it('supports all user roles (superadmin, admin, student, teacher, parent) in User schema without requiring username for non-admins', async () => {
      for (const role of ['superadmin', 'admin', 'student', 'teacher', 'parent']) {
        const doc = new User({
          name: `Test ${role}`,
          role,
          phone: '03001234567',
          cnic: '42101-1234567-1',
          address: 'Sector 5-A',
          city: 'Karachi'
        });
        await doc.validate();
        assert.equal(doc.role, role);
      }

      const invalidRoleDoc = new User({ name: 'Invalid', role: 'guest' });
      await assert.rejects(() => invalidRoleDoc.validate(), (err) => Boolean(err?.errors?.role));
    });

    it('blocks self-registration and unauthenticated/non-admin user creation with 401 and 403', async () => {
      const registrationEndpoints = [
        ['POST', '/api/auth/register'],
        ['POST', '/api/auth/users'],
        ['POST', '/api/students'],
        ['POST', '/api/teachers'],
        ['POST', '/api/parents']
      ];

      for (const [method, path] of registrationEndpoints) {
        const unauthRes = await request(method, path, { body: { name: 'Self Register' } });
        assert.equal(unauthRes.status, 401, `Expected 401 on unauthenticated ${method} ${path}`);

        const studentToken = jwt.sign(
          { id: validStudentId, role: 'student' },
          JWT_SECRET,
          { expiresIn: '1h' }
        );
        for (const nonAdminToken of [studentToken, teacherToken, parentToken]) {
          const forbiddenRes = await request(method, path, {
            token: nonAdminToken,
            body: { name: 'Self Register' }
          });
          assert.equal(forbiddenRes.status, 403, `Expected 403 on ${method} ${path}`);
        }
      }

      // Admin cannot elevate/create superadmin or admin via POST /api/auth/users
      const adminCreateAdminRes = await request('POST', '/api/auth/users', {
        token: adminToken,
        body: { username: 'otheradmin', name: 'Other Admin', pin: '1234', role: 'superadmin' }
      });
      assert.equal(adminCreateAdminRes.status, 403);
    });

    it('allows authenticated SuperAdmin to register a student via POST /api/auth/register storing basic info in `users`', async () => {
      const enrolledDoc = new Student({
        fullName: 'Bilal Ahmed',
        fatherName: 'Tariq Mahmood',
        status: 'Enrolled'
      });
      await assert.rejects(
        () => enrolledDoc.validate(),
        (err) => Boolean(err?.errors?.classId && err?.errors?.parentId)
      );

      let createdUserDoc = null;
      let createdStudentDoc = null;

      User.findOne = async () => null;
      User.create = async (doc) => {
        createdUserDoc = new User(doc);
        await createdUserDoc.validate();
        return createdUserDoc;
      };
      Student.findOne = async () => null;
      Student.create = async (doc) => {
        createdStudentDoc = new Student(doc);
        await createdStudentDoc.validate();
        return createdStudentDoc;
      };

      const res = await request('POST', '/api/auth/register', {
        token: superAdminToken,
        body: {
          firstName: 'Bilal',
          lastName: 'Ahmed',
          fatherName: 'Tariq Mahmood',
          cnic: '42101-1234567-1',
          guardianMobile: '03001234567',
          guardianEmail: 'tariq@example.com',
          pin: '1234',
          confirmPin: '1234',
          address: 'Sector 5-A, Karachi',
          city: 'Karachi',
          enrollmentProgram: 'Hifz-ul-Quran'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(createdUserDoc.role, 'student');
      assert.equal(createdUserDoc.name, 'Bilal Ahmed');
      assert.equal(createdUserDoc.cnic, '42101-1234567-1');
      assert.equal(String(createdStudentDoc.userId), String(createdUserDoc._id));
      assert.equal(res.data.student.status, 'approved');
    });

    it('allows authenticated SuperAdmin/Admin to add Student (with auto-parent in `users`), Teacher, and Parent', async () => {
      const createdUsers = [];
      User.findOne = async () => null;
      User.create = async (doc) => {
        const u = new User(doc);
        await u.validate();
        createdUsers.push(u);
        return u;
      };

      // 1. Add Student via POST /api/students (auto-creates parent User + Parent + Student User + Student)
      Class.findById = async () => ({ _id: validClassId, name: 'Hifz A' });
      Parent.findOne = async () => null;
      let createdParentDoc = null;
      Parent.create = async (doc) => {
        createdParentDoc = new Parent(doc);
        await createdParentDoc.validate();
        return createdParentDoc;
      };
      Student.findOne = async () => null;
      let createdStudentDoc = null;
      Student.create = async (doc) => {
        createdStudentDoc = new Student(doc);
        await createdStudentDoc.validate();
        createdStudentDoc.populate = async () => createdStudentDoc;
        return createdStudentDoc;
      };

      const stuRes = await request('POST', '/api/students', {
        token: superAdminToken,
        body: {
          fullName: 'Zain Ali',
          fatherName: 'Muhammad Ali',
          classId: validClassId,
          parentName: 'Muhammad Ali',
          parentPhone: '03005556677',
          parentCnic: '42101-5556677-1',
          pin: '4321'
        }
      });
      assert.equal(stuRes.status, 201);
      assert.equal(stuRes.data.success, true);
      assert.equal(stuRes.data.isNewParentCreated, true);
      assert.equal(stuRes.data.studentPin, '4321');
      assert.equal(createdUsers.length, 2);
      assert.equal(createdUsers[0].role, 'parent');
      assert.equal(createdUsers[1].role, 'student');
      assert.ok(createdUsers[1].pinHash);
      assert.equal(await bcryptjs.compare('4321', createdUsers[1].pinHash), true);
      assert.equal(String(createdParentDoc.userId), String(createdUsers[0]._id));
      assert.equal(String(createdStudentDoc.userId), String(createdUsers[1]._id));

      // 2. Add Teacher via POST /api/teachers
      Teacher.findOne = async () => null;
      let createdTeacherDoc = null;
      Teacher.create = async (doc) => {
        createdTeacherDoc = new Teacher(doc);
        await createdTeacherDoc.validate();
        return createdTeacherDoc;
      };

      const teachRes = await request('POST', '/api/teachers', {
        token: adminToken,
        body: {
          name: 'Qari Ibrahim',
          phone: '03112223344',
          cnic: '42101-2223344-5',
          email: 'ibrahim@mms.edu',
          role: 'Hifz Teacher',
          pin: '7788'
        }
      });
      assert.equal(teachRes.status, 201);
      assert.equal(teachRes.data.success, true);
      assert.equal(teachRes.data.teacherPin, '7788');
      assert.equal(createdUsers[2].role, 'teacher');
      assert.equal(createdUsers[2].name, 'Qari Ibrahim');
      assert.equal(await bcryptjs.compare('7788', createdUsers[2].pinHash), true);
      assert.equal(String(createdTeacherDoc.userId), String(createdUsers[2]._id));

      // 3. Add Parent via POST /api/parents
      Parent.findOne = async () => null;
      const parRes = await request('POST', '/api/parents', {
        token: superAdminToken,
        body: {
          name: 'Haji Yousuf',
          phone: '03219998877',
          cnic: '42101-9998877-3',
          address: 'Nazimabad, Karachi'
        }
      });
      assert.equal(parRes.status, 201);
      assert.equal(parRes.data.success, true);
      assert.equal(createdUsers[3].role, 'parent');
      assert.equal(createdUsers[3].name, 'Haji Yousuf');
      assert.ok(parRes.data.credentials.defaultPassword);
    });

    it('authenticates teacher and parent from central `users` table via POST /api/auth/login-pin', async () => {
      const secretHash = await bcryptjs.hash('5678', 4);
      const teacherUserId = new mongoose.Types.ObjectId();
      const teacherProfileId = new mongoose.Types.ObjectId();

      User.findByIdAndUpdate = async () => null;
      User.findOne = () => ({
        select: async () => ({
          _id: teacherUserId,
          name: 'Qari Ibrahim',
          phone: '03112223344',
          role: 'teacher',
          status: 'Active',
          pinHash: secretHash
        })
      });
      Teacher.findOne = async () => ({
        _id: teacherProfileId,
        userId: teacherUserId,
        name: 'Qari Ibrahim',
        phone: '03112223344',
        role: 'Hifz Teacher'
      });

      const loginRes = await request('POST', '/api/auth/login-pin', {
        body: { phone: '03112223344', pin: '5678' }
      });
      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.data.role, 'teacher');
      assert.equal(loginRes.data.teacher._id, teacherProfileId.toString());
      const decoded = jwt.verify(loginRes.data.token, JWT_SECRET);
      assert.equal(decoded.userId, teacherUserId.toString());
      assert.equal(decoded.teacherId, teacherProfileId.toString());
      assert.equal(decoded.role, 'teacher');
    });
  });

  describe('Student PIN login & data isolation', () => {
    it('issues a student JWT on PIN login and restricts endpoints to own student data only', async () => {
      const ownPinHash = await bcryptjs.hash('4321', 4);
      const otherStudentId = new mongoose.Types.ObjectId().toString();
      const studentUserId = new mongoose.Types.ObjectId();
      const ownStudentDoc = {
        ...makeExistingStudent({
          userId: studentUserId,
          firstName: 'Hamza',
          lastName: 'Raza',
          fullName: 'Hamza Raza',
          cnic: '42101-9999999-1',
          guardianMobile: '03009998877',
          status: 'approved',
          role: 'student',
          pin: ownPinHash
        }),
        populate: async () => ownStudentDoc
      };

      // Without a record in `users`, student login is rejected (404)
      User.findOne = () => ({
        select: async () => null
      });
      Student.findOne = async () => ownStudentDoc;

      const missingUserLogin = await request('POST', '/api/auth/login-pin', {
        body: { cnic: '42101-9999999-1', pin: '4321' }
      });
      assert.equal(missingUserLogin.status, 404);

      // When user exists in central `users` table, student authenticates
      User.findByIdAndUpdate = async () => null;
      User.findOne = () => ({
        select: async () => ({
          _id: studentUserId,
          name: 'Hamza Raza',
          cnic: '42101-9999999-1',
          phone: '03009998877',
          role: 'student',
          status: 'Active',
          pinHash: ownPinHash
        })
      });

      const loginRes = await request('POST', '/api/auth/login-pin', {
        body: { cnic: '42101-9999999-1', pin: '4321' }
      });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.data.success, true);
      assert.equal(loginRes.data.role, 'student');
      assert.ok(loginRes.data.token);
      assert.equal(loginRes.data.student.pin, undefined);
      assert.equal(loginRes.data.student.fullName, 'Hamza Raza');

      const studentToken = loginRes.data.token;

      // GET /api/auth/me returns only own student profile
      Student.findById = (id) => ({
        populate: async () => (String(id) === validStudentId ? ownStudentDoc : null)
      });
      const meRes = await request('GET', '/api/auth/me', { token: studentToken });
      assert.equal(meRes.status, 200);
      assert.equal(meRes.data.role, 'student');
      assert.equal(meRes.data.student._id, validStudentId);
      assert.equal(meRes.data.student.pin, undefined);

      // GET /api/admin/students forces query._id = req.user.id for students
      let capturedAdminQuery = null;
      Student.find = (query) => {
        capturedAdminQuery = query;
        return {
          populate: () => ({
            sort: async () => [ownStudentDoc]
          })
        };
      };
      const adminListRes = await request('GET', '/api/admin/students', { token: studentToken });
      assert.equal(adminListRes.status, 200);
      assert.equal(capturedAdminQuery._id, validStudentId);
      assert.equal(adminListRes.data.students.length, 1);

      // GET /api/students forces query._id = req.user.id for students
      let capturedStudentQuery = null;
      Student.find = (query) => {
        capturedStudentQuery = query;
        return {
          populate: () => ({
            sort: async () => [ownStudentDoc]
          })
        };
      };
      const studentListRes = await request('GET', '/api/students', { token: studentToken });
      assert.equal(studentListRes.status, 200);
      assert.equal(capturedStudentQuery._id, validStudentId);
      assert.equal(studentListRes.data.students.length, 1);

      // GET /api/students/:otherId returns 403 for another student's ID
      const otherStudentRes = await request('GET', `/api/students/${otherStudentId}`, {
        token: studentToken
      });
      assert.equal(otherStudentRes.status, 403);

      // GET /api/admin/pending returns 403 for students
      const pendingRes = await request('GET', '/api/admin/pending', { token: studentToken });
      assert.equal(pendingRes.status, 403);
    });
  });
});
