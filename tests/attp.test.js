import test from 'node:test';
import assert from 'node:assert/strict';
import { findCommand } from '../src/commands/index.js';
import { buildAttpLines, attpFontSize, buildAttpFilter } from '../src/commands/midia.js';

test('attp registrado na categoria Mídia com aliases', () => {
  const command = findCommand('attp');
  assert.ok(command);
  assert.equal(command.category, 'Mídia');
  assert.ok(command.aliases.includes('textoanimado'));
  assert.match(command.usage, /!attp/);
});

test('attp exige texto', async () => {
  const sent = [];
  const ctx = {
    prefix: '!', text: '', jid: 'jid', msg: { key: {} },
    sock: { sendMessage: async () => {} },
    reply: async (text) => { sent.push(text); }
  };
  await findCommand('attp').run(ctx);
  assert.match(sent[0], /!attp Seu texto/);
});

test('attp quebra texto em linhas e limita tamanho', () => {
  assert.deepEqual(buildAttpLines('  oi   tudo  bem '), ['oi tudo bem']);
  assert.deepEqual(buildAttpLines(''), []);

  const lines = buildAttpLines(`${'a'.repeat(14)} ${'b'.repeat(20)} ccc`);
  assert.equal(lines[0], 'a'.repeat(14));
  assert.equal(lines[1], 'b'.repeat(14));
  assert.equal(lines[2], 'bbbbbb ccc');

  const many = buildAttpLines(Array.from({ length: 8 }, () => 'abcdefghijklmno').join(' '));
  assert.equal(many.length, 5);
  assert.match(many[4], /…$/);
});

test('attp ajusta fonte e monta filtro com cores alternadas', () => {
  assert.equal(attpFontSize(['oi']), 96);
  assert.equal(attpFontSize(['abcdefghij']), 78);
  assert.equal(attpFontSize(['abcdefghijklmn']), 62);
  assert.equal(attpFontSize(['abcdefghijklmno']), 48);

  const filter = buildAttpFilter(['oi'], '/tmp/texto.txt');
  assert.match(filter, /fontcolor=0xFF3366/);
  assert.match(filter, /fontcolor=0xFF7A00/);
  assert.ok(filter.includes("enable='eq(mod(floor(t*6)\\,6)\\,5)'"));
  assert.match(filter, /format=rgba$/);
});
