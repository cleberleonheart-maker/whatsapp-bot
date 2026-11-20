import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { config } from '../src/config.js';
import { appendSignature } from '../src/utils.js';

test('branding: nome, logo e assinatura da Fênix configurados', () => {
  assert.equal(config.botName, 'Fênix');
  assert.ok(fs.existsSync(config.botLogo));
  assert.ok(fs.existsSync('assets/fenix-assinatura.png'));
  assert.match(config.botDescription, /Fênix/);
  assert.equal(config.botSignature, '— 🔥 *Fênix* — piadas, jogos e utilidades');
  assert.match(config.version, /^1\.0\.\d+$/);
});

test('appendSignature adiciona a assinatura sem duplicar', () => {
  const signed = appendSignature('Oi', config.botSignature);
  assert.match(signed, /Oi\n\n— 🔥 \*Fênix\*/);
  assert.equal(appendSignature(signed, config.botSignature), signed);
  assert.equal(appendSignature('Oi', ''), 'Oi');
});
