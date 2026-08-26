const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
const DASHBOARD_PATH = path.join(__dirname, '..', '..', 'data', 'dashboards.json');

const SESSION_COOKIE = 'maps_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12시간

// 별도 DB 없이 메모리에 세션을 둔다 (서버 재시작 시 초기화됨, 소규모 운영에 충분).
const sessions = new Map(); // token -> { id, role, expiresAt }

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function setSessionCookie(req, res, token) {
  const secure = req.protocol === 'https' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || session.role !== 'admin') {
    return res.status(401).json({ ok: false, error: '관리자 로그인이 필요합니다.' });
  }
  req.session = session;
  next();
}

// ---- 세션 ----

router.get('/me', (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({ auth: false });
  res.json({ auth: true, id: session.id, role: session.role });
});

router.post('/login', (req, res) => {
  const { id, pw } = req.body || {};
  const adminId = process.env.ADMIN_ID || 'admin';
  if (!id || !pw || id !== adminId || pw !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { id: adminId, role: 'admin', expiresAt: Date.now() + SESSION_TTL_MS });
  setSessionCookie(req, res, token);
  res.json({ ok: true, id: adminId, role: 'admin' });
});

router.post('/logout', (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ---- 대시보드 관리 ----

router.get('/dashboard', (req, res) => {
  fs.readFile(DASHBOARD_PATH, 'utf-8', (err, raw) => {
    if (err) return res.status(404).json({ columns: [] });
    res.type('application/json').send(raw);
  });
});

router.post('/save', requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || !Array.isArray(body.columns)) {
    return res.status(400).json({ ok: false, error: '올바르지 않은 저장 데이터입니다.' });
  }
  fs.writeFile(DASHBOARD_PATH, JSON.stringify(body, null, 2), (err) => {
    if (err) return res.status(500).json({ ok: false, error: '저장 중 오류가 발생했습니다.' });
    res.json({ ok: true });
  });
});

module.exports = router;
