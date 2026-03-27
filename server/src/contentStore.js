const fs = require('fs');
const path = require('path');

const CONTENT_PATH = path.join(__dirname, '..', '..', 'data', 'gameContent.json');

function readContent() {
  const raw = fs.readFileSync(CONTENT_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveContent(content) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf8');
}

module.exports = {
  readContent,
  saveContent,
};

