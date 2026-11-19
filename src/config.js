import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function int(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|sim|yes|on)$/i.test(String(value));
}

export const config = {
  prefix: process.env.PREFIX || '!',
  altPrefixes: (process.env.ALT_PREFIXES || '/').split(',').map((p) => p.trim()).filter(Boolean),
  ownerNumber: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  sessionDir: path.resolve(process.cwd(), process.env.SESSION_DIR || './auth_info'),
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || './data/runtime'),
  logLevel: process.env.LOG_LEVEL || 'info',
  timezone: process.env.TZ || 'America/Sao_Paulo',
  botName: process.env.BOT_NAME || 'Fênix',
  botDescription: process.env.BOT_DESCRIPTION || 'Fênix — bot de WhatsApp com piadas, jogos e utilidades',
  botLogo: path.resolve(process.cwd(), process.env.BOT_LOGO || './assets/fenix-logo.png'),
  botSignature: process.env.BOT_SIGNATURE !== undefined
    ? process.env.BOT_SIGNATURE
    : '— 🔥 *Fênix* — piadas, jogos e utilidades',
  rateLimit: int(process.env.RATE_LIMIT, 12),
  cooldown: int(process.env.COOLDOWN_MS, 2500),
  autoRead: bool(process.env.AUTO_READ, true),
  autoPresence: bool(process.env.AUTO_PRESENCE, true),
  welcomeEnabled: bool(process.env.WELCOME_ENABLED, true),
  antilinkDefault: bool(process.env.ANTILINK_DEFAULT, false),
  filterDefault: bool(process.env.FILTER_DEFAULT, false),
  xpPerMessage: int(process.env.XP_PER_MESSAGE, 3),
  reconnectDelay: int(process.env.RECONNECT_DELAY_MS, 5000),
  maxReconnects: int(process.env.MAX_RECONNECTS, 0),
  ocrApiKey: process.env.OCR_API_KEY || 'helloworld',
  clearSessionOnLogout: bool(process.env.CLEAR_SESSION_ON_LOGOUT, false),
  pairingPhone: process.env.PAIRING_PHONE || '',
  ytdlpBin: process.env.YTDLP_BIN || '',
  videoLimitSeconds: int(process.env.VIDEO_LIMIT_SECONDS, 600),
  instanceLockFile: path.resolve(process.cwd(), process.env.INSTANCE_LOCK_FILE || './data/runtime/bot.lock'),
  logToFile: bool(process.env.LOG_TO_FILE, true),
  logFile: path.resolve(process.cwd(), process.env.LOG_FILE || './data/runtime/bot.log'),
  logMaxBytes: int(process.env.LOG_MAX_BYTES, 5 * 1024 * 1024),
  logMaxFiles: int(process.env.LOG_MAX_FILES, 5),
  healthAlerts: bool(process.env.HEALTH_ALERTS, true),
  healthAlertJid: process.env.HEALTH_ALERT_JID || '',
  logSessionErrors: bool(process.env.LOG_SESSION_ERRORS, false),
  logIncomingMessages: bool(process.env.LOG_INCOMING_MESSAGES, false),
};

export const prefixes = [config.prefix, ...config.altPrefixes];
