import { spawn } from 'node:child_process';

// One supervisor-owned entrypoint starts both local services, on Windows too.
const python = process.env.PYTHON ?? process.env.CODEX_PRIMARY_RUNTIME_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const api = spawn(python, ['-m', 'uvicorn', 'backend.app:app', '--host', '127.0.0.1', '--port', '8000'], { stdio: 'inherit' });
const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
const stop = () => { api.kill(); web.kill(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('error', error => { console.error('Python API could not start:', error.message); stop(); process.exitCode = 1; });
web.on('error', error => { console.error('Vite could not start:', error.message); stop(); process.exitCode = 1; });
api.on('exit', code => { if (code) { stop(); process.exitCode = code; } });
web.on('exit', code => { stop(); process.exitCode = code ?? 0; });
