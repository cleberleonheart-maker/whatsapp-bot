import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { config } from './config.js';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');

function formatArg(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  try {
    return util.inspect(value, { depth: 3, colors: false, breakLength: 1000 });
  } catch {
    return String(value);
  }
}

export function rotateLogFile(filePath, maxBytes = config.logMaxBytes, maxFiles = config.logMaxFiles) {
  if (!fs.existsSync(filePath)) return;
  if (fs.statSync(filePath).size < maxBytes) return;

  const copies = Math.max(1, Number(maxFiles) || 1);
  for (let index = copies - 1; index >= 1; index -= 1) {
    const from = `${filePath}.${index}`;
    const to = `${filePath}.${index + 1}`;
    if (!fs.existsSync(from)) continue;
    if (fs.existsSync(to)) fs.unlinkSync(to);
    fs.renameSync(from, to);
  }
  fs.renameSync(filePath, `${filePath}.1`);
}

export function appendLogLine(filePath, line, maxBytes = config.logMaxBytes, maxFiles = config.logMaxFiles) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  rotateLogFile(filePath, maxBytes, maxFiles);
  fs.appendFileSync(filePath, `${line.replace(ANSI, '')}\n`);
}

export function appendLog(...args) {
  if (!config.logToFile) return;
  const stamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  appendLogLine(config.logFile, `[${stamp}] ${args.map(formatArg).join(' ')}`);
}
