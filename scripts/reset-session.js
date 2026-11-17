import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';

const target = config.sessionDir;
fs.rmSync(target, { recursive: true, force: true });
console.log(`Sessão removida: ${path.relative(process.cwd(), target)}`);
console.log('Rode npm start e escaneie o QR Code para vincular novamente.');
