const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { accounts, signupRequests, dashRequests, dashboards } = require('../lib/stores');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const { loadSession, createSession, destroySession, requireAdmin } = require('../lib/session');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'dash-requests');
const MAX_HTML_BYTES = 4 * 1024 * 1024; // 4MB

// 업로드된 HTML은 사용자가 직접 작성한 콘텐츠이므로, 직접 열람 시에도
// iframe sandbox와 동등한 제약(스크립트/폼/팝업만 허용, 쿠키·저장소 접근 차단)을 강제한다.
function sandboxHeaders(res) {
  res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-forms allow-modals allow-popups');
}

// 파일명에 개행이 섞여 헤더가 깨지는 걸 막고, 비-ASCII 폴백/UTF-8 파일명을 함께 내려준다.
function setDownloadHeader(res, filename) {
  const safe = String(filename || 'download.html').replace(/[\r\n]/g, ' ');
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`
  );
}

const norm = (s) => (s || '').replace(/\s+/g, '');

function resolveColumn(columns, features) {
  const list = Array.isArray(features) ? features : [];
  for (const feat of list) {
    if (!feat || !norm(feat)) continue;
    const existing = columns.find((c) => norm(c.team) === norm(feat));
    if (existing) return existing;
    const created = { team: feat, tag: '', items: [] };
    columns.push(created);
    return created;
  }
  let fallback = columns.find((c) => norm(c.team) === norm('공통 및 루틴 업무'));
  if (!fallback) {
    fallback = { team: '공통 및 루틴 업무', tag: 'Common & Routine Operations', items: [] };
    columns.push(fallback);
  }
  return fallback;
}

router.use(loadSession);

// ---- 세션 ----

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ auth: false });
  res.json({ auth: true, id: req.user.id, role: req.user.role });
});

router.post('/login', (req, res) => {
  const { id, pw } = req.body || {};
  if (!id || !pw) return res.status(400).json({ ok: false, error: '아이디와 비밀번호를 입력하세요.' });
  const acc = accounts.read().find((a) => a.id === id);
  if (!acc || !verifyPassword(pw, acc.pw)) {
    return res.status(401).json({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  createSession(res, acc);
  res.json({ ok: true, id: acc.id, role: acc.role });
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

// ---- 대시보드 관리 콘솔 (관리자가 팀/AI 목록을 직접 편집) ----

router.post('/save', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body;
    if (!body || !Array.isArray(body.columns)) {
      return res.status(400).json({ ok: false, error: '올바르지 않은 저장 데이터입니다.' });
    }
    await dashboards.write(body);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { id, pw, org, name, empno } = req.body || {};
    if (!id || !pw || !org || !name || !/^\d+$/.test(empno || '')) {
      return res.status(400).json({ ok: false, error: '입력값을 확인해주세요.' });
    }
    const accountList = accounts.read();
    const pendingList = signupRequests.read();
    if (accountList.some((a) => a.id === id) || pendingList.some((p) => p.id === id)) {
      return res.status(409).json({ ok: false, error: '이미 사용 중인 아이디입니다.' });
    }
    pendingList.push({ id, pw: hashPassword(pw), org, name, empno, ts: new Date().toISOString() });
    await signupRequests.write(pendingList);
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/pending-accounts', requireAdmin, (req, res) => {
  const items = signupRequests.read().map(({ pw, ...rest }) => rest);
  res.json({ ok: true, items });
});

router.post('/approve-account', requireAdmin, async (req, res, next) => {
  try {
    const { id, approve } = req.body || {};
    const pendingList = signupRequests.read();
    const idx = pendingList.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: '가입 신청을 찾을 수 없습니다.' });
    const [pending] = pendingList.splice(idx, 1);
    if (approve) {
      const accountList = accounts.read();
      accountList.push({
        id: pending.id,
        pw: pending.pw,
        role: 'user',
        org: pending.org,
        name: pending.name,
        empno: pending.empno,
        createdAt: new Date().toISOString(),
      });
      await accounts.write(accountList);
    }
    await signupRequests.write(pendingList);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---- 계정 관리 (관리자 콘솔의 "계정 관리" 탭) ----

function isLastAdmin(list, id) {
  const admins = list.filter((a) => a.role === 'admin');
  return admins.length === 1 && admins[0].id === id;
}

router.get('/accounts', requireAdmin, (req, res) => {
  const list = accounts.read().map(({ pw, ...rest }) => rest);
  res.json({ ok: true, accounts: list });
});

router.post('/accounts', requireAdmin, async (req, res, next) => {
  try {
    const { action, id } = req.body || {};
    const list = accounts.read();

    if (action === 'add') {
      const { pw, role } = req.body;
      if (!id || !pw) return res.status(400).json({ ok: false, error: 'ID와 비밀번호를 입력하세요.' });
      if (list.some((a) => a.id === id)) {
        return res.status(409).json({ ok: false, error: '이미 존재하는 아이디입니다.' });
      }
      list.push({
        id,
        pw: hashPassword(pw),
        role: role === 'admin' ? 'admin' : 'user',
        org: '',
        name: '',
        empno: '',
        createdAt: new Date().toISOString(),
      });
      await accounts.write(list);
      return res.json({ ok: true });
    }

    const acc = list.find((a) => a.id === id);
    if (!acc) return res.status(404).json({ ok: false, error: '계정을 찾을 수 없습니다.' });

    if (action === 'update') {
      const { pw, role, name, org, empno } = req.body;
      if (role && role !== acc.role && acc.role === 'admin' && role !== 'admin' && isLastAdmin(list, id)) {
        return res.status(409).json({ ok: false, error: '마지막 관리자 계정의 권한은 변경할 수 없습니다.' });
      }
      if (pw) acc.pw = hashPassword(pw);
      if (role === 'admin' || role === 'user') acc.role = role;
      if (name !== undefined) acc.name = name;
      if (org !== undefined) acc.org = org;
      if (empno !== undefined) acc.empno = empno;
      await accounts.write(list);
      return res.json({ ok: true });
    }

    if (action === 'delete') {
      if (acc.role === 'admin' && isLastAdmin(list, id)) {
        return res.status(409).json({ ok: false, error: '마지막 관리자 계정은 삭제할 수 없습니다.' });
      }
      const idx = list.findIndex((a) => a.id === id);
      list.splice(idx, 1);
      await accounts.write(list);
      return res.json({ ok: true });
    }

    res.status(400).json({ ok: false, error: '올바르지 않은 요청입니다.' });
  } catch (e) {
    next(e);
  }
});

// ---- AI Agent 등록 요청 ----

router.post('/dash-request', async (req, res, next) => {
  try {
    const { name, author, org, team, desc, features, etc, html, fname } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, error: '대시보드명을 입력하세요.' });
    }
    const trimmedHtml = typeof html === 'string' ? html : '';
    const hasFile = !!trimmedHtml.trim();
    if (hasFile) {
      const ext = path.extname(fname || '').toLowerCase();
      if (ext !== '.html' && ext !== '.htm') {
        return res.status(400).json({ ok: false, error: 'HTML 파일(.html)만 첨부할 수 있습니다.' });
      }
      if (Buffer.byteLength(trimmedHtml, 'utf-8') > MAX_HTML_BYTES) {
        return res.status(400).json({ ok: false, error: '파일 용량은 4MB 이하만 가능합니다.' });
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (hasFile) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, `${id}.html`), trimmedHtml, 'utf-8');
    }

    const list = dashRequests.read();
    list.push({
      id,
      name: String(name).trim(),
      requesterName: (author || '').trim(),
      requesterOrg: (org || '').trim(),
      requester: req.user ? req.user.id : '',
      org: (org || '').trim(),
      team: (team || '').trim(),
      desc: (desc || '').trim(),
      features: Array.isArray(features) ? features.filter(Boolean) : [],
      etc: (etc || '').trim(),
      fname: hasFile ? fname : '',
      file: hasFile,
      status: 'pending',
      ts: now,
      updatedAt: now,
      stage1: null,
      stage2: null,
    });
    await dashRequests.write(list);
    res.status(201).json({ ok: true, id });
  } catch (e) {
    next(e);
  }
});

router.get('/dash-requests', requireAdmin, (req, res) => {
  const items = dashRequests.read().slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
  res.json({ ok: true, items });
});

router.get('/request-status', requireAdmin, (req, res) => {
  const items = dashRequests.read().slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
  res.json({ ok: true, items });
});

router.post('/dash-request-cancel', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.body || {};
    const list = dashRequests.read();
    const item = list.find((q) => q.id === id);
    if (!item) return res.status(404).json({ ok: false, error: '요청을 찾을 수 없습니다.' });
    if (!['pending', 'it_approved'].includes(item.status)) {
      return res.status(409).json({ ok: false, error: '이미 처리된 요청은 취소할 수 없습니다.' });
    }
    item.status = 'cancelled';
    item.updatedAt = new Date().toISOString();
    await dashRequests.write(list);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// 1차(IT) 승인은 최초 관리자 계정(ADMIN_ID)만, 2차(적절성) 승인은 그 외 관리자만 처리할 수 있다.
router.post('/approve-dash-request', requireAdmin, async (req, res, next) => {
  try {
    const { id, approve, reason } = req.body || {};
    const list = dashRequests.read();
    const item = list.find((q) => q.id === id);
    if (!item) return res.status(404).json({ ok: false, error: '요청을 찾을 수 없습니다.' });

    const superId = process.env.ADMIN_ID || 'admin';
    const isSuper = req.user.id === superId;
    const now = new Date().toISOString();

    if (item.status === 'pending') {
      if (!isSuper) {
        return res.status(403).json({ ok: false, error: '1차 IT 검토는 최초 관리자 계정만 처리할 수 있습니다.' });
      }
      item.stage1 = { by: req.user.id, ts: now, decision: approve ? 'approved' : 'rejected', reason: reason || '' };
      item.status = approve ? 'it_approved' : 'rejected';
    } else if (item.status === 'it_approved') {
      if (isSuper) {
        return res.status(403).json({ ok: false, error: '2차 적절성 검토는 다른 관리자 계정으로 진행해주세요.' });
      }
      item.stage2 = { by: req.user.id, ts: now, decision: approve ? 'approved' : 'rejected', reason: reason || '' };
      item.status = approve ? 'approved' : 'rejected';
    } else {
      return res.status(409).json({ ok: false, error: '이미 처리가 완료된 요청입니다.' });
    }
    item.updatedAt = now;

    if (item.status === 'approved') {
      const board = dashboards.read();
      if (!Array.isArray(board.columns)) board.columns = [];
      const col = resolveColumn(board.columns, item.features);
      col.items = col.items || [];
      const nextOrder = col.items.reduce((m, it) => Math.max(m, +it.order || 0), 0) + 1;
      col.items.push({
        name: item.name,
        desc: item.desc || '',
        owner: item.requesterName || '',
        // "/"로 시작하는 경로는 메인 화면의 normAddr()이 현재 접속 중인 origin을 붙여서 열어준다.
        // 승인 시점의 host를 박아 넣으면(예: localhost:3000) 서버 주소가 바뀔 때마다(로컬 -> 사내망 IP 등)
        // 기존 카드가 깨지므로, 항상 이 경로 형태로 저장한다.
        addr: item.file ? `/api/dash-file?id=${item.id}` : '',
        order: nextOrder,
        org: item.org || '',
        likes: 0,
        linkedAt: now.slice(0, 10),
      });
      await dashboards.write(board);
    }

    await dashRequests.write(list);
    res.json({ ok: true, item });
  } catch (e) {
    next(e);
  }
});

router.get('/admin-notifications', requireAdmin, (req, res) => {
  const accountsPending = signupRequests.read().length;
  const requestsPending = dashRequests
    .read()
    .filter((q) => q.status === 'pending' || q.status === 'it_approved').length;
  res.json({ ok: true, accounts: accountsPending, requests: requestsPending });
});

// ---- HTML 실행/다운로드 ----

// 공개: 2차(최종) 승인된 요청의 HTML만 실행 가능. 카테고리별 카드 클릭 시 이 주소가 열린다.
// ?download=1 을 붙이면 브라우저에서 바로 열지 않고 등록 시 첨부한 원본 파일명으로 다운로드된다.
router.get('/dash-file', (req, res) => {
  const list = dashRequests.read();
  const item = list.find((q) => q.id === req.query.id);
  if (!item || item.status !== 'approved' || !item.file) {
    return res.status(404).send('<h1>404</h1><p>승인된 AI Agent를 찾을 수 없습니다.</p>');
  }
  sandboxHeaders(res);
  if (req.query.download) {
    setDownloadHeader(res, item.fname || `${item.name}.html`);
    item.downloads = (item.downloads || 0) + 1;
    dashRequests.write(list).catch(() => {});
  }
  res.sendFile(path.join(UPLOAD_DIR, `${item.id}.html`));
});

// 공개: 카드에 다운로드 버튼 툴팁으로 보여줄 항목별 누적 다운로드 횟수
router.get('/dash-download-counts', (req, res) => {
  const counts = {};
  dashRequests.read().forEach((q) => {
    if (q.status === 'approved' && q.file) counts[q.id] = q.downloads || 0;
  });
  res.json({ ok: true, counts });
});

// 관리자: 승인 상태와 무관하게 첨부 HTML을 검토/다운로드
router.get('/req-file', requireAdmin, (req, res) => {
  const item = dashRequests.read().find((q) => q.id === req.query.id);
  if (!item || !item.file) return res.status(404).send('<h1>404</h1><p>파일을 찾을 수 없습니다.</p>');
  sandboxHeaders(res);
  res.sendFile(path.join(UPLOAD_DIR, `${item.id}.html`));
});

module.exports = router;
