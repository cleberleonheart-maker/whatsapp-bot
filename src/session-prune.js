import fs from 'node:fs';
import path from 'node:path';

function sessionEntries(record) {
  const raw = record?._sessions;
  if (Array.isArray(raw)) return raw.map((session, index) => ({ key: String(index), session }));
  if (raw && typeof raw === 'object') return Object.entries(raw).map(([key, session]) => ({ key, session }));
  return [];
}

function isOpenSession(session) {
  return session?.indexInfo?.closed === -1;
}

function usedAt(session) {
  const info = session?.indexInfo || {};
  const used = Number(info.used ?? info.created ?? 0);
  return Number.isFinite(used) ? used : 0;
}

export function pruneSessionRecord(record, keep = 1) {
  const limit = Math.max(1, Number.parseInt(keep, 10) || 1);
  const entries = sessionEntries(record);
  const isArray = Array.isArray(record?._sessions);
  const openBefore = entries.filter((entry) => isOpenSession(entry.session)).length;
  const ranked = entries
    .map((entry) => ({ ...entry, open: isOpenSession(entry.session), used: usedAt(entry.session) }))
    .sort((a, b) => Number(b.open) - Number(a.open) || b.used - a.used);
  const kept = new Set(ranked.slice(0, limit).map((entry) => entry.key));
  const keptEntries = entries.filter((entry) => kept.has(entry.key));
  const sessions = isArray
    ? keptEntries.map((entry) => entry.session)
    : Object.fromEntries(keptEntries.map((entry) => [entry.key, entry.session]));

  return {
    record: { ...record, _sessions: sessions },
    before: entries.length,
    after: keptEntries.length,
    removed: entries.length - keptEntries.length,
    openBefore,
    openAfter: keptEntries.filter((entry) => isOpenSession(entry.session)).length,
  };
}

export function pruneSessionWrites(keys, keep = 1) {
  const originalSet = keys.set.bind(keys);
  keys.set = async (data) => {
    if (data?.session) {
      for (const [id, value] of Object.entries(data.session)) {
        if (!value?._sessions) continue;
        const pruned = pruneSessionRecord(value, keep);
        if (pruned.removed > 0) data.session[id] = pruned.record;
      }
    }
    return originalSet(data);
  };
  return keys;
}

export function resolveSessionFiles(sessionDir, names = []) {
  if (names.length) {
    return names.map((name) => {
      const target = path.resolve(sessionDir, path.basename(name));
      if (!fs.existsSync(target)) throw new Error(`Arquivo de sessão não encontrado: ${target}`);
      return target;
    });
  }

  return fs
    .readdirSync(sessionDir)
    .filter((name) => /^session-.*\.json$/.test(name))
    .sort()
    .map((name) => path.join(sessionDir, name));
}

export function backupSessionDir(sessionDir, backupRoot) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupRoot, `auth-info-${stamp}-${process.pid}`);
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.cpSync(sessionDir, target, { recursive: true });
  return target;
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, file);
}

export function pruneSessionFiles({ sessionDir, backupRoot, files = [], keep = 1, dryRun = false }) {
  const plans = resolveSessionFiles(sessionDir, files).map((file) => {
    const original = JSON.parse(fs.readFileSync(file, 'utf8'));
    const result = pruneSessionRecord(original, keep);
    return { file, ...result, changed: result.removed > 0 };
  });
  const changed = plans.filter((plan) => plan.changed);
  const backup = !dryRun && changed.length ? backupSessionDir(sessionDir, backupRoot) : null;

  if (!dryRun) {
    for (const plan of changed) writeJsonAtomic(plan.file, plan.record);
  }

  return { backup, plans, changed: changed.length };
}
