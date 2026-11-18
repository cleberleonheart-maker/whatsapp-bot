import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireInstanceLock, releaseInstanceLock, isPidAlive } from '../src/instance-lock.js';
import { appendLogLine, rotateLogFile } from '../src/log-file.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'brinca-stability-'));
}

test('lock de instância bloqueia segunda instância e libera ao finalizar', () => {
  const lockPath = path.join(tempDir(), 'bot.lock');
  const release = acquireInstanceLock(lockPath);

  assert.equal(fs.existsSync(lockPath), true);
  assert.throws(() => acquireInstanceLock(lockPath), /Já existe outra instância rodando/);

  release();
  assert.equal(fs.existsSync(lockPath), false);
  assert.doesNotThrow(() => releaseInstanceLock(lockPath));
});

test('lock de instância remove arquivo órfão', () => {
  const lockPath = path.join(tempDir(), 'bot.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ startedAt: 0 }));

  const release = acquireInstanceLock(lockPath);
  assert.equal(fs.existsSync(lockPath), true);
  release();
  assert.equal(fs.existsSync(lockPath), false);
});

test('isPidAlive valida PID', () => {
  assert.equal(isPidAlive(process.pid), true);
  assert.equal(isPidAlive(-1), false);
  assert.equal(isPidAlive(undefined), false);
});

test('rotação de logs mantém apenas a quantidade configurada', () => {
  const logPath = path.join(tempDir(), 'bot.log');

  fs.writeFileSync(logPath, 'a'.repeat(20));
  rotateLogFile(logPath, 10, 2);
  assert.equal(fs.existsSync(logPath), false);
  assert.equal(fs.readFileSync(`${logPath}.1`, 'utf8'), 'a'.repeat(20));

  fs.writeFileSync(logPath, 'b'.repeat(20));
  rotateLogFile(logPath, 10, 2);
  assert.equal(fs.readFileSync(`${logPath}.2`, 'utf8'), 'a'.repeat(20));
  assert.equal(fs.readFileSync(`${logPath}.1`, 'utf8'), 'b'.repeat(20));

  fs.writeFileSync(logPath, 'c'.repeat(20));
  rotateLogFile(logPath, 10, 2);
  assert.equal(fs.existsSync(`${logPath}.3`), false);
  assert.equal(fs.readFileSync(`${logPath}.2`, 'utf8'), 'b'.repeat(20));
  assert.equal(fs.readFileSync(`${logPath}.1`, 'utf8'), 'c'.repeat(20));
});

test('appendLogLine grava linha sem códigos ANSI', () => {
  const logPath = path.join(tempDir(), 'bot.log');
  appendLogLine(logPath, 'mensagem normal', 100, 2);
  assert.equal(fs.readFileSync(logPath, 'utf8'), 'mensagem normal\n');
});
