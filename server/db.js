const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

let writeQueue = Promise.resolve();

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

// 쓰기 작업을 하나의 큐로 직렬화해 동시 요청으로 인한 파일 손상을 방지한다.
function writeDB(data) {
  writeQueue = writeQueue.then(() =>
    fs.promises.writeFile(DB_PATH, JSON.stringify(data, null, 2))
  );
  return writeQueue;
}

module.exports = { readDB, writeDB };
