import test from 'node:test';
import assert from 'node:assert/strict';
import { findCommand, commands } from '../src/commands/index.js';

function makeStore() {
  const users = new Map();
  const sessions = new Map();
  return {
    users, sessions,
    stats: { messages: 0, commands: 0, startedAt: Date.now() },
    user(jid) {
      if (!users.has(jid)) {
        users.set(jid, {
          xp: 0, messages: 0, commands: 0, level: 1, wins: 0,
          coins: 100, streak: 0, titles: [], activeTitle: null,
          inventory: {}, rpg: null, lastDaily: 0
        });
      }
      return users.get(jid);
    },
    addCoins(jid, amount) { this.user(jid).coins += amount; },
    spendCoins(jid, amount) {
      if (this.user(jid).coins < amount) return false;
      this.user(jid).coins -= amount;
      return true;
    },
    addXp(jid, amount) { this.user(jid).xp += amount; return { level: 1, leveledUp: false }; },
    ranking() { return []; },
    group() { return { antilink: false, filter: false, welcome: true, welcomeText: 'Olá @user' }; },
    getSession(key) { return sessions.get(key) || null; },
    session(key, value) { sessions.set(key, { ...value }); return sessions.get(key); },
    touchSession(key, value) { Object.assign(sessions.get(key), value); return sessions.get(key); },
    deleteSession(key) { sessions.delete(key); },
    constructor: { xpForLevel: (level) => (level - 1) ** 2 * 100 }
  };
}

function makeCtx(options = {}) {
  const store = options.store || makeStore();
  const sender = options.sender || '5511999999999@s.whatsapp.net';
  const jid = options.jid || '120363000000000001@g.us';
  const sent = [];
  const ctx = {
    store, sent, sender, jid, registry: commands, isGroup: jid.endsWith('@g.us'), isAdmin: true, isOwner: false,
    prefix: '!', args: options.args || [], text: options.text || '',
    config: { timezone: 'America/Sao_Paulo', botName: 'BrincaBot' },
    sock: { sendMessage: async () => ({}) },
    msg: {
      key: { remoteJid: jid, participant: sender },
      message: {
        extendedTextMessage: {
          contextInfo: { mentionedJid: options.mentioned || [] }
        }
      }
    },
    reply: async (text, opts = {}) => {
      sent.push({ text, opts });
      return { key: {} };
    },
    send: async (payload) => { sent.push({ payload }); },
    react: async () => {}
  };
  return ctx;
}

async function run(name, options = {}) {
  const ctx = makeCtx(options);
  await findCommand(name).run(ctx);
  return ctx;
}

test('economia: comprar item debita moedas e atualiza inventário', async () => {
  const ctx = await run('comprar', { args: ['pocao'] });
  assert.equal(ctx.store.user(ctx.sender).inventory.pocao, 1);
  assert.equal(ctx.store.user(ctx.sender).coins, 50);
  assert.match(ctx.sent[0].text, /Poção de cura|adicionado/);
});

test('economia: daily entrega moedas e marca resgate', async () => {
  const ctx = await run('daily');
  assert.ok(ctx.store.user(ctx.sender).coins > 100);
  assert.ok(ctx.store.user(ctx.sender).lastDaily > 0);
});

test('economia: apostar valida valor e saldo', async () => {
  const ctx = await run('apostar', { args: ['50', 'cara'] });
  assert.match(ctx.sent[0].text, /moeda caiu/);
});

test('rpg: criar personagem e batalhar', async () => {
  let ctx = await run('rpg', { args: ['mago'] });
  assert.equal(ctx.store.user(ctx.sender).rpg.class, 'mago');
  ctx = await run('batalha', { store: ctx.store });
  const session = ctx.store.sessions.get(`${ctx.jid}:${ctx.sender}:rpg`);
  assert.ok(session);
  session.enemy.hp = 1;
  ctx = await run('atacar', { store: ctx.store });
  assert.match(ctx.sent[0].text, /derrotou| moedas/);
  assert.equal(ctx.store.user(ctx.sender).rpg.wins, 1);
});

test('novos jogos: truco e xadrez', async () => {
  let ctx = await run('truco', { store: makeStore() });
  assert.match(ctx.sent[0].text, /suas cartas/);
  ctx = await run('truco', { store: ctx.store, args: ['1'] });
  assert.match(ctx.sent[0].text, /Placar/);

  ctx = await run('xadrez', { store: makeStore() });
  assert.match(ctx.sent[0].text, /Xadrez/);
  ctx = await run('xadrez', { store: ctx.store, args: ['e2e4'] });
  assert.match(ctx.sent[0].text, /Você jogou e2e4/);
});

test('novos jogos: bingo e caça ao tesouro', async () => {
  let ctx = await run('bingo', { store: makeStore() });
  assert.match(ctx.sent[0].text, /Bingo iniciado/);
  ctx = await run('bingo', { store: ctx.store });
  assert.match(ctx.sent[0].text, /Número sorteado/);

  const store = makeStore();
  ctx = await run('tesouro', { store });
  assert.match(ctx.sent[0].text, /Caça ao tesouro iniciada/);
  const key = `${ctx.jid}:tesouro`;
  store.getSession(key).secret = 42;
  ctx = await run('tesouro', { store, args: ['42'] });
  assert.match(ctx.sent[0].text, /encontrou o tesouro/);
});

test('novos jogos: quem é mais com votação', async () => {
  const mentioned = ['5511111111111@s.whatsapp.net', '5522222222222@s.whatsapp.net'];
  let ctx = await run('quememais', {
    store: makeStore(),
    mentioned,
    text: 'Quem é mais engraçado?',
    args: []
  });
  assert.match(ctx.sent[0].text, /Quem é mais/);
  ctx = await run('quememais', { store: ctx.store, mentioned, args: ['1'], sender: '5533333333333@s.whatsapp.net' });
  assert.match(ctx.sent[0].text, /Voto registrado/);
  ctx = await run('quememais', { store: ctx.store, mentioned, args: ['resultado'] });
  assert.match(ctx.sent[0].text, /Resultado/);
});

test('mídia: comandos registrados e ajuda os lista', async () => {
  const ctx = await run('ajuda', { text: 'tudo' });
  assert.match(ctx.sent[0].text, /figurinhaanimada/);
  assert.match(ctx.sent[0].text, /𝐄𝐂𝐎𝐍𝐎𝐌𝐈𝐀/);
  assert.match(ctx.sent[0].text, /𝐑𝐏𝐆/);
});
