const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// 파일 기반 저장소. 동시 쓰기로 인한 파일 손상을 막기 위해 쓰기 작업을 큐로 직렬화한다.
function createStore(fileName, seedFn) {
  const filePath = path.join(DATA_DIR, fileName);
  let writeQueue = Promise.resolve();

  function ensureSeeded() {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(seedFn ? seedFn() : {}, null, 2));
    }
  }

  function read() {
    ensureSeeded();
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  function write(data) {
    writeQueue = writeQueue.then(() =>
      fs.promises.writeFile(filePath, JSON.stringify(data, null, 2))
    );
    return writeQueue;
  }

  return { read, write, filePath };
}

module.exports = { createStore };
