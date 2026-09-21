const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { readDB, writeDB } = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { CATEGORIES, STATUS } = require('../constants');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${req.agentId}.html`),
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.html' || ext === '.htm') return cb(null, true);
  cb(new Error('HTML 파일(.html)만 업로드할 수 있습니다.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

function publicView(agent) {
  const { rejectReason, ...rest } = agent;
  return rest;
}

// ---- 조회 ----

router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

// 공개: 2차 승인까지 완료된 에이전트만 노출
router.get('/agents', (req, res) => {
  const db = readDB();
  const approved = db.agents
    .filter((a) => a.status === STATUS.APPROVED)
    .map(publicView)
    .sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt));
  res.json(approved);
});

// 관리자: 전체 요청 목록 (모든 상태)
router.get('/agents/admin', adminAuth, (req, res) => {
  const db = readDB();
  const list = [...db.agents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

// ---- 등록 요청 ----

router.post('/agents', (req, res, next) => {
  req.agentId = crypto.randomUUID();

  upload.single('htmlFile')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || '파일 업로드에 실패했습니다.' });
    }

    try {
      const { name, category, description, developer, contactEmail } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: 'HTML 파일을 첨부해주세요.' });
      }
      if (!name || !category || !description || !developer || !contactEmail) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
      }
      if (!CATEGORIES.includes(category)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: '올바르지 않은 카테고리입니다.' });
      }

      const now = new Date().toISOString();
      const record = {
        id: req.agentId,
        name,
        category,
        description,
        developer,
        contactEmail,
        originalFileName: req.file.originalname,
        storedFileName: `${req.agentId}.html`,
        status: STATUS.PENDING,
        createdAt: now,
        updatedAt: now,
        firstApprovedAt: null,
        firstApprovedBy: null,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectReason: null,
      };

      const db = readDB();
      db.agents.push(record);
      writeDB(db)
        .then(() => res.status(201).json(publicView(record)))
        .catch(next);
    } catch (e) {
      next(e);
    }
  });
});

// ---- 관리자 승인 플로우 (1차 승인 -> 2차/최종 승인) ----

router.post('/agents/:id/first-approve', adminAuth, async (req, res, next) => {
  try {
    const db = readDB();
    const agent = db.agents.find((a) => a.id === req.params.id);
    if (!agent) return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    if (agent.status !== STATUS.PENDING) {
      return res.status(409).json({ message: '대기중인 요청만 1차 승인할 수 있습니다.' });
    }
    agent.status = STATUS.FIRST_APPROVED;
    agent.firstApprovedAt = new Date().toISOString();
    agent.firstApprovedBy = req.header('x-admin-name') || 'admin';
    agent.updatedAt = agent.firstApprovedAt;
    await writeDB(db);
    res.json(agent);
  } catch (e) {
    next(e);
  }
});

router.post('/agents/:id/second-approve', adminAuth, async (req, res, next) => {
  try {
    const db = readDB();
    const agent = db.agents.find((a) => a.id === req.params.id);
    if (!agent) return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    if (agent.status !== STATUS.FIRST_APPROVED) {
      return res.status(409).json({ message: '1차 승인된 요청만 2차(최종) 승인할 수 있습니다.' });
    }
    agent.status = STATUS.APPROVED;
    agent.approvedAt = new Date().toISOString();
    agent.approvedBy = req.header('x-admin-name') || 'admin';
    agent.updatedAt = agent.approvedAt;
    await writeDB(db);
    res.json(agent);
  } catch (e) {
    next(e);
  }
});

router.post('/agents/:id/reject', adminAuth, async (req, res, next) => {
  try {
    const db = readDB();
    const agent = db.agents.find((a) => a.id === req.params.id);
    if (!agent) return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    if (![STATUS.PENDING, STATUS.FIRST_APPROVED].includes(agent.status)) {
      return res.status(409).json({ message: '이미 처리가 완료된 요청입니다.' });
    }
    agent.status = STATUS.REJECTED;
    agent.rejectedAt = new Date().toISOString();
    agent.rejectReason = (req.body && req.body.reason) || '';
    agent.updatedAt = agent.rejectedAt;
    await writeDB(db);
    res.json(agent);
  } catch (e) {
    next(e);
  }
});

// ---- HTML 파일 실행/미리보기 ----

// 공개: 2차 승인 완료된 에이전트만 실행 가능
router.get('/agents/:id/file', (req, res) => {
  const db = readDB();
  const agent = db.agents.find((a) => a.id === req.params.id);
  if (!agent || agent.status !== STATUS.APPROVED) {
    return res.status(404).send('<h1>404</h1><p>승인된 에이전트를 찾을 수 없습니다.</p>');
  }
  res.sendFile(path.join(UPLOAD_DIR, agent.storedFileName));
});

// 관리자: 승인 전 상태와 무관하게 미리보기
router.get('/agents/:id/preview', adminAuth, (req, res) => {
  const db = readDB();
  const agent = db.agents.find((a) => a.id === req.params.id);
  if (!agent) return res.status(404).send('<h1>404</h1><p>요청을 찾을 수 없습니다.</p>');
  res.sendFile(path.join(UPLOAD_DIR, agent.storedFileName));
});

module.exports = router;
