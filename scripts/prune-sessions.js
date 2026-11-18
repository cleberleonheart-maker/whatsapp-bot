import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { isPidAlive } from '../src/instance-lock.js';
import { pruneSessionFiles } from '../src/session-prune.js';

let lock = null;
try {
  lock = JSON.parse(fs.readFileSync(config.instanceLockFile, 'utf8'));
} catch {}

if (lock && isPidAlive(Number(lock.pid))) {
  console.error(`Pare o bot antes de podar sessões (PID ${lock.pid} está ativo). Use: npm stop`);
  process.exit(1);
}

const args = process.argv.slice(2);
const keepArg = args.find((arg) => arg.startsWith('--keep='));
const keep = Number(keepArg?.split('=')[1]) || 1;
const dryRun = args.includes('--dry-run');
const files = args.filter((arg) => !arg.startsWith('--'));
const backupRoot = path.join(config.dataDir, 'auth-backups');

try {
  const result = pruneSessionFiles({ sessionDir: config.sessionDir, backupRoot, files, keep, dryRun });

  if (dryRun) console.log('Simulação: nenhum arquivo foi alterado.');
  console.log(`Arquivos verificados: ${result.plans.length}`);
  if (result.backup) console.log(`Backup: ${result.backup}`);

  for (const plan of result.plans.filter((item) => item.changed)) {
    console.log(
      `${path.basename(plan.file)}: ${plan.before} -> ${plan.after} sessão(ões), ` +
        `${plan.removed} removida(s), abertas ${plan.openBefore} -> ${plan.openAfter}`,
    );
  }

  if (!result.changed) console.log('Nenhuma sessão precisou de poda.');
} catch (error) {
  console.error(error?.message || error);
  process.exitCode = 1;
}
