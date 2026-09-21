const crypto = require('crypto');

// 데모/소규모 운영용 인메모리 세션. 서버 재시작 시 세션은 초기화된다.
const SESSIONS = new Map(); // token -> { id, role, createdAt }
const COOKIE_NAME = 'sid';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12시간

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function createSession(res, user) {
  const token = crypto.randomBytes(24).toString('hex');
  SESSIONS.set(token, { id: user.id, role: user.role, createdAt: Date.now() });
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`
  );
  return token;
}

function destroySession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (token) SESSIONS.delete(token);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`);
}

function loadSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  const session = token ? SESSIONS.get(token) : null;
  if (session && Date.now() - session.createdAt > MAX_AGE_MS) {
    SESSIONS.delete(token);
    req.user = null;
  } else {
    req.user = session ? { id: session.id, role: session.role } : null;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(401).json({ ok: false, error: '관리자 인증이 필요합니다.' });
  }
  next();
}

module.exports = { createSession, destroySession, loadSession, requireAdmin };
