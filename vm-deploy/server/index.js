const path = require('path');
const express = require('express');
require('dotenv').config();

const agentsRouter = require('./routes/agents');
const dashboardRouter = require('./routes/dashboard');
const { dashboards } = require('./lib/stores');

const app = express();
const PORT = process.env.PORT || 3000;
const MAIN_HTML = path.join(__dirname, '..', 'MAPS 영상버전 (김동우 선임) 2 (1).html');

app.use(express.json({ limit: '10mb' }));

// 메인 화면(단일 HTML) — AI Agent 등록/카테고리별 카드가 표시되는 실제 서비스 화면.
app.get('/', (req, res) => {
  res.sendFile(MAIN_HTML);
});

// 메인 화면이 fetch("data/dashboards.json")로 읽는 카탈로그. 요청이 2차 승인되면
// 이 저장소에 카드가 추가되므로, 정적 파일이 아니라 저장소를 그대로 반환한다.
app.get('/data/dashboards.json', (req, res) => {
  res.json(dashboards.read());
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', dashboardRouter);
app.use('/api', agentsRouter);

app.use((req, res) => {
  res.status(404).json({ message: '요청한 리소스를 찾을 수 없습니다.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || '서버 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`AI Agent Registry server listening on port ${PORT}`);
});
