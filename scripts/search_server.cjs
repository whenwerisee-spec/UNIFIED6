const fs = require('fs');
if (fs.existsSync('server.ts')) {
  const content = fs.readFileSync('server.ts', 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes('sweep') || line.toLowerCase().includes('kiln') || line.toLowerCase().includes('figment') || line.toLowerCase().includes('yield')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('server.ts does not exist in root');
}
