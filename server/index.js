const path = require('path');
const express = require('express');
require('dotenv').config();

const agentsRouter = require('./routes/agents');
const dashboardRouter = require('./routes/dashboard');
const { dashboards } = require('./lib/stores');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// v2 메인 화면(public/v2/index.html)이 fetch("data/dashboards.json")로 읽는 카탈로그.
// 요청이 2차 승인되면 이 저장소에 카드가 추가되므로, 정적 파일이 아니라 저장소를
// 그대로 반환한다.
app.get('/v2/data/dashboards.json', (req, res) => {
  res.json(dashboards.read());
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', agentsRouter);
// dashboardRouter 는 두 경로에 함께 건다: v2 페이지의 상대경로 fetch("api/...")는
// 페이지 위치(/v2/) 기준으로 /v2/api/... 를 호출하고, 승인된 카드 주소는
// dashboard.js 안에 /api/dash-file?id=... 로 고정 저장되어 있어 루트 /api 도 필요하다.
app.use('/api', dashboardRouter);
app.use('/v2/api', dashboardRouter);

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
