import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

const owned = new Map();

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readLock(lockPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    return { pid: Number(parsed.pid), token: String(parsed.token || '') };
  } catch {
    return null;
  }
}

export function acquireInstanceLock(lockPath = config.instanceLockFile) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const token = `${process.pid}:${Date.now()}:${randomUUID()}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token, startedAt: Date.now() }));
      fs.closeSync(fd);
      owned.set(lockPath, token);
      return () => releaseInstanceLock(lockPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const current = readLock(lockPath);
      if (current && isPidAlive(current.pid)) {
        throw new Error(`Já existe outra instância rodando (PID ${current.pid}).`);
      }
      try {
        fs.unlinkSync(lockPath);
      } catch (unlinkError) {
        if (unlinkError?.code !== 'ENOENT') throw unlinkError;
      }
    }
  }

  throw new Error('Não foi possível criar o lock de instância.');
}

export function releaseInstanceLock(lockPath = config.instanceLockFile) {
  const token = owned.get(lockPath);
  if (!token) return;
  owned.delete(lockPath);
  const current = readLock(lockPath);
  if (current?.token === token) {
    try {
      fs.unlinkSync(lockPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}
