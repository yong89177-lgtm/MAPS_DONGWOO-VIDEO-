const crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (check.length !== expected.length) return false;
  return crypto.timingSafeEqual(check, expected);
}

module.exports = { hashPassword, verifyPassword };
