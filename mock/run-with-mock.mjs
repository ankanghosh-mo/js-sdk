// Starts the mock backend (port 8096) and the Vite dev server (port 5181) proxying /api to it.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mock = spawn(process.execPath, [path.join(root, 'mock', 'mock-server.mjs')], { stdio: 'inherit' });
const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_API_TARGET: 'http://localhost:8096' },
});

const stop = () => {
  mock.kill();
  vite.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
mock.on('exit', stop);
vite.on('exit', stop);
