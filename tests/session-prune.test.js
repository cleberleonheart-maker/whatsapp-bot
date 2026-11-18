import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pruneSessionRecord, pruneSessionWrites, pruneSessionFiles } from '../src/session-prune.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'brinca-prune-'));
}

function session(used, closed) {
  return { indexInfo: { used, created: used, closed } };
}

test('pruneSessionRecord mantém a sessão aberta mais recente e descarta fechadas', () => {
  const original = {
    version: 2,
    _sessions: {
      antiga: session(100, 100),
      aberta: session(50, -1),
      recente: session(200, 200),
    },
  };

  const result = pruneSessionRecord(original, 1);

  assert.deepEqual(Object.keys(result.record._sessions), ['aberta']);
  assert.equal(result.before, 3);
  assert.equal(result.after, 1);
  assert.equal(result.removed, 2);
  assert.equal(result.openBefore, 1);
  assert.equal(result.openAfter, 1);
  assert.equal(original._sessions.antiga.indexInfo.closed, 100);
});

test('pruneSessionRecord preserva formato de array', () => {
  const result = pruneSessionRecord({ _sessions: [session(10, 10), session(20, -1)] }, 1);

  assert.ok(Array.isArray(result.record._sessions));
  assert.equal(result.record._sessions.length, 1);
  assert.equal(result.record._sessions[0].indexInfo.closed, -1);
});

test('pruneSessionWrites poda sessões antes de persistir', async () => {
  let recebido = null;
  const keys = {
    set: async (data) => {
      recebido = data;
    },
  };

  pruneSessionWrites(keys);
  await keys.set({ session: { 'jid.0': { _sessions: { antiga: session(10, 10), aberta: session(20, -1) } } } });

  assert.deepEqual(Object.keys(recebido.session['jid.0']._sessions), ['aberta']);
});

test('pruneSessionFiles cria backup e reescreve apenas arquivos alterados', () => {
  const root = tempDir();
  const sessionDir = path.join(root, 'auth_info');
  const backupRoot = path.join(root, 'backups');
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(
    path.join(sessionDir, 'session-a.json'),
    JSON.stringify({ _sessions: { a: session(1, -1), b: session(2, 2) } }),
  );
  fs.writeFileSync(path.join(sessionDir, 'session-b.json'), JSON.stringify({ _sessions: { a: session(1, -1) } }));

  const result = pruneSessionFiles({ sessionDir, backupRoot, keep: 1 });

  assert.equal(result.changed, 1);
  assert.ok(result.backup);
  assert.equal(fs.existsSync(path.join(result.backup, 'session-a.json')), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(result.backup, 'session-a.json'), 'utf8'))._sessions.b.indexInfo.closed, 2);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(sessionDir, 'session-a.json'), 'utf8'))._sessions).length, 1);

  const dry = pruneSessionFiles({ sessionDir, backupRoot, keep: 1, dryRun: true });
  assert.equal(dry.changed, 0);
  assert.equal(dry.backup, null);
});
