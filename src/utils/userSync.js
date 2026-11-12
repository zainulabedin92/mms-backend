const jwt = require('jsonwebtoken');
const User = require('../models/User');

const cleanStr = (val) => {
  if (val === undefined || val === null) return undefined;
  const trimmed = String(val).trim();
  return trimmed.length ? trimmed : undefined;
};

/**
 * Checks whether another User already owns the provided username, cnic, or phone.
 * Returns { field, user } on conflict, or null when clear.
 */
async function findUserConflict({ username, cnic, phone }, excludeUserId = null) {
  const orConditions = [];
  const cleanUsername = cleanStr(username)?.toLowerCase();
  const cleanCnic = cleanStr(cnic);
  const cleanPhone = cleanStr(phone);

  if (cleanUsername) orConditions.push({ username: cleanUsername });
  if (cleanCnic) orConditions.push({ cnic: cleanCnic });
  if (cleanPhone) orConditions.push({ phone: cleanPhone });

  if (!orConditions.length) return null;

  const query = { $or: orConditions };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const existing = await User.findOne(query);
  if (!existing) return null;

  let field = 'identifier';
  if (cleanUsername && existing.username === cleanUsername) field = 'username';
  else if (cleanCnic && existing.cnic === cleanCnic) field = 'CNIC';
  else if (cleanPhone && existing.phone === cleanPhone) field = 'phone';

  return { field, user: existing };
}

/**
 * Create a central User record in `users` collection.
 * Throws a 400-tagged error if username/CNIC/phone conflicts with an existing user.
 */
async function createUserRecord({
  username,
  name,
  cnic,
  phone,
  email,
  gender,
  dob,
  address,
  city,
  pictureUrl,
  pinHash,
  role,
  status = 'Active',
  createdBy = null
}) {
  const conflict = await findUserConflict({ username, cnic, phone });
  if (conflict) {
    const err = new Error(`A user with this ${conflict.field} already exists`);
    err.status = 400;
    throw err;
  }

  const doc = {
    username: cleanStr(username)?.toLowerCase(),
    name: cleanStr(name),
    cnic: cleanStr(cnic),
    phone: cleanStr(phone),
    email: cleanStr(email)?.toLowerCase(),
    ...(gender ? { gender } : {}),
    ...(dob ? { dob } : {}),
    ...(cleanStr(address) ? { address: cleanStr(address) } : {}),
    ...(cleanStr(city) ? { city: cleanStr(city) } : {}),
    ...(pictureUrl !== undefined ? { pictureUrl } : {}),
    ...(pinHash ? { pinHash } : {}),
    role,
    status,
    createdBy: createdBy || null
  };

  return User.create(doc);
}

/**
 * Roll back a newly created User document if linked profile creation fails.
 */
async function rollbackUser(user) {
  if (user && user._id) {
    await User.findByIdAndDelete(user._id).catch(() => null);
  }
}

/**
 * Build JWT payload linking both central `userId` and role-specific profile `id`.
 */
function buildUserJwtPayload(user, linkedProfile = null) {
  const role = user.role || 'student';
  const base = {
    userId: user._id,
    role
  };

  if (role === 'student') {
    return {
      ...base,
      id: linkedProfile?._id || user._id,
      ...(linkedProfile?._id ? { studentId: linkedProfile._id } : {}),
      ...(user.cnic ? { cnic: user.cnic } : {})
    };
  }

  if (role === 'teacher') {
    return {
      ...base,
      id: linkedProfile?._id || user._id,
      ...(linkedProfile?._id ? { teacherId: linkedProfile._id } : {}),
      ...(user.phone ? { phone: user.phone } : {})
    };
  }

  if (role === 'parent') {
    return {
      ...base,
      id: linkedProfile?._id || user._id,
      ...(linkedProfile?._id ? { parentId: linkedProfile._id } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
      ...(user.cnic ? { cnic: user.cnic } : {})
    };
  }

  return {
    ...base,
    id: user._id,
    ...(user.username ? { username: user.username } : {})
  };
}

function signUserToken(user, linkedProfile = null) {
  const secret = process.env.JWT_SECRET || 'supersecretmmskey123';
  const payload = buildUserJwtPayload(user, linkedProfile);
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRE || '7d' });
}

module.exports = {
  cleanStr,
  findUserConflict,
  createUserRecord,
  rollbackUser,
  buildUserJwtPayload,
  signUserToken
};

