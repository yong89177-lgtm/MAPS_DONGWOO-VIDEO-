const path = require('path');
const express = require('express');
require('dotenv').config();

const agentsRouter = require('./routes/agents');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

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
