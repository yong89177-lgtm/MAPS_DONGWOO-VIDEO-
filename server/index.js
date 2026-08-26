const path = require('path');
const express = require('express');
require('dotenv').config();

const agentsRouter = require('./routes/agents');
const dashboardRouter = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;
const MAPS_HTML_PATH = path.join(__dirname, '..', 'MAPS 영상버전 (김동우 선임) 2 (1).html');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/maps.html', (req, res) => {
  res.sendFile(MAPS_HTML_PATH, (err) => {
    if (err) res.status(404).json({ message: '요청한 리소스를 찾을 수 없습니다.' });
  });
});

// 대시보드 관리 콘솔이 읽는 정적 상태 파일 (data/db.json 등 다른 파일은 노출하지 않는다).
app.get('/data/dashboards.json', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'data', 'dashboards.json'), (err) => {
    if (err) res.status(404).json({ message: '요청한 리소스를 찾을 수 없습니다.' });
  });
});

app.use('/api', agentsRouter);
app.use('/api', dashboardRouter);

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
