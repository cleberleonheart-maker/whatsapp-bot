import { prefixes, config } from './config.js';
import { findCommand } from './commands/index.js';
import { handleGameMessage } from './commands/jogos.js';
import { handleMessage as handleNovosJogos } from './commands/jogosnovos.js';
import { handleMessage as handleRpgMessage } from './commands/rpg.js';
import { appendSignature, jidToNumber, normalize } from './utils.js';
import { log } from './logger.js';

const cooldowns = new Map();

function extractText(message = {}) {
  return message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.audioMessage?.caption ||
    message.documentMessage?.caption ||
    '';
}

function buildContext(sock, msg, store, registry) {
  const jid = msg.key?.remoteJid || '';
  const sender = msg.key?.participant || jid;
  const groupMetadata = jid.endsWith('@g.us') ? sock.groupMetadataCache?.get?.(jid) : null;
  const participants = groupMetadata?.participants || [];
  const isAdmin = participants.some((member) => member.id === sender && member.admin);
  const body = extractText(msg.message);
  const isOwner = Boolean(config.ownerNumber) && jidToNumber(sender) === config.ownerNumber;

  const ctx = {
    sock, msg, store, registry, config,
    jid, sender, body,
    senderNumber: jidToNumber(sender),
    isGroup: jid.endsWith('@g.us'),
    isAdmin,
    isOwner,
    groupMetadata,
    groupMembers: participants,
    groupConfig: jid.endsWith('@g.us') ? store.group(jid) : null,
    prefix: prefixes.find((prefix) => body.startsWith(prefix)) || config.prefix
  };

  ctx.args = [];
  ctx.text = '';

  ctx.send = (payload, options = {}) => sock.sendMessage(jid, payload, { quoted: msg, ...options });
  ctx.reply = async (text, options = {}) => {
    const { react, ...sendOptions } = options;
    const result = await sock.sendMessage(jid, { text: appendSignature(text, config.botSignature) }, { quoted: msg, ...sendOptions });
    if (react) await ctx.react(react);
    return result;
  };
  ctx.react = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } });

  return ctx;
}

export async function handleMessage(sock, msg, store, registry) {
  if (!msg?.message || msg.key?.remoteJid === 'status@broadcast') return;
  if (/bot|broadcast/i.test(msg.key?.participant || '')) return;

  const ctx = buildContext(sock, msg, store, registry);
  if (!ctx.body.trim()) return;

  try {
    const hasPrefix = prefixes.some((prefix) => ctx.body.trim().startsWith(prefix));
    if (msg.key?.fromMe && !hasPrefix) return;
    if (!hasPrefix) {
      store.trackActivity?.(ctx.jid, ctx.sender, ctx.msg.pushName, 'message');
      const handled = handleGameMessage(ctx) ||
        handleNovosJogos(ctx) ||
        handleRpgMessage(ctx);
      if (!handled) store.addXp(ctx.sender);
      return;
    }

    const afterPrefix = ctx.body.trim().slice(ctx.prefix.length);
    const parsed = /^(\S+)\s*([\s\S]*)$/.exec(afterPrefix);
    const name = parsed?.[1] || '';
    ctx.commandName = normalize(name);
    ctx.text = (parsed?.[2] || '').trim();
    ctx.args = ctx.text.split(/\s+/).filter(Boolean);

    const command = findCommand(ctx.commandName);
    if (!command) {
      if (config.logIncomingMessages) log.dim(`Comando desconhecido: ${ctx.commandName}`);
      return;
    }

    if (command.groupOnly && !ctx.isGroup) return ctx.reply('Este comando só funciona em grupos.');
    if (command.adminOnly && !ctx.isAdmin && !ctx.isOwner) {
      return ctx.reply('Apenas administradores podem usar este comando.');
    }
    if (command.ownerOnly && !ctx.isOwner) return ctx.reply('Comando restrito ao dono do bot.');

    if (!ctx.isOwner && !store.allow(`${ctx.jid}:${ctx.sender}`, 1000)) return;

    const cooldownKey = `${ctx.sender}:${ctx.jid}:${command.name}`;
    const last = cooldowns.get(cooldownKey) || 0;
    const elapsed = Date.now() - last;
    const cooldownMs = Number(ctx.groupConfig?.cooldown) || config.cooldown || 0;
    if (elapsed < cooldownMs) {
      return ctx.reply(`⏳ Aguarde ${((cooldownMs - elapsed) / 1000).toFixed(1)}s antes de usar este comando.`);
    }
    cooldowns.set(cooldownKey, Date.now());

    store.trackActivity?.(ctx.jid, ctx.sender, ctx.msg.pushName, 'command');
    store.stats.commands += 1;
    store.user(ctx.sender).commands += 1;
    log.cmd(`${ctx.commandName} de ${ctx.senderNumber}${ctx.isGroup ? ' em grupo' : ''}`);
    if (config.autoPresence && typeof sock.sendPresenceUpdate === 'function') {
      sock.sendPresenceUpdate('composing', ctx.jid).catch(() => {});
    }
    try {
      await command.run(ctx);
    } finally {
      if (config.autoPresence && typeof sock.sendPresenceUpdate === 'function') {
        sock.sendPresenceUpdate('paused', ctx.jid).catch(() => {});
      }
    }
  } catch (error) {
    log.error(`Erro ao processar mensagem: ${error.stack || error.message}`);
    try {
      await ctx.reply('Ops! Ocorreu um erro ao executar o comando. Tente novamente.');
    } catch {}
  }
}
