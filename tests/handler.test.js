import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMessage } from '../src/handler.js';
import { commands } from '../src/commands/index.js';

function makeFixtures() {
  const sent = [];
  const user = { xp: 0, level: 1, messages: 0, commands: 0, wins: 0, lastDaily: 0 };
  const stats = { messages: 0, commands: 0, startedAt: Date.now() };
  const sock = {
    sendMessage: async (jid, payload) => {
      sent.push({ jid, payload });
      return { key: { id: 'reply' } };
    }
  };
  const store = {
    allow: () => true,
    trackActivity: () => {},
    user: () => user,
    stats,
    group: () => ({})
  };
  return { sent, sock, store, stats };
}

function makeMessage(text) {
  return {
    key: {
      remoteJid: '55519550270931@s.whatsapp.net',
      participant: '55519550270931@s.whatsapp.net',
      fromMe: true,
      id: 'owner-command'
    },
    message: { conversation: text }
  };
}

test('handler aceita comando com prefixo enviado pelo próprio número', async () => {
  const { sent, sock, store, stats } = makeFixtures();

  await handleMessage(sock, makeMessage('!piada'), store, commands);

  assert.equal(stats.commands, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].payload.text, /Piada/);
  assert.match(sent[0].payload.text, /— 🔥 \*Fênix\*/);
});

test('handler ignora mensagem sem prefixo enviada pelo próprio número', async () => {
  const { sent, sock, store, stats } = makeFixtures();

  await handleMessage(sock, makeMessage('oi'), store, commands);

  assert.equal(stats.commands, 0);
  assert.equal(sent.length, 0);
});
