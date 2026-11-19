import fs from 'node:fs';
import path from 'node:path';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config, prefixes } from './config.js';
import { store } from './store.js';
import { log } from './logger.js';
import { handleMessage } from './handler.js';
import { commands } from './commands/index.js';
import { imageToSticker } from './commands/midia.js';
import { sleep, jidToNumber, normalize, matchesBadWord } from './utils.js';
import { acquireInstanceLock, releaseInstanceLock } from './instance-lock.js';
import { pruneSessionWrites } from './session-prune.js';

const LINK_REGEX = /(https?:\/\/|www\.|chat\.whatsapp\.com|t\.me\/|youtu\.be\/|discord\.gg\/)/i;

let reconnecting = false;
let pendingCredsSave = Promise.resolve();
let qrPending = false;
const healthAlertLastAt = new Map();

export async function flushSession() {
  await pendingCredsSave.catch(() => {});
}

async function sendHealthAlert(sock, text, key = text) {
  if (!config.healthAlerts) return;
  const jid = config.healthAlertJid || (config.ownerNumber ? `${config.ownerNumber}@s.whatsapp.net` : '');
  if (!jid) return;
  const now = Date.now();
  if (now - (healthAlertLastAt.get(key) || 0) < 5 * 60 * 1000) return;
  healthAlertLastAt.set(key, now);
  try {
    await sock.sendMessage(jid, { text: `[ALERTA] ${config.botName}: ${text}` });
  } catch {
    healthAlertLastAt.delete(key);
  }
}

export async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  pruneSessionWrites(state.keys);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  log.boot(`Versão do WhatsApp: ${version.join('.')} ${isLatest ? '(atual)' : '(desatualizada)'}`);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: config.logLevel === 'debug' ? 'debug' : 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    defaultQueryTimeoutMs: 60000
  });

  const ownMessageIds = new Set();
  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (...args) => {
    const result = await originalSendMessage(...args);
    const id = result?.key?.id;
    if (id) {
      ownMessageIds.add(id);
      if (ownMessageIds.size > 500) {
        ownMessageIds.delete(ownMessageIds.values().next().value);
      }
    }
    return result;
  };

  let pairingRequested = false;
  const needsPairing = config.pairingPhone && !state.creds.registered;

  sock.groupMetadataCache = new Map();
  sock.lidToJid = new Map();

  sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
    if (lid && jid) sock.lidToJid.set(lid, jid);
  });

  sock.ev.on('creds.update', () => {
    pendingCredsSave = pendingCredsSave.then(saveCreds).catch((error) => {
      log.error(`Falha ao salvar sessão: ${error.message}`);
    });
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrPending = true;
      if (config.pairingPhone) {
        if (needsPairing && !pairingRequested && !state.creds.pairingCode) {
          pairingRequested = true;
          await sleep(3000);
          try {
            const code = await sock.requestPairingCode(config.pairingPhone);
            log.warn(`Código de pareamento: ${code}`);
          } catch (error) {
            pairingRequested = false;
            log.error(`Falha ao gerar código de pareamento: ${error.message}`);
          }
        }
      } else {
        console.log('');
        qrcode.generate(qr, { small: true });
        log.warn('Escaneie o QR Code com o WhatsApp (Aparelhos conectados).');
      }
    }
    if (connection === 'open') {
      log.ok(`Conectado como ${jidToNumber(sock.user?.id) || 'desconhecido'}`);
      if (qrPending) {
        qrPending = false;
        await sendHealthAlert(sock, 'Novo QR Code conectado com sucesso.', 'qr-connected');
      }
      return;
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      log.warn(`Conexão fechada (${statusCode || 'motivo desconhecido'}).`);

      if (loggedOut) {
        await sendHealthAlert(sock, 'Sessão desvinculada pelo WhatsApp.', 'logged-out');
        await flushSession();
        if (config.clearSessionOnLogout) {
          fs.rmSync(config.sessionDir, { recursive: true, force: true });
          log.warn('Sessão removida (CLEAR_SESSION_ON_LOGOUT=true).');
        } else {
          log.warn('Sessão preservada em auth_info/. Se o vínculo foi realmente removido, rode: npm run reset:session');
        }
        return;
      }

      if (reconnecting) return;
      reconnecting = true;
      log.warn(`Reconectando em ${config.reconnectDelay / 1000}s...`);
      await sleep(config.reconnectDelay);
      reconnecting = false;
      connect().catch((error) => log.error(`Falha ao reconectar: ${error.message}`));
    }
  });

  sock.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      if (!update.id) continue;
      try {
        sock.groupMetadataCache.set(update.id, await sock.groupMetadata(update.id));
      } catch {}
    }
  });

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (!action || !participants?.length) return;
    try {
      sock.groupMetadataCache.set(id, await sock.groupMetadata(id));
    } catch {}
    if (action !== 'add' || !store.group(id).welcome) return;
    const group = store.group(id);
    for (const participant of participants) {
      const text = group.welcomeText.replace(/@user/g, `@${participant.split('@')[0]}`);
      try {
        await sock.sendMessage(id, { text }, { mentions: [participant] });
      } catch {}
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages || []) {
      if (!msg?.message) continue;
      if (msg.key?.fromMe) {
        const id = msg.key.id;
        if (ownMessageIds.has(id)) {
          ownMessageIds.delete(id);
          continue;
        }
        const text = messageText(msg).trim();
        if (!prefixes.some((prefix) => text.startsWith(prefix))) continue;
      }
      if (config.autoRead && typeof sock.readMessages === 'function') {
        sock.readMessages([msg.key]).catch(() => {});
      }
      const jid = msg.key.remoteJid;
      if (config.logIncomingMessages) {
        log.dim(`MSG ${jid} ${msg.key?.participant || ''} :: ${messageText(msg).slice(0, 160)}`);
      }
      if (jid?.endsWith('@g.us') && !sock.groupMetadataCache.has(jid)) {
        sock.groupMetadata(jid)
          .then((metadata) => sock.groupMetadataCache.set(jid, metadata))
          .catch(() => {});
      }
      if (jid?.endsWith('@g.us')) {
        const blocked = await moderate(sock, msg, jid);
        if (blocked) continue;
        handleAutoResponse(sock, msg, jid);
        if (msg.message?.imageMessage && store.group(jid).autofigu) {
          autoSticker(sock, msg, jid);
        }
      }
      await handleMessage(sock, msg, store, commands);
    }
  });

  return sock;
}

function messageText(msg) {
  return msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || '';
}

function linkIsAllowed(text, domains = []) {
  const match = String(text).match(/(?:https?:\/\/|www\.)([^\s/]+)/i);
  const host = match?.[1]?.toLowerCase();
  if (!host) return false;
  return domains.some((domain) => {
    const value = String(domain).toLowerCase().replace(/^\.+/, '');
    return host === value || host.endsWith(`.${value}`);
  });
}

function handleAutoResponse(sock, msg, jid) {
  const group = store.group(jid);
  if (!group.autoResponseEnabled || !group.autoResponses?.length) return;
  const text = messageText(msg);
  if (!text || /^[!\/]/.test(text.trim())) return;
  const needle = normalize(text);
  const match = group.autoResponses.find((entry) => needle.includes(normalize(entry.trigger)));
  if (!match) return;
  sock.sendMessage(jid, { text: match.response }, { quoted: msg }).catch(() => {});
}

async function autoSticker(sock, msg, jid) {
  try {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger });
    const sticker = await imageToSticker(buffer);
    await sock.sendMessage(jid, { sticker }, { quoted: msg });
  } catch (error) {
    log.warn(`Autofigu falhou: ${error.message}`);
  }
}

async function moderate(sock, msg, jid) {
  const group = store.group(jid);
  const sender = msg.key.participant || jid;
  const metadata = sock.groupMetadataCache.get(jid);
  const isPrivileged = Boolean(metadata?.participants?.find((member) => member.id === sender && member.admin)) ||
    (Boolean(config.ownerNumber) && jidToNumber(sender) === config.ownerNumber);
  if (isPrivileged) return false;

  const text = messageText(msg);
  const isMuted = group.muted?.includes(sender);
  const isBlacklisted = group.blacklist?.includes(sender);
  const hasLink = group.antilink && LINK_REGEX.test(text) && !linkIsAllowed(text, group.allowedDomains);
  const hasBadWord = group.filter && matchesBadWord(group, text);
  if (!isMuted && !isBlacklisted && !hasLink && !hasBadWord) return false;

  let reason = 'Você está silenciado neste grupo.';
  if (isBlacklisted) reason = 'Você está na lista negra deste grupo.';
  else if (hasLink) reason = 'Links não são permitidos neste grupo.';
  else if (hasBadWord) reason = 'Linguagem inadequada não é permitida.';

  try {
    await sock.sendMessage(jid, { delete: msg.key });
    await sock.sendMessage(jid, {
      text: `@${sender.split('@')[0]} ${reason}`,
      mentions: [sender]
    });
  } catch {}
  return true;
}

export async function startBot() {
  let releaseLock;
  try {
    releaseLock = acquireInstanceLock();
  } catch (error) {
    log.error(error.message);
    throw error;
  }

  store.startAutoSave();
  log.boot(`${config.botName} iniciando...`);
  log.info(`Prefixo: ${config.prefix} | Comandos: ${commands.length}`);
  const hasSession = fs.existsSync(path.join(config.sessionDir, 'creds.json'));
  if (hasSession) log.ok('Sessão encontrada em auth_info/ — conectando sem QR Code.');
  else log.warn('Nenhuma sessão salva. Um QR Code será exibido na primeira conexão.');

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn('Encerrando e salvando sessão...');
    await flushSession();
    store.stop();
    releaseLock();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    return await connect();
  } catch (error) {
    releaseLock();
    throw error;
  }
}
