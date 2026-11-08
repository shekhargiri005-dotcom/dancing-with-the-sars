const fs = require('fs');

const js = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

// Find all document.getElementById calls
const regex = /document\.getElementById\(['"]([a-zA-Z0-9_-]+)['"]\)/g;
let match;
const usedIds = new Set();
while ((match = regex.exec(js)) !== null) {
  usedIds.add(match[1]);
}

console.log('Total unique IDs accessed by document.getElementById in app.js:', usedIds.size);

const missing = [];
usedIds.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    missing.push(id);
  }
});

console.log('Missing IDs in index.html:', missing);

