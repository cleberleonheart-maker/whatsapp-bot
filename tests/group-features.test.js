import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { commands, findCommand } from '../src/commands/index.js';
import { matchesBadWord } from '../src/utils.js';

const JID = '120363000000000002@g.us';
const SENDER = '5511999999999@s.whatsapp.net';
const OTHER = '5511888888888@s.whatsapp.net';

function tempStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brincabot-grupo-'));
  return { store: new Store(directory), directory };
}

function makeCtx(store, overrides = {}) {
  const sent = [];
  const ctx = {
    store,
    sent,
    commands,
    config: { botName: 'BrincaBot', timezone: 'America/Sao_Paulo' },
    jid: JID,
    sender: SENDER,
    isGroup: true,
    isAdmin: true,
    isOwner: false,
    prefix: '!',
    args: [],
    text: '',
    msg: { key: { remoteJid: JID, participant: SENDER }, message: {} },
    sock: {},
    reply: async (text, options = {}) => {
      sent.push({ text, options });
      return { key: { id: 'mock' } };
    },
    react: async () => {}
  };
  return Object.assign(ctx, overrides);
}

test('novos comandos registrados e aliases normalizados', () => {
  for (const name of ['advertencias', 'regras', 'palavrao', 'infogrupo']) {
    assert.ok(findCommand(name), `${name} deve existir`);
  }
  assert.equal(findCommand('palavroes'), findCommand('palavrao'));
  assert.equal(findCommand('jokempô'), findCommand('ppt'));
  assert.equal(findCommand('JOKEMPO'), findCommand('ppt'));
});

test('regras: admin adiciona/lista/remove e membro não edita', async () => {
  const { store, directory } = tempStore();
  try {
    await findCommand('regras').run(makeCtx(store, { args: ['add', 'Respeite', 'todos'], text: 'add Respeite todos' }));
    await findCommand('regras').run(makeCtx(store, { args: ['add', 'Sem', 'spam'], text: 'add Sem spam' }));
    assert.deepEqual(store.group(JID).rules, ['Respeite todos', 'Sem spam']);

    const listCtx = makeCtx(store);
    await findCommand('regras').run(listCtx);
    assert.match(listCtx.sent[0].text, /1\. Respeite todos/);
    assert.match(listCtx.sent[0].text, /2\. Sem spam/);

    const denied = makeCtx(store, { isAdmin: false, args: ['add', 'Teste'], text: 'add Teste' });
    await findCommand('regras').run(denied);
    assert.match(denied.sent[0].text, /Apenas administradores/);

    await findCommand('regras').run(makeCtx(store, { args: ['del', '1'], text: 'del 1' }));
    assert.deepEqual(store.group(JID).rules, ['Sem spam']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('advertencias: admin vê todas e membro vê apenas a própria', async () => {
  const { store, directory } = tempStore();
  try {
    const group = store.group(JID);
    group.warnings = { [SENDER]: 2, [OTHER]: 1 };

    const adminCtx = makeCtx(store);
    await findCommand('advertencias').run(adminCtx);
    assert.match(adminCtx.sent[0].text, /Advertências do grupo/);
    assert.match(adminCtx.sent[0].text, /2/);

    const memberCtx = makeCtx(store, { sender: OTHER, isAdmin: false });
    await findCommand('advertencias').run(memberCtx);
    assert.match(memberCtx.sent[0].text, /Você tem 1 advertência/);
    assert.doesNotMatch(memberCtx.sent[0].text, /5511999999999/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('palavrao: adicionar, listar e remover palavra personalizada', async () => {
  const { store, directory } = tempStore();
  try {
    await findCommand('palavrao').run(makeCtx(store, { args: ['add', 'besteira'], text: 'add besteira' }));
    assert.deepEqual(store.group(JID).customBadWords, ['besteira']);

    const listCtx = makeCtx(store);
    await findCommand('palavrao').run(listCtx);
    assert.match(listCtx.sent[0].text, /besteira/);

    await findCommand('palavrao').run(makeCtx(store, { args: ['del', 'besteira'], text: 'del besteira' }));
    assert.deepEqual(store.group(JID).customBadWords, []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('palavrao: filtro usa palavras personalizadas com caracteres especiais', () => {
  assert.equal(matchesBadWord({ customBadWords: ['besteira (aí)'] }, 'Isso é besteira (aí)!'), true);
  assert.equal(matchesBadWord({ customBadWords: ['besteira'] }, 'BESTEIRA'), true);
  assert.equal(matchesBadWord({ customBadWords: ['besteira'] }, 'sem nada'), false);
});

test('infogrupo: mostra dados da metadata do grupo', async () => {
  const { store, directory } = tempStore();
  try {
    const metadata = {
      subject: 'Grupo de Teste',
      desc: 'Descrição do grupo',
      owner: SENDER,
      creation: 1700000000,
      participants: [
        { id: SENDER, admin: 'admin' },
        { id: OTHER }
      ]
    };
    const ctx = makeCtx(store, { sock: { groupMetadata: async () => metadata } });
    await findCommand('infogrupo').run(ctx);
    assert.match(ctx.sent[0].text, /Grupo de Teste/);
    assert.match(ctx.sent[0].text, /Descrição do grupo/);
    assert.match(ctx.sent[0].text, /Participantes: 2/);
    assert.equal(ctx.sent[0].options.mentions.length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
