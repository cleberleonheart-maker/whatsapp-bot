import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { config } from '../src/config.js';

test('branding: nome e logo da Fênix configurados', () => {
  assert.equal(config.botName, 'Fênix');
  assert.ok(fs.existsSync(config.botLogo));
  assert.match(config.botDescription, /Fênix/);
});
