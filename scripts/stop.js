import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [];

if (fs.existsSync('/proc')) {
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid === process.pid) continue;
    try {
      const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      if (cwd !== root) continue;
      const argv = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
      const binary = path.basename(argv[0] || '');
      const script = argv[1] || '';
      if (binary !== 'node') continue;
      if (script === 'index.js' || script === 'scripts/launch.js' || script === 'src/index.js') targets.push(pid);
    } catch {}
  }
}

for (const pid of targets) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {}
}
