const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendArgs = process.argv.slice(2);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

const backend = spawnSync(npmCommand, ['--prefix', 'backend', 'test', ...backendArgs], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});

if (backend.status !== 0) {
  process.exit(backend.status ?? 1);
}

const aiService = spawnSync(pythonCommand, ['-m', 'pytest', 'tests/', '-q'], {
  cwd: path.join(repoRoot, 'ai-service'),
  stdio: 'inherit',
  shell: true,
});

process.exit(aiService.status ?? 1);
