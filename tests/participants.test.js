import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { commands, findCommand } from '../src/commands/index.js';
import { formatPhone, participantLabel, phoneJidFor } from '../src/participants.js';

const LID = '96916675285036@lid';
const PHONE = '5596916675285@s.whatsapp.net';

function tempStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brincabot-participants-'));
  return { store: new Store(directory), directory };
}

function makeCtx(store, groupMembers = []) {
  const sent = [];
  return {
    store, sent, registry: commands, args: [], text: '', prefix: '!',
    config: { timezone: 'America/Sao_Paulo', botName: 'BrincaBot' },
    jid: '120363000000000001@g.us', sender: LID,
    msg: { key: { remoteJid: '120363000000000001@g.us', participant: LID }, message: {} },
    groupMembers,
    reply: async (text) => { sent.push({ text }); return { key: {} }; },
    react: async () => {}
  };
}

test('participantes: formata número brasileiro', () => {
  assert.equal(formatPhone(PHONE), '+55 96 91667-5285');
});

test('participantes: resolve LID pelo metadata do grupo', () => {
  const { store, directory } = tempStore();
  try {
    const ctx = makeCtx(store, [{ id: LID, lid: LID, jid: PHONE, name: 'João' }]);
    assert.equal(phoneJidFor(ctx, LID), PHONE);
    assert.equal(participantLabel(ctx, LID), 'João (+55 96 91667-5285)');
    assert.doesNotMatch(participantLabel(ctx, LID), /96916675285036/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('participantes: usa participantPn da mensagem quando não há metadata', () => {
  const { store, directory } = tempStore();
  try {
    const ctx = makeCtx(store);
    ctx.msg.key.participantPn = PHONE;
    assert.equal(participantLabel(ctx, LID), '+55 96 91667-5285');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('economiarank: exibe número real em vez do LID', async () => {
  const { store, directory } = tempStore();
  try {
    store.addCoins(LID, 500);
    const ctx = makeCtx(store, [{ id: LID, lid: LID, jid: PHONE, name: 'João' }]);
    await findCommand('economiarank').run(ctx);
    const output = ctx.sent[0].text;
    assert.match(output, /João \(\+55 96 91667-5285\)/);
    assert.doesNotMatch(output, /@96916675285036/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
