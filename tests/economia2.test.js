import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { findCommand, commands } from '../src/commands/index.js';

const SENDER = '5511999999999@s.whatsapp.net';

function tempStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brincabot-economia2-'));
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

test('economia 2.0: comandos registrados', () => {
  for (const name of ['banco', 'depositar', 'sacar', 'trabalho', 'investir', 'imposto']) {
    assert.ok(findCommand(name), `comando ${name} não registrado`);
    assert.equal(findCommand(name).category, 'Economia');
  }
});

test('banco: depositar e sacar movimentam carteira e banco', async () => {
  const { store, directory } = tempStore();
  try {
    store.addCoins(SENDER, 200);
    let ctx = makeCtx(store, ['100']);
    await findCommand('depositar').run(ctx);
    assert.equal(store.user(SENDER).coins, 100);
    assert.equal(store.user(SENDER).bank, 100);
    assert.match(ctx.sent[0].text, /depositou/);

    ctx = makeCtx(store, ['40']);
    await findCommand('sacar').run(ctx);
    assert.equal(store.user(SENDER).coins, 140);
    assert.equal(store.user(SENDER).bank, 60);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('trabalho: paga moedas, gera imposto e respeita cooldown', async () => {
  const { store, directory } = tempStore();
  try {
    let ctx = makeCtx(store);
    await findCommand('trabalho').run(ctx);
    const user = store.user(SENDER);
    assert.equal(user.jobs, 1);
    assert.ok(user.coins > 0);
    assert.ok(user.taxDebt > 0);
    assert.match(ctx.sent[0].text, /trabalhou como/);

    ctx = makeCtx(store);
    await findCommand('trabalho').run(ctx);
    assert.equal(user.jobs, 1);
    assert.match(ctx.sent[0].text, /descansar/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('investir: debeta valor e registra investimento', async () => {
  const { store, directory } = tempStore();
  const originalRandom = Math.random;
  Math.random = () => 0.99;
  try {
    store.addCoins(SENDER, 100);
    const ctx = makeCtx(store, ['50']);
    await findCommand('investir').run(ctx);
    assert.equal(store.user(SENDER).investments, 1);
    assert.notEqual(store.user(SENDER).coins, 100);
    assert.match(ctx.sent[0].text, /Investimento/);
  } finally {
    Math.random = originalRandom;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('imposto: pagar quita dívida e conta pagamento', async () => {
  const { store, directory } = tempStore();
  try {
    store.addCoins(SENDER, 100);
    store.addTaxDebt(SENDER, 30);
    const ctx = makeCtx(store, ['pagar']);
    await findCommand('imposto').run(ctx);
    const user = store.user(SENDER);
    assert.equal(user.taxDebt, 0);
    assert.equal(user.taxesPaid, 1);
    assert.equal(user.coins, 70);
    assert.match(ctx.sent[0].text, /pago/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('missões: resgatar.item específico após trabalhar', async () => {
  const { store, directory } = tempStore();
  try {
    await findCommand('missoes').run(makeCtx(store));
    await findCommand('trabalho').run(makeCtx(store));
    const before = store.user(SENDER).coins;
    const ctx = makeCtx(store, ['resgatar', 'trabalhos']);
    await findCommand('missoes').run(ctx);
    assert.deepEqual(store.user(SENDER).missions.claimed, ['trabalhos']);
    assert.equal(store.user(SENDER).coins, before + 50);
    assert.match(ctx.sent[0].text, /resgatou 1 missão/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
