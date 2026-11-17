import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { commands, findCommand } from '../src/commands/index.js';
import { handleMessage } from '../src/handler.js';

const JID = '120363000000000001@g.us';
const SENDER = '5511999999999@s.whatsapp.net';
const OTHER = '5511888888888@s.whatsapp.net';

function tempStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brincabot-fase1-'));
  return { store: new Store(directory), directory };
}

function makeCtx(store, overrides = {}) {
  const sent = [];
  const ctx = {
    store,
    sent,
    commands,
    config: { botName: 'BrincaBot', timezone: 'America/Sao_Paulo', cooldown: 2500 },
    jid: JID,
    sender: SENDER,
    isGroup: true,
    isAdmin: true,
    isOwner: false,
    groupMembers: [],
    prefix: '!',
    args: [],
    text: '',
    body: '',
    msg: { key: { remoteJid: JID, participant: SENDER }, message: {}, pushName: 'Ana' },
    sock: {
      sendMessage: async (jid, payload, options = {}) => {
        sent.push({ jid, payload, options });
        return { key: { id: 'mock' } };
      },
      groupParticipantsUpdate: async (jid, participants, action) => {
        sent.push({ jid, action, participants });
      }
    },
    reply: async (text, options = {}) => {
      sent.push({ payload: { text }, options });
      return { key: { id: 'mock' } };
    },
    send: async (payload, options = {}) => { sent.push({ payload, options }); },
    react: async () => {}
  };
  return Object.assign(ctx, overrides);
}

test('atividade: ranking e inativos usam dados por grupo', () => {
  const { store, directory } = tempStore();
  try {
    store.trackActivity(JID, SENDER, 'Ana', 'message');
    store.trackActivity(JID, SENDER, 'Ana', 'message');
    store.trackActivity(JID, SENDER, 'Ana', 'message');
    store.trackActivity(JID, OTHER, 'Bia', 'command');

    const ranking = store.activityRanking(JID, 10);
    assert.equal(ranking[0].userId, SENDER);
    assert.equal(ranking[0].total, 3);

    const members = [{ id: SENDER, admin: true }, { id: OTHER }, { id: '5511777777777@s.whatsapp.net' }];
    const inactive = store.inactiveMembers(JID, members, 3);
    assert.deepEqual(inactive.map((member) => member.id), [OTHER, '5511777777777@s.whatsapp.net']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('atividade: comandos rankativo e inativos respondem', async () => {
  const { store, directory } = tempStore();
  try {
    store.trackActivity(JID, SENDER, 'Ana', 'message');
    let ctx = makeCtx(store);
    await findCommand('rankativo').run(ctx);
    assert.match(ctx.sent[0].payload.text, /Ana/);

    ctx = makeCtx(store, {
      args: ['2'],
      groupMembers: [{ id: SENDER }, { id: OTHER }]
    });
    await findCommand('inativos').run(ctx);
    assert.match(ctx.sent[0].payload.text, /Membros com menos de 2 acoes|Membros com menos de 2 ações/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('moderação: autoresposta, mute e cooldown persistem no grupo', async () => {
  const { store, directory } = tempStore();
  try {
    let ctx = makeCtx(store, { args: ['add', 'oi|Olá!'] });
    await findCommand('autoresposta').run(ctx);
    assert.equal(store.group(JID).autoResponses[0].trigger, 'oi');

    ctx = makeCtx(store, { args: ['on'] });
    await findCommand('autoresposta').run(ctx);
    assert.equal(store.group(JID).autoResponseEnabled, true);

    const target = { participant: OTHER };
    ctx = makeCtx(store, {
      msg: { key: { remoteJid: JID, participant: SENDER }, message: { extendedTextMessage: { contextInfo: target } } }
    });
    await findCommand('mute').run(ctx);
    assert.ok(store.group(JID).muted.includes(OTHER));

    ctx = makeCtx(store, { args: ['3000'] });
    await findCommand('cooldown').run(ctx);
    assert.equal(store.group(JID).cooldown, 3000);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('jogo da velha: sessão interativa e jogada por mensagem simples', async () => {
  const { store, directory } = tempStore();
  try {
    let ctx = makeCtx(store);
    await findCommand('jogodavelha').run(ctx);
    assert.match(ctx.sent[0].payload.text, /Jogo da velha/);

    const sent = [];
    const sock = {
      sendMessage: async (jid, payload) => {
        sent.push({ jid, payload });
        return { key: { id: 'mock' } };
      }
    };
    await handleMessage(sock, { key: { remoteJid: JID, participant: SENDER }, message: { conversation: '5' }, pushName: 'Ana' }, store, commands);
    assert.ok(sent.some((entry) => /Jogo da velha|venceu|venci|Empate/.test(entry.payload.text || '')));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
