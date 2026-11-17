import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { commands, findCommand } from '../src/commands/index.js';
import { EVENTS, weekState } from '../src/commands/eventos.js';
import { weekInfo } from '../src/utils.js';

const SENDER = '5511999999999@s.whatsapp.net';

function tempStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brincabot-eventos-'));
  return { store: new Store(directory), directory };
}

function makeCtx(store, args = []) {
  const sent = [];
  return {
    store, sent, registry: commands, args, text: args.join(' '), prefix: '!',
    config: { timezone: 'America/Sao_Paulo', botName: 'BrincaBot' },
    jid: '120363000000000001@g.us', sender: SENDER,
    msg: { key: { remoteJid: '120363000000000001@g.us', participant: SENDER }, message: {} },
    reply: async (text) => { sent.push({ text }); return { key: {} }; },
    react: async () => {}
  };
}

test('eventos: comandos registrados na categoria Eventos', () => {
  for (const name of ['evento', 'economiarank']) {
    assert.ok(findCommand(name), `comando ${name} não registrado`);
    assert.equal(findCommand(name).category, 'Eventos');
  }
});

test('eventos: semana rotaciona entre os eventos', () => {
  const monday = new Date('2026-11-16T12:00:00Z');
  const state = weekState(monday);
  const info = weekInfo(monday);
  assert.equal(state.key, info.key);
  assert.equal(state.event, EVENTS[info.week % EVENTS.length]);
  assert.equal(state.nextEvent, EVENTS[(info.week + 1) % EVENTS.length]);
});

test('eventos: estado zera quando a semana muda', () => {
  const { store, directory } = tempStore();
  try {
    store.trackEvent('trabalho', 5);
    assert.equal(store.eventState().counters.trabalho, 5);
    store.events.week = '2000-W01';
    const next = store.eventState();
    assert.equal(next.week, weekInfo().key);
    assert.deepEqual(next.counters, {});
    assert.deepEqual(next.claimed, []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('eventos: ganho de moedas e trabalho alimentam contadores', async () => {
  const { store, directory } = tempStore();
  try {
    store.addCoins(SENDER, 100);
    assert.equal(store.eventState().counters.economia, 100);
    await findCommand('trabalho').run(makeCtx(store));
    assert.equal(store.eventState().counters.trabalho, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('eventos: resgate exige meta e dá bônus de ranking', async () => {
  const { store, directory } = tempStore();
  try {
    const { event } = weekState();
    let ctx = makeCtx(store, ['resgatar']);
    await findCommand('evento').run(ctx);
    assert.match(ctx.sent[0].text, /faltam/);

    store.trackEvent(event.id, event.goal);
    ctx = makeCtx(store, ['resgatar']);
    await findCommand('evento').run(ctx);
    const user = store.user(SENDER);
    const expected = Math.floor(event.reward * 1.5);
    assert.equal(user.coins, expected);
    assert.equal(user.xp, 40);
    assert.deepEqual(store.eventState().claimed, [SENDER]);
    assert.match(ctx.sent[0].text, /Evento concluído/);

    ctx = makeCtx(store, ['resgatar']);
    await findCommand('evento').run(ctx);
    assert.match(ctx.sent[0].text, /já resgatou/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('economiarank: ordena patrimônio e considera imposto', () => {
  const { store, directory } = tempStore();
  try {
    store.user(SENDER).coins = 100;
    store.user(SENDER).bank = 50;
    store.user(SENDER).taxDebt = 30;
    const other = '5511888888888@s.whatsapp.net';
    store.user(other).coins = 140;
    const ranking = store.economyRanking();
    assert.equal(ranking[0].jid, other);
    assert.equal(ranking[1].jid, SENDER);
    assert.equal(ranking[1].total, 120);
    assert.equal(store.economyPosition(SENDER), 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
