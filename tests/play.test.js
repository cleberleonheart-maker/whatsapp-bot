import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, findCommand } from '../src/commands/index.js';
import { resolveTarget, resolveYtDlp } from '../src/commands/play.js';

test('play: comandos e aliases registrados', () => {
  assert.ok(commands.length >= 83);
  for (const name of ['play', 'tomp3', 'musica', 'yt', 'playvid', 'ytv', 'video']) {
    assert.ok(findCommand(name), `comando ${name} não registrado`);
  }
  assert.equal(findCommand('play').category, 'Mídia');
  assert.equal(findCommand('playvid').category, 'Mídia');
});

test('play: resolve alvo de busca e URL', () => {
  assert.equal(resolveTarget('gatos fofos'), 'ytsearch1:gatos fofos');
  assert.equal(resolveTarget('https://youtu.be/abc123'), 'https://youtu.be/abc123');
  assert.equal(resolveTarget('   '), null);
});

test('play: resolve binário yt-dlp', () => {
  const bin = resolveYtDlp();
  assert.match(bin, /(^|\/)yt-dlp$/);
});

test('play: exige consulta', async () => {
  let reply = '';
  const ctx = { text: '   ', prefix: '!', reply: async (text) => { reply = text; } };
  await findCommand('play').run(ctx);
  assert.match(reply, /Use:.*play/);

  reply = '';
  await findCommand('playvid').run(ctx);
  assert.match(reply, /Use:.*playvid/);
});
