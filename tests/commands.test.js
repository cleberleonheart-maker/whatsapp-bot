import test from 'node:test';
import assert from 'node:assert/strict';
import { findCommand, commands } from '../src/commands/index.js';

function makeCtx(text = '', overrides = {}) {
  const sent = [];
  const sock = {
    sendMessage: async (jid, payload, options = {}) => {
      sent.push({ jid, payload, options });
      return { key: { id: 'mock' } };
    }
  };
  const group = { antilink: false, filter: false, welcome: true, welcomeText: 'Olá @user' };
  const store = {
    group: () => group,
    user: () => ({ xp: 0, level: 1, messages: 0, wins: 0, lastDaily: 0 }),
    ranking: () => [],
    getSession: () => null,
    session: (key, value) => value,
    touchSession: () => null,
    deleteSession: () => {},
    addXp: () => ({ level: 2, leveledUp: true }),
    stats: { messages: 0, commands: 0, startedAt: Date.now() },
    constructor: { xpForLevel: (level) => (level - 1) ** 2 * 100 }
  };
  const ctx = {
    sock, store, registry: commands, config: { timezone: 'America/Sao_Paulo', botName: 'BrincaBot' },
    jid: '120363000000000001@g.us', sender: '5511999999999@s.whatsapp.net',
    isGroup: true, isAdmin: true, isOwner: false,
    prefix: '!', body: text, args: [], text: '',
    msg: { key: { remoteJid: '120363000000000001@g.us', participant: '5511999999999@s.whatsapp.net' }, message: {} },
    sent,
    reply: async (payload, options = {}) => {
      sent.push({ jid: ctx.jid, payload: { text: payload }, options });
      return { key: { id: 'mock' } };
    },
    send: async (payload, options = {}) => {
      sent.push({ jid: ctx.jid, payload, options });
      return { key: { id: 'mock' } };
    },
    react: async (emoji) => {
      sent.push({ jid: ctx.jid, payload: { react: { text: emoji, key: ctx.msg.key } } });
    }
  };
  return Object.assign(ctx, overrides);
}

test('comando piada responde com texto', async () => {
  const ctx = makeCtx('!piada nerd');
  ctx.args = ['nerd'];
  ctx.text = 'nerd';
  await findCommand('piada').run(ctx);
  assert.match(ctx.sent[0].payload.text, /Piada \(Nerd\)/);
});

test('comando ppt aceita pedra, papel e tesoura', async () => {
  for (const choice of ['pedra', 'papel', 'tesoura']) {
    const ctx = makeCtx(`!ppt ${choice}`);
    ctx.args = [choice];
    await findCommand('ppt').run(ctx);
    assert.match(ctx.sent[0].payload.text, /Você:|Eu:/);
  }
});

test('comando calc calcula expressão', async () => {
  const ctx = makeCtx('!calc (2+3)*4');
  ctx.text = '(2+3)*4';
  await findCommand('calc').run(ctx);
  assert.match(ctx.sent[0].payload.text, /= \*20\*/);
});

test('comando ajuda organiza menu por categoria', async () => {
  let ctx = makeCtx('!ajuda');
  await findCommand('ajuda').run(ctx);
  assert.match(ctx.sent[0].payload.text, /┏╾═╼❋/);
  assert.match(ctx.sent[0].payload.text, /𝐌𝐄𝐍𝐔 𝐏𝐑𝐈𝐍𝐂𝐈𝐏𝐀𝐋/);
  assert.match(ctx.sent[0].payload.text, /!ajuda Jogos/);

  ctx = makeCtx('!ajuda');
  ctx.text = 'Diversão';
  await findCommand('ajuda').run(ctx);
  assert.match(ctx.sent[0].payload.text, /piada/);

  ctx = makeCtx('!ajuda');
  ctx.text = '2';
  await findCommand('ajuda').run(ctx);
  assert.match(ctx.sent[0].payload.text, /𝐃𝐈𝐕𝐄𝐑𝐒Ã𝐎/);
});

test('comando antilink alterna configuração do grupo', async () => {
  const ctx = makeCtx('!antilink on');
  ctx.args = ['on'];
  await findCommand('antilink').run(ctx);
  assert.equal(ctx.store.group().antilink, true);
  assert.match(ctx.sent[0].payload.text, /ativado/);
});

test('comando enquete valida entrada', async () => {
  const ctx = makeCtx('!enquete Pergunta');
  ctx.text = 'Pergunta';
  await findCommand('enquete').run(ctx);
  assert.match(ctx.sent[0].payload.text, /Pergunta\|Opção 1/);
});
