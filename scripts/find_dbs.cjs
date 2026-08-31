const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
        results = results.concat(walk(file));
      }
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk('C:\\Users\\WINNNEER\\Downloads\\coinbase3');
files.forEach(f => {
  if (f.endsWith('.db') || f.endsWith('.sqlite') || f.endsWith('.sqlite3') || f.endsWith('.json')) {
    if (!f.includes('package.json') && !f.includes('tsconfig.json') && !f.includes('components.json') && !f.includes('.gemini')) {
      console.log(f);
    }
  }
});
