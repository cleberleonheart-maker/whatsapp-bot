import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const localNode = path.resolve(process.env.HOME || '', '.node20/node_modules/node/bin/node');
const currentMajor = Number(process.versions.node.split('.')[0]);
const nodeBin = currentMajor >= 20 ? process.execPath : (fs.existsSync(localNode) ? localNode : null);

if (!nodeBin) {
  console.error('É necessário Node.js 20+. Instale com: nvm install 20 && nvm use 20');
  process.exit(1);
}

const child = spawn(nodeBin, ['index.js'], { stdio: 'inherit', cwd: process.cwd() });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (error) => {
  console.error('Falha ao iniciar:', error.message);
  process.exit(1);
});
