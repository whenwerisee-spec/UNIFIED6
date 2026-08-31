import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const isWindows = process.platform === 'win32';
const pythonExecutable = isWindows
  ? path.join(process.cwd(), 'sovereigns-banking-hub', 'backend', 'venv', 'Scripts', 'python.exe')
  : path.join(process.cwd(), 'sovereigns-banking-hub', 'backend', 'venv', 'bin', 'python');

const scriptPath = path.join(process.cwd(), 'sovereigns-banking-hub', 'backend', 'app.py');

if (!fs.existsSync(pythonExecutable)) {
  console.error(`Python executable not found at: ${pythonExecutable}`);
  process.exit(1);
}

const child = spawn(pythonExecutable, [scriptPath], { stdio: 'inherit' });
child.on('exit', (code) => {
  process.exit(code || 0);
});
