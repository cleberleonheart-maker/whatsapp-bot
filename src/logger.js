import chalk from 'chalk';
import { appendLog } from './log-file.js';
import { config } from './config.js';

const NOISY_SESSION_LOGS = [
  'Closing session:',
  'Opening session:',
  'Session already closed',
  'Session already open',
  'Removing old closed session:',
  'Closing open session in favor of incoming prekey bundle',
  'Failed to decrypt message with any known session',
  'Session error:'
];

let suppressedSessionLogs = 0;

export function isNoisySessionLog(...args) {
  return typeof args[0] === 'string' && NOISY_SESSION_LOGS.some((prefix) => args[0].startsWith(prefix));
}

for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
  const original = console[method]?.bind(console);
  if (!original) continue;
  console[method] = (...args) => {
    if (isNoisySessionLog(...args) && !config.logSessionErrors) {
      suppressedSessionLogs += 1;
      if (suppressedSessionLogs % 100 === 0) {
        const summary = `Erros internos de sessão suprimidos: ${suppressedSessionLogs}`;
        appendLog(summary);
        original(chalk.gray(`[    ] ${summary}`));
      }
      return;
    }
    appendLog(...args);
    original(...args);
  };
}

const colored = {
  boot: chalk.cyan,
  ok: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,
  cmd: chalk.magenta,
  dim: chalk.gray,
};

function stamp() {
  return chalk.gray(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
}

export const log = {
  boot: (...args) => console.log(stamp(), colored.boot('[BOOT]'), ...args),
  ok: (...args) => console.log(stamp(), colored.ok('[ OK ]'), ...args),
  info: (...args) => console.log(stamp(), colored.info('[INFO]'), ...args),
  warn: (...args) => console.log(stamp(), colored.warn('[WARN]'), ...args),
  error: (...args) => console.error(stamp(), colored.error('[ERRO]'), ...args),
  cmd: (...args) => console.log(stamp(), colored.cmd('[CMD ]'), ...args),
  dim: (...args) => console.log(stamp(), colored.dim('[    ]'), ...args),
};
