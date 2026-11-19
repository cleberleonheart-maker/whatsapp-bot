import crypto from 'node:crypto';

const BAD_WORDS = ['merda', 'bosta', 'caralho', 'porra', 'foda', 'fdp', 'filho da puta', 'cuzão', 'viado'];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesBadWord(group, text) {
  const badWords = [...BAD_WORDS, ...(group?.customBadWords || [])];
  return badWords.some((word) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}($|[^\\p{L}\\p{N}])`, 'iu').test(String(text || '')));
}

export function appendSignature(text, signature = '') {
  const body = String(text ?? '');
  const sign = String(signature || '').trim();
  if (!sign || body.includes(sign)) return body;
  return `${body}\n\n${sign}`;
}

export const randomItem = (array) => array[Math.floor(Math.random() * array.length)];
export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseArgs(text = '') {
  return String(text).trim().split(/\s+/).filter(Boolean);
}

export function truncate(value, max = 120) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function jidToNumber(jid = '') {
  return String(jid).split('@')[0].replace(/\D/g, '');
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function weekInfo(date = new Date()) {
  const current = new Date(date.getTime());
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
  const next = new Date(date.getTime());
  const daysUntilNext = (8 - day) % 7 || 7;
  next.setUTCDate(next.getUTCDate() + daysUntilNext);
  next.setUTCHours(0, 0, 0, 0);
  return {
    year: current.getUTCFullYear(),
    week,
    key: `${current.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
    next
  };
}

export function formatMs(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}

export function formatDate(date = new Date(), timezone = 'America/Sao_Paulo') {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function randomId(bytes = 8) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function isTruthy(value) {
  return value === true || value === 1 || value === 'on' || value === 'true';
}

const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  log: Math.log10,
  ln: Math.log,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  pow: (a, b) => a ** b,
  min: Math.min,
  max: Math.max,
};

const CONSTANTS = { pi: Math.PI, e: Math.E };

const TOKEN_REGEX = /\d+(?:\.\d+)?|[a-z]+|[-+*/^%(),]/gi;

function tokenize(input) {
  const raw = String(input).toLowerCase().replace(/\s+/g, '');
  const tokens = raw.match(TOKEN_REGEX);
  if (!tokens || tokens.join('') !== raw) throw new Error('Expressão inválida');
  return tokens;
}

function prepareTokens(tokens) {
  const result = [];
  const isValue = (token) => Boolean(token) && (/^\d/.test(token) || token === ')' || token in CONSTANTS);
  const startsValue = (token) => /^\d/.test(token) || token === '(' || token in CONSTANTS || token in FUNCTIONS;

  tokens.forEach((token, index) => {
    const previous = result[result.length - 1];
    if (isValue(previous) && startsValue(token)) result.push('*');
    if (token === '-' && (index === 0 || ['(', '+', '-', '*', '/', '%', '^', 'u-'].includes(previous))) {
      result.push('u-');
    } else {
      result.push(token);
    }
  });
  return result;
}

function toRpn(tokens) {
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };
  const rightAssociative = new Set(['^', 'u-']);
  const output = [];
  const stack = [];

  for (const token of prepareTokens(tokens)) {
    if (/^\d/.test(token) || token in CONSTANTS) {
      output.push(token);
      continue;
    }
    if (token in FUNCTIONS) {
      stack.push(token);
      continue;
    }
    if (token === '(') {
      stack.push(token);
      continue;
    }
    if (token === ')') {
      while (stack.length && stack[stack.length - 1] !== '(') output.push(stack.pop());
      if (!stack.length) throw new Error('Parênteses desbalanceados');
      stack.pop();
      if (stack.length && stack[stack.length - 1] in FUNCTIONS) output.push(stack.pop());
      continue;
    }
    if (!(token in precedence)) throw new Error(`Operador inválido: ${token}`);
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (!(top in precedence)) break;
      if (precedence[top] > precedence[token] ||
        (precedence[top] === precedence[token] && !rightAssociative.has(token))) {
        output.push(stack.pop());
      } else {
        break;
      }
    }
    stack.push(token);
  }

  while (stack.length) {
    const token = stack.pop();
    if (token === '(') throw new Error('Parênteses desbalanceados');
    output.push(token);
  }
  return output;
}

export function safeMath(expression) {
  const tokens = tokenize(expression);
  if (!tokens.length) throw new Error('Expressão vazia');
  const rpn = toRpn(tokens);
  const stack = [];

  for (const token of rpn) {
    if (/^\d/.test(token)) {
      stack.push(Number(token));
      continue;
    }
    if (token in CONSTANTS) {
      stack.push(CONSTANTS[token]);
      continue;
    }
    if (token === 'u-') {
      if (!stack.length) throw new Error('Expressão inválida');
      stack.push(-stack.pop());
      continue;
    }
    if (token in FUNCTIONS) {
      const arity = token === 'pow' || token === 'min' || token === 'max' ? 2 : 1;
      if (stack.length < arity) throw new Error('Argumentos insuficientes');
      const args = stack.splice(-arity);
      const result = FUNCTIONS[token](...args);
      if (!Number.isFinite(result)) throw new Error('Resultado inválido');
      stack.push(result);
      continue;
    }
    if (stack.length < 2) throw new Error('Expressão inválida');
    const b = stack.pop();
    const a = stack.pop();
    const results = {
      '+': () => a + b,
      '-': () => a - b,
      '*': () => a * b,
      '/': () => (b === 0 ? NaN : a / b),
      '%': () => (b === 0 ? NaN : a % b),
      '^': () => a ** b,
    };
    const result = results[token]();
    if (!Number.isFinite(result)) throw new Error('Resultado inválido (divisão por zero?)');
    stack.push(result);
  }

  if (stack.length !== 1) throw new Error('Expressão inválida');
  return stack[0];
}

export function generatePassword(length = 16, options = {}) {
  const size = clamp(Number.parseInt(length, 10) || 16, 6, 64);
  const { symbols = true, numbers = true } = options;
  let chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%&*()-_=+[]{}?';
  const bytes = crypto.randomBytes(size);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}
